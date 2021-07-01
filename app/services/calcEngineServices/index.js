const fs = require("fs")
const { get, min, max, isEmpty, difference } = require('lodash')
const { pathsByNation, getUmbrellaPaths } = require('zerotheft-node-utils').paths
const { convertStringToHash } = require('zerotheft-node-utils').web3
const config = require('zerotheft-node-utils/config')
const PUBLIC_PATH = `${config.APP_PATH}/public`
const cacheDir = `${config.APP_PATH}/.cache/calc_data`
const { getPastYearThefts } = require('./calcLogic')
const { writeFile, exportsDir, createAndWrite } = require('../../common')
const { getReportPath, getAppRoute } = require('../../../config');
const { cacheServer } = require('../redisService');
const { singleYearCaching } = require('../../workers/reports/dataCacheWorker')
const { generatePDFReport, generateNoVotePDFReport, generatePDFMultiReport, generateNoVoteMultiPDFReport, deleteJsonFile, mergePdfLatex } = require('./reportCommands')
const { defaultPropYear, firstPropYear, usaPopulation } = require('./helper')
const { createLog, SINGLE_REPORT_PATH, MULTI_REPORT_PATH, FULL_REPORT_PATH, ERROR_PATH, MAIN_PATH } = require('../LogInfoServices')

const reportsPath = `${getReportPath()}reports`
const multiIssueReportPath = `${reportsPath}/multiIssueReport`
const singleIssueReportPath = `${reportsPath}/ztReport`

const singleIssueReport = async (leafPath, fromWorker = false) => {
    createLog(SINGLE_REPORT_PATH, 'Single report generation initiation......', leafPath)
    const fileName = `${leafPath.replace(/\//g, '-')}`
    try {
        const filePath = singleIssueReportPath
        if (fromWorker || !fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            const nation = leafPath.split('/')[0]
            const nationPaths = await pathsByNation(nation)

            // let allYearData = { '2001': '' }
            // TODO: uncomment this
            let allYearData = await allYearCachedData(nation)

            let lPath = leafPath.split('/').slice(1).join('/')
            if (!isEmpty(allYearData) && get(allYearData, `paths.${lPath}`) && !get(allYearData, `paths.${lPath}.missing`)) {
                const leafJson = { yearData: allYearData, holon: getAppRoute(false), leafPath, actualPath: lPath, allPaths: nationPaths }
                createLog(SINGLE_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, leafPath)
                // TODO: uncomment this
                await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, leafJson)

                createLog(SINGLE_REPORT_PATH, `Generating report for => ${fileName}`, leafPath)
                await generatePDFReport('ztReport', fileName)
                return { report: `${fileName}.pdf` }
            } else {
                await generateNoVotePDFReport('ztReport', fileName, leafPath, getAppRoute(false))
                return { report: `${fileName}.pdf` }
                // return { message: 'Issue not present' }
            }
        } else if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            return { report: `${fileName}.pdf` }
        } else {
            return { message: 'Issue not present' }
        }
    } catch (e) {
        console.log(`path: ${leafPath}`, e)
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
    try {
        const jsonFile = fs.readFileSync(`${cacheDir}/${nation}/calc_summary.json`)
        return JSON.parse(jsonFile)
    } catch { }
}

const listAvailablePdfsPaths = (paths, path) => {
    let availablePaths = []
    const childrenKeys = difference(Object.keys(paths), ['metadata', 'parent'])
    const regex = new RegExp(`^${reportsPath}/([^\.]+).tex$`)

    childrenKeys.forEach((childPath) => {
        const childData = paths[childPath]
        const childFullPath = `${path}/${childPath}`
        const childFile = childFullPath.replace(/\//g, '-')
        const singleFile = `${singleIssueReportPath}/${childFile}.tex`
        const multiFile = `${multiIssueReportPath}/${childFile}_full.tex`
        if (get(childData, 'leaf') && fs.existsSync(singleFile)) {
            const matches = singleFile.match(regex)
            if (matches) {
                availablePaths.push(matches[1].replace(/-/g, '/'))
            }
        } else if ((get(childData, 'metadata.umbrella') || get(childData, 'parent')) && fs.existsSync(multiFile)) {
            availablePaths = [...availablePaths, ...listAvailablePdfsPaths(childData, childFullPath)]
        }
    })


    return ['multiIssueReport/' + path, ...availablePaths]
}

const multiIssuesReport = async (path, fromWorker = false) => {
    // createLog(MULTI_REPORT_PATH, 'Multi report generation initiation......', path)
    const fileName = `${path.replace(/\//g, '-')}`

    try {
        if (fromWorker || !fs.existsSync(`${multiIssueReportPath}/${fileName}.pdf`)) {
            const pathData = path.split('/')
            const nation = pathData[0]
            const noNationPath = pathData.slice(1).join('/')
            const nationPaths = await pathsByNation(nation)
            const allPaths = get(nationPaths, path.split('/').join('.'))

            const availablePdfsPaths = listAvailablePdfsPaths(allPaths, path)

            // let allYearData = { '2001': '' }
            // TODO: uncomment this
            let allYearData = await allYearCachedData(nation)

            if (!get(allYearData, `paths.${noNationPath}.missing`) || allPaths['parent']) {
                const pathsJson = { yearData: allYearData, actualPath: path, holon: getAppRoute(false), allPaths: nationPaths, subPaths: allPaths }
                // createLog(MULTI_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, path)
                // TODO: uncomment this
                await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, pathsJson)

                await generatePDFMultiReport('multiIssueReport', fileName, availablePdfsPaths)
                return { report: `${fileName}.pdf` }
            } else {
                await generateNoVoteMultiPDFReport('multiIssueReport', fileName, path, getAppRoute(false), allPaths, availablePdfsPaths)
                return { report: `${fileName}.pdf` }
                // return { message: 'No Issues for the path' }
            }
        } else if (fs.existsSync(`${multiIssueReportPath}/${fileName}.pdf`)) {
            return { report: `${fileName}.pdf` }
        } else {
            return { message: 'No Issues for the path' }
        }
    } catch (e) {
        // createLog(MULTI_REPORT_PATH, `Exceptions in single report generation with Exception: ${e.message}`, path)
        // createLog(ERROR_PATH, `calcEngineServices=>multiIssuesReport()::Exceptions in single report generation for ${path} with Exception: ${e.message}`)
        console.log(`path: ${path}`, e)
        return { error: e.message }
    } finally {
        // createLog(MULTI_REPORT_PATH, `Deleting json file => ${fileName}`, path)
        // TODO: uncomment this
        await deleteJsonFile(fileName)
    }
}

const getTexsSequence = async (path) => {
    const nation = path.split('/')[0]
    const nationPaths = await pathsByNation(nation)
    delete (nationPaths['Alias'])

    const childrens = get(nationPaths, path.replace(/\//g, '.'))

    const childrenKeys = difference(Object.keys(childrens), ['metadata', 'parent'])

    let texsSequence = []
    childrenKeys.forEach((childPath) => {
        const childData = childrens[childPath]
        const childFile = `${path}/${childPath}`.replace(/\//g, '-')
        const singleFile = `${singleIssueReportPath}/${childFile}.tex`
        const multiFile = `${multiIssueReportPath}/${childFile}_full.tex`
        if (get(childData, 'leaf') && fs.existsSync(singleFile)) {
            texsSequence.push(singleFile)
        } else if ((get(childData, 'metadata.umbrella') || get(childData, 'parent')) && fs.existsSync(multiFile)) {
            texsSequence.push(multiFile)
        }
    })

    const fileName = `${path.replace(/\//g, '-')}.tex`
    const reportPathTex = `${multiIssueReportPath}/${fileName}`
    if (texsSequence.length > 0 || fs.existsSync(reportPathTex)) {
        texsSequence.unshift(reportPathTex)
    }

    return texsSequence
}

const multiIssuesFullReport = async (path, fromWorker = false) => {
    // createLog(FULL_REPORT_PATH, `Full report generation initiation......`)
    try {
        const fullFileName = `${path.replace(/\//g, '-')}_full`
        const filePath = multiIssueReportPath
        const reportExists = fs.existsSync(`${filePath}/${fullFileName}.pdf`)
        if (fromWorker || !reportExists) {
            const texsSequence = await getTexsSequence(path)

            await multiIssuesReport(path, fromWorker)

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
 * @param {bool} fromWorker 
 * @param {string} nation 
 * @returns JSON will full report url
 */
const nationReport = async (fromWorker = false, nation = 'USA') => {
    // createLog(FULL_REPORT_PATH, `Full report generation initiation......`)
    try {
        const fullFileName = `${nation}_full`
        const reportExists = fs.existsSync(`${multiIssueReportPath}/${fullFileName}.pdf`)
        if (fromWorker || !reportExists) {
            const texsSequence = await getTexsSequence(nation)

            await multiIssuesReport(nation, fromWorker)

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

const texPathTraverse = async (path, currPath, texsSequence, umbrellaPaths, parentPaths = []) => {
    let pathClone = Object.assign({}, path)
    if (path && path.leaf)
        delete path.leaf
    if (path && path.umbrella)
        delete path.umbrella
    if (path && path.display_name)
        delete path.display_name
    if (path && path.parent)
        delete path.parent
    createLog(FULL_REPORT_PATH, `Traversing the path`)
    try {
        let nestedKeys = Object.keys(path)
        for (let i = 0; i < nestedKeys.length; i++) {
            let key = nestedKeys[i]
            let nestedValues = path[key]
            let nextPath = `${currPath}/${key}`.replace(/\//g, '-')
            let fileName = `${nextPath}`
            if (pathClone[key]['leaf']) {
                let filePath = singleIssueReportPath
                // if (fs.existsSync(`${filePath}/${fileName}.tex`)) {
                texsSequence.push(`${filePath}/${fileName}.tex`)
                // }
            } else {
                if (!parentPaths.includes(nextPath) && umbrellaPaths.includes(nextPath)) {
                    let filePath = singleIssueReportPath
                    // if (fs.existsSync(`${filePath}/${fileName}.tex`)) {
                    texsSequence.push(`${filePath}/${fileName}.tex`)
                    // }
                    parentPaths.push(nextPath)
                } else {
                    let filePath = `${getReportPath()}reports/temp_multiIssueReport`
                    // if (fs.existsSync(`${filePath}/${fileName}.tex`)) {
                    texsSequence.push(`${filePath}/${fileName}.tex`)
                    // }
                }
                createLog(FULL_REPORT_PATH, `Traversing recursively for the path and next path: ${nextPath}`)
                await texPathTraverse(nestedValues, nextPath, texsSequence, umbrellaPaths, parentPaths)
            }
        }
        return texsSequence
    } catch (e) {
        console.log(e)
        createLog(FULL_REPORT_PATH, `Exceptions in full report generation with Exception: ${e.message}`)
        createLog(ERROR_PATH, `calcEngineServices=>texPathTraverse()::Exceptions in full report generation with Exception: ${e.message}`)
        throw e
    }
}


const theftInfo = async (fromWorker = false, nation = 'USA') => {
    const exportFile = `${exportsDir}/calc_data/${nation}/calc_summary.json`

    try {
        if (!fromWorker && await cacheServer.getAsync(`CALC_SUMMARY_SYNCED`) && fs.existsSync(exportFile)) { //if path has been sychrnoized and not from worker
            // const result = await cacheServer.getAsync(nation)
            const nationData = JSON.parse(fs.readFileSync(exportFile))
            // = JSON.parse(result[nation])
            const paths = nationData.paths
            const agg = { [nation]: nationData._totals }
            let allTheftYears = []
            Object.keys(paths).forEach((path) => {
                const totals = paths[path]._totals
                if (totals.votes !== 0) {
                    agg[`${nation}/${path}`] = totals
                }
                allTheftYears = allTheftYears.concat(Object.keys(get(totals, 'voted_year_thefts', [])))
            })
            // check cache for past 
            // let yearTh = await getPastYearThefts(nation)
            // if (yearTh.length == 0) throw new Error('no past thefts data in cache')
            let minYr = min(allTheftYears)
            let maxYr = max(allTheftYears)
            // for (i = 0; i < yearTh.length; i++) {
            //     yr = yearTh[i]
            //     if (!minYr || parseInt(yr['Year']) < parseInt(minYr)) {
            //         minYr = parseInt(yr['Year'])
            //     } else {
            //         minYr = parseInt(minYr)
            //     }
            //     if (!maxYr || parseInt(yr['Year'])) {
            //         maxYr = parseInt(yr['Year'])
            //     } else {
            //         maxYr = parseInt(maxYr)
            //     }

            //     totalTh += yr['theft']
            // }
            agg['info'] = {}
            agg['info']['total'] = nationData['_totals']['theft']
            agg['info']['last_year_theft'] = nationData['_totals']['last_year_theft']
            // agg['info']['each_year'] = nationData['_totals']['theft'] / usaPopulation(year)
            // agg['info']['population'] = usaPopulation(year)
            agg['info']['many_years'] = nationData['_totals']['theft']
            agg['info']['max_year'] = maxYr
            agg['info']['min_year'] = minYr
            agg['info']['between_years'] = (maxYr - minYr) + 1
            agg['info']['votes'] = nationData['_totals']['votes']
            agg['info']['proposals'] = nationData['_totals']['proposals']

            //log the aggregated data in file inside exports directory
            let exportFileData = {}
            if (fs.existsSync(exportFile)) {
                exportFileData = JSON.parse(fs.readFileSync(exportFile))
            }
            exportFileData['info'] = agg['info']
            await createAndWrite(`${exportsDir}/calc_data/${nation}`, `calc_summary.json`, exportFileData)

            return agg;
        }
        else {
            // cacheServer.del('PAST_THEFTS')
            const response = singleYearCaching(nation) // Background task for processing and saving data into cache
            createLog(MAIN_PATH, `Background task for processing and saving data into cache for ${nation}`)
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
