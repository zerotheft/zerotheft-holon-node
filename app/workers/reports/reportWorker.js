const { Queue, Worker, QueueScheduler } = require('bullmq')
const IORedis = require('ioredis')
const { allNations } = require('zerotheft-node-utils').paths
const { cacheServer } = require('../../services/redisService')
const { getUmbrellaPaths } = require('zerotheft-node-utils/utils/github')
const { singleIssueReport, multiIssuesReport, nationReport } = require('../../services/calcEngineServices')
const { createLog, FULL_REPORT_PATH } = require('../../services/LogInfoServices')

const connection = new IORedis()

const reportQueueScheduler = new QueueScheduler('ReportQueue', { connection })
const reportQueue = new Queue('ReportQueue', { connection })

const reportWorker = new Worker('ReportQueue', async job => {
    if (job.name === 'pathReports') {
        try {
            cacheServer.set('REPORTS_INPROGRESS', true)

            // await theftInfo(true, null)
            const pathSync = await cacheServer.getAsync('PATH_SYNCHRONIZED')
            if (pathSync) {
                console.log('Report generation initiated')
                createLog(FULL_REPORT_PATH, `All path reports generation worker initiated`)
                let nationPaths = await allNations()
                nationPaths.forEach(async (nationHierarchy) => {
                    let nation = nationHierarchy.hierarchy
                    delete (nation['Alias'])
                    let country = Object.keys(nation)
                    let today = new Date()
                    let lastYear = today.getFullYear() - 1
                    let umbrellaPaths = await getUmbrellaPaths()
                    umbrellaPaths = umbrellaPaths.map(x => `${country[0]}/${x}`)
                    await runPathReport(nation[country[0]], country[0], umbrellaPaths)
                    for (let year = lastYear; year > lastYear - 20; year--) {
                        console.log(`Nation report for ${year} initiated`)
                        await nationReport(year, true, country[0])
                    }
                })
            }
            cacheServer.set('FULL_REPORT', true)
            cacheServer.del('REPORTS_INPROGRESS')

        } catch (e) {
            cacheServer.del('FULL_REPORT')
            cacheServer.del('REPORTS_INPROGRESS')
            console.log("reportWorker", e)
            throw e
        }
    }
}, { connection })

const runPathReport = async (path, currPath, umbrellaPaths, parentPaths = []) => {
    try {
        let nestedKeys = Object.keys(path)
        for (let i = 0; i < nestedKeys.length; i++) {
            let key = nestedKeys[i]
            if(['parent', 'leaf', 'display_name', 'umbrella'].includes(key))
                continue
            let nestedValues = path[key]
            let nextPath = `${currPath}/${key}`
            let today = new Date()
            let lastYear = today.getFullYear() - 1
            if (nestedValues && nestedValues['leaf']) {
                for (let year = lastYear; year > lastYear - 20; year--) {
                    console.log(`singleIssueReport onging for ${nextPath}(year ${year})`)
                    await singleIssueReport(nextPath, true, year)
                }
            } else {
                if (!parentPaths.includes(nextPath) && umbrellaPaths.includes(nextPath)) {
                    for (let year = lastYear; year > lastYear - 20; year--) {
                        console.log(`singleIssueReport onging for ${nextPath}(year ${year})`)
                        await singleIssueReport(nextPath, true, year)
                    }
                    parentPaths.push(nextPath)
                } else {
                    for (let year = lastYear; year > lastYear - 20; year--) {
                        console.log(`multiIssuesReport onging for ${nextPath}(year ${year})`)
                        await multiIssuesReport(nextPath, true, year)
                    }
                }
                await runPathReport(nestedValues, nextPath, umbrellaPaths, parentPaths)
            }
        }
    } catch (e) {
        cacheServer.del('FULL_REPORT')
        cacheServer.del('REPORTS_INPROGRESS')
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
