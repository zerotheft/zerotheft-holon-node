/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const IORedis = require('ioredis')
const fs = require('fs')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { pathsByNation, getUmbrellaPaths } = require('zerotheft-node-utils').paths

const { getProposalContract, getVoteContract } = require('zerotheft-node-utils/utils/contract')
const { exportsDir, createAndWrite, cacheDir } = require('../../common')
const {
  manipulatePaths,
  getHierarchyTotals,
  doPathRollUpsForYear,
  parentVotedYearTheftsRollups,
} = require('../../services/calcEngineServices/calcLogic')
const { cacheServer } = require('../../services/redisService')
const { createLog, MAIN_PATH, CRON_PATH } = require('../../services/LogInfoServices')
const { lastExportedVid } = require('../../services/engineDataServices/utils')

const connection = new IORedis()
const scanData = new Queue('ScanData', { connection })
const allYearData = new Queue('AllYearDataQueue', { connection })
const allYearDataScheduler = new QueueScheduler('AllYearDataQueue', { connection })

/**
 * This worker loops through all  the year and scan them individually by calling another worker
 */
const allYearDataWorker = new Worker(
  'AllYearDataQueue',
  async job => {
    if (job.data.reSync) {
      // if its from cron
      createLog(CRON_PATH, `Cron job started for data re-sync and full report`)
      // Reset voting exports
      fs.unlinkSync(`${exportsDir}/.last_exported_vid`)
      // Reset voters exports
      fs.unlinkSync(`${exportsDir}/.last_exported_uid`)

      cacheServer.del('VOTES_EXPORT_INPROGRESS')
      cacheServer.del('VOTERS_EXPORT_INPROGRESS')

      cacheServer.del('SYNC_INPROGRESS')
      cacheServer.del('FULL_REPORT')
      cacheServer.del('CALC_SUMMARY_SYNCED')
      cacheServer.del('REPORTS_INPROGRESS')
      cacheServer.set('DATA_RESYNC', true)
    }
  },
  { connection }
)

/**
 * This worker data scanning for specific year
 */
const scanDataWorker = new Worker(
  'ScanData',
  async job => {
    try {
      const { nation } = job.data
      console.log(`Caching initiated`)
      createLog(MAIN_PATH, `Caching initiated`)

      cacheServer.set('SYNC_INPROGRESS', true)

      const nationPaths = await pathsByNation(nation)
      const proposalContract = getProposalContract()
      const voterContract = getVoteContract()
      const umbrellaInfo = await getUmbrellaPaths() // get all umbrella paths and return array of umbrella paths
      /*
       *umbrellaPaths=["macroeconomics","workers","industries/finance","economic_crisis/2008_mortgage","industries/healthcare/pharma"]
       */
      const umbrellaPaths = Object.keys(umbrellaInfo).map(x => `${nation}/${x}`)
      const { proposals, votes } = await manipulatePaths(
        nationPaths.USA,
        proposalContract,
        voterContract,
        nation,
        {},
        umbrellaPaths,
        []
      )
      console.log('GHT', proposals.length, votes.length)

      const hierarchyData = await getHierarchyTotals(umbrellaPaths, proposals, votes, nationPaths)
      if (hierarchyData) {
        console.log('DPRFY')
        doPathRollUpsForYear(hierarchyData, umbrellaInfo, nationPaths)

        console.log('PVYTR')
        parentVotedYearTheftsRollups(hierarchyData, umbrellaInfo)
        // check if its valid before caching
        // let isCached = fs.existsSync(`${exportsDir}/calc_data/${nation}/${year}.json`)
        // only if there is no cached data and if total theft is not zero
        // if ((hierarchyData['_totals']['theft'] === 0 && hierarchyData['_totals']['against'] > hierarchyData['_totals']['for']) ||
        //     (!isCached && proposals.length === 0 && votes.length === 0 && hierarchyData['_totals']['theft'] === 0) ||
        //     hierarchyData['_totals']['theft'] !== 0
        // ) {
        cacheServer.set(nation, JSON.stringify(hierarchyData)) // this will save hierarchyData in redis-cache
        // Save hierarchyData in files
        const hierarchyDataDir = `${cacheDir}/calc_data/${nation}/`
        // export full data with proposals
        await createAndWrite(hierarchyDataDir, 'calc_summary.json', hierarchyData)

        // JSON with proposals data is huge so removing proposals from every path and then export it seperately
        Object.keys(hierarchyData.paths).forEach(path => {
          delete hierarchyData.paths[path].props
        })
        await createAndWrite(`${exportsDir}/calc_data/${nation}`, 'calc_summary.json', hierarchyData)
        // }
      }
    } catch (e) {
      console.log('ScanDataWoker', e)
      throw e
    }
  },
  { connection }
)

// raise flag when scanning and saving is completed
scanDataWorker.on(
  'completed',
  async () => {
    cacheServer.set('CALC_SUMMARY_SYNCED', true)
    cacheServer.del('SYNC_INPROGRESS')
    cacheServer.del('DATA_RESYNC')
    cacheServer.del('DATA_RESYNC_FAILED')

    console.log(`Caching completed.`)
    createLog(MAIN_PATH, `Caching completed.`)
  },
  { connection }
)

// raise flag when scanning and saving failed
scanDataWorker.on(
  'failed',
  async () => {
    cacheServer.del('SYNC_INPROGRESS')
    cacheServer.set('DATA_RESYNC_FAILED', new Date())
    cacheServer.del('DATA_RESYNC')
    console.log(`Caching failed.`)
    createLog(MAIN_PATH, `Caching failed.`)
  },
  { connection }
)

/**
 * @dev Scans every  proposals and votes from all the economic hierarchy paths.
 * Manipulates and do all the processing required for the report generation and save data in cache.
 * @param {string} nation
 * @param {int} year
 * @returns JSON with success or failure
 */
const dataCachingPerPath = async nation => {
  try {
    const syncProgressYear = await cacheServer.getAsync('SYNC_INPROGRESS')
    const isVotesExporting = await cacheServer.getAsync(`VOTES_EXPORT_INPROGRESS`)
    const cachedVid = await lastExportedVid()

    if (!syncProgressYear && !isVotesExporting && cachedVid > 0) {
      scanData.add('saveDatainCache', { nation }, { removeOnComplete: true, removeOnFail: true })
      return { message: `caching initiated. Please wait...` }
    }
    return { message: `Process ongoing. Status: ${!!syncProgressYear} vote export: ${!!isVotesExporting}` }
  } catch (e) {
    console.log('dataCachingPerPath', e)
    createLog(MAIN_PATH, `dataCachingPerPath:: ${e}`)

    throw e
  }
}
/**
 * @dev Saves all year's data in cache
 * @returns JSON with success or failure
 */
const allDataCache = async () => {
  try {
    allYearData.add(
      'allYearDataCachingCron',
      { nation: 'USA', reSync: true },
      { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 */4 * * *' } }
    ) // executes every 4 hrs
  } catch (e) {
    console.log('allDataCache', e)
    throw e
  }
}
/**
 * Immediately run the all data resyncing and recaching
 */
const allDataCacheImmediate = async () => {
  try {
    allYearData.add(
      'allYearDataCaching',
      { nation: 'USA', reSync: true },
      { removeOnComplete: true, removeOnFail: true }
    ) // executes immediately
  } catch (e) {
    console.log(`allDataCacheImmediate Error:: ${e}`)
    throw e
  }
}

module.exports = {
  dataCachingPerPath,
  allDataCache,
  allDataCacheImmediate,
  allYearData,
}
