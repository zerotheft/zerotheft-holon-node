const { voteByHolon: voteProposal } = require('zerotheft-node-utils/contracts/proposals')
const { userPriorVote, voteDataRollups } = require('zerotheft-node-utils/contracts/votes')
const { getUser } = require('zerotheft-node-utils/contracts/users')
const scrapedin = require('scrapedin')
const { get } = require('lodash')
const { getProxyHolonValues, getVoteValues, updateVoteValues, getLinkedinCookieValues } = require('zerotheft-node-utils/utils/storage')
const { createLog, VOTERS_PATH, VOTES_PATH, ERROR_PATH } = require('./LogInfoServices')

const MIN_WEIGHT = 3

const vote = async (req) => {
  createLog(VOTES_PATH, `voting initiation with request details ${req}`)
  createLog(VOTES_PATH, `Validating Request for voting`)
  if (await validate(req)) {
    const voter = req.voter.toLowerCase()
    createLog(VOTERS_PATH, voter)
    createLog(VOTES_PATH, 'Voting proposal...')
    let res = await voteProposal(req)
    createLog(VOTES_PATH, 'Getting vote values...')
    const votedValues = getVoteValues()
    const totalVoted = parseInt(votedValues[voter] || 0)
    updateVoteValues({ [voter]: totalVoted + 1 })
    createLog(VOTES_PATH, 'Completing votes...')
    return res
  }

}
const priorVote = async (req) => {
  let res = await userPriorVote(req)
  return res
}

const voteRollups = async (req) => {
  createLog(VOTES_PATH, `voteData rollups ${req}`)
  let res = await voteDataRollups(req)
  return res
}


const validate = async (req) => {
  try {
    const user = await getUser(req.voter)
    createLog(VOTES_PATH, `Checking if user is registered...`)

    if (!user) throw new Error('User is not registered yet.')

    const holonValues = getProxyHolonValues()
    createLog(VOTES_PATH, `Checking if holon had se up pay it forward yet...`)

    if (!holonValues.proxy) throw new Error('Holon does not have pay it forward set up yet.')

    const voteValues = getVoteValues()
    const totalVoted = voteValues[req.voter.toLowerCase()] || 0
    if (parseInt(totalVoted) >= parseInt(holonValues.maxVotes)) throw new Error('Voting quota exceeded.')

    if (!holonValues.linkedin) return true
    createLog(VOTES_PATH, `Getting linked in cookies values...`)
    const cookies = getLinkedinCookieValues()
    const options = {
      cookies
    }
    createLog(VOTES_PATH, `Scapping linked in profile...`)

    const profileScraper = await scrapedin(options)
    const profile = await profileScraper(user.linkedin)
    if (!profile) throw new Error('We can\'t proceed with your request at the moment.')

    const connections = parseInt(profile.profile.connections)
    const linkedinError = 'Your linkedin profile does not fulfil our minimum requirements.'
    if (connections < parseInt(holonValues.connections)) throw new Error(linkedinError)

    if (!holonValues.profileSufficiency) return true

    const positions = get(profile, 'positions.length') || 0
    const educations = get(profile, 'educations.length') || 0
    const skills = get(profile, 'skills.length') || 0
    const summary = get(profile, 'profile.summary.length') || 0
    const totalWeight = positions + educations * 0.5 + skills * 0.1 + summary * 0.05

    if (totalWeight < MIN_WEIGHT) throw new Error(linkedinError)

    return true
  } catch (e) {
    createLog(VOTES_PATH, `voteService=>validate()::Error occured while validating request for vote=> ${e.message}`)
    createLog(ERROR_PATH, `voteService=>validate()::Error occured while validating request for vote=> ${e.message}`)
    throw e
  }
}
module.exports = {
  vote,
  priorVote,
  voteRollups
}