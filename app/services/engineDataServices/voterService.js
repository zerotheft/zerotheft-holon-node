const PromisePool = require('@supercharge/promise-pool')

const { getUserContract } = require('zerotheft-node-utils').contracts
const { getUser, listUserIds } = require('zerotheft-node-utils/contracts/users')
const { lastExportedUid, failedUserIDFile, keepCacheRecord, cacheToFileRecord } = require('./utils')
const { writeCsv } = require('./readWriteCsv')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')
const { createDir, exportsDir } = require('../../common')


const exportAllVoters = async () => {
  try {
    await createDir(exportsDir)

    const userContract = await getUserContract()

    //get all voter addresses
    const userIds = await listUserIds(userContract)
    console.log('Total Users::', userIds.length)

    let count = 1;
    let lastUid = await lastExportedUid()
    console.log('lastUId', lastUid)

    await PromisePool
      .withConcurrency(10)
      .for(userIds)
      .process(async uid => {
        let userData = {}
        try {
          if (count > parseInt(lastUid)) {
            console.log('exporting UID::', count, '::', uid)

            userData = await getUser(uid, userContract)
            //if user found then add in csv
            if (userData.success)
              writeCsv([{
                id: uid, name: userData.name, country: userData.country, linkedin_url: userData.linkedin
              }], `${exportsDir}/users.csv`)

            await keepCacheRecord('LAST_EXPORTED_UID', count)

          }
        } catch (e) {

          fs.appendFileSync(failedUserIDFile, `${count}\n`);
          console.log('exportVoter Error::', e)
          createLog(EXPORT_LOG_PATH, `'exportVoter Error:: ${count} => ${e}`)

        }
        count++

      })

    //write the last exported User ID
    cacheToFileRecord('LAST_EXPORTED_UID', "users")

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