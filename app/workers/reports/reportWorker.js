const { Queue, Worker, QueueScheduler } = require('bullmq')
const PromisePool = require('@supercharge/promise-pool')
const IORedis = require('ioredis')
const { allNations } = require('zerotheft-node-utils').paths
const { cacheServer } = require('../../services/redisService')
const { singleIssueReport, multiIssuesFullReport, nationReport } = require('../../services/calcEngineServices')
const { createLog, FULL_REPORT_PATH } = require('../../services/LogInfoServices')

const connection = new IORedis()

const reportQueueScheduler = new QueueScheduler('ReportQueue', { connection })
const reportQueue = new Queue('ReportQueue', { connection })

const reportWorker = new Worker('ReportQueue', async job => {
    if (job.name === 'pathReports') {
        try {
            cacheServer.set('REPORTS_INPROGRESS', true)

            // await theftInfo(true, null)
            const isDatainCache = await cacheServer.getAsync('CALC_SUMMARY_SYNCED')
            if (isDatainCache) {
                console.log('Report generation initiated')
                createLog(FULL_REPORT_PATH, `All path reports generation worker initiated`)
                let nationPaths = await allNations()
                const promises = nationPaths.map(async (nationHierarchy) => {
                    // })
                    // nationPaths.forEach(async (nationHierarchy) => {
                    let nation = nationHierarchy.hierarchy
                    delete (nation['Version'])
                    delete (nation['Alias'])
                    let country = Object.keys(nation)
                    // console.log('sss')
                    await runPathReport(nation[country[0]], country[0])
                    await nationReport(true, country[0])
                })
                await Promise.all(promises)
            }

        } catch (e) {
            console.log("reportWorker", e)
            throw e
        }
    }
}, { connection })


// raise flag when report worker job is completed
reportWorker.on("completed", async (job, returnvalue) => {
    cacheServer.set('FULL_REPORT', true)
    cacheServer.del('REPORTS_INPROGRESS')
    console.log(`Report Worker completed`)
    createLog(FULL_REPORT_PATH, `Report Worker completed`)
}, { connection });

// raise flag when report worker job is failed
reportWorker.on("failed", async (job, returnvalue) => {
    cacheServer.del('FULL_REPORT')
    cacheServer.del('REPORTS_INPROGRESS')
    console.log(`Report Worker failed`)
    createLog(FULL_REPORT_PATH, `Report Worker failed`)
}, { connection });

/**
 * Generates path wise report for all years
 * @param {object} path 
 * @param {string} currPath 
 */
const runPathReport = async (path, currPath) => {
    try {
        await PromisePool
            .withConcurrency(10)
            .for(Object.keys(path))
            .process(async key => {
                if (['parent', 'leaf', 'display_name', 'umbrella', 'metadata'].includes(key))
                    return
                const currentPath = path[key]
                if (!currentPath) retun
                let nextPath = `${currPath}/${key}`
                if (currentPath['leaf']) {
                    await singleIssueReport(nextPath, true)
                } else if ((currentPath['metadata'] && currentPath['metadata']['umbrella']) || currentPath['parent']) {
                    await runPathReport(currentPath, nextPath)
                    await multiIssuesFullReport(nextPath, true)
                }
            })
    } catch (e) {
        console.log('runPathReport', e)
        throw e
    }
}


/**
 * This will generates path reports every hour
 */
const allReportWorker = async () => {
    try {
        reportQueue.add('pathReports', {}, { removeOnComplete: true, removeOnFail: true })
    } catch (e) {
        console.log(`allReportWorker Error:: ${e}`)
        throw e
    }
}



module.exports = {
    allReportWorker
}
