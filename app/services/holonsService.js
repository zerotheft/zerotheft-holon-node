const { getHolons, getHolonIdByAddress } = require('zerotheft-node-utils').holons
const { getStorageValues, getProxyHolonValues } = require('zerotheft-node-utils/utils/storage')
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
  return {
    address,
    holonID: holonres.holonID,
    canBeFunded
  }
}

module.exports = {
  getHolonsService,
  getInfo: getHolonInfo
}