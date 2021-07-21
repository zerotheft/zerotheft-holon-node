const fs = require('fs')
const csv = require('csvtojson');
const { uniq } = require('lodash')
const yaml = require('js-yaml')
const splitFile = require('split-file');
const PromisePool = require('@supercharge/promise-pool')
const { getProposalContract } = require('zerotheft-node-utils').contracts
const { contractIdentifier, fetchProposalYaml, listProposalIds, proposalYearTheftInfo, getProposalContractVersion } = require('zerotheft-node-utils/contracts/proposals')
const { createDir, exportsDir } = require('../../common')
const { exportsDirNation, lastExportedPid, failedProposalIDFile, keepCacheRecord, cacheToFileRecord } = require('./utils')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')
const { writeCsv } = require('./readWriteCsv')
const proposalsCsv = `${exportsDir}/proposals.csv`
//main method that process all proposal IDs
const processProposalIds = async (proposalContract, proposalIds, version, count, lastPid, isFailed = false) => {
  await PromisePool
    .withConcurrency(10)
    .for(proposalIds)
    .process(async pid => {
      try {

        const propKey = version === "v0" ? pid : `${contractIdentifier}:${version}:${pid}`
        if (count > parseInt(lastPid) || isFailed) {
          console.log('Exporting proposalId::', count, '::', propKey)
          const proposal = await proposalContract.callSmartContractGetFunc('getProposal', [propKey])

          let tmpYamlPath = `/tmp/main-${proposal.yamlBlock}.yaml`
          if (Object.keys(proposal).length > 0) {
            let proposalYaml;
            try { proposalYaml = await proposalContract.callSmartContractGetFunc('getProposalYaml', [proposal.yamlBlock]) }
            catch (e) {
              console.log(e)
            }

            outputFiles = await fetchProposalYaml(proposalContract, proposalYaml.firstBlock, 1)
            await splitFile.mergeFiles(outputFiles, tmpYamlPath)
            file = yaml.load(fs.readFileSync(tmpYamlPath, 'utf-8'))
            let { theftAmt } = proposalYearTheftInfo(file)

            const proposalDir = `${exportsDirNation}/${file.summary_country || 'USA'}/${file.hierarchy}/proposals`
            await createDir(proposalDir)
            fs.createReadStream(tmpYamlPath).pipe(fs.createWriteStream(`${proposalDir}/${propKey}_proposal-${proposal.date}.yaml`));
            //save every proposal in csv
            writeCsv([{
              "id": propKey,
              "country": `${file.summary_country || 'USA'}`,
              "path": file.hierarchy,
              "theft_amount": theftAmt,
              "date": proposal.date
            }], proposalsCsv)

            for (let index = 0; index < outputFiles.length; index++) {
              if (fs.existsSync(outputFiles[index])) { fs.unlinkSync(outputFiles[index]); }
            }
          }
        }
        await keepCacheRecord('LAST_EXPORTED_PID', count)

      } catch (e) {
        fs.appendFileSync(failedProposalIDFile, `${propKey}\n`);
        console.log(e.message)
        createLog(EXPORT_LOG_PATH, `'exportProposal Error:: ${count} => ${e}`)

      }
      count++
    })

}

/* get raw votes from the blockchain*/
const exportAllProposals = async () => {
  try {
    const proposalContract = await getProposalContract()

    //get the last exported proposal ID
    const { allProposals, allProposalsCount } = await listProposalIds(proposalContract)
    console.log('Total proposals::', allProposalsCount)

    let count = 1;
    let lastPid = await lastExportedPid()
    console.log('lastPid', lastPid)

    await PromisePool
      .withConcurrency(1)
      .for(Object.keys(allProposals))
      .process(async version => {
        await processProposalIds(proposalContract, allProposals[version], version, count, lastPid)
        count = allProposals[version].length + 1
      })
    //write the last exported Proposal ID
    cacheToFileRecord('LAST_EXPORTED_PID', "proposals")

    console.log('proposals export is completed!!!!')

    lastPid = await lastExportedPid()

    createLog(EXPORT_LOG_PATH, `All proposals exported. The last proposal ID exported is ${lastPid}`)
  }
  catch (e) {
    console.log(`exportAllProposals Error::`, e)
    createLog(EXPORT_LOG_PATH, `exportAllProposals Error:: ${e}`)

  }
}

/*export proposals from failed list*/
const exportFailedProposals = async () => {
  const proposalContract = await getProposalContract()
  try {
    var proposalIds = fs.readFileSync(failedProposalIDFile, 'utf8').trim().split('\n').map(i => i)
    createLog(EXPORT_LOG_PATH, `Processing ${uniq(proposalIds).length} failed proposals.`)

    //remove failed report file
    fs.unlinkSync(failedProposalIDFile)
    await processProposalIds(proposalContract, uniq(proposalIds), "v0", 1, undefined, true)
  } catch (e) {
    console.log(e.message)
  }
  //write the last exported Proposal ID
  cacheToFileRecord('LAST_EXPORTED_PID', "proposals")
}

/*convert csv file to json*/
const allProposalsJSON = async () => {
  const json = await csv().fromFile(proposalsCsv);
  return json
}

/* get all votes in json*/
const getProposalData = async () => {
  try {
    const proposals = await csv().fromFile(`${exportsDir}/proposals.csv`)
    return proposals
  }
  catch (e) {
    console.log(`getting Votes Error::`, e)
  }
}

module.exports = {
  exportAllProposals,
  exportFailedProposals,
  allProposalsJSON,
  getProposalData
}