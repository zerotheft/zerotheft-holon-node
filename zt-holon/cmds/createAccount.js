const { createAccount } = require('zerotheft-node-utils/utils/web3')
const { getStorageValues } = require('zerotheft-node-utils/utils/storage')
const chalk = require('chalk')

module.exports = async () => {
  const values = (await getStorageValues()) || {}
  if (values.address) {
    console.log(chalk.red('You have already created your account.'))
    return
  }
  const account = await createAccount()
  console.log(
    chalk.green(`Account successfully Created.
    Your account is: ${account.address}
  `)
  )
}
