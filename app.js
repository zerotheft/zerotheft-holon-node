const minimist = require('minimist')
const serveIndex = require('serve-index')
const bodyParser = require('body-parser')
const express = require('express')
const cors = require('cors')
const path = require('path')
const process = require('process')

const app = express()
const Honeybadger = require('honeybadger')
const { PORT, APP_PATH, MODE, BUILD_PATH, HONEYBADGER_KEY } = require('zerotheft-node-utils/config')
const routes = require('./app/routes')
const { watcherInit } = require('./app/workers/watcherWorker')
const { cleanupInit } = require('./app/workers/cleanupWorker')
const { allDataExport } = require('./app/workers/exportDataWorker')
const { allDataCache } = require('./app/workers/reports/dataCacheWorker')
const { createLog, MAIN_PATH } = require('./app/services/LogInfoServices')

createLog(MAIN_PATH, '.................Main process Initiated..............')

const { getReportPath } = require('./config')

app.use(express.static(path.join(APP_PATH, 'build')))

function logErrors(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('Error', err)
  next(err)
}
function errorHandler(err, req, res, next) {
  const code = !res.statusCode || res.statusCode === 200 ? 500 : res.statusCode
  const error = err && err.message ? err.message : err
  return res.status(code).send({ error: error || 'There was some errors while performing action.' })
}
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api', routes)
app.use(logErrors)
app.use(errorHandler)

app.use('/public', serveIndex(path.join(APP_PATH, 'public')))
app.use('/public', express.static(path.join(APP_PATH, 'public'), { fallthrough: false }))
app.use('/pathReports', express.static(`${getReportPath()}reports/multiIssueReport`, { fallthrough: false }))
app.use('/issueReports', express.static(`${getReportPath()}reports/ztReport`))

// health check route
app.get('/healthcheck', (req, res, next) =>
  res.send({
    status: 'Running',
    upTime: Math.floor(process.uptime()),
    success: true,
    message: 'holon is running fine',
  })
)
app.get('*', (req, res) => {
  res.sendFile(
    MODE === 'development' ? path.join(BUILD_PATH, 'index.html') : path.join(APP_PATH, 'build', 'index.html')
  )
})

/**
 * Start background Jobs
 */
// allReportWorker kicks in every 1 hour cron job that generates reports if all path data has been synced successfully
// createLog(MAIN_PATH, 'All Report Worker running in 3s')
// setTimeout(() => allReportWorker(), 3000)
// Initiated Heartbeat watcher. Runs every 5 min
createLog(MAIN_PATH, 'Heartbeat running in 3s')
setTimeout(() => watcherInit(), 3000)

// allDataExport runs background job once a day(midnight) and exports data from the blockchain and saves in files.
createLog(MAIN_PATH, 'All Data Export running in 10s')
setTimeout(() => allDataExport(), 10000)

// allDataCache runs background job and initiate caching for all years one by one.
createLog(MAIN_PATH, 'All Year Caching running in 5s')
setTimeout(() => allDataCache(), 5000)

// Cleanup worker cron initiated for every Friday @ 23:00
createLog(MAIN_PATH, 'cleanup worker initiated')
setTimeout(() => cleanupInit(), 5000)

const args = minimist(process.argv.slice(2))
const port = args.port || PORT || 3000
// set honeybadger config
Honeybadger.configure({
  apiKey: HONEYBADGER_KEY,
  environment: `${MODE}-holon-backend`,
  developmentEnvironments: ['development'],
})

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`App running on port ${port}!`))
createLog(MAIN_PATH, 'App listening now.')

module.exports = {
  app,
}
