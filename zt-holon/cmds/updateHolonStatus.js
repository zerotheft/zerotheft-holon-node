/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
const ora = require('ora')
const chalk = require('chalk')
const { getHolonContract, getCitizenContract } = require('zerotheft-node-utils/utils/contract')
const { getCitizenIdByAddress } = require('zerotheft-node-utils/contracts/citizens')
const { signMessage } = require('zerotheft-node-utils/utils/web3')
const { getStorageValues } = require('zerotheft-node-utils/utils/storage')
const error = require('../utils/error')

module.exports = async args => {
  const ownerAddress = args.owner_address
  const { status } = args
  if (ownerAddress === '' || ownerAddress === undefined) {
    error(chalk.red('Please provide address of a owner(as owner_address) used to register a holon'), true)
    return
  }

  if (status === '' || status === undefined) {
    error(chalk.red('Please provide a holon status(as status)'), true)
    return
  }

  const spinner = ora({ text: 'Loading...', color: 'green' })
  try {
    const storage = (await getStorageValues()) || {}
    if (!storage.address) {
      error(chalk.red('Please use zt-holon create-account to create your etc account.'), true)
    }
    // check if citizen address is in the blockchain
    const userContract = getCitizenContract()
    const userData = await getCitizenIdByAddress(storage.address, userContract)
    if (!userData.success) {
      error(chalk.red(userData.error), true)
    }
    const holonContract = getHolonContract()

    const params = [
      { t: 'string', v: status },
      { t: 'address', v: ownerAddress },
      { t: 'address', v: storage.address },
    ]
    const signedMessage = await signMessage(params)

    await holonContract.createTransaction('updateHolonStatus', [ownerAddress, status, signedMessage.signature])
    spinner.stop()
    console.log(chalk.green(`Holon status updated successfully.`))
  } catch (e) {
    console.log(e)
    spinner.stop()
    error(chalk.red(e || 'There were some errors while performing action'), true)
  }
}
