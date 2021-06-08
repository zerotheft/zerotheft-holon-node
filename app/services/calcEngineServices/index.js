const fs = require("fs")
const { get, isEmpty } = require('lodash')
const { pathsByNation, getUmbrellaPaths } = require('zerotheft-node-utils').paths
const { convertStringToHash } = require('zerotheft-node-utils').web3
const { getPastYearThefts } = require('./calcLogic')
const { writeFile, exportsDir, createAndWrite } = require('../../common')
const { getReportPath, getAppRoute } = require('../../../config');
const { cacheServer } = require('../redisService');
const { singleYearCaching } = require('../../workers/reports/dataCacheWorker')
const { generatePDFReport, generatePDFMultiReport, deleteJsonFile, mergePdfLatex } = require('./reportCommands')
const { defaultPropYear, firstPropYear, usaPopulation } = require('./helper')
const { createLog, SINGLE_REPORT_PATH, MULTI_REPORT_PATH, FULL_REPORT_PATH, ERROR_PATH, MAIN_PATH } = require('../LogInfoServices')

const multiIssueReportPath = `${getReportPath()}reports/multiIssueReport`
const singleIssueReportPath = `${getReportPath()}reports/ztReport`

const singleIssueReport = async (leafPath, fromWorker = false, year) => {
    createLog(SINGLE_REPORT_PATH, 'Single report generation initiation......', leafPath)
    const fileName = `${year}_${leafPath.replace(/\//g, '-')}`
    try {
        const filePath = singleIssueReportPath
        if (fromWorker || !fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            const nation = leafPath.split('/')[0]
            const nationPaths = await pathsByNation(nation)

            // let allYearData = { '2001': '' }
            // TODO: uncomment this
            let allYearData = await allYearCachedData(nation)

            let lPath = leafPath.split('/').slice(1).join('/')
            if (!isEmpty(allYearData) && !get(allYearData, `${year}.paths.${lPath}.missing`)) {
                const leafJson = { yearData: allYearData, holon: getAppRoute(false), leafPath, actualPath: lPath, allPaths: nationPaths }
                createLog(SINGLE_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, leafPath)
                // TODO: uncomment this
                await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, leafJson)

                createLog(SINGLE_REPORT_PATH, `Generating report for => ${fileName} with year:${year}`, leafPath)
                await generatePDFReport('ztReport', fileName, year)
                return { report: `${fileName}.pdf` }
            } else {
                return { message: 'Issue not present' }
            }
        } else if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            return { report: `${fileName}.pdf` }
        } else {
            return { message: 'Issue not present' }
        }
    } catch (e) {
        console.log(`year: ${year} and path: ${leafPath}`, e)
        createLog(SINGLE_REPORT_PATH, `Exceptions in single report generation with Exception: ${e.message}`, leafPath)
        createLog(ERROR_PATH, `calcEngineServices=>singleIssueReport()::Exceptions in single report generation for ${leafPath} with Exception: ${e.message}`)
        return { error: e.message }
    } finally {
        createLog(SINGLE_REPORT_PATH, `Deleting json file => ${fileName}`, leafPath)
        // TODO: uncomment this
        await deleteJsonFile(fileName)
    }
}

/*
* fetch data from cache and do year wise mapping
*/
const allYearCachedData = async (nation) => {
    createLog(MAIN_PATH, 'Fetching data from cache and do year wise mapping...')
    let allYearData = {}
    for (i = defaultPropYear; i >= firstPropYear; i--) {
        let tempValue = await cacheServer.hgetallAsync(`${i}`)
        if (get(tempValue, nation)) {
            allYearData[`${i}`] = JSON.parse(get(tempValue, nation))
        }
    }
    return allYearData
}

/*
* fetch single year data from cache
*/
const singleYearCachedData = async (nation, year) => {
    let tempValue = await cacheServer.hgetallAsync(year)
    if (get(tempValue, nation)) {
        return JSON.parse(get(tempValue, nation))
    }

    throw new Error(`Cached data not found for year ${year}`)
}

const multiIssuesReport = async (path, fromWorker = false, year, texsSequence) => {
    // createLog(MULTI_REPORT_PATH, 'Multi report generation initiation......', path)
    const fileName = `${year}_${path.replace(/\//g, '-')}`

    try {
        const filePath = multiIssueReportPath
        if (fromWorker || !fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            const nation = path.split('/')[0]
            const nationPaths = await pathsByNation(nation)
            const allPaths = get(nationPaths, path.split('/').join('.'))

            // let allYearData = { '2001': '' }
            // TODO: uncomment this
            let allYearData = await allYearCachedData(nation)

            if (!isEmpty(allYearData)) {
                const umbrellaPaths = await getUmbrellaPaths()
                const singleYearData = await singleYearCachedData(nation, year)
                const pathsJson = { yearData: allYearData, singleYearData, actualPath: path, holon: getAppRoute(false), allPaths: nationPaths, subPaths: allPaths, pageLink: convertStringToHash(`full_${nation}_${year}`), umbrellaPaths: umbrellaPaths }
                // createLog(MULTI_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, path)
                // TODO: uncomment this
                await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, pathsJson)

                await generatePDFMultiReport('multiIssueReport', fileName, year, texsSequence)
                return { report: `${fileName}.pdf` }
            } else {
                return { message: 'No Issues for the path' }
            }
        } else if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            return { report: `${fileName}.pdf` }
        } else {
            return { message: 'No Issues for the path' }
        }
    } catch (e) {
        // createLog(MULTI_REPORT_PATH, `Exceptions in single report generation with Exception: ${e.message}`, path)
        // createLog(ERROR_PATH, `calcEngineServices=>multiIssuesReport()::Exceptions in single report generation for ${path} with Exception: ${e.message}`)
        console.log(`year: ${year} and path: ${path}`, e)
        return { error: e.message }
    } finally {
        // createLog(MULTI_REPORT_PATH, `Deleting json file => ${fileName}`, path)
        // TODO: uncomment this
        await deleteJsonFile(fileName)
    }
}

const getTexsSequence = async (year, path) => {
    const nation = path.split('/')[0]
    const nationPaths = await pathsByNation(nation)
    delete (nationPaths['Alias'])

    // createLog(FULL_REPORT_PATH, `Fetching Umbrella Path`)
    let umbrellaPaths = await getUmbrellaPaths()
    umbrellaPaths = umbrellaPaths.map(x => `${nation}/${x}`)

    let texsSequence = await texPathTraverse(get(nationPaths, path.replace(/\//g, '.')), path.replace(/\//g, '-'), [], year, umbrellaPaths)

    const nationTocReportName = `${year}_${path.replace(/\//g, '-')}`
    const reportPathTex = `${multiIssueReportPath}/${nationTocReportName}.tex`
    if (texsSequence.length > 0 || fs.existsSync(reportPathTex)) {
        texsSequence.unshift(reportPathTex)
    }

    return texsSequence
}

const multiIssuesFullReport = async (path, fromWorker = false, year) => {
    // createLog(FULL_REPORT_PATH, `Full report generation initiation...... for the year ${year}`)
    try {
        const fullFileName = `full_${year}_${path.replace(/\//g, '-')}`
        const filePath = multiIssueReportPath
        const reportExists = fs.existsSync(`${filePath}/${fullFileName}.pdf`)
        if (fromWorker || !reportExists) {
            const texsSequence = await getTexsSequence(year, path)
            let availablePdfsPaths = []
            texsSequence.forEach((texFile) => {
                const matches = texFile.match(/\/[^-]+-([^\/]+).tex$/)
                if (matches) {
                    availablePdfsPaths.push(matches[1].replace(/-/g, '/'))
                }
            })

            await multiIssuesReport(path, fromWorker, year, availablePdfsPaths)

            // create full umbrealla report
            await mergePdfLatex(fullFileName, texsSequence)
            return { report: `${fullFileName}.pdf` }
        } else if (reportExists) {
            return { report: `${fullFileName}.pdf` }
        } else {
            return { message: 'Full Umbrella Report Generation will take time. Come back later.' }
        }
    } catch (e) {
        // createLog(FULL_REPORT_PATH, `Exceptions in full report generation for ${path} with Exception: ${e.message}`)
        // createLog(ERROR_PATH, `calcEngineServices=>nationReport()::Exceptions in full report generation for ${path} with Exception: ${e.message}`)
        return { error: e.message }
    }
}

/**
 * @dev Method generates full report of the nation
 * @param {int} year 
 * @param {bool} fromWorker 
 * @param {string} nation 
 * @returns JSON will full report url
 */
const nationReport = async (year, fromWorker = false, nation = 'USA') => {
    // createLog(FULL_REPORT_PATH, `Full report generation initiation...... for the year ${year}`)
    try {
        const fullFileName = `full_${year}_${nation}`
        const filePath = multiIssueReportPath
        const reportExists = fs.existsSync(`${filePath}/${fullFileName}.pdf`)
        if (fromWorker || !reportExists) {
            const texsSequence = await getAllMultiReportTexs(nation, year)
            let availablePdfsPaths = []
            texsSequence.forEach((texFile) => {
                const matches = texFile.match(/\/[^-]+-([^\/]+).tex$/)
                if (matches) {
                    availablePdfsPaths.push(matches[1].replace(/-/g, '/'))
                }
            })

            await multiIssuesReport(nation, fromWorker, year, availablePdfsPaths)

            // create full nation report
            await mergePdfLatex(fullFileName, texsSequence)
            return { report: `${fullFileName}.pdf` }
        } else if (reportExists) {
            return { report: `${fullFileName}.pdf` }
        } else {
            return { message: 'Full Country Report Generation will take time. Come back later.' }
        }
    } catch (e) {
        // createLog(FULL_REPORT_PATH, `Exceptions in full report generation for ${nation} with Exception: ${e.message}`)
        // createLog(ERROR_PATH, `calcEngineServices=>nationReport()::Exceptions in full report generation for ${nation} with Exception: ${e.message}`)
        console.log(e)
        return { error: e.message }
    }
}

const getAllMultiReportTexs = async (nation, year) => {
    let texsSequence = []
    fs.readdirSync(`${multiIssueReportPath}/`).forEach(file => {
        const regex = new RegExp(`^full_${year}_${nation}[^.]+.tex$`)
        if (regex.test(file)) texsSequence.push(`${multiIssueReportPath}/${file}`)
    })

    const nationPaths = await pathsByNation(nation)
    delete (nationPaths['Alias'])
    let nationTocReportName = `${year}_${nation}`
    const reportPath = `${multiIssueReportPath}/${nationTocReportName}.tex`

    if (texsSequence.length > 0 || fs.existsSync(reportPath)) {
        texsSequence.unshift(reportPath)
    }

    return texsSequence
}

const texPathTraverse = async (path, currPath, texsSequence, year, umbrellaPaths, parentPaths = []) => {
    let pathClone = Object.assign({}, path)
    if (path && path.leaf)
        delete path.leaf
    if (path && path.umbrella)
        delete path.umbrella
    if (path && path.display_name)
        delete path.display_name
    if (path && path.parent)
        delete path.parent
    createLog(FULL_REPORT_PATH, `Traversing the path for the year ${year}`)
    try {
        let nestedKeys = Object.keys(path)
        for (let i = 0; i < nestedKeys.length; i++) {
            let key = nestedKeys[i]
            let nestedValues = path[key]
            let nextPath = `${currPath}/${key}`.replace(/\//g, '-')
            let fileName = `${year}_${nextPath}`
            if (pathClone[key]['leaf']) {
                let filePath = singleIssueReportPath
                if (fs.existsSync(`${filePath}/${fileName}.tex`)) {
                    texsSequence.push(`${filePath}/${fileName}.tex`)
                }
            } else {
                if (!parentPaths.includes(nextPath) && umbrellaPaths.includes(nextPath)) {
                    let filePath = singleIssueReportPath
                    if (fs.existsSync(`${filePath}/${fileName}.tex`)) {
                        texsSequence.push(`${filePath}/${fileName}.tex`)
                    }
                    parentPaths.push(nextPath)
                } else {
                    let filePath = `${getReportPath()}reports/temp_multiIssueReport`
                    if (fs.existsSync(`${filePath}/${fileName}.tex`)) {
                        texsSequence.push(`${filePath}/${fileName}.tex`)
                    }
                }
                createLog(FULL_REPORT_PATH, `Traversing recursively for the path for the year ${year} and nexx path: ${nextPath}`)
                await texPathTraverse(nestedValues, nextPath, texsSequence, year, umbrellaPaths, parentPaths)
            }
        }
        return texsSequence
    } catch (e) {
        console.log(e)
        createLog(FULL_REPORT_PATH, `Exceptions in full report generation for ${year} with Exception: ${e.message}`)
        createLog(ERROR_PATH, `calcEngineServices=>texPathTraverse()::Exceptions in full report generation for ${year} with Exception: ${e.message}`)
        throw e
    }
}


const theftInfo = async (fromWorker = false, year, nation = 'USA') => {
    try {
        if (await cacheServer.getAsync('PATH_SYNCHRONIZED') && !fromWorker && (await cacheServer.getAsync(`YEAR_${year}_SYNCED`))) { //if path has been sychrnoized and not from worker
            const result = await cacheServer.hgetallAsync(year)
            const nationData = JSON.parse(result[nation])
            const paths = nationData.paths
            const agg = { [nation]: nationData._totals }
            Object.keys(paths).forEach((path) => {
                const totals = paths[path]._totals
                if (totals.votes !== 0) {
                    agg[`${nation}/${path}`] = totals
                }
            })
            // check cache for past 
            let yearTh = await getPastYearThefts(nation)
            if (yearTh.length == 0) throw new Error('no past thefts data in cache')
            let minYr, maxYr
            let totalTh = 0
            for (i = 0; i < yearTh.length; i++) {
                yr = yearTh[i]
                if (!minYr || parseInt(yr['Year']) < parseInt(minYr)) {
                    minYr = parseInt(yr['Year'])
                } else {
                    minYr = parseInt(minYr)
                }
                if (!maxYr || parseInt(yr['Year'])) {
                    maxYr = parseInt(yr['Year'])
                } else {
                    maxYr = parseInt(maxYr)
                }
                totalTh += yr['theft']
            }

            agg['info'] = {}
            agg['info']['total'] = nationData['_totals']['theft']
            agg['info']['each_year'] = nationData['_totals']['theft'] / usaPopulation(year)
            agg['info']['population'] = usaPopulation(year)
            agg['info']['many_years'] = totalTh
            agg['info']['max_year'] = maxYr
            agg['info']['min_year'] = minYr
            agg['info']['between_years'] = (maxYr - minYr) + 1
            agg['info']['votes'] = nationData['_totals']['votes']
            agg['info']['proposals'] = nationData['_totals']['proposals']

            //log the aggregated data in file inside exports directory
            const exportFile = `${exportsDir}/calc_year_data/${nation}/${year}.json`
            let exportFileData = {}
            if (fs.existsSync(exportFile)) {
                exportFileData = JSON.parse(fs.readFileSync(exportFile))
            }
            exportFileData['info'] = agg['info']
            await createAndWrite(`${exportsDir}/calc_year_data/${nation}`, `${year}.json`, exportFileData)

            return agg;
        }
        else {
            cacheServer.del('PAST_THEFTS')
            const response = singleYearCaching(nation, year) // Background task for processing and saving data into cache
            createLog(MAIN_PATH, `Background task for processing and saving data into cache for ${nation} in ${year}`)
            return response
        }
    } catch (e) {
        console.log(e)
        createLog(ERROR_PATH, `calcEngineServices=>theftInfo()::Exception occurs in theftInfo with ${e.message}`)
        return { error: e.message }
    }
}

module.exports = {
    allYearCachedData,
    singleIssueReport,
    multiIssuesReport,
    theftInfo,
    nationReport,
    multiIssuesFullReport,
}
