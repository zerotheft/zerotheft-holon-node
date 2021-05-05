const ora = require('ora')
const chalk = require('chalk')
const URL = require('url');

const error = require('../utils/error')
const { isURL } = require('zerotheft-node-utils/utils/helpers')
const axios = require('axios')

const { getStorageValues } = require('zerotheft-node-utils/utils/storage.js')
const { MODE, PORT } = require('zerotheft-node-utils/config.js')
const { getHolonContract } = require('zerotheft-node-utils/utils/contract')
const { grantRole } = require('zerotheft-node-utils/utils/accessControl')

module.exports = async args => {
    const url = args.url
    let port = args.port
    const country = args.country
    const donationAddr = args.donation_address
    if (url === "" || url === undefined) {
        error(chalk.red('Please provide appropriate holon path'), true)
        return
    }

    if (port === "" || port === undefined) {
        error(chalk.red('Please provide appropriate holon port'), true)
        return
    }
    if (country === "" || country === undefined) {
        error(chalk.red('Please provide country'), true)
        return
    }
    if (donationAddr === "" || donationAddr === undefined) {
        error(chalk.red('Please provide donation address'), true)
        return
    }
    const holonPath = `${url.replace(/\/$/, "")}:${port}`

    if (!isURL(holonPath)) {
        error(chalk.red('Invalid holon url'), true)
        return
    }
    const holonURL = URL.parse(holonPath)
    if (MODE !== "development" && ["localhost", "127.0.0.1", ""].includes(holonURL.hostname)) {
        error(chalk.red('localhost URL not allowed'), true)
        return
    }
    if (MODE == "development") {
        port = PORT || 40107
    }
    const spinner = ora({ text: 'Registering Holon...', color: 'green' })

    try {
        const storage = (await getStorageValues()) || {}
        if (!storage.address) {
            error(chalk.red('Please use zt-holon create-account to create your etc account.'), true)
        }
        spinner.start()
        //perform status check of holon
        const response = await axios.get(`${holonURL.protocol}//${holonURL.hostname}:${port}/healthcheck`)
        if (response.data.success) {
            const holonContract = getHolonContract()
            //check if holon is already registered
            const holonIds = await holonContract.callSmartContractGetFunc('getHolonIds')
            if (holonIds.length > 0) {
                holonIds.forEach(async (holonID) => {
                    const holonInfo = await holonContract.callSmartContractGetFunc('getHolon', [holonID])
                    if (holonInfo.url === holonPath) {
                        error(chalk.red(chalk`${holonPath} holon already registered.`), true)
                    }

                })
            }

            //assign holon ownership to the user who executes command
            await grantRole(storage.address, "holonowner")
            //now add holon data in the blockchain
            const holonDetails = {
                url: holonPath,
                country
            }
            await holonContract.createTransaction('registerHolon', [JSON.stringify(holonDetails).replace('"', '\"'), response.data.status, donationAddr], 900000)

            spinner.stop()
            console.log(chalk.green(`Holon successfully registered and user has been assigned ownership of the holon.`))
        }
    } catch (e) {
        console.log(e)
        spinner.stop()
        error(chalk.red(e || 'There were some errors while performing action'), true)
    }
}