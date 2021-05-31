const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { allYearData } = require('./reports/dataCacheWorker')
const { allReportWorker } = require('./reports/reportWorker')
const { cacheServer } = require('../services/redisService')
const { createLog, WATCHER_LOG_PATH } = require('../services/LogInfoServices')
const { lastExportedUid, lastExportedPid, lastExportedVid } = require('../services/engineDataServices/utils')
const { calculatePastYearThefts } = require('../services/calcEngineServices/calcLogic')

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
    const isDatainCache = await cacheServer.getAsync(`PATH_SYNCHRONIZED`)
    const pastThefts = await cacheServer.hgetallAsync(`PAST_THEFTS`)
    const cachedUid = await lastExportedUid()
    const cachedPid = await lastExportedPid()
    const cachedVid = await lastExportedVid()

    console.log(`1. Caching in progress(SYNC_INPROGRESS): ${!!isSyncing} (${isSyncing})`)
    console.log(`2. Reports in progress(REPORTS_INPROGRESS): ${!!isGeneratingReports}`)
    console.log(`3. Full report(FULL_REPORT): ${!!isFullReport}`)
    console.log(`4. Data in cache(PATH_SYNCHRONIZED): ${!!isDatainCache}`)
    console.log(`4. Past year thefts(PAST_THEFTS): ${!!pastThefts}`)
    console.log(`5. Last User ID Exported: ${cachedUid}`)
    console.log(`6. Last Proposal ID Exported: ${cachedPid}`)
    console.log(`7. Last Vote ID Exported: ${cachedVid}`)
    /**
     * If no data in cache and no sync in progress
     * Initiate data caching
     */
    if (!isDatainCache && !isSyncing) {
      console.log('Cache data missing. Inititated....')
      allYearData.add('allYearDataCaching', { nation: "USA" }, { removeOnComplete: true, removeOnFail: true })
    } else {
      console.log('Cache Data. OK!!')
    }
    /**
    * If sync is complete and no past year thefts collected
    * calculate past year thefts
    */
    if (isDatainCache && !isSyncing && !pastThefts) {
      console.log('Past year thefts missing. Initiated...')
      // when all year data got sycned get past year thefts
      await calculatePastYearThefts()
    }
    /**
     * If sync is complete and full report is not present.
     * Initiate full report
     */
    if (!isSyncing && !isFullReport && isDatainCache && !isGeneratingReports) {
      console.log('Full reports missing. Inititated....')
      allReportWorker()
    } else if (isGeneratingReports) {
      console.log('Reports in progress!!')
    }

    console.log('*****HEARTBEAT Report*****')

    // Print heatbeat in log file
    let logContent = `***HEARTBEAT***\nCaching in progress(SYNC_INPROGRESS): ${!!isSyncing}(${isSyncing})\nReports in progress(REPORTS_INPROGRESS): ${!!isGeneratingReports}\nFull report(FULL_REPORT): ${!!isFullReport}\nData in cache(PATH_SYNCHRONIZED): ${!!isDatainCache}\nLast User ID Exported: ${cachedUid}\nLast Proposal ID Exported: ${cachedPid}\nLast Vote ID Exported: ${cachedVid}\n`
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
    watcherQueue.add('heartbeat', {}, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '* * * * *' } })
  } catch (e) {
    console.log('watcherWorker', e)
    createLog(WATCHER_LOG_PATH, `watcherWorker ${e}`)
    throw e
  }


}

module.exports = {
  watcherInit
}
