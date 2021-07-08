const ora = require('ora')
const chalk = require('chalk')
const URL = require('url');

const error = require('../utils/error')
const { isURL } = require('zerotheft-node-utils/utils/helpers')
const axios = require('axios')

const { getStorageValues } = require('zerotheft-node-utils/utils/storage.js')
const { MODE, PORT } = require('zerotheft-node-utils/config.js')
const { getHolonContract, getCitizenContract } = require('zerotheft-node-utils/utils/contract')
const { grantRole } = require('zerotheft-node-utils/utils/accessControl')
const { getCitizen } = require('zerotheft-node-utils/contracts/citizens')


module.exports = async args => {
    const name = args.name
    const url = args.url
    const donationAddr = args.donation_address
    if (url === "" || url === undefined) {
        error(chalk.red('Please provide appropriate holon url along with port(if any) eg:https://abc.com:8585'), true)
        return
    }
    if (name === "" || name === undefined) {
        error(chalk.red('Please provide holon name'), true)
        return
    }
    if (donationAddr === "" || donationAddr === undefined) {
        error(chalk.red('Please provide donation address'), true)
        return
    }
    const holonPath = `${url.replace(/\/$/, "")}`

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
        //check if citizen address is in the blockchain
        const userContract = getCitizenContract()
        const userData = await getCitizen(storage.address, userContract)
        if (!userData.success) {
            error(chalk.red(userData.error), true)
        }
        //perform status check of holon
        const response = await axios.get(`${holonURL.protocol}//${holonURL.hostname}/healthcheck`)
        if (response.data.success) {
            const holonContract = getHolonContract()
            //assign holon ownership to the citizen who executes command
            await grantRole(storage.address, "holonowner")
            //now add holon data in the blockchain
            const holonDetails = {
                url: holonPath,
                country
            }
            await holonContract.createTransaction('registerHolon', [name, url, donationAddr, response.data.status], 900000)

            spinner.stop()
            console.log(chalk.green(`Holon successfully registered and citizen has been assigned ownership of the holon.`))
        }
    } catch (e) {
        console.log(e)
        spinner.stop()
        error(chalk.red(e || 'There were some errors while performing action'), true)
    }
}
