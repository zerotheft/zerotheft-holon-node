const { getHolons, getHolonIdByAddress } = require('zerotheft-node-utils').holons
const { getStorageValues, getProxyHolonValues } = require('zerotheft-node-utils/utils/storage')
const fs = require('fs')
const config = require('zerotheft-node-utils/config')

const getHolonsService = async () => {
  try {
    const holons = await getHolons()
    return holons
  } catch (e) {
    return { error: e }
  }
}

/**
 * This method returns the holon information with holonID, address, whether a holon can be funded or not which is actually determined if holon has got a proxy wallet address to receive a funds.
 * @returns {Object} json object with usefull holon information as:
 * address(holon address),
 * holonID(Unique ID of a holon used to regsiter in the blockchain),
 * reportsPath(symplink of a reports)
 * canBeFunded(if holon has got a proxy wallet address to receive funds)
 * */
const getHolonInfo = async () => {
  const address = getStorageValues() && getStorageValues().address
  const holonres = await getHolonIdByAddress(address)
  const canBeFunded = getProxyHolonValues().proxy
  const reportsDir = `${config.APP_PATH}/zt_report/reports`
  let reportsPath = ''
  if (fs.existsSync(reportsDir)) {
    reportsPath = fs.realpathSync(`${config.APP_PATH}/zt_report/reports`).match(/public[^~]+/)[0]
  }
  return {
    address,
    holonID: holonres.holonID,
    canBeFunded,
    reportsPath,
  }
}

module.exports = {
  getHolonsService,
  getInfo: getHolonInfo,
}
