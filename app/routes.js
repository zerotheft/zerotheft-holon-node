const express = require('express')
const { getSingleIssueReport, generateReports, getMultiIssuesReport, getTheftInfo, getNationReport } = require('./controllers/reportController')
const { getPath, allNations, pathsByNation, getUmbrellaPaths } = require('./controllers/pathsController')
const { getProposalWithDetail, getTemplateDetail, pathProposalsByYear } = require('./controllers/proposalsController')
const { vote, priorVote } = require('./controllers/voteController')
const { userInfo } = require('./controllers/userController')
const { getHolons, getHolonInfo } = require('./controllers/holonsController')
const { exportVoteData, exportReportData, exportProposalData, exportFailedProposalData, exportHolonData, exportVoterData } = require('./controllers/engineDataController')
const { getCurrentVersion, getAutoUpdateStatus, updateHolon, disableAutoUpdate, enableAutoUpdate } = require('./controllers/utilityController')
const { nationReport } = require('./services/calcEngineServices')

const router = express.Router()

/*
*COLLECTION OF ALL ROUTES
*/
/* GET home page. */

//Path Routes
router.get('/paths', pathsByNation)
router.get('/nations', allNations)
router.get('/path/:dir', getPath)
router.get('/umbrella-paths', getUmbrellaPaths)

//Report Routes
router.get('/nationPath/:nation/:year/viewReport', getNationReport)
router.get('/issue/:path/:year/viewReport', getSingleIssueReport)
router.get('/issues/:path/:year/viewReport', getMultiIssuesReport)
router.get('/issues/:path/:year/theftInfo', getTheftInfo)
router.get('/gen-reports', generateReports)
//Proposals Routes
router.get('/proposal-detail/:id', getProposalWithDetail)
router.get('/proposals-by-year', pathProposalsByYear)
// Vote Routes
router.post('/vote', vote)
router.post('/prior-vote', priorVote)
router.get('/user-info/:address', userInfo)
//Holons
router.get('/holons', getHolons)
router.get('/holon-info', getHolonInfo)

//Holon Auto-Update
router.get('/current-version', getCurrentVersion)
router.get('/auto-update-status', getAutoUpdateStatus)
router.get('/update-holon/:address', updateHolon)
router.get('/disable-auto-update/:address', disableAutoUpdate)
router.get('/enable-auto-update/:address', enableAutoUpdate)

//template hierarchy
router.get('/get-template-detail/:path', getTemplateDetail)

//export blockchain data APIs
router.get('/export-proposals', exportProposalData)
router.get('/export-failed-proposals', exportFailedProposalData)
router.get('/export-report', exportReportData)
router.get('/export-votes', exportVoteData)
router.get('/export-holons', exportHolonData)
router.get('/export-voters', exportVoterData)

module.exports = router