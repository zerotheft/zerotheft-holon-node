const fs = require('fs')
const { writeFile, exportsDir } = require('../../common')
const voteIDFile = `${exportsDir}/.last_exported_vid`
const failedVoteIDFile = `${exportsDir}/.export_failed_vids`
const proposalIdFile = `${exportsDir}/.last_exported_pid`
const failedProposalIDFile = `${exportsDir}/.export_failed_pids`
const holonIdFile = `${exportsDir}/.last_exported_hid`
const failedHolonIDFile = `${exportsDir}/.export_failed_hids`
const userIdFile = `${exportsDir}/.last_exported_uid`
const failedUserIDFile = `${exportsDir}/.export_failed_uids`
const exportsDirNation = `${exportsDir}/nation_data`
const userSpecificVotesFile = `${exportsDirNation}/user_specific_votes.json`
const proposalVotesFile = `${exportsDirNation}/proposalVotes.json`
const proposalVotersFile = `${exportsDirNation}/proposalVoters.json`
const proposalArchiveVotesFile = `${exportsDirNation}/proposalArchiveVotes.json`
const { cacheServer } = require('../redisService')


//get the last exported vote ID
const lastExportedVid = async () => {
  let lastVid = 0
  try {
    lastVid = fs.readFileSync(voteIDFile, 'utf-8')
  } catch (e) {
    console.log(e.message)
  }
  let cachedPid = await cacheServer.getAsync('LAST_EXPORTED_VID')
  if (cachedPid) lastVid = parseInt(cachedPid)
  return lastVid
}
//get the last exported proposal ID
const lastExportedPid = async () => {
  let lastPid = 0
  try {
    lastPid = fs.readFileSync(proposalIdFile, 'utf-8')
  } catch (e) {
    console.log(e.message)
  }
  let cachedPid = await cacheServer.getAsync('LAST_EXPORTED_PID')
  if (cachedPid) lastPid = parseInt(cachedPid)
  return lastPid
}
//get the last exported holon ID
const lastExportedHid = async () => {
  let lastHid = 0
  try {
    lastHid = fs.readFileSync(holonIdFile, 'utf-8')
  } catch (e) {
    console.log(e.message)
  }
  let cachedHid = await cacheServer.getAsync('LAST_EXPORTED_HID')
  if (cachedHid) lastHid = parseInt(cachedHid)
  return lastHid
}

//get the last exported user ID
const lastExportedUid = async () => {
  let lastUid = 0
  try {
    lastUid = fs.readFileSync(userIdFile, 'utf-8')
  } catch (e) {
    console.log(e.message)
  }
  let cachedUid = await cacheServer.getAsync('LAST_EXPORTED_UID')
  if (cachedUid) lastUid = parseInt(cachedUid)

  return lastUid
}

//save the record temporarily in cache
const keepCacheRecord = async (key, count) => {
  let cachedId = await cacheServer.getAsync(key)
  if (!cachedId || count > parseInt(cachedId))
    cacheServer.set(key, count)
}

//save the record in file
const cacheToFileRecord = async (key, entity) => {
  if (entity === "users")
    file = userIdFile
  else if (entity === "votes")
    file = voteIDFile
  else if (entity === "proposals")
    file = proposalIdFile
  let cachedUid = await cacheServer.getAsync(key)
  console.log(file)
  if (cachedUid)
    await writeFile(file, parseInt(cachedUid))
  cacheServer.del(key)
}

//returns voting rollups information
const voteDataRollups = async () => {
  let userSpecificVotes = {}
  let proposalVotes = {}
  let proposalVoters = {}
  let proposalArchiveVotes = {}
  try { userSpecificVotes = JSON.parse(fs.readFileSync(userSpecificVotesFile, 'utf-8')); } catch (e) { }
  try { proposalVotes = JSON.parse(fs.readFileSync(proposalVotesFile, 'utf-8')); } catch (e) { }
  try { proposalVoters = JSON.parse(fs.readFileSync(proposalVotersFile, 'utf-8')); } catch (e) { }
  try { proposalArchiveVotes = JSON.parse(fs.readFileSync(proposalArchiveVotesFile, 'utf-8')); } catch (e) { }
  return { userSpecificVotes, proposalVotes, proposalVoters, proposalArchiveVotes }
}

//save vote roll ups date
const saveVoteRollupsData = async (voteData) => {
  if (voteData.userSpecificVotes) await writeFile(userSpecificVotesFile, voteData.userSpecificVotes)
  if (voteData.proposalVotes) await writeFile(proposalVotesFile, voteData.proposalVotes)
  if (voteData.proposalVoters) await writeFile(proposalVotersFile, voteData.proposalVoters)
  if (voteData.proposalArchiveVotes) await writeFile(proposalArchiveVotesFile, voteData.proposalArchiveVotes)
}

module.exports = {
  exportsDirNation,
  voteIDFile,
  failedVoteIDFile,
  lastExportedVid,
  proposalIdFile,
  failedProposalIDFile,
  lastExportedPid,
  holonIdFile,
  failedHolonIDFile,
  lastExportedHid,
  userIdFile,
  failedUserIDFile,
  lastExportedUid,
  keepCacheRecord,
  cacheToFileRecord,
  voteDataRollups,
  saveVoteRollupsData
}