const { proposals } = require('zerotheft-node-utils')
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

/* return votes from the stored exported data */
const getVotes = async (req, res, next) => {
  try {
    const path = req.query['0']
    const response = await voteService.getVoteData(path)
    res.send(response)
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

/* Downloads and saves every proposals from the blockchain */
const exportProposalData = async (req, res, next) => {
  try {
    const response = proposalService.exportAllProposals()
    res.send({ message: 'proposal export is in progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Downloads and saves every failed proposals from the blockchain */
const exportFailedProposalData = async (req, res, next) => {
  try {
    const response = proposalService.exportFailedProposals()
    res.send({ message: 'failed proposal export is in progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Downloads and saves every holons from the blockchain */
const exportHolonData = async (req, res, next) => {
  try {
    const response = await holonService.exportAllHolons()
    res.send({ message: 'holon export is in progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Downloads and saves every voters from the blockchain */
const exportVoterData = async (req, res, next) => {
  try {
    const response = voterService.exportAllVoters()
    res.send({ message: 'voter export is in progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* return proposals from the stored exported data */
const getVoters = async (req, res, next) => {
  try {
    const response = await voterService.getVoterData()
    res.send(response)
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* Returns all exported proposals from csv */
const exportedProposals = async (req, res, next) => {
  try {
    const content = await proposalService.allProposalsJSON()
    res.send({ content, message: 'proposal export is in progress' })
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

/* return proposals from the stored exported data */
const getProposals = async (req, res, next) => {
  try {
    const response = await proposalService.getProposalData()
    res.send(response)
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
  exportVoterData,
  exportedProposals,
  getVoters,
  getVotes,
  getProposals,
}
