const fs = require('fs')
const { singleIssueReport, multiIssuesFullReport, theftInfo, nationReport } = require('../services/calcEngineServices');
const { getAppRoute } = require('../../config');
const { allReportWorker } = require('../workers/reports/reportWorker');

const getSingleIssueReport = async (req, res, next) => {
    const response = await singleIssueReport(req.params.path, false, req.params.year)
    if (response.report) {
        return res.send({ report: `${getAppRoute()}/issueReports/${response.report}` })
    } else {
        return res.send(response)
    }
}

const getMultiIssuesReport = async (req, res, next) => {
    const response = await multiIssuesFullReport(req.params.path, false, req.params.year)
    if (response.report) {
        return res.send({ report: `${getAppRoute()}/pathReports/${response.report}` })
    } else {
        return res.send(response)
    }
}

const getNationReport = async (req, res, next) => {
    const response = await nationReport(req.params.year, false, req.params.path)
    if (response.report) {
        return res.send({ report: `${getAppRoute()}/pathReports/${response.report}` })
    } else {
        return res.send(response)
    }
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
    getNationReport
}
