const ora = require('ora')
const chalk = require('chalk')

const error = require('../utils/error')
const { getCitizenContract } = require('zerotheft-node-utils/utils/contract')
const { getStorageValues } = require('zerotheft-node-utils/utils/storage.js')

module.exports = async (args) => {
    const firstname = args.firstname || ""
    const middlename = args.middlename || ""
    const lastname = args.lastname || ""
    const country = args.country || ""
    const citizenship = args.citizenship || ""
    const currentState = args.state || ""
    const currentCity = args.city || ""
    const currentZip = args.zip || ""
    const linkedin = args.linkedin || ""

    if (firstname === "" || firstname === undefined) {
        error(chalk.red('Please provide firstname'), true)
        return
    }
    if (country === "" || country === undefined) {
        error(chalk.red('Please provide country name'), true)
        return
    }
    if (linkedin === "" || linkedin === undefined) {
        error(chalk.red('Please provide linkedin url'), true)
        return
    }
    const spinner = ora({ text: 'Loading...', color: 'green' }).start()
    try {
        const contract = getCitizenContract()
        const storage = await getStorageValues()

        await contract.createTransaction('createCitizen', [firstname, middlename, lastname, country, citizenship, currentState, currentCity, currentZip, linkedin, storage.address], 900000)
        spinner.stop()
        console.log(chalk.green(`Citizen registration completed`))
    } catch (e) {
        console.log(e)
        spinner.stop()
        error(chalk.red(e || 'There were some errors while performing action'), true)
    }
}
