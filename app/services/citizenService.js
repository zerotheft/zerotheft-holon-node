const { getCitizen } = require('zerotheft-node-utils/contracts/citizens')

const getCitizenInfo = async voter => {
  try {
    const citizen = await getCitizen(voter)
    if(!citizen) throw new Error('Citizen is not registered yet.')
    return citizen
  } catch (e) {
    throw e
  }
}

module.exports = {
  getCitizenInfo
}
