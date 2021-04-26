
const voteService = require('../services/engineDataServices/voteService')
const proposalService = require('../services/engineDataServices/proposalService')
const reportService = require('../services/engineDataServices/reportService')
const holonService = require('../services/engineDataServices/holonService')
const voterService = require('../services/engineDataServices/voterService')

const exportVoteData = async (req, res, next) => {
  try {
    const response = voteService.exportAllVotes()
    res.send({ message: 'vote export is in  progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}


const exportReportData = async (req, res, next) => {
  try {
    const response = await reportService.exportCachedReport()
    res.send(response)
  } catch (e) {
    res.status(400) && next(e.message)
  }
}


/* Downloads and  saves every proposals from the blockchain*/
const exportProposalData = async (req, res, next) => {
  try {
    const response = proposalService.exportAllProposals()
    res.send({ message: 'proposal export is in  progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Downloads and  saves every failed proposals from the blockchain*/
const exportFailedProposalData = async (req, res, next) => {
  try {
    const response = proposalService.exportFailedProposals()
    res.send({ message: 'failed proposal export is in  progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Downloads and  saves every holons from the blockchain*/
const exportHolonData = async (req, res, next) => {
  try {
    const response = await holonService.exportAllHolons()
    res.send({ message: 'holon export is in  progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Downloads and  saves every voters from the blockchain*/
const exportVoterData = async (req, res, next) => {
  try {
    const response = voterService.exportAllVoters()
    res.send({ message: 'voter export is in  progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}
module.exports = {
  exportVoteData,
  exportReportData,
  exportProposalData,
  exportFailedProposalData,
  exportHolonData,
  exportVoterData
}