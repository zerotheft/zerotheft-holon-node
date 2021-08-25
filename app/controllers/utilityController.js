const fs = require('fs')

const { getStorageValues } = require('zerotheft-node-utils/utils/storage')
const config = require('zerotheft-node-utils/config')
const { executeDisableCommand, executeEnableCommand, executeUpdateCommand } = require('../services/utilityService')

const configJSON = `${config.APP_PATH}/config.json`

const checkCitizenPermission = async req => {
  const address = getStorageValues() && getStorageValues().address
  if (address.toLowerCase() !== req.params.address.toLowerCase()) {
    throw new Error('citizen has no permission to update.')
  }
}
// Return status of auto update either true or false
const getCurrentVersion = async (req, res, next) => {
  const appconfig = fs.readFileSync(configJSON)
  const version = (json = require('../../package.json').version)
  return res.send({ version, date: `${JSON.parse(appconfig).VERSION_TIMESTAMP}` })
  // return res.send({ date: `${JSON.parse(appconfig).VERSION_TIMESTAMP}` })
}
// Return status of auto update either true or false
const getAutoUpdateStatus = async (req, res, next) => {
  const appconfig = fs.readFileSync(configJSON)
  return res.send({ status: `${JSON.parse(appconfig).AUTO_UPDATE}` })
}

// Update holon
const updateHolon = async (req, res, next) => {
  try {
    await checkCitizenPermission(req)
    const response = await executeUpdateCommand()
    return res.send(response)
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

// Disable auto update feature
const disableAutoUpdate = async (req, res, next) => {
  try {
    await checkCitizenPermission(req)
    const appconfig = fs.readFileSync(configJSON)
    const response = await executeDisableCommand(appconfig)
    return res.send(response)
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

// Enable auto update feature
const enableAutoUpdate = async (req, res, next) => {
  try {
    await checkCitizenPermission(req)
    const appconfig = fs.readFileSync(configJSON)
    const response = await executeEnableCommand(appconfig)
    return res.send(response)
  } catch (e) {
    res.status(400) && next(e.message)
  }
}

module.exports = {
  getCurrentVersion,
  getAutoUpdateStatus,
  updateHolon,
  disableAutoUpdate,
  enableAutoUpdate,
}
