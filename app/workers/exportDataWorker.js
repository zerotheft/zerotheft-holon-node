const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { exportAllProposals, exportFailedProposals } = require('../services/engineDataServices/proposalService')
const { exportAllVotes } = require('../services/engineDataServices/voteService')
const { exportAllVoters } = require('../services/engineDataServices/voterService')
const { cacheServer } = require('../services/redisService')
const { createLog, EXPORT_LOG_PATH } = require('../services/LogInfoServices')


const connection = new IORedis()

const exportDataQueueScheduler = new QueueScheduler('ExportDataQueue', { connection })
const exportDataQueue = new Queue('ExportDataQueue', { connection })

const exportWorker = new Worker('ExportDataQueue', async job => {
  try {
    if (job.name === 'proposalsExport') {
      cacheServer.set('PROPOSALS_EXPORT_INPROGRESS', true)
      createLog(EXPORT_LOG_PATH, '===>Export Proposals cron started')
      await exportAllProposals()

      // give a try to export the failed proposals
      createLog(EXPORT_LOG_PATH, `===>Export Failed Proposals cron started`)
      await exportFailedProposals()
      createLog(EXPORT_LOG_PATH, `Export Failed Proposals cron completed`)

    } else if (job.name === 'votersExport') {
      cacheServer.set('VOTERS_EXPORT_INPROGRESS', true)
      createLog(EXPORT_LOG_PATH, '===>Export Voters cron started')
      await exportAllVoters()

    } else if (job.name === 'votesExport') {

      cacheServer.set('VOTES_EXPORT_INPROGRESS', true)
      createLog(EXPORT_LOG_PATH, '===>Export Votes cron started')
      await exportAllVotes()

    }
  } catch (e) {
    console.log("exportWorker Error::", e)
    createLog(EXPORT_LOG_PATH, `===>exportWorker Error:: ${e}`)
    throw e
  }
}, { connection })



// after worker finishes job
exportWorker.on("completed", async (job, returnvalue) => {
  if (job.name === 'proposalsExport') {
    cacheServer.del('PROPOSALS_EXPORT_INPROGRESS')
    createLog(EXPORT_LOG_PATH, `Export Proposals cron completed`)
  } else if (job.name === 'votersExport') {
    cacheServer.del('VOTERS_EXPORT_INPROGRESS')
    createLog(EXPORT_LOG_PATH, 'Export Voters cron completed')

  } else if (job.name === 'votesExport') {
    cacheServer.del('VOTES_EXPORT_INPROGRESS')
    createLog(EXPORT_LOG_PATH, 'Export Votes cron completed')

  }
}, { connection });


// after worker failed
exportWorker.on("failed", async (job, returnvalue) => {
  if (job.name === 'proposalsExport') {
    cacheServer.del('PROPOSALS_EXPORT_INPROGRESS')
    createLog(EXPORT_LOG_PATH, `Export Proposals cron failed`)
  } else if (job.name === 'votersExport') {
    cacheServer.del('VOTERS_EXPORT_INPROGRESS')
    createLog(EXPORT_LOG_PATH, 'Export Voters cron failed')
  } else if (job.name === 'votesExport') {
    cacheServer.del('VOTES_EXPORT_INPROGRESS')
    createLog(EXPORT_LOG_PATH, 'Export Votes cron failed')
  }
}, { connection });



/**
 * Runs worker every 10pm daily and exports the blockchain data.
 */
const allDataExport = async () => {
  try {
    const proposalExport = await cacheServer.getAsync('PROPOSALS_EXPORT_INPROGRESS')
    const votersExport = await cacheServer.getAsync('VOTERS_EXPORT_INPROGRESS')
    const votesExport = await cacheServer.getAsync('VOTES_EXPORT_INPROGRESS')
    if (!proposalExport)
      await exportDataQueue.add('proposalsExport', {}, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 22 * * *' } })
    if (!votersExport)
      await exportDataQueue.add('votersExport', {}, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 22 * * *' } })
    if (!votesExport)
      await exportDataQueue.add('votesExport', {}, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 22 * * *' } })
  } catch (e) {
    console.log(e)
    createLog(EXPORT_LOG_PATH, `===>allDataExport ${e}`)
    throw e
  }
}

module.exports = {
  allDataExport,
  exportDataQueue
}
