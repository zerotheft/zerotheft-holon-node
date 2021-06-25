const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { singleYearCaching } = require('./reports/dataCacheWorker')
const { exportDataQueue } = require('./exportDataWorker')
const { allReportWorker } = require('./reports/reportWorker')
const { cacheServer } = require('../services/redisService')
const { createLog, WATCHER_LOG_PATH } = require('../services/LogInfoServices')
const { lastExportedUid, lastExportedPid, lastExportedVid } = require('../services/engineDataServices/utils')
const { calculatePastYearThefts } = require('../services/calcEngineServices/calcLogic')
const { defaultPropYear, firstPropYear } = require('../services/calcEngineServices/helper')

const connection = new IORedis()

const watcherQueueScheduler = new QueueScheduler('WatcherQueue', { connection })
const watcherQueue = new Queue('WatcherQueue', { connection })

const watcherWorker = new Worker('WatcherQueue', async job => {
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    console.log('*****HEARTBEAT Report*****')

    const isSyncing = await cacheServer.getAsync(`SYNC_INPROGRESS`)
    const isGeneratingReports = await cacheServer.getAsync(`REPORTS_INPROGRESS`)
    const isFullReport = await cacheServer.getAsync(`FULL_REPORT`)
    // const isDatainCache = await cacheServer.getAsync(`PATH_SYNCHRONIZED`)
    // const pastThefts = await cacheServer.hgetallAsync(`PAST_THEFTS`)
    const isDatainCache = await cacheServer.getAsync(`CALC_SUMMARY_SYNCED`)
    const cachedUid = await lastExportedUid()
    const cachedPid = await lastExportedPid()
    const cachedVid = await lastExportedVid()
    const isProposalExporting = await cacheServer.getAsync(`PROPOSALS_EXPORT_INPROGRESS`)
    const isVotersExporting = await cacheServer.getAsync(`VOTERS_EXPORT_INPROGRESS`)
    const isVotesExporting = await cacheServer.getAsync(`VOTES_EXPORT_INPROGRESS`)

    console.log(`1. Caching in progress(SYNC_INPROGRESS): ${!!isSyncing}`)
    console.log(`2. Reports in progress(REPORTS_INPROGRESS): ${!!isGeneratingReports}`)
    console.log(`3. Full report(FULL_REPORT): ${!!isFullReport}`)
    console.log(`4. Data in cache(CALC_SUMMARY_SYNCED): ${!!isDatainCache}`)
    // console.log(`5. Past year thefts(PAST_THEFTS): ${!!pastThefts}`)
    console.log(`6. Last User ID Exported: ${cachedUid}`)
    console.log(`7. User Export in progress(VOTERS_EXPORT_INPROGRESS): ${!!isVotersExporting}`)
    console.log(`8. Last Proposal ID Exported: ${cachedPid}`)
    console.log(`9. Proposal Export in progress(PROPOSALS_EXPORT_INPROGRESS): ${!!isProposalExporting}`)
    console.log(`10. Last Vote ID Exported: ${cachedVid}`)
    console.log(`11. Vote Export in progress(VOTES_EXPORT_INPROGRESS): ${!!isVotesExporting}`)

    const isNotExporting = (!isVotesExporting && !isVotersExporting && !isProposalExporting)
    /**
    * If no vote data exported
    * Initiate vote data exports
    */
    if (cachedVid === 0 && !isVotesExporting) {
      console.log('Vote Export data missing. Inititated....')
      createLog(WATCHER_LOG_PATH, 'Vote Export data missing. Inititated....')
      exportDataQueue.add('votesExport', {}, { removeOnComplete: true, removeOnFail: true })
    }

    /**
   * If no voters data exported
   * Initiate voters data exports
   */
    if (cachedUid === 0 && !isVotersExporting) {
      console.log('Voters Export data missing. Inititated....')
      createLog(WATCHER_LOG_PATH, 'Voters Export data missing. Inititated....')
      exportDataQueue.add('votersExport', {}, { removeOnComplete: true, removeOnFail: true })
    }
    /**
 * If no proposal data exported
 * Initiate proposal data exports
 */
    if (cachedPid === 0 && !isProposalExporting) {
      console.log('Proposal Export data missing. Inititated....')
      createLog(WATCHER_LOG_PATH, 'Proposal Export data missing. Inititated....')
      exportDataQueue.add('proposalsExport', {}, { removeOnComplete: true, removeOnFail: true })
    }
    /**
     * If no data in cache and no sync in progress
     * Initiate data caching
     */
    if (!isSyncing && cachedVid > 0 && !isVotesExporting && !isDatainCache) {
      await singleYearCaching(job.data.nation)
    }
    /**
    * If sync is complete and no past year thefts collected
    * calculate past year thefts
    */
    // if (isDatainCache && !isSyncing && !pastThefts) {
    //   console.log('Past year thefts missing. Initiated...')
    //   // when all year data got sycned get past year thefts
    //   // await calculatePastYearThefts()
    // }
    /**
     * If sync is complete and full report is not present.
     * Initiate full report
     */
    if (!isSyncing && !isFullReport && isDatainCache && !isGeneratingReports && isNotExporting) {
      console.log('Full reports missing. Inititated....')
      allReportWorker()
    } else if (isGeneratingReports) {
      console.log('Reports in progress!!')
    }

    console.log('*****HEARTBEAT Report*****')

    // Print heatbeat in log file
    let logContent = `***HEARTBEAT***\nCaching in progress(SYNC_INPROGRESS): ${!!isSyncing}(${isSyncing})\nReports in progress(REPORTS_INPROGRESS): ${!!isGeneratingReports}\nFull report(FULL_REPORT): ${!!isFullReport}\nData in cache(CALC_SUMMARY_SYNCED): ${!!isDatainCache}\nLast User ID Exported: ${cachedUid}\nUser Export in progress(VOTERS_EXPORT_INPROGRESS): ${!!isVotersExporting}\nLast Proposal ID Exported: ${cachedPid}\nProposal Export in progress(PROPOSALS_EXPORT_INPROGRESS): ${!!isProposalExporting}\nLast Vote ID Exported: ${cachedVid}\n Vote Export in progress(VOTES_EXPORT_INPROGRESS): ${!!isVotesExporting}\nser ID Exported: ${cachedUid}\nLast Proposal ID Exported: ${cachedPid}\nLast Vote ID Exported: ${cachedVid}\n`
    createLog(WATCHER_LOG_PATH, logContent)

  } catch (e) {
    console.log("watcherWorker ", e)
    createLog(WATCHER_LOG_PATH, `watcherWorker ${e}`)
    throw e
  }
}, { connection })



// after worker finishes job
watcherWorker.on("completed", async (job, returnvalue) => {

}, { connection });


// after worker failed
watcherWorker.on("failed", async (job, returnvalue) => {

}, { connection });



/**
 * Its like heartbeat which actually monitors all the background jobs and also performs required operations
 */
const watcherInit = async () => {
  try {
    watcherQueue.add('heartbeat', { nation: "USA" }, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '* * * * *' } })
  } catch (e) {
    console.log('watcherWorker', e)
    createLog(WATCHER_LOG_PATH, `watcherWorker ${e}`)
    throw e
  }


}

module.exports = {
  watcherInit
}
