const fs = require('fs')
const PromisePool = require('@supercharge/promise-pool')

const { getUserContract, getProposalContract, getVoterContract, getHolonContract } = require('zerotheft-node-utils').contracts
const { listVoteIds } = require('zerotheft-node-utils/contracts/votes')
const { fetchProposalYaml } = require('zerotheft-node-utils/contracts/proposals')
const { getHolons } = require('zerotheft-node-utils/contracts/holons')
const { getUser } = require('zerotheft-node-utils/contracts/users')
const { createDir } = require('../../common')
const { lastExportedVid, failedVoteIDFile, keepCacheRecord, cacheToFileRecord, exportsDirNation } = require('./utils')
const { writeCsv } = require('./readWriteCsv')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')

/* get all votes and export them individually in json*/
const exportAllVotes = async (req) => {
  try {
    const userContract = await getUserContract()
    const proposalContract = await getProposalContract()
    const voterContract = await getVoterContract()
    const holonContract = await getHolonContract()

    //get all the holons
    const allHolons = await getHolons('object', holonContract)

    //get all the voteIds
    let allVoteIds = await listVoteIds(voterContract)
    // let allVoteIds = [1712, 2182, 2766, 2770, 2769]
    console.log('Total votes::', allVoteIds.length)

    let lastVid = await lastExportedVid()
    await PromisePool
      .withConcurrency(10)
      .for(allVoteIds)
      .process(async voteID => {

        try {
          if (parseInt(voteID) > parseInt(lastVid)) {
            console.log('exporting voteID:: ', voteID)
            //First get the votes info
            let { voter, voteType, proposalID, altTheftAmt, comment, date } = await voterContract.callSmartContractGetFunc('getVote', [parseInt(voteID)])
            const { holon, isFunded, isArchive } = await voterContract.callSmartContractGetFunc('getVoteExtra', [parseInt(voteID)])
            //get the voter information
            const { name, linkedin, country } = await getUser(voter, userContract)

            //get the voted proposal information
            const proposalInfo = await proposalContract.callSmartContractGetFunc('getProposal', [parseInt(proposalID)])
            outputFiles = await fetchProposalYaml(proposalContract, proposalInfo.yamlBlock, 1, [], undefined, 1)
            const file = fs.readFileSync(outputFiles[0], 'utf-8')
            const countryReg = file.match(/summary_country: ("|')?([^("|'|\n)]+)("|')?/i)
            let summaryCountry = countryReg ? countryReg[2] : 'USA'
            const hierarchy = file.match(/hierarchy: ("|')?([^("|'|\n)]+)("|')?/i)[2]

            //Start writing it in the file
            const voteDir = `${exportsDirNation}/${summaryCountry}/${hierarchy}/votes`
            await createDir(voteDir)
            writeCsv([{
              "id": voteID,
              "vote_type": voteType ? 'yes' : 'no',
              "alt_theft_amt": altTheftAmt,
              comment,
              "is_funded": isFunded ? 'yes' : 'no',
              "is_archive": isArchive ? 'yes' : 'no',
              "timestamp": date,
              "holon_name": allHolons[holon].name,
              "holon_url": allHolons[holon].url,
              "holon_address": allHolons[holon].address,
              "holon_country": allHolons[holon].country,
              "voter_id": voter,
              "voter_name": name,
              "voter_country": country,
              "voter_linkedin": linkedin,
              "proposal_id": proposalID,
              "proposal_timestamp": proposalInfo.date

            }], `${voteDir}/votes.csv`)
            await keepCacheRecord('LAST_EXPORTED_VID', parseInt(voteID))

          }
        } catch (e) {

          fs.appendFileSync(failedVoteIDFile, `${parseInt(voteID)}\n`);
          console.log('exportVote Error::', e)
          createLog(EXPORT_LOG_PATH, `'exportVote Error:: ${voteID} => ${e}`)
        }
      })

    //write the last exported User ID
    cacheToFileRecord('LAST_EXPORTED_VID', "votes")

    console.log('votes export is completed!!!!')

    lastVid = await lastExportedVid()
    createLog(EXPORT_LOG_PATH, `All voters exported. The last voter exported is ${lastVid}`)
  }
  catch (e) {
    console.log(`exportAllVotes Error::`, e)
    createLog(EXPORT_LOG_PATH, `exportAllVotes Error:: ${e}`)

  }
}



module.exports = {
  exportAllVotes
}