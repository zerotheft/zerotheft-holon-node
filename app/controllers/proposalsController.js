const { proposalWithDetails, fetchProposalTemplate, getPathProposalsByYear } = require('../services/proposalsService');

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

const pathProposalsByYear = async (req, res, next) => {
  try {
    const response = await getPathProposalsByYear(req.query.path, req.query.year)
    
    return res.send(response)
  } catch(e) {
    return res.status(400) && next(e)
  }
}


module.exports = {
  getProposalWithDetail,
  getTemplateDetail,
  pathProposalsByYear
}