/* eslint-disable import/no-extraneous-dependencies */
const { citizenFeedback } = require('zerotheft-node-utils/contracts/proposals')
const { getCitizen } = require('zerotheft-node-utils/contracts/citizens')

/**
 * Find citizen based on voter address
 * @param {string} voter - voter's address
 * @returns JSON object of citizen's info
 */
const getCitizenInfo = async voter => {
  const citizen = await getCitizen(voter)
  if (!citizen) {
    throw new Error('Citizen is not registered yet.')
  }
  return citizen
}

/**
 * Search and return citizen's feedback to a specific proposal
 * @param {string} citizenAddress - citizen's address
 * @param {string} proposalID - proposal's ID
 */
const getCitizenProposalRating = async (citizenAddress, proposalID) => {
  const response = await citizenFeedback(proposalID, citizenAddress)
  return response
}

module.exports = {
  getCitizenInfo,
  getCitizenProposalRating,
}
