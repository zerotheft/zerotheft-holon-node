const { getProposalDetails, getProposalTemplate, getPathProposalsByYear } = require('zerotheft-node-utils').proposals

const proposalWithDetails = async (id) => {
  try {
    if (id === 0 || isNaN(id)) throw new Error(`Not valid proposal id. i.e ${id}`)
    const proposal = await getProposalDetails(id)
    return proposal
  } catch (e) {
    return { error: e.message }
  }
}
const fetchProposalTemplate = async (path) => {
  try {
    const proposal = await getProposalTemplate(path)
    return { content: proposal }
  } catch (e) {
    if (e.response && e.response.status === 404) {
      return { status: 404, error: `${path} Proposal could not be found on github. Please check it on github.` }
    }
    return { error: e }
  }
}

module.exports = {
  proposalWithDetails,
  fetchProposalTemplate,
  getPathProposalsByYear,
}