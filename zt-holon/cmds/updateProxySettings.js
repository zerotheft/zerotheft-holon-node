const chalk = require('chalk')
const error = require('../utils/error')
const {getProxyHolonValues } = require('zerotheft-node-utils/utils/storage')

const registerProxyVoter = require('./registerProxyVoter')

module.exports = async () => {
  if(!getProxyHolonValues().proxy) {
    error(chalk.red('Proxy voter is not registered yet. Please use zt-holon register-proxy-voter command.'), true)
  }
  registerProxyVoter()
}