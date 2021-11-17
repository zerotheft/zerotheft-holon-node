const { proposalWithDetails, fetchProposalTemplate, getPathProposalsByPath } = require('../services/proposalsService')

/**
 * Get the detail information of a proposal based on the proposalId.
 * It parses proposal yaml and displays content.
 */
const getProposalWithDetail = async (req, res, next) => {
  const response = await proposalWithDetails(req.params.id, true)
  if (response.error) {
    return res.status(400) && next(response.error)
  }
  return res.send(response)
}

const getTemplateDetail = async (req, res, next) => {
  const response = await fetchProposalTemplate(req.params.path, true)
  if (response.error) {
    return res.status(response.status) && next(response.error)
  }
  return res.send(response)
}

const pathProposalsByPath = async (req, res, next) => {
  try {
    const response = await getPathProposalsByPath(req.query.path)
    const votes = []
    const theftAmt = []
    response.map(proposal => {
      if (proposal && proposal.votes) {
        votes.push(proposal.votes)
        theftAmt.push(proposal.theftAmt)
      }
    })
    return res.send({ data: response, chartData: { bellCurveThefts: theftAmt, bellCurveVotes: votes } })
  } catch (e) {
    return res.status(400) && next(e)
  }
}

module.exports = {
  getProposalWithDetail,
  getTemplateDetail,
  pathProposalsByPath,
}
