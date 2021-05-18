const ora = require('ora')
const chalk = require('chalk')

const error = require('../utils/error')
const { getHolonContract } = require('zerotheft-node-utils/utils/contract')

module.exports = async args => {
    const holon = args.holon
    const donationAddr = args.donation_address
    if (holon === "" || holon === undefined) {
        error(chalk.red('Please provide proper holon address'), true)
        return
    }
    if (donationAddr === "" || donationAddr === undefined) {
        error(chalk.red('Please provide donation address'), true)
        return
    }


    const spinner = ora({ text: 'Loading...', color: 'green' })
    try {

        spinner.start()
        const holonContract = getHolonContract()

        await holonContract.createTransaction('updateDonorAddress', [holon, donationAddr])
        spinner.stop()
        console.log(chalk.green(`Holon donation address updated successfully.`))

    } catch (e) {
        spinner.stop()
        error(chalk.red(e || 'There were some errors while performing action'), true)
    }
}
