const menus = {
  main: `
    zt-holon [command] <options>

    my-account                                                                                        ... view your account details
    create-account                                                                                    ... creates your new account
    register-citizen  --firstname "<firstname>" --middlename "<middlename>" --lastname "<lastname>"  
    --country "<country>" --citizenship "<citizenship>" --state "<state>" 
    --city "<city>" --zip "<zip>" --linkedin "<linkedin>"                                             ... register citizen
    get-balance                                                                                       ... get the ETC balance in your account
    greeting                                                                                          ... greets
    import-account --private-key <privateKey>                                                         ... imports the account using private key
    register-holon --url <url> --name <name> --donation_address <address>                             ... registers your holon into blockchain
    register-proxy-voter                                                                              ... registers for proxy voting so that voter can vote through your account
    update-proxy-settings                                                                             ... updates the proxy settings
    version                                                                                           ... show package version
    help                                                                                              ... show help menu for a command
`,

  greeting: `
    zt-holon greeting .....greets you`
}

module.exports = (args) => {
  const subCmd = args._[0] === 'help'
    ? args._[1]
    : args._[0]

  console.log(menus[subCmd] || menus.main)
}
