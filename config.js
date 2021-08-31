const config = require('zerotheft-node-utils/config')

const PORT = config.PORT || 3000
const fs = require('fs')

const getReportPath = () => `${config.APP_PATH}/${config.REPORT_PATH}/`

const getAppRoute = (baseUrl = true) => {
  try {
    if (config.MODE === 'development') {
      return `http://localhost:${PORT}`
    }
    const appconfig = fs.readFileSync(`${config.APP_PATH}/config.json`)
    return `${baseUrl ? JSON.parse(appconfig).BASE_URL : JSON.parse(appconfig).APP_URL}`
  } catch {
    return null
  }
}

module.exports = {
  PORT,
  getReportPath,
  getAppRoute,
}
