const fs = require('fs')
const chalk = require('chalk')
const ora = require('ora')
const scrapedin = require('scrapedin')
const inquirer = require('inquirer');
const { createAccount } = require('zerotheft-node-utils/utils/web3')
const { getHolonContract } = require('zerotheft-node-utils/utils/contract')
const { updateLinkedinCookieValues, updateProxyHolonValues, getStorageValues } = require('zerotheft-node-utils/utils/storage')
const error = require('../utils/error')

module.exports = async () => {
  const proxyStorage = getStorageValues('proxy') || {}
  const storage = getStorageValues() || {}
  if (!proxyStorage.address) {
    const proxyAccount = await createAccount('proxy')
    if (!storage.address)
      error(chalk.red('Please use zt-holon create-account to create your etc account. You can also use zt-holon import-account --private-key <privateKey>  to import your existing account '), true)
    try {
      const holonContract = getHolonContract()
      await holonContract.createTransaction('updateProxyAddress', [storage.address, proxyAccount.address], 800000)
    } catch (e) {
      error(chalk.red(e || 'Something went wrong'), true)
    }
  }

  let answers = { proxy: true }
  const initials = await initialQuestions()
  answers = { ...answers, ...initials }
  if (answers.linkedin === true) {
    const { cookie } = await linkedinCookie()
    if (cookie) {
      try {
        const file = fs.readFileSync(cookie)
        const cookies = JSON.parse(file)
        const options = {
          cookies
        }
        const spinner = ora({ text: 'Validating...', color: 'green' }).start()
        const profileScraper = await scrapedin(options)
        const profile = await profileScraper('https://www.linkedin.com/company/linkedin')
        spinner.stop()
        if (!profile) error('Please provide valid cookie');
        await updateLinkedinCookieValues(cookies)
        console.log(chalk.blue('Once you are logged out from your browser, this cookie wont work. Please make sure to update the cookie then.'))
      } catch (e) {
        error(chalk.red('Please check the cookies or path you have provided'), true)
      }
    }
    const linkedin = await linkedinValidations()
    answers = { ...answers, ...linkedin }
  }
  console.log(chalk.green('Settings successfully saved.'))
  await updateProxyHolonValues(answers)
  process.exit()
}

const initialQuestions = async () => {
  return inquirer
    .prompt([
      {
        name: 'maxVotes', message: 'Maximum votes a voter can vote by using this method:', type: 'input', default: 1, validate: i => {
          if (isNaN(i)) return 'Please provide valid number';
          return true;
        }
      },
      { name: 'linkedin', message: 'Do you want to verify by citizen\'s linked in profile? You need to give us cookie of the linkedin account.', type: 'confirm' }
    ])
}

const linkedinCookie = async () => {
  return inquirer
    .prompt([
      {
        name: 'cookie', message: `Linkedin cookie file path: (If you don't know how to do that, we suggest to install EditThisCookie chrome extension, after installing open a logged LinkedIn website and via the extension click on export and paste it to a json file.)`, type: 'input', validate: async i => {
          try {
            const cookies = fs.readFileSync(i)
            return true
          } catch (e) {
            return 'Please provide valid file path'
          }
        }
      }
    ])
}
const linkedinValidations = async () => {
  return inquirer
    .prompt([
      {
        name: 'connections', message: 'How many minimum connections should the profile have?', type: 'input', default: 5, validate: i => {
          if (isNaN(i)) return 'Please provide valid number';
          return true;
        }
      },
      { name: 'profileSufficiency', message: 'Do you want to enable our profile sufficiency check', type: 'confirm' }
    ])
}