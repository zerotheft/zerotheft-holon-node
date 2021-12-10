const { nextVotingArea } = require('zerotheft-node-utils/contracts/paths')

/**
 * Figure out the next area to vote in.
 * ** Sort out the hierarchical area based on the priority.
 *    Find out the number of votes in each hierarchical areas and calculate score based on `priority` and `votes`.
 *    Figure out the winning score and the best area to vote next.
 * @returns Result with winning score and the area to vote in next time.
 */
const areaPriorityScore = async () => {
  const nextAreasToVote = await nextVotingArea()
  return nextAreasToVote
}
module.exports = {
  areaPriorityScore,
}
