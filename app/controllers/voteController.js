
const voteService = require('../services/voteService')

const vote = async (req, res, next) => {
  try {
    const response = await voteService.vote(req.body)
    res.send(response)
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

const priorVote = async (req, res, next) => {
  try {
    const response = await voteService.priorVote(req.body)
    res.send(response)
  } catch (e) {
    next(e.message)
  }
}
module.exports = {
  vote,
  priorVote
}