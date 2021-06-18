const fs = require('fs')
const { get, uniq, remove } = require('lodash')
const PromisePool = require('@supercharge/promise-pool')

const { getUserContract, getProposalContract, getVoterContract, getHolonContract } = require('zerotheft-node-utils').contracts
const { listVoteIds, updateVoteDataRollups, saveVoteRollupsData } = require('zerotheft-node-utils/contracts/votes')
const { voteDataRollupsFile } = require('zerotheft-node-utils/utils/common')
const { fetchProposalYaml, proposalYearTheftInfo } = require('zerotheft-node-utils/contracts/proposals')
const { getHolons } = require('zerotheft-node-utils/contracts/holons')
const { getUser } = require('zerotheft-node-utils/contracts/users')
const { createDir } = require('../../common')
const { lastExportedVid, failedVoteIDFile, keepCacheRecord, cacheToFileRecord, exportsDirNation } = require('./utils')
const { convertToAscii } = require('zerotheft-node-utils/utils/web3');

const { writeCsv } = require('./readWriteCsv')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')

/* get all votes and export them individually in json*/
const exportAllVotes = async (req) => {
  try {
    const userContract = await getUserContract()
    const proposalContract = await getProposalContract()
    const voterContract = await getVoterContract()
    const holonContract = await getHolonContract()

    let { userSpecificVotes, proposalVotes, proposalVoters, proposalArchiveVotes } = await voteDataRollupsFile()

    //get all the holons
    const allHolons = await getHolons('object', holonContract)

    //get all the voteIds
    let allVoteIds = await listVoteIds(voterContract)
    // let allVoteIds = [1712, 2182, 2766, 2770, 2769]
    // console.log(allVoteIds)
    // return
    //  allVoteIds = ['0xd6d7d417305741d4b50ca199a75dcd38a69083d40013ecac6a294d322befaded']
    console.log('Total votes::', allVoteIds.length)

    let count = 1;
    let lastVid = await lastExportedVid()
    console.log('lastVid', lastVid);
    await PromisePool
      .withConcurrency(10)
      .for(allVoteIds)
      .process(async voteID => {

        try {
          if (count > parseInt(lastVid)) {
            // if (1) {
            console.log('exporting voteID:: ', count, '::', voteID)
            //First get the votes info
            let { voter, voteIsTheft, proposalID, customTheftAmount, comment, date } = await voterContract.callSmartContractGetFunc('getVote', [voteID])
            const { holon, voteReplaces, voteReplacedBy } = await voterContract.callSmartContractGetFunc('getVoteExtra', [voteID])
            //get the voter information
            const { name, linkedin, country } = await getUser(voter, userContract)

            //get the voted proposal information
            const proposalInfo = await proposalContract.callSmartContractGetFunc('getProposal', [proposalID])
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
              "vote_type": voteIsTheft ? 'yes' : 'no',
              "alt_theft_amt": customTheftAmount,
              comment,
              "is_archive": !voteReplacedBy.includes(convertToAscii(0)) ? "yes" : "no",
              "vote_replaces": voteReplaces,
              "vote_replaced_by": voteReplacedBy,
              "timestamp": date,
              "holon_name": get(allHolons[holon], 'name', ''),
              "holon_url": get(allHolons[holon], 'url', ''),
              "holon_address": get(allHolons[holon], 'address', ''),
              "holon_country": get(allHolons[holon], 'country', ''),
              "voter_id": voter,
              "voter_name": name,
              "voter_country": country,
              "voter_linkedin": linkedin,
              "proposal_id": proposalID,
              "proposal_timestamp": proposalInfo.date

            }], `${voteDir}/votes.csv`)

            // keep the roll ups record in file
            updateVoteDataRollups({ userSpecificVotes, proposalVotes, proposalVoters, proposalArchiveVotes }, { voter, voteID, proposalID, voteReplaces }, proposalInfo)

            await keepCacheRecord('LAST_EXPORTED_VID', count)
          }
        } catch (e) {

          fs.appendFileSync(failedVoteIDFile, `${count}\n`);
          console.log('exportVote Error::', e)
          createLog(EXPORT_LOG_PATH, `'exportVote Error:: ${count} => ${e}`)
        }
        count++
      })

    //write the last exported User ID
    cacheToFileRecord('LAST_EXPORTED_VID', "votes")

    console.log('votes export is completed!!!!')

    lastVid = await lastExportedVid()

    //save all the rollups
    await saveVoteRollupsData({ userSpecificVotes, proposalVotes, proposalVoters, proposalArchiveVotes })

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