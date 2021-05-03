const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { pathsByNation } = require('zerotheft-node-utils').paths
const { getUmbrellaPaths } = require('zerotheft-node-utils/utils/github')

const { getProposalContract, getVoterContract } = require('zerotheft-node-utils/utils/contract')
const { manipulatePaths, getHierarchyTotals, doPathRollUpsForYear } = require('../../services/calcEngineServices/calcLogic')
const { cacheServer } = require('../../services/redisService')
const { PUBLIC_PATH, createDir, writeFile } = require('../../common')
const { defaultPropYear, firstPropYear } = require('../../services/calcEngineServices/constants')
const { createLog, MAIN_PATH, CRON_PATH } = require('../../services/LogInfoServices')

const connection = new IORedis()
const scanData = new Queue('ScanData', { connection })
const allYearData = new Queue('AllYearDataQueue', { connection })
const allYearDataScheduler = new QueueScheduler('AllYearDataQueue', { connection })

/**
 * This worker loops through all  the year and scan them individually by calling another worker
 */
const allYearDataWorker = new Worker('AllYearDataQueue', async job => {
    if (!!job.data.reSync) { //if its from cron
        createLog(CRON_PATH, `Cron job started for data re-sync and full report`)
        cacheServer.del('FULL_REPORT')
        cacheServer.del('REPORTS_INPROGRESS')
    }
    for (let year = firstPropYear; year <= defaultPropYear; year++) {
        const isYearSynced = await cacheServer.getAsync(`YEAR_${year}_SYNCED`)
        if (!isYearSynced || !!job.data.reSync)
            await singleYearCaching(job.data.nation, year)
    }
}, { connection })

// generate report if all path year data cached
// allYearDataWorker.on("completed", async (job, returnvalue) => {
//     const isDataCached = await cacheServer.getAsync(`PATH_SYNCHRONIZED`)
//     const isSyncing = await cacheServer.getAsync(`SYNC_INPROGRESS`)
//     const isFullReport = await cacheServer.getAsync(`FULL_REPORT`)
//     if (isDataCached && !isSyncing && (!isFullReport || !!job.data.reSync)) {
//         createLog(FULL_REPORT_PATH, `report generation including full report initiated`)
//         reportQueue.add('pathReports', {}, { removeOnComplete: true, removeOnFail: true })
//     }
// }, { connection });
/**
 * This worker data scanning for specific year
 */
const scanDataWorker = new Worker('ScanData', async job => {
    try {
        const year = job.data.year
        const nation = job.data.nation
        console.log(`Caching initiated for year ${year}`)
        createLog(MAIN_PATH, `Caching initiated for year ${year}`)

        cacheServer.set('SYNC_INPROGRESS', year)

        const nationPaths = await pathsByNation(nation)
        const proposalContract = getProposalContract()
        const voterContract = getVoterContract()
        let umbrellaPaths = await getUmbrellaPaths()// get all umbrella paths and return array of umbrella paths
        /*
        *umbrellaPaths=["macroeconomics","workers","industries/finance","economic_crisis/2008_mortgage","industries/healthcare/pharma"]
        */
        umbrellaPaths = umbrellaPaths.map(x => `${nation}/${x}`)
        const { proposals, votes } = await manipulatePaths(nationPaths.USA, proposalContract, voterContract, nation, {}, umbrellaPaths, [], year)
        console.log('GHT', year, proposals.length, votes.length)
        const mainVal = await getHierarchyTotals(proposals, votes, nationPaths)
        if (mainVal) {
            let yearData = mainVal[`${year}`]
            console.log('DPRFY', year)
            doPathRollUpsForYear(yearData, umbrellaPaths, nationPaths)
            console.log('SC', year)
            cacheServer.hmset(`${year}`, nation, JSON.stringify(yearData)) //this will save yearData in redis-cache

            // Save yearData in files
            console.log('SF', year)
            const yearDataDir = `${PUBLIC_PATH}/reports/cached_year_data/${nation}/`
            await createDir(yearDataDir)
            await writeFile(`${yearDataDir}/${year}.json`, yearData)

        }
        cacheServer.set(`YEAR_${year}_SYNCED`, true)
    } catch (e) {
        console.log("ScanDataWoker", e)
        throw e
    }
}, { connection })

// raise flag when scanning and saving is completed
scanDataWorker.on("completed", async (job, returnvalue) => {
    cacheServer.set('PATH_SYNCHRONIZED', true)
    cacheServer.del('SYNC_INPROGRESS')
    console.log(`Caching completed for year ${job.data.year}`)
    createLog(MAIN_PATH, `Caching completed for year ${job.data.year}`)
}, { connection });

// raise flag when scanning and saving failed
scanDataWorker.on("failed", async (job, returnvalue) => {
    cacheServer.del('SYNC_INPROGRESS')
    console.log(`Caching failed for year ${job.data.year}`)
    createLog(MAIN_PATH, `Caching failed for year ${job.data.year}`)
}, { connection });


/**
 * @dev Saves year wise data in cache
 * @param {string} nation 
 * @param {int} year 
 * @returns JSON with success or failure
 */
const singleYearCaching = async (nation, year) => {
    try {
        const syncProgressYear = await cacheServer.getAsync('SYNC_INPROGRESS')
        if (!syncProgressYear || parseInt(syncProgressYear) !== parseInt(year)) {
            scanData.add('saveDatainCache', { nation, year }, { removeOnComplete: true, removeOnFail: true })
            return { message: `caching initiated for year ${year}. Please wait...` }
        } else
            return { message: `caching ongoing for year ${syncProgressYear}` }

    } catch (e) {
        console.log('singleYearCaching', e)
        throw e
    }
}
/**
 * @dev Saves all year's data in cache
 * @returns JSON with success or failure
 */
const allDataCache = async () => {
    try {
        allYearData.add('allYearDataCaching', { nation: "USA" }, { removeOnComplete: true, removeOnFail: true })// executes immediately
        allYearData.add('allYearDataCachingCron', { nation: "USA", reSync: true }, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 */4 * * *' } })// executes every 4 hrs
    } catch (e) {
        console.log('allDataCache', e)
        throw e
    }
}

module.exports = {
    singleYearCaching,
    allDataCache,
    allYearData
}