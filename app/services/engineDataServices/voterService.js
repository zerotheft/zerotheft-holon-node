const PromisePool = require('@supercharge/promise-pool')
const fs = require('fs')

const { getCitizenContract } = require('zerotheft-node-utils').contracts
const {
  contractIdentifier,
  getCitizen,
  listCitizenIds,
  getCitizenContractVersion,
} = require('zerotheft-node-utils/contracts/citizens')
const csv = require('csvtojson')
const { lastExportedUid, failedCitizenIDFile, keepCacheRecord, cacheToFileRecord } = require('./utils')
const { writeCsv } = require('./readWriteCsv')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')
const { createDir, exportsDir, writeFile } = require('../../common')

const exportAllVoters = async () => {
  try {
    await createDir(exportsDir)

    const citizenContract = await getCitizenContract()
    // get all voter addresses
    const { allVoters, allVotersCount } = await listCitizenIds(citizenContract)
    console.log('Total Citizens::', allVotersCount)

    let count = 1
    let lastUid = await lastExportedUid()
    console.log('lastUId', lastUid)
    const citizensDir = `${exportsDir}/citizens`
    const fileDir = Date.now()
    await PromisePool.withConcurrency(1)
      .for(Object.keys(allVoters))
      .process(async version => {
        await PromisePool.withConcurrency(10)
          .for(allVoters[version])
          .process(async uid => {
            let citizenData = {}
            try {
              if (count > parseInt(lastUid)) {
                console.log('exporting UID::', count, '::', uid)
                uid = `${contractIdentifier}:${version}:${uid}`
                citizenData = await getCitizen(uid, citizenContract)

                await createDir(citizensDir)

                // if citizen found then add in csv
                if (citizenData.success) {
                  writeCsv(
                    [
                      {
                        id: uid,
                        address: citizenData.address,
                        firstName: citizenData.firstName,
                        middleName: citizenData.middleName,
                        lastName: citizenData.lastName,
                        country: citizenData.country,
                        citizenship: citizenData.citizenship,
                        currentState: citizenData.currentState,
                        currentCity: citizenData.currentCity,
                        currentZip: citizenData.currentZip,
                        version: citizenData.version,
                        linkedin: citizenData.linkedin,
                        createdAt: citizenData.createdAt,
                      },
                    ],
                    `${citizensDir}/${fileDir}.csv`
                  )
                }

                await keepCacheRecord('LAST_EXPORTED_UID', count)
              }
            } catch (e) {
              fs.appendFileSync(failedCitizenIDFile, `${count}\n`)
              console.log('exportVoter Error::', e)
              createLog(EXPORT_LOG_PATH, `'exportVoter Error:: ${count} => ${e}`)
            }
            count++
          })
      })
    // write the last exported Citizen ID
    cacheToFileRecord('LAST_EXPORTED_UID', 'citizens')

    console.log('voters export is completed!!!!')
    lastUid = await lastExportedUid()
    // save the last created file name of csv
    writeFile(`${citizensDir}/.latest_csv_file`, fileDir)
    createLog(EXPORT_LOG_PATH, `All voters exported. The last voter exported is ${lastUid}`)
  } catch (e) {
    console.log(`exportAllVoters Error::`, e)
    createLog(EXPORT_LOG_PATH, `exportAllVoters Error:: ${e}`)
  }
}

/* get all citizens in json */
const getVoterData = async req => {
  try {
    const fileName = fs.readFileSync(`${exportsDir}/citizens/.latest_csv_file`, 'utf8').toString()
    const citizens = await csv().fromFile(`${exportsDir}/citizens/${fileName.replace('\n', '')}.csv`)
    return citizens
  } catch (e) {
    console.log(`getting Votes Error::`, e)
  }
}

module.exports = {
  exportAllVoters,
  getVoterData,
}
