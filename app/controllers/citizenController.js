const { getCitizenInfo } = require('../services/citizenService')

const citizenInfo = async (req, res, next) => {
  try {
    const response = await getCitizenInfo(req.params.citizenID)
    res.send(response)
  } catch (e) {
    next(e.message)
  }
}

module.exports = {
  citizenInfo,
}
