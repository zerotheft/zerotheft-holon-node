const { getHolonContract } = require('zerotheft-node-utils').contracts
const { getHolons } = require('zerotheft-node-utils/contracts/holons')
const { writeCsv } = require('./readWriteCsv')
const { exportsDir } = require('./utils')

/* get all Holons*/
const exportAllHolons = async () => {
  try {

    const holonContract = await getHolonContract()

    //get all holons in array
    const holons = await getHolons('array', holonContract)

    //get the holons
    writeCsv(holons, `${exportsDir}/holons.csv`, true)
    console.log('holons export is completed!!!!')

  }
  catch (e) {
    console.log('exportAllHolons Error:: ', e)
  }
}

module.exports = {
  exportAllHolons
}