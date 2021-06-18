const fs = require('fs')
const csv = require('csvtojson');
const { uniq } = require('lodash')
const yaml = require('js-yaml')
const splitFile = require('split-file');
const PromisePool = require('@supercharge/promise-pool')
const { getProposalContract } = require('zerotheft-node-utils').contracts
const { fetchProposalYaml, listProposalIds, proposalYearTheftInfo } = require('zerotheft-node-utils/contracts/proposals')
const { createDir, exportsDir } = require('../../common')
const { exportsDirNation, lastExportedPid, failedProposalIDFile, keepCacheRecord, cacheToFileRecord } = require('./utils')
const { createLog, EXPORT_LOG_PATH } = require('../LogInfoServices')
const { writeCsv } = require('./readWriteCsv')
const proposalsCsv = `${exportsDir}/proposals.csv`
//main method that process all proposal IDs
const processProposalIds = async (proposalContract, proposalIds, count, lastPid, isFailed = false) => {
  await PromisePool
    .withConcurrency(10)
    .for(proposalIds)
    .process(async pid => {
      try {
        if (count > parseInt(lastPid) || isFailed) {
          // if ((parseInt(pid) > parseInt(lastPid)) || isFailed) {
          console.log('Exporting proposalId::', count, '::', pid)
          const proposal = await proposalContract.callSmartContractGetFunc('getProposal', [pid])
          let tmpYamlPath = `/tmp/main-${proposal.yamlBlock}.yaml`

          if (Object.keys(proposal).length > 0) {
            outputFiles = await fetchProposalYaml(proposalContract, proposal.yamlBlock, 1)
            await splitFile.mergeFiles(outputFiles, tmpYamlPath)
            file = yaml.load(fs.readFileSync(tmpYamlPath, 'utf-8'))
            let { theftYears, theftAmt } = proposalYearTheftInfo(file)

            const proposalDir = `${exportsDirNation}/${file.summary_country || 'USA'}/${file.hierarchy}/proposals`
            await createDir(proposalDir)
            fs.createReadStream(tmpYamlPath).pipe(fs.createWriteStream(`${proposalDir}/${pid}_proposal-${proposal.date}.yaml`));

            //save every proposal in csv
            writeCsv([{
              "id": pid,
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
        fs.appendFileSync(failedProposalIDFile, `${count}\n`);
        console.log(e.message)
        createLog(EXPORT_LOG_PATH, `'exportProposal Error:: ${count} => ${e}`)

      }
      count++
    })

  //write the last exported Proposal ID
  cacheToFileRecord('LAST_EXPORTED_PID', "proposals")
}

/* get raw votes from the blockchain*/
const exportAllProposals = async () => {
  try {
    const proposalContract = await getProposalContract()

    //get the last exported proposal ID
    const proposalIds = await listProposalIds(proposalContract)
    console.log('Total proposals::', proposalIds.length)

    let count = 1;
    let lastPid = await lastExportedPid()
    console.log('lastPid', lastPid)


    await processProposalIds(proposalContract, proposalIds, count, lastPid)

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
    var proposalIds = fs.readFileSync(failedProposalIDFile, 'utf8').trim().split('\n').map(i => parseInt(i))
    createLog(EXPORT_LOG_PATH, `Processing ${uniq(proposalIds).length} failed proposals.`)

    //remove failed report file
    fs.unlinkSync(failedProposalIDFile)
    await processProposalIds(proposalContract, uniq(proposalIds), true)
  } catch (e) {
    console.log(e.message)
  }
}

/*convert csv file to json*/
const allProposalsJSON = async () => {
  const json = await csv().fromFile(proposalsCsv);
  return json
}


module.exports = {
  exportAllProposals,
  exportFailedProposals,
  allProposalsJSON
}