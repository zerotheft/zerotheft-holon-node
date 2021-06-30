const PromisePool = require('@supercharge/promise-pool')

const { getCitizenContract } = require('zerotheft-node-utils').contracts
const { getCitizen, listCitizenIds } = require('zerotheft-node-utils/contracts/citizens')
const { lastExportedUid, failedCitizenIDFile, keepCacheRecord, cacheToFileRecord } = require('./utils')
const { writeCsv } = require('./readWriteCsv')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')
const { createDir, exportsDir } = require('../../common')


const exportAllVoters = async () => {
  try {
    await createDir(exportsDir)

    const citizenContract = await getCitizenContract()

    //get all voter addresses
    const citizenIds = await listCitizenIds(citizenContract)
    console.log('Total Citizens::', citizenIds.length)

    let count = 1;
    let lastUid = await lastExportedUid()
    console.log('lastUId', lastUid)
    const fileDir = `${Date.now()}`

    await PromisePool
      .withConcurrency(10)
      .for(citizenIds)
      .process(async uid => {
        let citizenData = {}
        try {
          if (count > parseInt(lastUid)) {
            console.log('exporting UID::', count, '::', uid)

            citizenData = await getCitizen(uid, citizenContract)
            const citizensDir = `${exportsDir}/citizens`
            await createDir(citizensDir)

            //if citizen found then add in csv
            if (citizenData.success)
              writeCsv([{
                id: uid, name: citizenData.name, country: citizenData.country, linkedin_url: citizenData.linkedin
              }], `${citizensDir}/${fileDir}.csv`)

            await keepCacheRecord('LAST_EXPORTED_UID', count)

          }
        } catch (e) {

          fs.appendFileSync(failedCitizenIDFile, `${count}\n`);
          console.log('exportVoter Error::', e)
          createLog(EXPORT_LOG_PATH, `'exportVoter Error:: ${count} => ${e}`)

        }
        count++

      })

    //write the last exported Citizen ID
    cacheToFileRecord('LAST_EXPORTED_UID', "citizens")

    console.log('voters export is completed!!!!')
    lastUid = await lastExportedUid()
    createLog(EXPORT_LOG_PATH, `All voters exported. The last voter exported is ${lastUid}`)

  }
  catch (e) {
    console.log(`exportAllVoters Error::`, e)
    createLog(EXPORT_LOG_PATH, `exportAllVoters Error:: ${e}`)
  }
}

module.exports = {
  exportAllVoters
}