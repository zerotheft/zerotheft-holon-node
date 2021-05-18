const { getHolonsService, getInfo } = require('../services/holonsService');

const getHolons = async (req, res, next) => {
  const response = await getHolonsService()
  if (response.error) {
    return res.sendStatus(400) && next(response.error)
  }
  return res.send(response)
}

const getHolonInfo = async(req, res, next) => {
  try {
    const response = await getInfo()
    res.send(response)
  } catch(e) {
    next(e.message)
  }
}

module.exports = {
  getHolons,
  getHolonInfo
}