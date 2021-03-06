const fs = require('fs')
const {
  singleIssueReport,
  multiIssuesFullReport,
  theftInfo,
  nationReport,
  setupForReportsDirs,
} = require('../services/calcEngineServices')
const { getAppRoute } = require('../../config')
const { allReportWorker } = require('../workers/reports/reportWorker')

setupForReportsDirs(false)

/**
 * Generate report of single issue.
 */
const getSingleIssueReport = async (req, res) => {
  const response = await singleIssueReport(req.params.path, false)
  if (response.report) {
    return res.send({ report: `${getAppRoute()}/issueReports/${response.report}` })
  }
  return res.send(response)
}

const getMultiIssuesReport = async (req, res, next) => {
  const response = await multiIssuesFullReport(req.params.path, false)
  if (response.report) {
    return res.send({ report: `${getAppRoute()}/pathReports/${response.report}` })
  }
  return res.send(response)
}

const getNationReport = async (req, res, next) => {
  const response = await nationReport(false, req.params.path)
  if (response.report) {
    return res.send({ report: `${getAppRoute()}/pathReports/${response.report}` })
  }
  return res.send(response)
}

const getTheftInfo = async (req, res, next) => {
  const response = await theftInfo(false)
  if (response) {
    return res.send(response)
  }
}

const generateReports = async (req, res, next) => {
  try {
    allReportWorker()
    res.send({ message: 'all report generation worker initiated' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

module.exports = {
  getSingleIssueReport,
  getMultiIssuesReport,
  generateReports,
  getTheftInfo,
  getNationReport,
}
