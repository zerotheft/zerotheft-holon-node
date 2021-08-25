const minimist = require('minimist')
const error = require('./utils/error')

module.exports = () => {
  const args = minimist(process.argv.slice(2), { string: ['from', 'to', 'citizen', 'donation_address'] })
  let cmd = args._[0] || 'help'

  if (args.version || args.v) {
    cmd = 'version'
  }

  if (args.help || args.h) {
    cmd = 'help'
  }

  switch (cmd) {
    case 'my-account':
      require('./cmds/myAccount')(args)
      break
    case 'create-account':
      require('./cmds/createAccount')(args)
      break
    case 'register-citizen':
      require('./cmds/registerCitizen')(args)
      break

    case 'get-balance':
      require('./cmds/getBalance')(args)
      break

    case 'greeting':
      require('./cmds/greeting')(args)
      break

    case 'import-account':
      require('./cmds/importAccount')(args)
      break

    case 'register-holon':
      require('./cmds/registerHolon')(args)
      break
    case 'donation-address':
      require('./cmds/donationAddress')(args)
      break
    case 'register-proxy-voter':
      require('./cmds/registerProxyVoter')(args)
      break

    case 'update-proxy-settings':
      require('./cmds/updateProxySettings')(args)
      break

    case 'version':
      require('./cmds/version')(args)
      break

    case 'help':
      require('./cmds/help')(args)
      break

    default:
      error(`"${cmd}" is not a valid command!`)
      break
  }
}
