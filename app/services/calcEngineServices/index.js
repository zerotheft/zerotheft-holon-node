const fs = require("fs")
const { get, isEmpty } = require('lodash')
const { pathsByNation, getUmbrellaPaths } = require('zerotheft-node-utils').paths
const { convertStringToHash } = require('zerotheft-node-utils').web3
const { writeFile } = require('../../common')
const { getReportPath, getAppRoute } = require('../../../config');
const { cacheServer } = require('../redisService');
const { singleYearCaching } = require('../../workers/reports/dataCacheWorker')
const { generateReport, generatePDFReport, generatePDFMultiReport, generatePDF, mergePdfForNation, generatePageNumberFooter, renameHTMLFile, renamePDFFile, deleteJsonFile, mergePdfLatex } = require('./reportCommands')
const { defaultPropYear, firstPropYear, population } = require('./constants')
const { createLog, SINGLE_REPORT_PATH, MULTI_REPORT_PATH, FULL_REPORT_PATH, ERROR_PATH, MAIN_PATH } = require('../LogInfoServices')

const singleIssueReport = async (leafPath, fromWorker = false, year) => {
    createLog(SINGLE_REPORT_PATH, 'Single report generation initiation......', leafPath)
    const fileName = `${year}_${leafPath.replace(/\//g, '-')}`
    try {
        const filePath = `${getReportPath()}reports/ztReport`
        if (fromWorker || !fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            const nation = leafPath.split('/')[0]
            const nationPaths = await pathsByNation(nation)

            let allYearData = { '2001': '' }
            // TODO: uncomment this
            // let allYearData = await allYearCachedData(nation)

            let lPath = leafPath.split('/').slice(1).join('/')
            if (!isEmpty(allYearData) && !get(allYearData, `${year}.paths.${lPath}.missing`)) {
                const leafJson = { yearData: allYearData, holon: getAppRoute(), actualPath: lPath, allPaths: nationPaths }
                createLog(SINGLE_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, leafPath)
                // TODO: uncomment this
                // await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, leafJson)

                createLog(SINGLE_REPORT_PATH, `Generating report for => ${fileName} with year:${year}`, leafPath)
                generatePDFReport('ztReport', fileName, year)
                return { report: `${fileName}.pdf` }


                // createLog(SINGLE_REPORT_PATH, `Generating report for => ${fileName} with year:${year}`, leafPath)
                // await generateReport('ztReport', fileName, year)
                // createLog(SINGLE_REPORT_PATH, `Generating PDF for => ${fileName}`, leafPath)
                // await generatePDF(filePath, 'ztReport')
                // if (fs.existsSync(`${filePath}/ztReport.html`)) {
                //     createLog(SINGLE_REPORT_PATH, `Renaming file => ${fileName}`, leafPath)
                //     await renameHTMLFile('ztReport', fileName)
                //     createLog(SINGLE_REPORT_PATH, `Generating page number footer for  => ${fileName}`, leafPath)
                //     await generatePageNumbwerFooter(filePath, 'ztReport', fileName, `ZeroTheft Theft in ${leafPath} Report `)
                //     // createLog(SINGLE_REPORT_PATH, `Deleting json file => ${fileName}`, leafPath)
                //     // await deleteJsonFile(fileName)
                //     return { report: `${fileName}.html` }
                // } else {
                //     return { message: 'Error generating file' }
                // }
            } else {
                return { message: 'Issue not present' }
            }
        } else if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            return { report: `${fileName}.pdf` }
        } else {
            return { message: 'Issue not present' }
        }
    } catch (e) {
        console.log(e)
        createLog(SINGLE_REPORT_PATH, `Exceptions in single report generation with Exception: ${e.message}`, leafPath)
        createLog(ERROR_PATH, `calcEngineServices=>singleIssueReport()::Exceptions in single report generation for ${leafPath} with Exception: ${e.message}`)
        return { error: e.message }
    } finally {
        createLog(SINGLE_REPORT_PATH, `Deleting json file => ${fileName}`, leafPath)
        // TODO: uncomment this
        // await deleteJsonFile(fileName)
    }
}

/*
* fetch data from cache and do year wise mapping
*/
const allYearCachedData = async (nation) => {
    createLog(MAIN_PATH, 'Fetching data from cache and do year wise mapping...')
    let allYearData = {}
    for (i = defaultPropYear; i > firstPropYear; i--) {
        let tempValue = await cacheServer.hgetallAsync(`${i}`)
        if (get(tempValue, nation)) {
            allYearData[`${i}`] = JSON.parse(get(tempValue, nation))
        }
    }
    return allYearData
}
const multiIssuesReport = async (path, fromWorker = false, year) => {
    // createLog(MULTI_REPORT_PATH, 'Multi report generation initiation......', path)
    const fileName = `${year}_${path}`

    try {
        const filePath = `${getReportPath()}reports/multiIssueReport`
        if (fromWorker || !fs.existsSync(`${filePath}/${fileName}.pdf`)) {
            const nation = path.split('/')[0]
            const nationPaths = await pathsByNation(nation)
            const allPaths = get(nationPaths, path.split('/').join('.'))

            let allYearData = { '2001': '' }
            // TODO: uncomment this
            // let allYearData = await allYearCachedData(nation)

            if (!isEmpty(allYearData)) {
                const umbrellaPaths = await getUmbrellaPaths()
                const pathsJson = { yearData: allYearData, actualPath: path, holon: getAppRoute(), allPaths: nationPaths, subPaths: allPaths, pageLink: convertStringToHash(`full_${nation}_${year}`), umbrellaPaths: umbrellaPaths }
                // createLog(MULTI_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, path)
                // TODO: uncomment this
                // await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, pathsJson)
                // createLog(MULTI_REPORT_PATH, `Generating report for => ${fileName} with year:${year}`, path)
                // await generateReport('multiIssueReport', fileName, year)
                // createLog(MULTI_REPORT_PATH, `Generating PDF for => ${filePATH}`, path)
                // await generatePDF(filePath, 'multiIssueReport')
                generatePDFMultiReport('multiIssueReport', fileName, year)
                return { report: `${fileName}.pdf` }
                // if (fromWorker) {
                //     let tempFilePath = `${getReportPath()}reports/temp_multiIssueReport/`
                //     // createLog(MULTI_REPORT_PATH, `Generating report for => ${fileName} with year:${year}`, path)
                //     await generateReport('multiIssueReport', fileName, year, 'true')
                //     // createLog(MULTI_REPORT_PATH, `Generating PDF for => ${tempFilePath}`, path)
                //     await generatePDF(tempFilePath, 'multiIssueReport')
                //     // createLog(MULTI_REPORT_PATH, `Renaming file => ${fileName}`, path)
                //     await renamePDFFile('multiIssueReport', fileName, tempFilePath)
                // }
                // if (fs.existsSync(`${filePath}/multiIssueReport.html`)) {
                //     // createLog(MULTI_REPORT_PATH, `Renaming file => ${fileName}`, path)
                //     await renameHTMLFile('multiIssueReport', fileName)
                //     // createLog(MULTI_REPORT_PATH, `Generating page number footer for  => ${fileName}`, path)
                //     await generatePageNumberFooter(filePath, 'multiIssueReport', fileName, `ZeroTheft Theft in ${path} Report `)
                //     return { report: `${fileName}.html` }
                // } else {
                //     return { message: 'Error generating file' }
                // }
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
        console.log(e)
        return { error: e.message }
    } finally {
        // createLog(MULTI_REPORT_PATH, `Deleting json file => ${fileName}`, path)
        // TODO: uncomment this
        // await deleteJsonFile(fileName)
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
        const fileName = `${year}_${nation}`
        const fullFileName = `full_${year}_${nation}`
        const filePath = `${getReportPath()}reports/multiIssueReport`
        const reportExists = fs.existsSync(`${filePath}/${fullFileName}.pdf`)
        if (fromWorker || !reportExists) {
            // createLog(FULL_REPORT_PATH, `Nation Report initiated for ${nation}(${year})`)
            // createLog(FULL_REPORT_PATH, `Fetching Multi Issue Report for ${nation}`)
            const response = await multiIssuesReport(nation, fromWorker, year)
            // return { report: `${fileName}.pdf` }
            if (response.report) {
                const nationPaths = await pathsByNation(nation)
                delete (nationPaths['Alias'])
                let nationTocReportName = `${year}_${nation}`
                // createLog(FULL_REPORT_PATH, `Fetching Umbrella Path`)
                let umbrellaPaths = await getUmbrellaPaths()
                umbrellaPaths = umbrellaPaths.map(x => `${nation}/${x}`)
                let pdfsSequence = await pdfPathTraverse(nationPaths[nation], nation, [], year, umbrellaPaths)
                if (pdfsSequence.length > 0) {
                    pdfsSequence.unshift(`${getReportPath()}reports/multiIssueReport/${nationTocReportName}.pdf`)
                    mergePdfLatex(fullFileName, pdfsSequence)
                    return { report: `${fullFileName}.pdf` }
                    // const fileWithoutFooter = convertStringToHash(`nofoot_full_${nation}_${year}`)
                    // // createLog(FULL_REPORT_PATH, `Merging pdf for nation with filepath ${filePath}`)
                    // await mergePdfForNation(filePath, fileWithoutFooter, pdfsSequence.join(' '))
                    // if (fs.existsSync(`${filePath}/${fileWithoutFooter}.pdf`)) {
                    //     // createLog(FULL_REPORT_PATH, `Generaing Page Number footer for ${filePath}`)
                    //     await generatePageNumberFooter(filePath, fileWithoutFooter, fileName)
                    //     return { report: `${fileName}.pdf` }
                    // } else {
                    //     return { message: 'Error generating PDF report' }
                    // }
                } else {
                    return { message: 'Report not present' }
                }
            } else {
                return { message: response.error }
            }

        } else if (reportExists) {
            return { report: `${fullFileName}.pdf` }
        } else {
            return { message: 'Full Country Report Generation will take time. Come back later.' }
        }
    } catch (e) {
        // createLog(FULL_REPORT_PATH, `Exceptions in full report generation for ${nation} with Exception: ${e.message}`)
        // createLog(ERROR_PATH, `calcEngineServices=>nationReport()::Exceptions in full report generation for ${nation} with Exception: ${e.message}`)
        return { error: e.message }
    }
}

const pdfPathTraverse = async (path, currPath, pdfsSequence, year, umbrellaPaths, parentPaths = []) => {
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
                let filePath = `${getReportPath()}reports/ztReport`
                if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
                    pdfsSequence.push(`${filePath}/${fileName}.pdf`)
                }
            } else {
                if (!parentPaths.includes(nextPath) && umbrellaPaths.includes(nextPath)) {
                    let filePath = `${getReportPath()}reports/ztReport`
                    if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
                        pdfsSequence.push(`${filePath}/${fileName}.pdf`)
                    }
                    parentPaths.push(nextPath)
                } else {
                    let filePath = `${getReportPath()}reports/temp_multiIssueReport`
                    if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
                        pdfsSequence.push(`${filePath}/${fileName}.pdf`)
                    }
                }
                createLog(FULL_REPORT_PATH, `Traversing recursively for the path for the year ${year} and nexx path: ${nextPath}`)
                await pdfPathTraverse(nestedValues, nextPath, pdfsSequence, year, umbrellaPaths, parentPaths)
            }
        }
        return pdfsSequence
    } catch (e) {
        console.log(e)
        createLog(FULL_REPORT_PATH, `Exceptions in full report generation for ${year} with Exception: ${e.message}`)
        createLog(ERROR_PATH, `calcEngineServices=>pdfPathTraverse()::Exceptions in full report generation for ${year} with Exception: ${e.message}`)
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
            let yearTh = await getPastYearThefts(nation)
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
            agg['info']['each_year'] = nationData['_totals']['theft'] / population(year)
            agg['info']['many_years'] = totalTh
            agg['info']['between_years'] = (maxYr - minYr) + 1
            return agg;
        }
        else {
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


const getPastYearThefts = async (nation) => {
    let sumTotals = {}
    for (i = defaultPropYear; i > firstPropYear; i--) {
        let tempValue = await cacheServer.hgetallAsync(`${i}`)
        if (get(tempValue, nation)) {
            sumTotals[`${i}`] = JSON.parse(get(tempValue, nation))
        }
    }
    let yearTh = []
    // simple estimator - use the prior theft until it changes
    let priorTheft
    let firstTheft
    for (year in sumTotals) {
        let p = sumTotals[year]

        let yd = { 'Year': year, 'theft': priorTheft, 'Determined By': 'estimation' }
        if (!p || get(p, 'missing')) {
            yearTh.push(yd)
            continue
        } else if (p['_totals']['legit']) {
            yd['Determined By'] = 'voting'
            yd['theft'] = p['_totals']['theft']
        } else { // not legit
            yd['Determined By'] = 'incomplete voting'
            yd['theft'] = p['_totals']['theft']
        }

        if (!firstTheft) {
            firstTheft = yd['theft']
        } else {
            firstTheft = firstTheft
        }
        priorTheft = yd['theft']

        yearTh.push(yd)
    }

    // second pass - back-fill any early years with firstTheft estimate
    for (yd in yearTh) {
        if (!yd['theft']) {
            yd['theft'] = firstTheft
        }
    }

    // third pass - step-estimate any theft between two legit/incomplete years
    let lastTh
    let lastThIdx = -1
    let preStep
    let preIdx
    let postStep
    let postIdx
    yearTh.forEach((yd, idx) => {
        if (yd['Determined By'] === 'voting' || yd['Determined By'] === 'incomplete voting') {
            // if we had a legit in the past, back-fill all estimation cases between
            let step
            if (lastTh && lastThIdx < (idx - 1)) {
                let diff = yd['theft'] - lastTh
                let gap = idx - lastThIdx
                step = diff / gap

                for (let backIdx = lastThIdx + 1; backIdx < idx; backIdx++) {
                    lastTh += step
                    yearTh[backIdx]['theft'] = lastTh
                }
            } else if (lastTh && lastThIdx == (idx - 1)) {
                step = yd['theft'] - lastTh
            }
            // prepare for fourth/fifth passes
            if (step) {
                if (!preStep && idx > 0) {
                    preStep = step
                    preIdx = idx
                }
                postStep = step
                postIdx = idx
            }
            lastTh = yd['theft']
            lastThIdx = idx
        }
    })
    // fourth pass - apply preStep to years before first not missing
    if (preIdx) {
        lastTh = yearTh[preIdx]['theft']
        for (let pi = preIdx - 1; pi < -1; pi--) {
            lastTh -= preStep
            if (lastTh <= 0) {
                yearTh[pi]['theft'] = 0
            } else {
                yearTh[pi]['theft'] = lastTh
            }
        }
    }
    // fifth pass - apply postStep to years after last not missing
    if (postIdx && postIdx < yearTh.length - 1) {
        lastTh = yearTh[postIdx]['theft']
        for (let pi = postIdx + 1; pi < yearTh.length; pi++) {
            lastTh += postStep
            if (lastTh <= 0) {
                yearTh[pi]['theft'] = 0
            } else {
                yearTh[pi]['theft'] = lastTh
            }
        }
    }
    return yearTh
}

module.exports = {
    allYearCachedData,
    singleIssueReport,
    multiIssuesReport,
    theftInfo,
    nationReport,
}
