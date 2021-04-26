
const { getUserInfo } = require('../services/userService')

const userInfo = async (req, res, next) => {
  try {
    const response = await getUserInfo(req.params.address)
    res.send(response)
  } catch(e) {
    next(e.message)
  }
}

module.exports = {
  userInfo
}