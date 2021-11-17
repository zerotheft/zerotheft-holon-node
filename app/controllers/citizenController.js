const { getCitizenInfo, getCitizenProposalRating } = require('../services/citizenService')

/**
 * Get citizen info based on citizen id
 * @param {object} req - request object
 * @param {object} res -response object
 * @param {Function} next - next function
 */
const citizenInfo = async (req, res, next) => {
  try {
    const response = await getCitizenInfo(req.params.citizenID)
    res.send(response)
  } catch (e) {
    next(e.message)
  }
}
/**
 * Find citizen provided rating to specific proposal
 * @param {object} req - request object
 * @param {object} res -response object
 * @param {Function} next - next function
 */
const citizenProposalRating = async (req, res, next) => {
  try {
    const response = await getCitizenProposalRating(req.params.citizenAddress, req.params.proposalID)
    res.send(response)
  } catch (e) {
    next(e.message)
  }
}
module.exports = {
  citizenInfo,
  citizenProposalRating,
}
