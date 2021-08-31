const fs = require('fs')
const { exec } = require('child_process')
const config = require('zerotheft-node-utils/config')

const configJSON = `${config.APP_PATH}/config.json`

const getAppConfig = async () => {
  const appconfig = fs.readFileSync(configJSON)
  return JSON.parse(appconfig)
}

const executeDisableCommand = async () => {
  const configVal = await getAppConfig()
  return new Promise((resolve, reject) => {
    const env = config.MODE
    try {
      fs.writeFileSync('/etc/apt/sources.list.d/zerotheft-source.list', '')
      configVal.AUTO_UPDATE = 'false'
      fs.writeFileSync(configJSON, JSON.stringify(configVal))
    } catch (e) {
      console.log(e.message)
      reject({ message: e.message, success: false })
    }
    resolve({ message: 'auto update disabled', success: true })
  })
}

const executeEnableCommand = async () => {
  const configVal = await getAppConfig()
  return new Promise((resolve, reject) => {
    const env = config.MODE
    try {
      fs.writeFileSync(
        '/etc/apt/sources.list.d/zerotheft-source.list',
        `deb [trusted=yes] https://zerotheft-holon-${env}.s3.us-east-1.amazonaws.com/releases stable main`
      )
      configVal.AUTO_UPDATE = 'true'
      fs.writeFileSync(configJSON, JSON.stringify(configVal))
    } catch (e) {
      console.log(e.message)
      reject({ message: `exec error: ${e.message}`, success: false })
    }
    resolve({ message: 'auto update enabled', success: true })
  })
}

const executeUpdateCommand = async () =>
  new Promise((resolve, reject) => {
    const env = config.MODE
    fs.writeFileSync(
      '/etc/apt/sources.list.d/zerotheft-source.list',
      `deb [trusted=yes] https://zerotheft-holon-${env}.s3.us-east-1.amazonaws.com/releases stable main`
    )
    exec(`sudo apt-get update && sudo apt-get install zerotheft-holon`, (error, stdout, stderr) => {
      fs.writeFileSync('/etc/apt/sources.list.d/zerotheft-source.list', '')
      if (error) {
        console.log(stderr)
        reject({ message: `exec error: ${error}`, success: false })
      }
      console.log(stdout)
      resolve({ message: 'holon update successfully', success: true })
    })
  })
module.exports = {
  executeDisableCommand,
  executeEnableCommand,
  executeUpdateCommand,
}
