const IORedis = require('ioredis')
const fs = require('fs')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const config = require('zerotheft-node-utils/config')
const { createLog, LOG_PATH, MAIN_PATH } = require('../services/LogInfoServices')

const connection = new IORedis()

const cleanupQueneScheduler = new QueueScheduler('cleanupQuene', { connection })
const cleanupQuene = new Queue('cleanupQuene', { connection })

const cleanupWorker = new Worker(
  'cleanupQuene',
  async job => {
    try {
      // first remove everything inside log path
      console.log('**Cleaner cleaning logs directory')
      await removeDir(LOG_PATH)

      // remove everything from tmp directory
      console.log('**Cleaner cleaning tmp directory')
      await removeDir(`${config.APP_PATH}/tmp`)

      // clean the cached directory of path yamls
      console.log('**Cleaner cleaning cached path yaml')
      await removeDir(`${config.APP_PATH}/.zt/pathYamls`)
    } catch (e) {
      console.log('cleanupWorker ', e)
      createLog(MAIN_PATH, `cleanupWorker ${e}`)
      throw e
    }
  },
  { connection }
)

/**
 * Removes files and sub-directories of path
 * @param {string} path
 */
const removeDir = async path => {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path)

    if (files.length > 0) {
      files.forEach(filename => {
        if (fs.statSync(`${path}/${filename}`).isDirectory()) {
          removeDir(`${path}/${filename}`)
        } else {
          fs.unlinkSync(`${path}/${filename}`)
        }
      })
    } else {
      console.log(`No files found in the directory(${path}).`)
    }
  } else {
    console.log(`Directory path(${path}) not found.`)
  }
}

/**
 * Cleaner worker cleans up the tmp directory and all the log files every one @  23:00 on Friday
 */
const cleanupInit = async () => {
  try {
    cleanupQuene.add('cleaner', {}, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 23 * * FRI' } })
  } catch (e) {
    console.log('cleanupWorker', e)
    createLog(MAIN_PATH, `cleanupWorker ${e}`)
    throw e
  }
}

module.exports = {
  cleanupInit,
}
