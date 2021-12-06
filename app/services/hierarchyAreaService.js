const { get } = require('lodash')
const { getHierarchyAreaVotes, allNations } = require('zerotheft-node-utils/contracts/paths')
const defaultRank = 1 // If hierarchy area not falling in the range of min/max votes then rank is "1" by default
const votesRank = [
  {
    rank: 10,
    minVote: 0,
    maxVote: 19,
  },
  {
    rank: 9,
    minVote: 20,
    maxVote: 50,
  },
  {
    rank: 8,
    minVote: 51,
    maxVote: 99,
  },
  {
    rank: 7,
    minVote: 100,
    maxVote: 299,
  },
  {
    rank: 6,
    minVote: 300,
    maxVote: 999,
  },
  {
    rank: 5,
    minVote: 1000,
    maxVote: 9999,
  },
]
/**
 * Figure out the next area to vote in.
 * ** Sort out the hierarchical area based on the priority.
 *    Find out the number of votes in each hierarchical areas and calculate score based on `priority` and `votes`.
 *    Figure out the winning score and the best area to vote next.
 * @returns Result with winning score and the area to vote in next time.
 */
const areaPriorityScore = async () => {
  let prioritizedArea = {}
  let winningScore = 0
  const areaVotes = await getHierarchyAreaVotes()
  const allNationsHierarchy = await allNations()
  const priorityList = allNationsHierarchy.find(hierarchy => hierarchy.nation === 'USA').priorityList
  // Looping through each priority list. Every priority have multiple hierarchy areas.
  Object.keys(priorityList).forEach(pn => {
    let priority = parseInt(pn)
    const priorityAreas = priorityList[priority]

    // Calculate the score of every hierarchial areas sorted by priority
    Object.keys(priorityAreas).forEach(hash => {
      let voteCount = areaVotes[hash] || 0
      // Get the rank of area based on votes given
      let voteRange = votesRank.find(p => voteCount >= p.minVote && voteCount <= p.maxVote)
      const rank = voteRange ? voteRange.rank : defaultRank
      // Calculate the score based on rank
      let score = (10 - priority) * rank
      let scoreSheetItem = get(prioritizedArea, score, { '_areas': [] })
      scoreSheetItem['_areas'].push({
        hash,
        hierarchy: priorityAreas[hash],
        votes: voteCount,
        priority,
        score
      })
      prioritizedArea[score] = scoreSheetItem
      // Find the winning score i.e. the highest score
      if (score > winningScore) { winningScore = score }
    })
  })

  // Find the most eligible hierarchy area for the next voting from the wining score sheet.
  const nextVotein = prioritizedArea[winningScore]['_areas'].reduce((previous, current) => {
    //next priority if has highest priority or highest priority with less votes
    return (current.priority < previous.priority || (current.votes < previous.votes && current.priority === previous.priority)) ? current : previous
  })

  // console.log(prioritizedArea[winningScore]['_areas'])
  return { prioritizedArea, winningScore, nextVotein }
}
module.exports = {
  areaPriorityScore,
}
