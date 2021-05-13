const fs = require('fs')
const { singleIssueReport, multiIssuesReport, theftInfo, nationReport } = require('../services/calcEngineServices');
const { getAppRoute } = require('../../config');
const { allReportWorker } = require('../workers/reports/reportWorker');

const getSingleIssueReport = async (req, res, next) => {
    const response = await singleIssueReport(req.params.path, false, req.params.year)
    response.pdfResponse.pdf.pipe(response.pdfResponse.output)
    response.pdfResponse.pdf.on('error', err => {
        console.error('generateLatexPDF::', err)
        return res.send(err)
    })
    response.pdfResponse.pdf.on('finish', () => {
        console.log('PDF generated!')
        fs.unlinkSync(response.pdfResponse.reportPrepd)
        return res.send({ report: `${getAppRoute()}/issueReports/${response.reportFile}` })
    })
}

const getMultiIssuesReport = async (req, res, next) => {
    const response = await multiIssuesReport(req.params.path, false, req.params.year)
    response.pdfResponse.pdf.pipe(response.pdfResponse.output)
    response.pdfResponse.pdf.on('error', err => {
        console.error('generateLatexPDF::', err)
        return res.send(err)
    })
    response.pdfResponse.pdf.on('finish', () => {
        console.log('PDF generated!')
        fs.unlinkSync(response.pdfResponse.reportPrepd)
        return res.send({ report: `${getAppRoute()}/pathReports/${response.reportFile}` })
    })
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
    const response = await theftInfo(false, req.params.year)
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
