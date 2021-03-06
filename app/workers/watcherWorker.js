/* eslint-disable no-console */
// eslint-disable-next-line import/no-extraneous-dependencies
const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { dataCachingPerPath } = require('./reports/dataCacheWorker')
const { exportDataQueue } = require('./exportDataWorker')
const { allReportWorker } = require('./reports/reportWorker')
const { allDataCacheImmediate } = require('./reports/dataCacheWorker')
const { cacheServer } = require('../services/redisService')
const { createLog, WATCHER_LOG_PATH } = require('../services/LogInfoServices')
const { lastExportedUid, lastExportedPid, lastExportedVid } = require('../services/engineDataServices/utils')

const connection = new IORedis()

const watcherQueueScheduler = new QueueScheduler('WatcherQueue', { connection })
const watcherQueue = new Queue('WatcherQueue', { connection })

/**
 * Watcher worker is like heartbeat. It runs every  minute.
 * It checks whether tasks are successfully completed or not. It keeps the track of every tracks based on redis status.
 * It runs the individual task based on the task status.
 */
const watcherWorker = new Worker(
  'WatcherQueue',
  async job => {
    await new Promise(resolve => setTimeout(resolve, 10000))

    try {
      console.log('*****HEARTBEAT Report*****')
      const isSyncing = await cacheServer.getAsync(`SYNC_INPROGRESS`)
      const isGeneratingReports = await cacheServer.getAsync(`REPORTS_INPROGRESS`)
      const isFullReport = await cacheServer.getAsync(`FULL_REPORT`)
      const isResyncing = await cacheServer.getAsync(`DATA_RESYNC`)
      const isResyncingFailed = await cacheServer.getAsync(`DATA_RESYNC_FAILED`)
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
      console.log(`5. Last Citizen ID Exported: ${cachedUid}`)
      console.log(`6. Citizen Export in progress(VOTERS_EXPORT_INPROGRESS): ${!!isVotersExporting}`)
      console.log(`7. Last Proposal ID Exported: ${cachedPid}`)
      console.log(`8. Proposal Export in progress(PROPOSALS_EXPORT_INPROGRESS): ${!!isProposalExporting}`)
      console.log(`9. Last Vote ID Exported: ${cachedVid}`)
      console.log(`10. Vote Export in progress(VOTES_EXPORT_INPROGRESS): ${!!isVotesExporting}`)
      console.log(`11. Data Resyncing(DATA_RESYNC): ${!!isResyncing}`)
      console.log(`12. Data Resyn failed(DATA_RESYNC_FAILED): ${!!isResyncingFailed}(${isResyncingFailed})`)

      const isNotExporting = !isVotesExporting && !isVotersExporting && !isProposalExporting
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
       * If no extra process is running and data is not in cache or its 4 hours cron job
       * Initiate data caching
       */
      if (!isSyncing && cachedVid > 0 && !isVotesExporting && !isGeneratingReports && (!isDatainCache || isResyncing)) {
        await dataCachingPerPath(job.data.nation)
      }

      /**
       * If sync is complete and full report is not present.
       * Initiate full report
       */
      if (!isSyncing && !isFullReport && isDatainCache && !isGeneratingReports && isNotExporting && cachedVid > 0) {
        console.log('Full reports missing. Inititated....')
        allReportWorker()
      } else if (isGeneratingReports) {
        console.log('Reports in progress!!')
      }

      /**
       * If resycing every 4 hours failed then watcher detects and re-reuns it
       */
      if (isResyncingFailed && !isFullReport && isDatainCache && !isGeneratingReports && isNotExporting) {
        console.log('All data resycing triggered from failed status....')
        allDataCacheImmediate()
      }

      // eslint-disable-next-line no-console
      console.log('*****HEARTBEAT Report*****')

      // Print heatbeat in log file
      const logContent = `***HEARTBEAT***\nCaching in progress(SYNC_INPROGRESS): ${!!isSyncing}(${isSyncing})\nReports in progress(REPORTS_INPROGRESS): ${!!isGeneratingReports}\nFull report(FULL_REPORT): ${!!isFullReport}\nData in cache(CALC_SUMMARY_SYNCED): ${!!isDatainCache}\nLast Citizen ID Exported: ${cachedUid}\nCitizen Export in progress(VOTERS_EXPORT_INPROGRESS): ${!!isVotersExporting}\nLast Proposal ID Exported: ${cachedPid}\nProposal Export in progress(PROPOSALS_EXPORT_INPROGRESS): ${!!isProposalExporting}\nLast Vote ID Exported: ${cachedVid}\n Vote Export in progress(VOTES_EXPORT_INPROGRESS): ${!!isVotesExporting}\nser ID Exported: ${cachedUid}\nLast Proposal ID Exported: ${cachedPid}\nLast Vote ID Exported: ${cachedVid}\n`
      createLog(WATCHER_LOG_PATH, logContent)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('watcherWorker ', e)
      createLog(WATCHER_LOG_PATH, `watcherWorker ${e}`)
      throw e
    }
  },
  { connection }
)

// after worker finishes job
watcherWorker.on('completed', async () => { }, { connection })

// after worker failed
watcherWorker.on('failed', async () => { }, { connection })

/**
 * Its like heartbeat which actually monitors all the background jobs and also performs required operations
 */
const watcherInit = async () => {
  try {
    watcherQueue.add(
      'heartbeat',
      { nation: 'USA' },
      { removeOnComplete: true, removeOnFail: true, repeat: { cron: '* * * * *' } }
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('watcherWorker', e)
    createLog(WATCHER_LOG_PATH, `watcherWorker ${e}`)
    throw e
  }
}

module.exports = {
  watcherInit,
}
