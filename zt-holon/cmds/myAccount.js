const { getStorageValues } = require('zerotheft-node-utils/utils/storage')
const chalk = require('chalk')

module.exports = () => {
  const acc = getStorageValues()
  if (!acc) {
    console.log(chalk.red('You have not setup your account yet'))
    return
  }
  console.log(chalk`
    Your public address is {green.bold ${acc.address}}
    Your private key is {green.bold ${acc.key}}
  `)
}
