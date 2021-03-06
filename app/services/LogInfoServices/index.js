const fs = require('fs')
const { PUBLIC_PATH, exportsDir } = require('../../common')

const LOG_PATH = `${PUBLIC_PATH}/logs`
const MAIN_PATH = `${LOG_PATH}/main.log`
const CRON_PATH = `${LOG_PATH}/cron.log`
const ERROR_PATH = `${LOG_PATH}/error.log`
const PROPOSAL_PATH = `${LOG_PATH}/proposals`
const VOTES_PATH = `${LOG_PATH}/votes`
const VOTERS_PATH = `${LOG_PATH}/voters`
const CALC_STATUS_PATH = `${LOG_PATH}/calc_status`
const FULL_REPORT_PATH = `${LOG_PATH}/full_report`
const SINGLE_REPORT_PATH = `${LOG_PATH}/single_report`
const MULTI_REPORT_PATH = `${LOG_PATH}/multi_report`
const EXPORT_LOG_PATH = `${exportsDir}/main.log`
const WATCHER_LOG_PATH = `${LOG_PATH}/watcher.log`

const createDirIfNotExist = () => {
  if (!fs.existsSync(PUBLIC_PATH)) {
    fs.mkdirSync(PUBLIC_PATH)
  }
  if (!fs.existsSync(LOG_PATH)) {
    fs.mkdirSync(LOG_PATH)
  }
  if (!fs.existsSync(PROPOSAL_PATH)) {
    fs.mkdirSync(PROPOSAL_PATH)
  }
  if (!fs.existsSync(VOTES_PATH)) {
    fs.mkdirSync(VOTES_PATH)
  }
  if (!fs.existsSync(VOTERS_PATH)) {
    fs.mkdirSync(VOTERS_PATH)
  }
  if (!fs.existsSync(CALC_STATUS_PATH)) {
    fs.mkdirSync(CALC_STATUS_PATH)
  }
  if (!fs.existsSync(FULL_REPORT_PATH)) {
    fs.mkdirSync(FULL_REPORT_PATH)
  }
  if (!fs.existsSync(SINGLE_REPORT_PATH)) {
    fs.mkdirSync(SINGLE_REPORT_PATH)
  }
  if (!fs.existsSync(MULTI_REPORT_PATH)) {
    fs.mkdirSync(MULTI_REPORT_PATH)
  }
}

const createNecessaryDir = location => {
  if (!fs.existsSync(location)) {
    fs.mkdirSync(location)
  }
}

createDirIfNotExist()

const createLog = (location, log, path = '') => {
  path = path.replace(/\/0/g, '')
  if (path.includes('/')) {
    const folderArray = path.split('/')
    mainDir = location
    folderArray.forEach(dir => {
      mainDir += `/${dir}`
      createNecessaryDir(mainDir)
    })
    location = `${mainDir}/main.log`
  } else if (path.length > 0) {
    const pathDir = `${location}/${path}`
    createNecessaryDir(pathDir)
    location += '/main.log'
  } else if (!location.includes('.log')) {
    location += '/main.log'
  }
  fs.appendFileSync(location, `${new Date()}::${log}\n`)
}

const readDir = location => {
  fs.readdir(location)
}

module.exports = {
  createLog,
  readDir,
  LOG_PATH,
  MAIN_PATH,
  CRON_PATH,
  ERROR_PATH,
  PROPOSAL_PATH,
  VOTES_PATH,
  VOTERS_PATH,
  CALC_STATUS_PATH,
  FULL_REPORT_PATH,
  SINGLE_REPORT_PATH,
  MULTI_REPORT_PATH,
  EXPORT_LOG_PATH,
  WATCHER_LOG_PATH,
}
