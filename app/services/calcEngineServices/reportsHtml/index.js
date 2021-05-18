const fs = require('fs')
const head = require('./head')
const downloadBtn = require('./downloadBtn')
const header = require('./header')
const theftBlocks = require('./theftBlocks')
const lineGraph = require('./lineGraph')
const charts = require('./charts')
const leadingProposal = require('./leadingProposal')
const foot = require('./foot')

const singleReport = (args) => {
  fs.writeFileSync('test.html', `${head()}${downloadBtn()}${header()}${theftBlocks()}${lineGraph()}${charts()}${leadingProposal()}${foot()}`)
}
module.exports = singleReport