const { allNations } = require('zerotheft-node-utils').paths
const { allYearCachedData } = require('../calcEngineServices')
const { createDir, writeFile, exportsDir } = require('../../common')

/* get cached report information  and export in JSON file*/
const exportCachedReport = async () => {
  try {
    let allNationPaths = await allNations()
    const promises = allNationPaths.map(async (nationData) => {
      const nation = nationData.nation
      const allYearData = await allYearCachedData(nation)
      const nationDir = `${exportsDir}/nation_reports/${nation}`
      await createDir(nationDir)
      await writeFile(`${nationDir}/all_year_report.json`, allYearData)
    })
    await Promise.all(promises)
    return { message: `all year report exported` }
  }
  catch (e) {
    return { error: e.message }
  }
}




module.exports = {
  exportCachedReport
}