const { importByPrivateKey } = require('zerotheft-node-utils/utils/web3')
const { getStorageValues, updateStorageValues } = require('zerotheft-node-utils/utils/storage')
const chalk = require('chalk')

module.exports = async args => {
  try {
    const privateKey = args['private-key']
    const values = (await getStorageValues()) || {}
    if (values.address) {
      console.log(chalk.red('You have already created your account.'))
      return
    }
    const account = await importByPrivateKey(privateKey)
    updateStorageValues(account.address, account.encryptedKey, null)
    console.log(
      chalk.green(`Account successfully Created.
    Your account is: ${account.address}
  `)
    )
  } catch (e) {
    console.log(chalk.red('Cannot import account. Please check your private key.'))
  }
}
