const { getUser } = require('zerotheft-node-utils/contracts/users')

const getUserInfo = async voter => {
  try {
    const user = await getUser(voter)
    if(!user) throw new Error('User is not registered yet.')
    return user
  } catch (e) {
    throw e
  }
}

module.exports = {
  getUserInfo
}
