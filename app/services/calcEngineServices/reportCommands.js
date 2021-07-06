const { exec } = require('child_process')
const { get, startCase, isEmpty } = require("lodash")
const latex = require('node-latex')
const yaml = require('js-yaml')
const yamlConverter = require('json2yaml')

const fs = require('fs')
const homedir = require('os').homedir()
const templates = `${homedir}/.zerotheft/Zerotheft-Holon/holon-api/app/services/calcEngineServices/templates`
const { getReportPath } = require('../../../config');
const { APP_PATH } = require('zerotheft-node-utils/config')
const { getProposalYaml } = require('zerotheft-node-utils').proposals
const { createLog, MAIN_PATH } = require('../LogInfoServices')
const { loadSingleIssue, getPathYearProposals, getPathYearVotes, getPathVoteTotals, loadAllIssues, getLeafPaths, getFlatPaths } = require('./inputReader')
const { getCitizenAmounts, realTheftAmount, theftAmountAbbr, usaPopulation, prepareBellCurveData } = require('./helper')
const { pathSummary: analyticsPathSummary,
    splitPath,
    yesNoVoteTotalsSummary,
    proposalVoteTotalsSummaryMulti,
    getPastYearsTheftForMulti,
    assignPageNumbers
} = require('./reportAnalytics')

var currentDate = new Date();
var currentYear = currentDate.getFullYear();

const multiIssueReportPath = `${getReportPath()}reports/multiIssueReport`
const singleIssueReportPath = `${getReportPath()}reports/ztReport`
const apiPath = `${APP_PATH}/Zerotheft-Holon/holon-api`
const pleaseVoteImage = `${apiPath}/app/assets/please_vote.png`
const inflatedValuesPath = `${apiPath}/app/services/calcEngineServices/inflatedValues.json`

if (!fs.existsSync(inflatedValuesPath)) {
    const yearlyAverageUSInflationRate = require('./yearlyAverageUSInflationRate.json')
    const years = Object.keys(yearlyAverageUSInflationRate).sort().reverse()

    let inflatedValues = {}
    inflatedValues[currentYear] = 1
    years.forEach((year, index) => {
        inflatedValues[year] = inflatedValues[parseInt(year) + 1] * (1 + (yearlyAverageUSInflationRate[year] / 100))
    })

    fs.writeFileSync(inflatedValuesPath, JSON.stringify(inflatedValues))
}
const inflatedValues = require(inflatedValuesPath)

const generateReportData = async (fileName) => {
    const { yearData: summaryTotals, actualPath: path, leafPath, holon, allPaths } = loadSingleIssue(fileName)

    const year = (new Date()).getFullYear() - 1
    let pdfData = {}
    pdfData.pdfLink = `/issueReports/${fileName}.pdf`
    pdfData.year = year
    pdfData.country = 'USA'
    pdfData.holonUrl = holon
    pdfData.pageID = 'ztReport/' + leafPath

    const pdfReportPath = `${holon}/issueReports/${fileName}.pdf`
    const props = getPathYearProposals(summaryTotals, path)
    const votes = getPathYearVotes(props)
    const vt = getPathVoteTotals(summaryTotals, path)
    if (vt['missing']) throw new Error(`generateReportData: Proposals not available for path: ${path}`);

    const voteTotals = {
        'for': get(vt, '_totals.for', 0),
        'against': get(vt, '_totals.against', 0),
        'props': get(vt, 'props', {})
    }

    const pathSummary = analyticsPathSummary(voteTotals)

    const { pathTitle, pathPrefix } = splitPath(path)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix

    let pathData = leafPath.split('/')
    const leafSlug = pathData.pop()
    const pathSlug = pathData.join('%2F')
    pdfData.leafSlug = leafSlug
    pdfData.pathSlug = pathSlug

    const { thefts: propThefts, votes: propVotes } = proposalVoteTotalsSummaryMulti(voteTotals, false)

    const yearTh = getPastYearsTheftForMulti(summaryTotals, path)

    let minYr = null
    let maxYr = null
    let totalTh = 0
    let yearTheft
    for (i = 0; i < yearTh.length; i++) {
        const yr = yearTh[i]
        minYr = minYr === null || yr['Year'] < minYr ? yr['Year'] : minYr
        maxYr = maxYr === null || yr['Year'] > maxYr ? yr['Year'] : maxYr
        totalTh += yr['theft']
        if (yr['Year'] == year) yearTheft = yr['Theft']
    }

    const votedYearThefts = get(vt, `_totals.voted_year_thefts`, {})
    const leadingTheft = get(pathSummary, 'leading_theft', '$0')
    const cts = getCitizenAmounts(year)
    const perCitTheft = theftAmountAbbr((realTheftAmount(leadingTheft) / cts['citizens']).toFixed(2))
    const xYrs = (parseInt(maxYr) - parseInt(minYr)) + 1

    const manyYearsPerCit = theftAmountAbbr(totalTh / cts['citizens'])

    pdfData.theft = theftAmountAbbr(get(votedYearThefts, year, 0))
    pdfData.citizen = cts.citizens
    pdfData.perCitTheft = perCitTheft

    pdfData.manyYearsTheft = theftAmountAbbr(totalTh)
    pdfData.manyYearsPerCit = manyYearsPerCit
    pdfData.xYrs = xYrs
    pdfData.minYear = minYr
    pdfData.maxYear = maxYr

    let theftValueChartData = 'Year theft DeterminedBy Theft\n'
    yearTh.forEach((theft) => {
        theftValueChartData += `${theft['Year']} ${theft['theft']} ${theft['Determined By'].replace(/\s/g, '')} ${theft['Theft'].replace(/\s/g, '')}\n`
    })

    pdfData.theftValueChartData = theftValueChartData

    const { noVotes, yesVotes } = yesNoVoteTotalsSummary(voteTotals)
    const totalVotes = yesVotes + noVotes
    pdfData.yesVotes = yesVotes
    pdfData.noVotes = noVotes
    pdfData.totalVotes = totalVotes
    pdfData.yesVotePercent = ((yesVotes / totalVotes) * 100).toFixed()
    pdfData.noVotePercent = 100 - pdfData.yesVotePercent

    const { bellCurveThefts, bellCurveVotes } = prepareBellCurveData(propThefts, propVotes)

    let votesForTheftAmountData = 'Theft Votes\n';
    bellCurveThefts.forEach((theft, index) => {
        votesForTheftAmountData += `${theft} ${bellCurveVotes[index]}\n`
    })
    pdfData.votesForTheftAmountData = votesForTheftAmountData

    pdfData.stolenByYearTableData = prepareStolenByYear(votedYearThefts)
    pdfData.inflationYear = currentYear

    const leadingProp = get(pathSummary, 'leading_proposal')
    const proposalID = get(leadingProp, 'id')
    const yamlJSON = await getProposalYaml(proposalID, path)
    pdfData.leadingProposalID = proposalID
    pdfData.leadingProposalAuthor = get(yamlJSON, 'author.name')
    pdfData.leadingProposalDate = leadingProp['date']

    const leadingProposalDetail = yamlConverter.stringify(yamlJSON)
    const limitedLinesArray = limitTextLines(leadingProposalDetail)

    pdfData.leadingProposalDetail = leadingProposalDetail.replace(/\\n/g, '\n')
    pdfData.leadingProposalDetailPart = limitedLinesArray.join('\n')
    // pdfData.leadingProposalDetail = yamlConverter.stringify(yamlJSON).replace(/: ?>/g, ': |')

    return pdfData
}

const prepareStolenByYearSingle = (year, stolenByYear, inflated = false) => {
    if (!year) return ` & `
    return `${year} & \\$${theftAmountAbbr(inflated ? stolenByYear[year] * inflatedValues[year] : stolenByYear[year])}`
}

const prepareStolenByYear = (stolenByYear) => {
    let stolenByYearTableData = ''
    const stolenByYearYears = Object.keys(stolenByYear).sort().reverse()
    const columns = 3
    const numberOfRows = Math.ceil(stolenByYearYears.length / columns)

    for (var i = 0; i < numberOfRows; i++) {
        const year1 = stolenByYearYears[i]
        const year2 = stolenByYearYears[i + numberOfRows]
        const year3 = stolenByYearYears[i + (numberOfRows * 2)]
        stolenByYearTableData += `
            ${prepareStolenByYearSingle(year1, stolenByYear)} &
            ${prepareStolenByYearSingle(year2, stolenByYear)} &
            ${prepareStolenByYearSingle(year3, stolenByYear)} & &
            ${prepareStolenByYearSingle(year1, stolenByYear, true)} &
            ${prepareStolenByYearSingle(year2, stolenByYear, true)} &
            ${prepareStolenByYearSingle(year3, stolenByYear, true)} \\\\ \n`
    }

    return stolenByYearTableData
}

const wordLengthThreshold = 15

const breakLines = (line, lineChars, indent, start) => {
    const end = start + lineChars
    const spaceIndex = line.lastIndexOf(' ', end) + 1
    if (start > 0) {
        line = line.substring(0, start) + (indent + '  ') + line.substring(start)
    }
    const nextStart = spaceIndex === 0 || (end - spaceIndex > wordLengthThreshold) ? end : line.length < end ? line.length : spaceIndex
    let brokenLines = [line.substring(start, nextStart)]

    if (end < line.length) {
        brokenLines = [...brokenLines, ...breakLines(line, lineChars, indent, nextStart)]
    }

    return brokenLines
}

const limitTextLines = (content, lineLimit = 119, lineChars = 90) => {
    content = content.replace(/\\n/g, '\n')
    const lineArray = content.split(/\n/g)

    let limitedLinesArray = []
    const linCharsRegex = new RegExp(`.{1,${lineChars}}`, 'g')

    for (var i = 0; i < lineArray.length; i++) {

        const lineContent = lineArray[i]

        if (lineContent.length > lineChars) {
            const indentMatch = lineContent.match(/^\s+/)
            const brokenLines = breakLines(lineContent, lineChars, indentMatch ? indentMatch[0] : '', 0)
            limitedLinesArray = [...limitedLinesArray, ...brokenLines]
        } else {
            limitedLinesArray.push(lineContent)
        }

        if (limitedLinesArray.length >= lineLimit) {
            limitedLinesArray.splice(lineLimit)
            break;
        }
    }

    return limitedLinesArray
}

const generateLatexPDF = async (pdfData, fileName) => {
    return new Promise((resolve, reject) => {
        let template = fs.readFileSync(`${templates}/report.tex`, 'utf8')
        Object.keys(pdfData).forEach((key) => {
            if (['leadingProposalDetail', 'leadingProposalDetailPart', 'viewMore'].includes(key)) return

            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const templateFull = template.replace(/--leadingProposalDetail--/g, pdfData['leadingProposalDetail'])
            .replace(/--viewMore--/g, '')
        const templatePart = template.replace(/--leadingProposalDetail--/g, pdfData['leadingProposalDetailPart'])
            .replace(/--viewMore--/g, `\\href{${pdfData['holonUrl']}/path/${pdfData['pathSlug']}/issue/${pdfData['leafSlug']}}{\\color{blue}View More}`)

        const reportPrepd = `${singleIssueReportPath}/${fileName}.tex`
        const reportPDF = `${singleIssueReportPath}/${fileName}.pdf`

        fs.writeFileSync(reportPrepd, templateFull, function (err) {
            if (err) {
                console.error('generateLatexPDF::', err)
                reject({ message: err })
            }
            console.log('report Prepared');
        });

        const input = fs.createReadStream(reportPrepd)
        const output = fs.createWriteStream(reportPDF)
        const pdf = latex(input, { args: ['-shell-escape'] })
        pdf.pipe(output)
        pdf.on('error', err => {
            console.error('generateLatexPDF::', err)
            reject({ message: err })
            fs.unlinkSync(reportPDF)
            fs.unlinkSync(reportPrepd)
        })
        pdf.on('finish', () => {
            fs.writeFileSync(reportPrepd, templatePart, function (err) {
                if (err) {
                    console.error('generateLatexPDFPart::', err)
                    reject({ message: err })
                }
                console.log('report for full report Prepared');
            });
            console.log('PDF generated!')
            resolve()
        })
    })
}


const generateLatexMultiPDF = async (pdfData, fileName) => {
    return new Promise((resolve, reject) => {
        let template = fs.readFileSync(`${templates}/multiReport.tex`, 'utf8')

        pdfData.hideBlocks.forEach((block) => {
            const regex = new RegExp(`% ${block}Start[^~]+% ${block}End`, 'g')
            template = template.replace(regex, '')
        })

        Object.keys(pdfData).forEach((key) => {
            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const reportPrepd = `${multiIssueReportPath}/${fileName}.tex`
        const reportPDF = `${multiIssueReportPath}/${fileName}.pdf`

        fs.writeFileSync(reportPrepd, template, function (err) {
            if (err) {
                console.error('generateLatexMultiPDF::', err)
                reject({ message: err })
            }
            console.log('multi report Prepared');
        });

        const input = fs.createReadStream(reportPrepd)
        const output = fs.createWriteStream(reportPDF)
        const pdf = latex(input, { args: ['-shell-escape'] })

        pdf.pipe(output)
        pdf.on('error', err => {
            console.error('generateLatexMultiPDF::', err)
            reject({ message: err })
            fs.unlinkSync(reportPDF)
            fs.unlinkSync(reportPrepd)
        })
        pdf.on('finish', () => {
            console.log('PDF generated!')
            resolve()
        })
    })
}

const generatePDFReport = async (noteBookName, fileName, isPdf = 'false') => {
    createLog(MAIN_PATH, `Generating Report with filename: ${fileName}`)
    const pdfData = await generateReportData(fileName)
    return await generateLatexPDF(pdfData, fileName)
}

const generateNoVoteReportData = async (fileName, path, holon) => {
    const pathData = path.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    let pdfData = {}
    pdfData.pdfLink = `/pathReports/${fileName}.pdf`
    pdfData.country = nation
    pdfData.holonUrl = holon
    pdfData.pageID = 'ztReport/' + path

    const { pathTitle, pathPrefix } = splitPath(noNationPath)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix
    pdfData.pleaseVoteImage = pleaseVoteImage

    return pdfData
}

const generateNoVoteLatexPDF = async (pdfData, fileName) => {
    return new Promise((resolve, reject) => {
        let template = fs.readFileSync(`${templates}/reportNoVote.tex`, 'utf8')
        Object.keys(pdfData).forEach((key) => {
            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const reportPrepd = `${singleIssueReportPath}/${fileName}.tex`
        const reportPDF = `${singleIssueReportPath}/${fileName}.pdf`

        fs.writeFileSync(reportPrepd, template, function (err) {
            if (err) {
                console.error('generateLatexPDF::', err)
                reject({ message: err })
            }
            console.log('report Prepared');
        });

        const input = fs.createReadStream(reportPrepd)
        const output = fs.createWriteStream(reportPDF)
        const pdf = latex(input)
        pdf.pipe(output)
        pdf.on('error', err => {
            console.error('generateLatexPDF::', err)
            reject({ message: err })
            fs.unlinkSync(reportPDF)
            fs.unlinkSync(reportPrepd)
        })
        pdf.on('finish', () => {
            console.log('PDF generated!')
            resolve()
        })
    })
}

const generateNoVotePDFReport = async (noteBookName, fileName, path, holon) => {
    createLog(MAIN_PATH, `Generating No Vote Report with filename: ${fileName}`)
    const pdfData = await generateNoVoteReportData(fileName, path, holon)
    return await generateNoVoteLatexPDF(pdfData, fileName)
}

const generateNoVoteMultiReportData = async (fileName, path, holon, subPaths, availablePdfsPaths) => {
    const pathData = path.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    let pdfData = {}
    pdfData.country = nation
    pdfData.holonUrl = holon
    pdfData.pageID = 'multiIssueReport/' + path

    const { pathTitle, pathPrefix } = splitPath(noNationPath)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix
    pdfData.pleaseVoteImage = pleaseVoteImage

    const sourcesOfTheft = prepareSourcesOfTheftNoVote(noNationPath, nation, subPaths, availablePdfsPaths)

    pdfData.sourcesOfTheft = sourcesOfTheft

    return pdfData
}

const generateNoVoteMultiLatexPDF = async (pdfData, fileName) => {
    return new Promise((resolve, reject) => {
        let template = fs.readFileSync(`${templates}/reportNoVoteMulti.tex`, 'utf8')
        Object.keys(pdfData).forEach((key) => {
            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const reportPrepd = `${multiIssueReportPath}/${fileName}.tex`
        const reportPDF = `${multiIssueReportPath}/${fileName}.pdf`

        fs.writeFileSync(reportPrepd, template, function (err) {
            if (err) {
                console.error('generateLatexNoVoteMultiPDF::', err)
                reject({ message: err })
            }
            console.log('no votes multi report Prepared');
        });

        const input = fs.createReadStream(reportPrepd)
        const output = fs.createWriteStream(reportPDF)
        const pdf = latex(input)

        pdf.pipe(output)
        pdf.on('error', err => {
            console.error('generateLatexNoVoteMultiPDF::', err)
            reject({ message: err })
            fs.unlinkSync(reportPDF)
            fs.unlinkSync(reportPrepd)
        })
        pdf.on('finish', () => {
            console.log('PDF generated!')
            resolve()
        })
    })
}

const generateNoVoteMultiPDFReport = async (noteBookName, fileName, path, holon, subPaths, availablePdfsPaths) => {
    createLog(MAIN_PATH, `Generating No Vote Report with filename: ${fileName}`)
    const pdfData = await generateNoVoteMultiReportData(fileName, path, holon, subPaths, availablePdfsPaths)
    return await generateNoVoteMultiLatexPDF(pdfData, fileName)
}

const generateMultiReportData = (fileName, availablePdfsPaths) => {
    const { summaryTotals, actualPath, holon, allPaths, subPaths } = loadAllIssues(fileName)

    const pathData = actualPath.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    const year = (new Date()).getFullYear() - 1
    let pdfData = {}
    pdfData.pdfLink = `/pathReports/${fileName}.pdf`
    pdfData.year = year
    pdfData.country = nation
    pdfData.holonUrl = holon
    pdfData.pageID = 'multiIssueReport/' + actualPath

    let generatedFrom = ''
    const valueParent = get(subPaths, 'metadata.value_parent')
    if (valueParent === 'umbrella')
        generatedFrom = 'Generated from Umbrella Proposals'
    else if (valueParent === 'children')
        generatedFrom = 'Generated from Child Proposals'

    pdfData.generatedFrom = generatedFrom

    let hideBlocks = []

    const { pathTitle, pathPrefix } = splitPath(actualPath)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix

    const paths = allPaths[nation]

    const path = actualPath == nation ? nation : noNationPath
    let sumTotals = {}

    const yearPaths = summaryTotals['paths']

    if (path in yearPaths) sumTotals = yearPaths[path]['_totals']
    else if (path === nation) sumTotals = summaryTotals['_totals']

    if (isEmpty(get(sumTotals, `${path === nation ? 'overall' : 'voted'}_year_thefts`))) hideBlocks = [...hideBlocks, 'chartBlock']

    let subPathsFlat = []
    const flatPaths = getFlatPaths(paths)
    if (path === nation) {
        subPathsFlat = flatPaths
    } else {
        flatPaths.forEach((p) => {
            if (p.indexOf(path + '/') === 0) subPathsFlat.push(p)
        })
    }

    const subPathTotals = {}
    subPathsFlat.forEach((p) => {
        if (p in summaryTotals['paths']) subPathTotals[p] = summaryTotals['paths'][p]['_totals']
    })

    const yearTh = getPastYearsTheftForMulti(summaryTotals, path, nation)

    let minYr = null
    let maxYr = null
    let totalTh = 0
    let yearTheft
    for (i = 0; i < yearTh.length; i++) {
        const yr = yearTh[i]
        minYr = minYr === null || yr['Year'] < minYr ? yr['Year'] : minYr
        maxYr = maxYr === null || yr['Year'] > maxYr ? yr['Year'] : maxYr
        totalTh += yr['theft']
        if (yr['Year'] == year) yearTheft = yr['Theft']
    }

    const totalTheft = sumTotals['theft'].toFixed(1)

    const cts = getCitizenAmounts(year)
    const xYrs = (parseInt(maxYr) - parseInt(minYr)) + 1
    const perCit = theftAmountAbbr((totalTheft / cts['citizens']).toFixed(1))
    const manyYearsPerCit = theftAmountAbbr((totalTh / cts['citizens']).toFixed(1))

    pdfData.theft = theftAmountAbbr(get(sumTotals, `${path === nation ? 'overall' : 'voted'}_year_thefts.${year}`, 0))
    pdfData.citizen = cts.citizens
    pdfData.perCitTheft = perCit
    pdfData.manyYearsTheft = theftAmountAbbr(totalTh)
    pdfData.manyYearsPerCit = manyYearsPerCit
    pdfData.xYrs = xYrs
    pdfData.minYear = minYr
    pdfData.maxYear = maxYr

    let theftValueChartData = 'Year theft DeterminedBy Theft\n'
    yearTh.forEach((theft) => {
        theftValueChartData += `${theft['Year']} ${theft['theft']} ${theft['Determined By'].replace(/\s/g, '')} ${theft['Theft'].replace(/\s/g, '')}\n`
    })

    pdfData.theftValueChartData = theftValueChartData

    const sourcesOfTheft = prepareSourcesOfTheft(path, sumTotals, totalTheft, path, nation, subPaths, subPathTotals, availablePdfsPaths)

    pdfData.sourcesOfTheft = sourcesOfTheft

    pdfData.hideBlocks = hideBlocks

    return pdfData
}

const rowDisp = (prob, tots, indent, totalTheft, fullPath, nation, multi, availablePdfsPaths) => {
    const probPretty = startCase(prob)
    const legit = tots['legit'] ? 'legit' : ''
    let votepct = tots['votes'] > 0 ? tots['for'] / tots['votes'] : 0

    let voteyn = 'Theft'
    if (votepct < 0.5) {
        voteyn = "Not Theft"
        votepct = tots['votes'] > 0 ? tots['against'] / tots['votes'] : 0
    }

    const theft = tots['theft']
    const theftAbbr = theftAmountAbbr(theft)
    const theftpct = totalTheft > 0 ? (tots['theft'] / totalTheft * 100).toFixed() : 0

    const notes = 'need_votes' in tots && tots['need_votes'] > 0 ? 'Needs ' + tots['need_votes'] + ' more votes for High Confidence' : theft ? '\\$' + theftAbbr : ''

    const pathMatch = fullPath.match(/^\/?([^*]+)/)
    if (pathMatch) {
        fullPath = pathMatch[1]
    }
    const filePath = (multi ? 'multiIssueReport/' : 'ztReport/') + (prob !== nation ? nation + '/' : '') + fullPath

    return `\\textbf{${'\\quad '.repeat(indent)}${probPretty}} &
    \\cellcolor{${voteyn === 'Theft' ? 'tableTheftBg' : 'tableNoTheftBg'}} \\color{white} \\centering \\textbf{${voteyn}  ${voteyn === 'Theft' ? (votepct * 100).toFixed(2) + '\\%' : ''}} &
    ${availablePdfsPaths.includes(filePath) ? `\\hyperlink{${filePath}}{View Report}` : 'View Report'} &
    ${notes} \\\\ \n`
}

const walkSubPath = (prefix, paths, indent, subPathTotals, sumTotals, nation, availablePdfsPaths) => {
    let disp = ''
    if (!paths) return disp

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf', 'metadata'].includes(p)) return
        const pp = prefix + p
        disp += rowDisp(p, subPathTotals[pp], indent, sumTotals['theft'], pp, nation, !get(paths, `${p}.leaf`), availablePdfsPaths)
        disp += walkSubPath(prefix + p + '/', paths[p], indent + 1, subPathTotals, sumTotals, nation, availablePdfsPaths)
    })

    return disp
}

const prepareSourcesOfTheft = (path, sumTotals, totalTheft, fullPath, nation, subPaths, subPathTotals, availablePdfsPaths) => {
    // insert the area total as the first line
    disp = rowDisp(path, sumTotals, 0, totalTheft, fullPath, nation, true, availablePdfsPaths)

    // now walk all the sub-paths from this path
    const firstPath = path == nation ? '' : path + '/'
    disp += walkSubPath(firstPath, subPaths, 1, subPathTotals, sumTotals, nation, availablePdfsPaths)

    return disp
}

const rowDispNoVote = (prob, indent, nation, multi, fullPath, availablePdfsPaths) => {
    const probPretty = startCase(prob)
    const pathMatch = fullPath.match(/^\/?([^*]+)/)
    if (pathMatch) {
        fullPath = pathMatch[1]
    }
    const filePath = (multi ? 'multiIssueReport/' : 'ztReport/') + (prob !== nation ? nation + '/' : '') + fullPath

    return `\\textbf{${'\\quad '.repeat(indent)}${probPretty}} &
     &
    ${availablePdfsPaths.includes(filePath) ? `\\hyperlink{${filePath}}{View Report}` : 'View Report'} &
     \\\\ \n`
}

const walkSubPathNoVote = (prefix, paths, indent, nation, availablePdfsPaths) => {
    let disp = ''
    if (!paths) return disp

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf', 'metadata'].includes(p)) return
        const pp = prefix + p
        disp += rowDispNoVote(p, indent, nation, !get(paths, `${p}.leaf`), pp, availablePdfsPaths)
        disp += walkSubPathNoVote(pp ? pp + '/' : '', paths[p], indent + 1, nation, availablePdfsPaths)
    })

    return disp
}

const prepareSourcesOfTheftNoVote = (fullPath, nation, subPaths, availablePdfsPaths) => {
    // insert the area total as the first line
    disp = rowDispNoVote(fullPath, 0, nation, true, fullPath, availablePdfsPaths)

    // now walk all the sub-paths from this path
    const firstPath = fullPath == nation ? '' : fullPath + '/'
    disp += walkSubPathNoVote(firstPath, subPaths, 1, nation, availablePdfsPaths)

    return disp
}

const generatePDFMultiReport = async (noteBookName, fileName, availablePdfsPaths) => {
    const pdfData = generateMultiReportData(fileName, availablePdfsPaths)
    return await generateLatexMultiPDF(pdfData, fileName)
}

const mergePdfLatex = async (fileName, texsSequence) => {
    return new Promise((resolve, reject) => {
        let mergedTex = ''
        texsSequence.forEach((texFile) => {
            if (!fs.existsSync(texFile)) return
            let texContent = fs.readFileSync(texFile, 'utf8')
            const texBody = texContent.match(/% headsectionstart[\s\S]+% headsectionend([\s\S]+)\\end{document}/)[1]

            mergedTex += `\\newpage
            ` + texBody
        })

        let mergedTemplate = fs.readFileSync(`${templates}/mixedReport.tex`, 'utf8')
        mergedTemplate = mergedTemplate.replace(/--mixedContent--/g, mergedTex)

        const reportPrepd = `${multiIssueReportPath}/${fileName}.tex`
        const mergedLatexPDF = `${multiIssueReportPath}/${fileName}.pdf`
        fs.writeFileSync(reportPrepd, mergedTemplate, function (err) {
            if (err) {
                console.error('generateLatexPDF::', err)
                reject({ message: err })
            }
            console.log('full report Prepared');
        });

        const input = fs.createReadStream(reportPrepd)
        const output = fs.createWriteStream(mergedLatexPDF)
        const pdf = latex(input, { args: ['-shell-escape'] })
        pdf.pipe(output)
        pdf.on('error', err => {
            console.error('generateLatexPDF::', err)
            reject({ message: err })
            fs.unlinkSync(mergedLatexPDF)
            fs.unlinkSync(reportPrepd)
        })
        pdf.on('finish', () => {
            console.log('PDF generated!')
            resolve()
        })
    })
}

const mergePdfForNation = async (folder, pdfFileName, allPdfs) => {
    createLog(MAIN_PATH, `Merging PDF for the nation ${folder}/${pdfFileName}`)
    return new Promise((resolve, reject) => {
        exec(`java -jar ${APP_PATH}/pdftk/build/jar/pdftk.jar ${allPdfs} cat output ${folder}/${pdfFileName}.pdf && rm -rf ${getReportPath()}reports/temp_multiIssueReport`, (error, stdout, stderr) => {
            resolve()
        })
    })
}

const deleteJsonFile = async (fileName) => {
    createLog(MAIN_PATH, `Deleting json file from inpus json with filename:: ${fileName}`)
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${getReportPath()}input_jsons/${fileName}.json`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

module.exports = {
    generatePDFReport,
    generateNoVotePDFReport,
    generateNoVoteMultiPDFReport,
    generatePDFMultiReport,
    mergePdfLatex,
    mergePdfForNation,
    deleteJsonFile,
}