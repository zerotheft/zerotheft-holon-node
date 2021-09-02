/* eslint-disable no-underscore-dangle */
const fs = require('fs')
const { get, min, max, isEmpty, difference } = require('lodash')
const { pathsByNation } = require('zerotheft-node-utils').paths
const config = require('zerotheft-node-utils/config')

const cacheDir = `${config.APP_PATH}/.cache/calc_data`
const { writeFile, exportsDir, createAndWrite } = require('../../common')
const { getReportPath, getAppRoute } = require('../../../config')
const { cacheServer } = require('../redisService')
const { dataCachingPerPath } = require('../../workers/reports/dataCacheWorker')
const {
  generatePDFReport,
  generateNoVotePDFReport,
  generatePDFMultiReport,
  generateNoVoteMultiPDFReport,
  deleteJsonFile,
  mergePdfLatex,
} = require('./reportCommands')
const { createLog, SINGLE_REPORT_PATH, ERROR_PATH, MAIN_PATH } = require('../LogInfoServices')

const reportsPath = fromWorker => `${getReportPath()}reports${fromWorker ? '_in_progress' : ''}`
const multiIssueReportPath = fromWorker => `${reportsPath(fromWorker)}/multiIssueReport`
const singleIssueReportPath = fromWorker => `${reportsPath(fromWorker)}/ztReport`

/**
 * Before report generation, all data from the blockchain were exported and go through a calculation algorithm.
 * Calculation engine creates a summary json file that is then used for report generation process.
 * This method actually scans the calc_summary.json file and returns a JSON object whereever needed in the report generation process.
 */
const allYearCachedData = async nation => {
  createLog(MAIN_PATH, 'Fetching data from cache and do year wise mapping...')
  try {
    const jsonFile = fs.readFileSync(`${cacheDir}/${nation}/calc_summary.json`)
    return JSON.parse(jsonFile)
  } catch {
    return {}
  }
}
/**
 * Generate sigle report based on economic hierarchy path. This method is also called from worker itself
 * Ultimate pdf is generated for a single path.
 */
const singleIssueReport = async (leafPath, fromWorker = false) => {
  createLog(SINGLE_REPORT_PATH, 'Single report generation initiation......', leafPath)
  const fileName = `${leafPath.replace(/\//g, '-')}`
  try {
    const filePath = singleIssueReportPath(fromWorker)
    if (fromWorker || !fs.existsSync(`${filePath}/${fileName}.pdf`)) {
      const nation = leafPath.split('/')[0]
      const nationPaths = await pathsByNation(nation)

      const allYearData = await allYearCachedData(nation)

      const lPath = leafPath.split('/').slice(1).join('/')
      if (
        !isEmpty(allYearData) &&
        get(allYearData, `paths.${lPath}`) &&
        !get(allYearData, `paths.${lPath}.missing`) &&
        get(allYearData, `paths.${lPath}._totals.votes`) > 0 &&
        get(allYearData, `paths.${lPath}._totals.proposals`) > 0
      ) {
        const leafJson = {
          yearData: allYearData,
          holon: getAppRoute(false),
          leafPath,
          actualPath: lPath,
          allPaths: nationPaths,
        }
        createLog(SINGLE_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, leafPath)
        await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, leafJson)

        createLog(SINGLE_REPORT_PATH, `Generating report for => ${fileName}`, leafPath)
        await generatePDFReport('ztReport', fileName, fromWorker)
        return { report: `${fileName}.pdf` }
      }
      await generateNoVotePDFReport('ztReport', fileName, leafPath, getAppRoute(false), nationPaths, fromWorker)
      return { report: `${fileName}.pdf` }
    }
    if (fs.existsSync(`${filePath}/${fileName}.pdf`)) {
      return { report: `${fileName}.pdf` }
    }
    return { message: 'Issue not present' }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`path: ${leafPath}`, e)
    createLog(SINGLE_REPORT_PATH, `Exceptions in single report generation with Exception: ${e.message}`, leafPath)
    createLog(
      ERROR_PATH,
      `calcEngineServices=>singleIssueReport()::Exceptions in single report generation for ${leafPath} with Exception: ${e.message}`
    )
    return { error: e.message }
  } finally {
    createLog(SINGLE_REPORT_PATH, `Deleting json file => ${fileName}`, leafPath)
    await deleteJsonFile(fileName)
  }
}

/**
 * Get the avilable paths for report generation.
 * All pdf files are named after the specific paths. It runs through all the paths passed as method params and create a tex file name based on path.
 */
const listAvailablePdfsPaths = (paths, path, fromWorker) => {
  let availablePaths = []
  const childrenKeys = difference(Object.keys(paths), ['metadata', 'parent'])
  const regex = new RegExp(`^${reportsPath(fromWorker)}/([^\.]+).tex$`)

  childrenKeys.forEach(childPath => {
    const childData = paths[childPath]
    const childFullPath = `${path}/${childPath}`
    const childFile = childFullPath.replace(/\//g, '-')
    const singleFile = `${singleIssueReportPath(fromWorker)}/${childFile}.tex`
    const multiFile = `${multiIssueReportPath(fromWorker)}/${childFile}_full.tex`
    if (get(childData, 'leaf') && fs.existsSync(singleFile)) {
      const matches = singleFile.match(regex)
      if (matches) {
        availablePaths.push(matches[1].replace(/-/g, '/'))
      }
    } else if ((get(childData, 'metadata.umbrella') || get(childData, 'parent')) && fs.existsSync(multiFile)) {
      availablePaths = [...availablePaths, ...listAvailablePdfsPaths(childData, childFullPath, fromWorker)]
    }
  })

  return [`multiIssueReport/${path}`, ...availablePaths]
}

/**
 * This method generates a umbrella report.
 * Paths are either a umbrella or leaf path. Report for umbrella path is quite different than the leaft path.
 */
const multiIssuesReport = async (path, fromWorker = false) => {
  // createLog(MULTI_REPORT_PATH, 'Multi report generation initiation......', path)
  const fileName = `${path.replace(/\//g, '-')}`

  try {
    if (fromWorker || !fs.existsSync(`${multiIssueReportPath(fromWorker)}/${fileName}.pdf`)) {
      const pathData = path.split('/')
      const nation = pathData[0]
      const noNationPath = pathData.slice(1).join('/')
      const nationPaths = await pathsByNation(nation)
      const allPaths = get(nationPaths, path.split('/').join('.'))

      const availablePdfsPaths = listAvailablePdfsPaths(allPaths, path, fromWorker)

      // let allYearData = { '2001': '' }
      // TODO: uncomment this
      const allYearData = await allYearCachedData(nation)

      if (
        !get(allYearData, `paths.${noNationPath}.missing`) ||
        get(allYearData, `paths.${noNationPath}._totals.value_parent`) === 'children' ||
        allPaths.parent
      ) {
        const pathsJson = {
          yearData: allYearData,
          actualPath: path,
          holon: getAppRoute(false),
          allPaths: nationPaths,
          subPaths: allPaths,
        }
        // createLog(MULTI_REPORT_PATH, `Writing to input jsons => ${fileName}.json`, path)
        // TODO: uncomment this
        await writeFile(`${getReportPath()}input_jsons/${fileName}.json`, pathsJson)

        await generatePDFMultiReport('multiIssueReport', fileName, availablePdfsPaths, fromWorker)
        return { report: `${fileName}.pdf` }
      }
      await generateNoVoteMultiPDFReport(
        'multiIssueReport',
        fileName,
        path,
        getAppRoute(false),
        allPaths,
        availablePdfsPaths,
        fromWorker
      )
      return { report: `${fileName}.pdf` }
      // return { message: 'No Issues for the path' }
    }
    if (fs.existsSync(`${multiIssueReportPath(fromWorker)}/${fileName}.pdf`)) {
      return { report: `${fileName}.pdf` }
    }
    return { message: 'No Issues for the path' }
  } catch (e) {
    // createLog(MULTI_REPORT_PATH, `Exceptions in single report generation with Exception: ${e.message}`, path)
    // createLog(ERROR_PATH, `calcEngineServices=>multiIssuesReport()::Exceptions in single report generation for ${path} with Exception: ${e.message}`)
    // eslint-disable-next-line no-console
    console.log(`path: ${path}`, e)
    return { error: e.message }
  } finally {
    // createLog(MULTI_REPORT_PATH, `Deleting json file => ${fileName}`, path)
    // TODO: uncomment this
    await deleteJsonFile(fileName)
  }
}

const getTexsSequence = async (path, fromWorker) => {
  const nation = path.split('/')[0]
  const nationPaths = await pathsByNation(nation)
  delete nationPaths.Alias

  const childrens = get(nationPaths, path.replace(/\//g, '.'))

  const childrenKeys = difference(Object.keys(childrens), ['metadata', 'parent'])

  const texsSequence = []
  childrenKeys.forEach(childPath => {
    const childData = childrens[childPath]
    const childFile = `${path}/${childPath}`.replace(/\//g, '-')
    const singleFile = `${singleIssueReportPath(fromWorker)}/${childFile}.tex`
    const multiFile = `${multiIssueReportPath(fromWorker)}/${childFile}_full.tex`
    if (get(childData, 'leaf') && fs.existsSync(singleFile)) {
      texsSequence.push(singleFile)
    } else if ((get(childData, 'metadata.umbrella') || get(childData, 'parent')) && fs.existsSync(multiFile)) {
      texsSequence.push(multiFile)
    }
  })

  const fileName = `${path.replace(/\//g, '-')}.tex`
  const reportPathTex = `${multiIssueReportPath(fromWorker)}/${fileName}`
  if (texsSequence.length > 0 || fs.existsSync(reportPathTex)) {
    texsSequence.unshift(reportPathTex)
  }

  return texsSequence
}

const multiIssuesFullReport = async (path, fromWorker = false) => {
  // createLog(FULL_REPORT_PATH, `Full report generation initiation......`)
  try {
    const fullFileName = `${path.replace(/\//g, '-')}_full`
    const filePath = multiIssueReportPath(fromWorker)
    const reportExists = fs.existsSync(`${filePath}/${fullFileName}.pdf`)
    if (fromWorker || !reportExists) {
      await multiIssuesReport(path, fromWorker)
      const texsSequence = await getTexsSequence(path, fromWorker)

      // create full umbrealla report
      await mergePdfLatex(fullFileName, texsSequence, fromWorker, getAppRoute(false))
      return { report: `${fullFileName}.pdf` }
    }
    if (reportExists) {
      return { report: `${fullFileName}.pdf` }
    }
    return { message: 'Full Umbrella Report Generation will take time. Come back later.' }
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
    const reportExists = fs.existsSync(`${multiIssueReportPath(fromWorker)}/${fullFileName}.pdf`)
    if (fromWorker || !reportExists) {
      await multiIssuesReport(nation, fromWorker)
      const texsSequence = await getTexsSequence(nation, fromWorker)

      // create full nation report
      await mergePdfLatex(fullFileName, texsSequence, fromWorker, getAppRoute(false))
      return { report: `${fullFileName}.pdf` }
    }
    if (reportExists) {
      return { report: `${fullFileName}.pdf` }
    }
    return { message: 'Full Country Report Generation will take time. Come back later.' }
  } catch (e) {
    // createLog(FULL_REPORT_PATH, `Exceptions in full report generation for ${nation} with Exception: ${e.message}`)
    // createLog(ERROR_PATH, `calcEngineServices=>nationReport()::Exceptions in full report generation for ${nation} with Exception: ${e.message}`)
    console.log(e)
    return { error: e.message }
  }
}

const theftInfo = async (fromWorker = false, nation = 'USA') => {
  const exportFile = `${exportsDir}/calc_data/${nation}/calc_summary.json`

  try {
    if (!fromWorker && (await cacheServer.getAsync(`CALC_SUMMARY_SYNCED`)) && fs.existsSync(exportFile)) {
      // if path has been sychrnoized and not from worker
      // const result = await cacheServer.getAsync(nation)
      const nationData = JSON.parse(fs.readFileSync(exportFile))
      // = JSON.parse(result[nation])
      const { paths } = nationData
      // eslint-disable-next-line no-underscore-dangle
      const agg = { [nation]: nationData._totals }
      let allTheftYears = []
      Object.keys(paths).forEach(path => {
        // eslint-disable-next-line no-underscore-dangle
        const totals = paths[path]._totals
        if (totals.votes !== 0) {
          agg[`${nation}/${path}`] = totals
        }
        allTheftYears = allTheftYears.concat(Object.keys(get(totals, 'voted_year_thefts', [])))
      })
      // check cache for past
      // let yearTh = await getPastYearThefts(nation)
      // if (yearTh.length == 0) throw new Error('no past thefts data in cache')
      const minYr = min(allTheftYears)
      const maxYr = max(allTheftYears)
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
      agg.info = {}
      agg.info.total = nationData._totals.theft
      agg.info.last_year_theft = nationData._totals.last_year_theft
      // agg['info']['each_year'] = nationData['_totals']['theft'] / usaPopulation(year)
      // agg['info']['population'] = usaPopulation(year)
      agg.info.many_years = nationData._totals.theft
      agg.info.max_year = maxYr
      agg.info.min_year = minYr
      agg.info.between_years = maxYr - minYr + 1
      agg.info.votes = nationData._totals.votes
      agg.info.proposals = nationData._totals.proposals

      // log the aggregated data in file inside exports directory
      let exportFileData = {}
      if (fs.existsSync(exportFile)) {
        exportFileData = JSON.parse(fs.readFileSync(exportFile))
      }
      exportFileData.info = agg.info
      await createAndWrite(`${exportsDir}/calc_data/${nation}`, `calc_summary.json`, exportFileData)

      return agg
    }

    const response = dataCachingPerPath(nation) // Background task for processing and saving data into cache
    createLog(MAIN_PATH, `Background task for processing and saving data into cache for ${nation}`)
    return response
  } catch (e) {
    console.log(e)
    createLog(ERROR_PATH, `calcEngineServices=>theftInfo()::Exception occurs in theftInfo with ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Reports are generated in every 4 hours. No reports are purged or deleted. Report generation always takes time.
 * Util report generation is completed in progress reports are kept in different directory as `reports_in_progress` and then directory name is changed to `reports`
 */
const setupForReportsInProgress = () => {
  const time = new Date()
  const reportPath = `${exportsDir}/${time.getFullYear()}/${time.getMonth() + 1
    }/${time.getDate()}/${time.getHours()}_hrs_${time.getMinutes()}_mins_${time.getSeconds()}_secs/reports`
  // const reportPath = `${exportsDir}/${time.getFullYear()}/${time.getMonth()}/${time.getDate()}/reports`
  fs.mkdirSync(`${reportPath}/multiIssueReport`, { recursive: true })
  fs.mkdirSync(`${reportPath}/ztReport`, { recursive: true })
  const symLinkPath = `${config.APP_PATH}/zt_report/reports_in_progress`
  try {
    fs.unlinkSync(symLinkPath)
  } catch (e) { }
  fs.symlinkSync(reportPath, symLinkPath, 'dir')
}

/**
 * When report generation is complete then `reports_in_progress` is then changed to `reports` and served in holon UI
 */
const setupForReportsDirs = (replaceDirs = true) => {
  const symLinkPath = `${config.APP_PATH}/zt_report/reports_in_progress`
  const currentReportsSymLinkPath = `${config.APP_PATH}/zt_report/reports`

  if (!(replaceDirs || !fs.existsSync(currentReportsSymLinkPath))) return

  if (!fs.existsSync(symLinkPath)) {
    setupForReportsInProgress()
  }

  const reportPath = fs.realpathSync(symLinkPath)
  try {
    fs.unlinkSync(currentReportsSymLinkPath)
  } catch (e) { }
  fs.symlinkSync(reportPath, currentReportsSymLinkPath, 'dir')
}

module.exports = {
  allYearCachedData,
  singleIssueReport,
  multiIssuesReport,
  theftInfo,
  nationReport,
  multiIssuesFullReport,
  setupForReportsInProgress,
  setupForReportsDirs,
}
