const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { allYearData } = require('./reports/dataCacheWorker')
const { allReportWorker } = require('./reports/reportWorker')
const { cacheServer } = require('../services/redisService')
const { createLog, MAIN_PATH } = require('../services/LogInfoServices')

const connection = new IORedis()

const watcherQueueScheduler = new QueueScheduler('WatcherQueue', { connection })
const watcherQueue = new Queue('WatcherQueue', { connection })

const watcherWorker = new Worker('WatcherQueue', async job => {
  try {
    console.log('*****HEARTBEAT Report*****')

    const isSyncing = await cacheServer.getAsync(`SYNC_INPROGRESS`)
    const isGeneratingReports = await cacheServer.getAsync(`REPORTS_INPROGRESS`)
    const isFullReport = await cacheServer.getAsync(`FULL_REPORT`)
    const isDatainCache = await cacheServer.getAsync(`PATH_SYNCHRONIZED`)

    console.log(`1. Caching in progress: ${!!isSyncing}`)
    console.log(`2. Reports in progress: ${!!isGeneratingReports}`)
    console.log(`3. Full report: ${!!isFullReport}`)
    console.log(`4. Data in cache: ${!!isDatainCache}`)
    /**
     * If sync is complete 
     * Initiate data caching
     */
    if (!isDatainCache && !isSyncing) {
      console.log('Cache data missing. Inititated....')
      allYearData.add('allYearDataCaching', { nation: "USA" }, { removeOnComplete: true, removeOnFail: true })
    } else {
      console.log('Cache Data. OK!!')
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
    } else {
      console.log('Full report. OK!!')
    }

    console.log('*****HEARTBEAT Report*****')

  } catch (e) {
    console.log("watcherWorker ", e)
    createLog(MAIN_PATH, `watcherWorker ${e}`)
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
    await watcherQueue.add('heartbeat', {}, { removeOnComplete: 1, removeOnFail: 1, repeat: { cron: '* * * * *' } })
  } catch (e) {
    console.log('watcherWorker', e)
    createLog(MAIN_PATH, `watcherWorker ${e}`)
    throw e
  }


}

module.exports = {
  watcherInit
}
