const config = require('zerotheft-node-utils/config')
const PORT = config.PORT || 3000;
const fs = require('fs')

const getReportPath = () => {
  return `${config.APP_PATH}/${config.REPORT_PATH}/`
}

const getAppRoute = () => {
  try {
    if (config.MODE === 'development') {
      return `http://localhost:${PORT}`
    } else {
      const appconfig = fs.readFileSync(`${config.APP_PATH}/config.json`)
      return `${JSON.parse(appconfig).BASE_URL}`
    }
  } catch {
    return null
  }
}


module.exports = {
  PORT,
  getReportPath,
  getAppRoute
}