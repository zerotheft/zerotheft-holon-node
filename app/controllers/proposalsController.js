const { proposalWithDetails, fetchProposalTemplate, getPathProposalsByYear } = require('../services/proposalsService');
const { prepareBellCurveData } = require('../services/calcEngineServices/helper')

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
    var votes = [],
      theftAmt = []
    response.map((proposal) => {
      if(proposal['votes']){
        votes.push(proposal['votes']);
        theftAmt.push(proposal['theftAmt'])
      }
    })
    const exactData = prepareBellCurveData(theftAmt, votes)
    return res.send({ data: response, chartData: exactData })
  } catch(e) {
    return res.status(400) && next(e)
  }
}


module.exports = {
  getProposalWithDetail,
  getTemplateDetail,
  pathProposalsByYear
}