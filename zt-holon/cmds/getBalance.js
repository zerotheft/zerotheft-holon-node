const ora = require('ora')
const chalk = require('chalk')

const { getBalance } = require('zerotheft-node-utils/utils/web3')
const error = require('../utils/error')

module.exports = async () => {
  const spinner = ora({ text: 'Loading...', color: 'green' }).start()

  try {
    const balance = await getBalance()
    spinner.stop()

    console.log(chalk`Your balance is: {green.bold ${balance} ETC}`)
  } catch (e) {
    spinner.stop()
    error(chalk.red('There were some errors while performing action'), true)
  }
}
