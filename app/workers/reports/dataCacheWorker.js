const IORedis = require('ioredis')
const { Queue, Worker, QueueScheduler } = require('bullmq')
const { pathsByNation, getUmbrellaPaths } = require('zerotheft-node-utils').paths

const { getProposalContract, getVoterContract } = require('zerotheft-node-utils/utils/contract')
const { exportsDir, createAndWrite, cacheDir } = require('../../common')
const { manipulatePaths, getHierarchyTotals, doPathRollUpsForYear } = require('../../services/calcEngineServices/calcLogic')
const { cacheServer } = require('../../services/redisService')
const { defaultPropYear, firstPropYear } = require('../../services/calcEngineServices/constants')
const { createLog, MAIN_PATH, CRON_PATH } = require('../../services/LogInfoServices')

const connection = new IORedis()
const scanData = new Queue('ScanData', { connection })
const allYearData = new Queue('AllYearDataQueue', { connection })
const allYearDataScheduler = new QueueScheduler('AllYearDataQueue', { connection })

/**
 * This worker loops through all  the year and scan them individually by calling another worker
 */
const allYearDataWorker = new Worker('AllYearDataQueue', async job => {
    if (!!job.data.reSync) { //if its from cron
        createLog(CRON_PATH, `Cron job started for data re-sync and full report`)
        cacheServer.del('FULL_REPORT')
        cacheServer.del('REPORTS_INPROGRESS')
        cacheServer.del('SYNC_INPROGRESS')
        cacheServer.del('PAST_THEFTS')
    }
    for (let year = defaultPropYear; year >= firstPropYear; year--) {
        const isYearSynced = await cacheServer.getAsync(`YEAR_${year}_SYNCED`)
        if (!isYearSynced || !!job.data.reSync)
            await singleYearCaching(job.data.nation, year)
    }

}, { connection })

/**
 * This worker data scanning for specific year
 */
const scanDataWorker = new Worker('ScanData', async job => {
    try {
        const year = job.data.year
        const nation = job.data.nation
        console.log(`Caching initiated for year ${year}`)
        createLog(MAIN_PATH, `Caching initiated for year ${year}`)

        cacheServer.set('SYNC_INPROGRESS', year)

        const nationPaths = await pathsByNation(nation)
        const proposalContract = getProposalContract()
        const voterContract = getVoterContract()
        let umbrellaPaths = await getUmbrellaPaths()// get all umbrella paths and return array of umbrella paths
        /*
        *umbrellaPaths=["macroeconomics","workers","industries/finance","economic_crisis/2008_mortgage","industries/healthcare/pharma"]
        */
        umbrellaPaths = umbrellaPaths.map(x => `${nation}/${x}`)
        const { proposals, votes } = await manipulatePaths(nationPaths.USA, proposalContract, voterContract, nation, {}, umbrellaPaths, [], year)
        console.log('GHT', year, proposals.length, votes.length)

        const mainVal = await getHierarchyTotals(umbrellaPaths, proposals, votes, nationPaths)
        if (mainVal) {
            let yearData = mainVal[`${year}`]
            console.log('DPRFY', year)
            doPathRollUpsForYear(yearData, umbrellaPaths, nationPaths)
            cacheServer.hmset(`${year}`, nation, JSON.stringify(yearData)) //this will save yearData in redis-cache
            // Save yearData in files
            const yearDataDir = `${cacheDir}/calc_year_data/${nation}/`
            // export full data with proposals
            await createAndWrite(yearDataDir, `${year}.json`, yearData)

            //JSON with proposals data is huge so removing proposals from every path and then export it seperately
            Object.keys(yearData['paths']).forEach((path) => {
                delete yearData['paths'][path]['props']
            })
            await createAndWrite(`${exportsDir}/calc_year_data/${nation}`, `${year}.json`, yearData)

        }
        cacheServer.set(`YEAR_${year}_SYNCED`, true)
    } catch (e) {
        console.log("ScanDataWoker", e)
        throw e
    }
}, { connection })

// raise flag when scanning and saving is completed
scanDataWorker.on("completed", async (job, returnvalue) => {
    cacheServer.set('PATH_SYNCHRONIZED', true)
    cacheServer.del('SYNC_INPROGRESS')
    console.log(`Caching completed for year ${job.data.year}`)
    createLog(MAIN_PATH, `Caching completed for year ${job.data.year}`)
}, { connection });

// raise flag when scanning and saving failed
scanDataWorker.on("failed", async (job, returnvalue) => {
    cacheServer.del('SYNC_INPROGRESS')
    console.log(`Caching failed for year ${job.data.year}`)
    createLog(MAIN_PATH, `Caching failed for year ${job.data.year}`)
}, { connection });


/**
 * @dev Saves year wise data in cache
 * @param {string} nation 
 * @param {int} year 
 * @returns JSON with success or failure
 */
const singleYearCaching = async (nation, year) => {
    try {
        const syncProgressYear = await cacheServer.getAsync('SYNC_INPROGRESS')
        if (!syncProgressYear || parseInt(syncProgressYear) !== parseInt(year)) {
            scanData.add('saveDatainCache', { nation, year }, { removeOnComplete: true, removeOnFail: true })
            return { message: `caching initiated for year ${year}. Please wait...` }
        } else
            return { message: `caching ongoing for year ${syncProgressYear}` }

    } catch (e) {
        console.log('singleYearCaching', e)
        throw e
    }
}
/**
 * @dev Saves all year's data in cache
 * @returns JSON with success or failure
 */
const allDataCache = async () => {
    try {
        allYearData.add('allYearDataCaching', { nation: "USA" }, { removeOnComplete: true, removeOnFail: true })// executes immediately
        allYearData.add('allYearDataCachingCron', { nation: "USA", reSync: true }, { removeOnComplete: true, removeOnFail: true, repeat: { cron: '0 */4 * * *' } })// executes every 4 hrs
    } catch (e) {
        console.log('allDataCache', e)
        throw e
    }
}

module.exports = {
    singleYearCaching,
    allDataCache,
    allYearData
}