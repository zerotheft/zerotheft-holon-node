module.exports = (message, exit) => {
  process.stdout.clearLine()
  console.log(message)
  exit && process.exit(1)
}
