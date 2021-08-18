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

const getHolonInfo = async () => {
  const address = getStorageValues() && getStorageValues().address
  const holonres = await getHolonIdByAddress(address)
  const canBeFunded = getProxyHolonValues().proxy
  const reportsPath = fs.realpathSync(`${config.APP_PATH}/zt_report/reports`).match(/public[^~]+/)[0]
  return {
    address,
    holonID: holonres.holonID,
    canBeFunded,
    reportsPath
  }
}

module.exports = {
  getHolonsService,
  getInfo: getHolonInfo
}