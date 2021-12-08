const { areaPriorityScore } = require('../services/hierarchyAreaService')

/**
 * Figure out the next area to vote in and return the result of an algorithm
 */
const findNextPriorityArea = async (req, res, next) => {
  try {
    const scoreSheet = await areaPriorityScore()
    res.status(200).send({ scoreSheet, message: 'Priority area to vote in next determined successfully.' })
  } catch (e) {
    next(e)
  }
}
module.exports = {
  findNextPriorityArea,
}
