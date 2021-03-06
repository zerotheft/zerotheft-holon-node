/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
const fs = require('fs')
const { get } = require('lodash')
const csv = require('csvtojson')
const PromisePool = require('@supercharge/promise-pool')

const { getCitizenContract, getProposalContract, getVoteContract, getHolonContract } =
  require('zerotheft-node-utils').contracts
const {
  contractIdentifier,
  listVoteIds,
  updateVoteDataRollups,
  saveVoteRollupsData,
} = require('zerotheft-node-utils/contracts/votes')
const { voteDataRollupsFile } = require('zerotheft-node-utils/utils/common')
const { fetchProposalYaml } = require('zerotheft-node-utils/contracts/proposals')
const { getHolons } = require('zerotheft-node-utils/contracts/holons')
const { getCitizen, getCitizenIdByAddress } = require('zerotheft-node-utils/contracts/citizens')
const { createDir, exportsDir, writeFile } = require('../../common')
const { lastExportedVid, failedVoteIDFile, keepCacheRecord, cacheToFileRecord, exportsDirNation } = require('./utils')

const { writeCsv } = require('./readWriteCsv')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')

/* get all votes and export them individually in json */
const exportAllVotes = async () => {
  try {
    const citizenContract = await getCitizenContract()
    const proposalContract = await getProposalContract()
    const voterContract = await getVoteContract()
    const holonContract = await getHolonContract()

    const { citizenSpecificVotes, proposalVotes, proposalVoters, proposalArchiveVotes, hierarchyAreaVotes } =
      await voteDataRollupsFile()

    // get all the holons
    const allHolons = await getHolons('object', holonContract)
    // get all the voteIds
    const { allVotes, allVotesCount } = await listVoteIds(voterContract)
    console.log('Total votes::', allVotesCount)

    let count = 1
    let lastVid = await lastExportedVid()
    console.log('lastVid', lastVid)
    const fileDir = Date.now()
    await PromisePool.withConcurrency(1)
      .for(Object.keys(allVotes))
      .process(async version => {
        await PromisePool.withConcurrency(1)
          .for(allVotes[version])
          .process(async voteID => {
            try {
              if (count > parseInt(lastVid)) {
                // if (1) {
                console.log('exporting voteID:: ', count, '::', voteID)
                const voteKey = `${contractIdentifier}:${version}:${voteID}`
                // First get the votes info
                const { voter, voteIsTheft, yesTheftProposal, noTheftProposal, customTheftAmount, comment, date } =
                  await voterContract.callSmartContractGetFunc('getVote', [voteKey])
                const { hierarchyPath: votedPath, holon } = await voterContract.callSmartContractGetFunc(
                  'getVoteExtra',
                  [voteKey]
                )
                // get the voter information
                const cres = await getCitizenIdByAddress(voter, citizenContract)
                const { name, linkedin, country } = await getCitizen(cres.citizenID, citizenContract)
                const proposalID = voteIsTheft === 'True' ? yesTheftProposal : noTheftProposal
                // get the voted proposal information
                const proposalInfo = await proposalContract.callSmartContractGetFunc('getProposal', [proposalID])
                const proposalYaml = await proposalContract.callSmartContractGetFunc('getProposalYaml', [
                  proposalInfo.yamlBlock,
                ])

                const outputFiles = await fetchProposalYaml(
                  proposalContract,
                  proposalYaml.firstBlock,
                  1,
                  [],
                  undefined,
                  1
                )
                const file = fs.readFileSync(outputFiles[0], 'utf-8')
                const countryReg = file.match(/summary_country: ("|')?([^("|'|\n)]+)("|')?/i)
                const summaryCountry = countryReg ? countryReg[2] : 'USA'
                const hierarchy = file.match(/hierarchy: ("|')?([^("|'|\n)]+)("|')?/i)[2]
                // Start writing it in the file
                const voteDir = `${exportsDirNation}/${summaryCountry}/${hierarchy}/votes`
                await createDir(voteDir)
                writeCsv(
                  [
                    {
                      id: voteKey,
                      vote_type: voteIsTheft,
                      alt_theft_amt: customTheftAmount,
                      yes_theft_proposal: yesTheftProposal,
                      no_theft_proposal: noTheftProposal,
                      comment,
                      timestamp: date,
                      holon_id: holon,
                      holon_name: get(allHolons[holon], 'name', ''),
                      holon_url: get(allHolons[holon], 'url', ''),
                      holon_address: get(allHolons[holon], 'owner', ''),
                      holon_donation_address: get(allHolons[holon], 'donationAddress', ''),
                      voter_id: cres.citizenID,
                      voter_address: voter,
                      voter_name: name,
                      voter_country: country,
                      voter_linkedin: linkedin,
                      proposal_id: proposalID,
                      proposal_timestamp: proposalInfo.date,
                    },
                  ],
                  `${voteDir}/${fileDir}.csv`
                )

                // keep the roll ups record in file
                await updateVoteDataRollups(
                  { citizenSpecificVotes, proposalVotes, proposalVoters, proposalArchiveVotes, hierarchyAreaVotes },
                  { voter, votedPath, voteID: voteKey, proposalID, castedOn: date },
                  proposalInfo,
                  voterContract
                )

                await keepCacheRecord('LAST_EXPORTED_VID', count)

                // save the last created file name of csv
                writeFile(`${voteDir}/.latest_csv_file`, fileDir)
              }
            } catch (e) {
              fs.appendFileSync(failedVoteIDFile, `${count}\n`)
              console.log('exportVote Error::', e)
              createLog(EXPORT_LOG_PATH, `'exportVote Error:: ${count} => ${e}`)
            }
            count++
          })
      })
    // write the last exported Citizen ID
    cacheToFileRecord('LAST_EXPORTED_VID', 'votes')

    console.log('votes export is completed!!!!')

    lastVid = await lastExportedVid()
    // save all the rollups
    await saveVoteRollupsData({
      citizenSpecificVotes,
      proposalVotes,
      proposalVoters,
      proposalArchiveVotes,
      hierarchyAreaVotes,
    })

    createLog(EXPORT_LOG_PATH, `All voters exported. The last voter exported is ${lastVid}`)
  } catch (e) {
    console.log(`exportAllVotes Error::`, e)
    createLog(EXPORT_LOG_PATH, `exportAllVotes Error:: ${e}`)
  }
}

/* get all votes in json */
const getVoteData = async referencePath => {
  try {
    const path = `nation_data/USA/${referencePath}/votes`
    const fileName = fs.readFileSync(`${exportsDir}/${path}/.latest_csv_file`, 'utf8').toString()
    const votes = await csv().fromFile(`${exportsDir}/${path}/${fileName.replace('\n', '')}.csv`)
    return votes
  } catch (e) {
    console.log(`getting Votes Error::`, e)
  }
}

module.exports = {
  exportAllVotes,
  getVoteData,
}
