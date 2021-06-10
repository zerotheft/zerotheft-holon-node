const { exec } = require('child_process')
const { get, startCase } = require("lodash")
const latex = require('node-latex')
const yaml = require('js-yaml')
const yamlConverter = require('json2yaml')

const fs = require('fs')
const homedir = require('os').homedir()
const templates = `${homedir}/.zerotheft/Zerotheft-Holon/holon-api/app/services/calcEngineServices/templates`
const { getReportPath } = require('../../../config');
const { JUPYTER_PATH, WKPDFTOHTML_PATH, APP_PATH } = require('zerotheft-node-utils/config')
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

const generateReport = async (noteBookName, fileName, year, isPdf = 'false') => {
    createLog(MAIN_PATH, `Generating Report for the year ${year} with filename: ${fileName}`)
    return new Promise((resolve, reject) => {
        let newNoteBook = isPdf === 'false' ? noteBookName : `temp_${noteBookName}`
        // console.log(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${noteBookName}'`)
        exec(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}, "isPdf": "${isPdf}"}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${newNoteBook}'`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

const generateReportData = async (fileName, year) => {
    const { yearData: summaryTotals, actualPath: path, leafPath, holon, allPaths } = loadSingleIssue(fileName)

    let pdfData = {}
    pdfData.pdfLink = `/issueReports/${fileName}.pdf`
    pdfData.year = year
    pdfData.country = 'USA'
    pdfData.holonUrl = holon
    pdfData.pageID = path

    const pdfReportPath = `${holon}/issueReports/${fileName}.pdf`
    const props = getPathYearProposals(summaryTotals, path, year)
    const votes = getPathYearVotes(props)
    const vt = getPathVoteTotals(summaryTotals[year], path)
    if (vt['missing']) throw new Error(`generateReportData: Proposals not available for path: ${path} and year ${year}`);

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

    const { yesNo, yesNoLabels } = yesNoVoteTotalsSummary(voteTotals)
    const { thefts: propThefts, votes: propVotes } = proposalVoteTotalsSummaryMulti(voteTotals, false)

    const yearTh = getPastYearsTheftForMulti(summaryTotals, path)

    let minYr = null
    let maxYr = null
    let totalTh = 0
    for (i = 0; i < yearTh.length; i++) {
        const yr = yearTh[i]
        minYr = minYr === null || yr['Year'] < minYr ? yr['Year'] : minYr
        maxYr = maxYr === null || yr['Year'] > maxYr ? yr['Year'] : maxYr
        totalTh += yr['theft']
    }

    const leadingTheft = get(pathSummary, 'leading_theft', '$0')
    const cts = getCitizenAmounts(year)
    const perCitTheft = theftAmountAbbr((realTheftAmount(leadingTheft) / cts['citizens']).toFixed(2))
    const xYrs = (parseInt(maxYr) - parseInt(minYr)) + 1

    const manyYearsPerCit = theftAmountAbbr(totalTh / cts['citizens'])

    pdfData.theft = leadingTheft
    pdfData.citizen = cts.citizens
    pdfData.perCitTheft = perCitTheft

    pdfData.manyYearsTheft = theftAmountAbbr(totalTh)
    pdfData.manyYearsPerCit = manyYearsPerCit
    pdfData.xYrs = xYrs
    pdfData.minYear = minYr
    pdfData.maxYear = maxYr

    let yearThTmp = yearTh
    yearThTmp[0]['Year'] = 2001
    // yearThTmp[2]['Determined By'] = 'incomplete voting'
    // yearThTmp[5]['Determined By'] = 'estimation'
    // yearThTmp[8]['Determined By'] = 'incomplete voting'
    // yearThTmp[6]['Determined By'] = 'estimation'
    let theftValueChartData = 'Year theft DeterminedBy Theft\n'
    yearThTmp.forEach((theft) => {
        theftValueChartData += `${theft['Year']} ${theft['theft']} ${theft['Determined By'].replace(/\s/g, '')} ${theft['Theft'].replace(/\s/g, '')}\n`
    })

    pdfData.theftValueChartData = theftValueChartData

    let yesNoPieData = []
    yesNoLabels.forEach((label, index) => {
        yesNoPieData.push(`${yesNo[index]}/${label}`)
    });

    // console.log('yesnosfasfasdf', yesNo, yesNoLabels)

    // pdfData.yesNoPieData = '300/No,968/Yes'
    pdfData.yesNoPieData = yesNoPieData.join(',')

    const { bellCurveThefts, bellCurveVotes } = prepareBellCurveData(propThefts, propVotes)

    let votesForTheftAmountData = 'Theft Votes\n';
    bellCurveThefts.forEach((theft, index) => {
        votesForTheftAmountData += `${theft} ${bellCurveVotes[index]}\n`
    })
    pdfData.votesForTheftAmountData = votesForTheftAmountData

    const leadingProp = get(pathSummary, 'leading_proposal')
    const proposalID = get(leadingProp, 'id')
    const yamlJSON = await getProposalYaml(proposalID, path, year)
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

        const reportPrepd = `${getReportPath()}reports/ztReport/${fileName}.tex`
        const reportPDF = `${getReportPath()}reports/ztReport/${fileName}.pdf`

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
        Object.keys(pdfData).forEach((key) => {
            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const reportPrepd = `${getReportPath()}reports/multiIssueReport/${fileName}.tex`
        const reportPDF = `${getReportPath()}reports/multiIssueReport/${fileName}.pdf`

        fs.writeFileSync(reportPrepd, template, function (err) {
            if (err) {
                console.error('generateLatexPDF::', err)
                reject({ message: err })
            }
            console.log('multi report Prepared');
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
            console.log('PDF generated!')
            resolve()
        })
    })
}

const generatePDFReport = async (noteBookName, fileName, year, isPdf = 'false') => {
    createLog(MAIN_PATH, `Generating Report for the year ${year} with filename: ${fileName}`)
    const pdfData = await generateReportData(fileName, year)
    return await generateLatexPDF(pdfData, fileName)

    // return new Promise((resolve, reject) => {
    //     let newNoteBook = isPdf === 'false' ? noteBookName : `temp_${noteBookName}`

    // fs.copyFile(`${getReportPath()}input_jsons/corp_tax_evasion.html`, `${getReportPath()}reports/ztReport/${fileName}.html`, (err) => {
    //     if (err) {
    //         reject({ message: `exec error: ${err}` })
    //     }
    //     resolve()
    // });

    // console.log(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${noteBookName}'`)
    // TODO: removing jupyter lab integration
    // exec(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}, "isPdf": "${isPdf}"}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${newNoteBook}'`, (error, stdout, stderr) => {
    //     if (error) {
    //         reject({ message: `exec error: ${error}` })
    //     }
    //     resolve()
    // })
    // })
}

const generateMultiReportData = (fileName, year, availablePdfsPaths) => {
    const { summaryTotals, singleYearData, actualPath, holon, allPaths, subPaths, pdflinks, umbrellaPaths } = loadAllIssues(fileName)

    const pathData = actualPath.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    let pdfData = {}
    pdfData.pdfLink = `/pathReports/${fileName}.pdf`
    pdfData.year = year
    pdfData.country = nation
    pdfData.holonUrl = holon
    pdfData.pageID = noNationPath

    const { pathTitle, pathPrefix } = splitPath(actualPath)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix

    const population = usaPopulation(year)
    const pdfReportPath = `${holon}/pathReports/${fileName}.pdf`

    const paths = allPaths[nation]

    const path = actualPath == nation ? nation : noNationPath
    const leafPaths = getLeafPaths(paths)
    let sumTotals = {}

    const yearPaths = singleYearData['paths']

    if (path in yearPaths) sumTotals = yearPaths[path]['_totals']
    else if (path === nation) sumTotals = singleYearData['_totals']

    let subPathsFlat = []
    const flatPaths = getFlatPaths(paths)
    let pageNo = 7
    if (path === nation) {
        subPathsFlat = flatPaths
        pageNo = 7
        sumTotals['pageno'] = 1
    } else {
        flatPaths.forEach((p) => {
            if (p.indexOf(path + '/') === 0) subPathsFlat.push(p)
        })
    }

    const { pageNo: resultPageNo, summaryTotalsPaths } = assignPageNumbers(singleYearData['paths'], paths, '', pageNo)
    singleYearData['paths'] = summaryTotalsPaths

    const subPathTotals = {}
    subPathsFlat.forEach((p) => {
        if (p in singleYearData['paths']) subPathTotals[p] = singleYearData['paths'][p]['_totals']
    })

    const pathSummary = analyticsPathSummary(sumTotals, true)

    const yearTh = getPastYearsTheftForMulti(summaryTotals, path, nation)

    let minYr = null
    let maxYr = null
    let totalTh = 0
    for (i = 0; i < yearTh.length; i++) {
        const yr = yearTh[i]
        minYr = minYr === null || yr['Year'] < minYr ? yr['Year'] : minYr
        maxYr = maxYr === null || yr['Year'] > maxYr ? yr['Year'] : maxYr
        totalTh += yr['theft']
    }

    const totalTheft = sumTotals['theft'].toFixed(1)

    const cts = getCitizenAmounts(year)
    const xYrs = (parseInt(maxYr) - parseInt(minYr)) + 1
    const perCit = theftAmountAbbr((totalTheft / cts['citizens']).toFixed(1))
    const manyYearsPerCit = theftAmountAbbr((totalTh / cts['citizens']).toFixed(1))

    pdfData.theft = theftAmountAbbr(totalTheft)
    pdfData.citizen = cts.citizens
    pdfData.perCitTheft = perCit
    pdfData.manyYearsTheft = theftAmountAbbr(totalTh)
    pdfData.manyYearsPerCit = manyYearsPerCit
    pdfData.xYrs = xYrs
    pdfData.minYear = minYr
    pdfData.maxYear = maxYr

    let yearThTmp = yearTh
    // yearThTmp[0]['Year'] = 2001
    // yearThTmp[2]['Determined By'] = 'incomplete voting'
    // yearThTmp[5]['Determined By'] = 'estimation'
    // yearThTmp[8]['Determined By'] = 'incomplete voting'
    // yearThTmp[6]['Determined By'] = 'estimation'
    let theftValueChartData = 'Year theft DeterminedBy Theft\n'
    yearThTmp.forEach((theft) => {
        theftValueChartData += `${theft['Year']} ${theft['theft']} ${theft['Determined By'].replace(/\s/g, '')} ${theft['Theft'].replace(/\s/g, '')}\n`
    })

    pdfData.theftValueChartData = theftValueChartData

    const sourcesOfTheft = prepareSourcesOfTheft(path, sumTotals, totalTheft, path, pdflinks, holon, nation, subPaths, subPathTotals, availablePdfsPaths)

    pdfData.sourcesOfTheft = sourcesOfTheft

    return pdfData
}

const rowDisp = (prob, tots, indent, totalTheft, fullPath, pdflinks, holon, availablePdfsPaths) => {
    const probPretty = startCase(prob)
    const legit = tots['legit'] ? 'legit' : ''
    let votepct = tots['votes'] > 0 ? tots['for'] / tots['votes'] : 0

    let voteyn = 'Theft'
    if (votepct < 0.5) {
        voteyn = "Not Theft"
        votepct = tots['votes'] > 0 ? tots['against'] / tots['votes'] : 0
    }

    const page = tots['pageno'] < 0 ? 'n/a' : tots['pageno']
    const theft = tots['theft']
    const theftAbbr = theftAmountAbbr(theft)
    const theftpct = totalTheft > 0 ? (tots['theft'] / totalTheft * 100).toFixed() : 0

    const notes = 'need_votes' in tots && tots['need_votes'] > 0 ? 'Needs ' + tots['need_votes'] + ' more votes for High Confidence' : theft ? '\\$' + theftAbbr : ''

    const filename = pdflinks //if path == nation else json_file

    return `\\textbf{${'\\quad '.repeat(indent)}${probPretty}} &
    \\cellcolor{${voteyn === 'Theft' ? 'tableTheftBg' : 'tableNoTheftBg'}} \\color{white} \\centering \\textbf{${voteyn} ${(votepct * 100).toFixed(2)}\\%} &
    ${availablePdfsPaths.includes(fullPath) ? `\\hyperlink{${fullPath}}{View Report}` : 'View Report'} &
    ${notes} \\\\ \n`
}

const walkSubPath = (prefix, paths, indent, subPathTotals, sumTotals, pdflinks, holon, availablePdfsPaths) => {
    let disp = ''
    if (!paths) return disp

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf'].includes(p)) return
        const pp = prefix + p
        disp += rowDisp(p, subPathTotals[pp], indent, sumTotals['theft'], pp, pdflinks, holon, availablePdfsPaths)
        disp += walkSubPath(prefix + p + '/', paths[p], indent + 1, subPathTotals, sumTotals, pdflinks, holon, availablePdfsPaths)
    })

    return disp
}

const prepareSourcesOfTheft = (path, sumTotals, totalTheft, fullPath, pdflinks, holon, nation, subPaths, subPathTotals, availablePdfsPaths) => {
    // insert the area total as the first line
    disp = rowDisp(path, sumTotals, 0, totalTheft, fullPath, pdflinks, holon, availablePdfsPaths)

    // now walk all the sub-paths from this path
    const firstPath = path == nation ? '' : path + '/'
    disp += walkSubPath(firstPath, subPaths, 1, subPathTotals, sumTotals, pdflinks, holon, availablePdfsPaths)

    return disp
}

const generatePDFMultiReport = async (noteBookName, fileName, year, availablePdfsPaths) => {
    const pdfData = generateMultiReportData(fileName, year, availablePdfsPaths)
    return await generateLatexMultiPDF(pdfData, fileName)
    // return new Promise((resolve, reject) => {
    //     let newNoteBook = isPdf === 'false' ? noteBookName : `temp_${noteBookName}`

    //     console.log('generatePDFMultiReport===========')
    //     generateMultiReportData(fileName, year)
    //     resolve()

    // fs.copyFile(`${getReportPath()}input_jsons/corp_tax_evasion.html`, `${getReportPath()}reports/ztReport/${fileName}.html`, (err) => {
    //     if (err) {
    //         reject({ message: `exec error: ${err}` })
    //     }
    //     resolve()
    // });

    // console.log(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${noteBookName}'`)
    // TODO: removing jupyter lab integration
    // exec(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}, "isPdf": "${isPdf}"}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${newNoteBook}'`, (error, stdout, stderr) => {
    //     if (error) {
    //         reject({ message: `exec error: ${error}` })
    //     }
    //     resolve()
    // })
    // })
}

const generatePDF = async (folder, pdfReportName) => {
    createLog(MAIN_PATH, `Generating PDF for ${folder}/${pdfReportName}`)
    return new Promise((resolve, reject) => {
        // console.log(`${WKPDFTOHTML_PATH} --header-left "Report" --footer-right [page]/[topage] --margin-top 2cm --margin-bottom 2cm --lowquality ${folder}/${pdfReportName}.html ${folder}/${pdfReportName}.pdf`)
        exec(`${WKPDFTOHTML_PATH} --header-left "Report" --footer-right [page]/[topage] --margin-top 2cm --margin-bottom 2cm --lowquality ${folder}/${pdfReportName}.html ${folder}/${pdfReportName}.pdf`, (error, stdout, stderr) => {
            resolve()
        })
    })
}

const mergePdfLatex = async (fileName, texsSequence) => {
    return new Promise((resolve, reject) => {
        let mergedTex = ''
        texsSequence.forEach((texFile) => {
            let texContent = fs.readFileSync(texFile, 'utf8')
            const texBody = texContent.match(/% headsectionstart[\s\S]+% headsectionend([\s\S]+)\\end{document}/)[1]

            mergedTex += `\\newpage
            ` + texBody
        })

        let mergedTemplate = fs.readFileSync(`${templates}/mixedReport.tex`, 'utf8')
        mergedTemplate = mergedTemplate.replace(/--mixedContent--/g, mergedTex)

        const reportPrepd = `${getReportPath()}reports/multiIssueReport/${fileName}.tex`
        const mergedLatexPDF = `${getReportPath()}reports/multiIssueReport/${fileName}.pdf`
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

const generatePageNumberFooter = async (folder, noFooterFileName, fileName, footer = 'ZeroTheft Total Theft Report') => {
    createLog(MAIN_PATH, `Generating Page number footer ${folder}/${fileName}`)
    return new Promise((resolve, reject) => {
        exec(`enscript --fancy-header=footer -L1 -b'||' --footer '|| ${footer} - Page $%' -o- < \
        <(for i in $(seq 1 200); do echo; done) | \
        ps2pdf - | \
        java -jar ${APP_PATH}/pdftk/build/jar/pdftk.jar '${folder}/${noFooterFileName}.pdf' multistamp - output '${folder}/${fileName}.pdf'`, { shell: '/bin/bash' }, (error, stdout, stderr) => {
            resolve()
        })
    })
}

const renameHTMLFile = async (oldFileName, newFileName, filePath = `${getReportPath()}reports/${oldFileName}/`) => {
    createLog(MAIN_PATH, `Renaming html file from ${filePath}${oldFileName} to ${filePath}${newFileName}`)
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${filePath}${newFileName}.html && mv ${filePath}${oldFileName}.html ${filePath}${newFileName}.html`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

const renamePDFFile = async (oldFileName, newFileName, filePath = `${getReportPath()}reports/${oldFileName}/`) => {
    createLog(MAIN_PATH, `Renaming pdf file from ${filePath}${oldFileName} to ${filePath}${newFileName}`)
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${filePath}${newFileName}.pdf ${filePath}${oldFileName}.html && mv ${filePath}${oldFileName}.pdf ${filePath}${newFileName}.pdf`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
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
    generateReport,
    generatePDFReport,
    generatePDFMultiReport,
    generatePDF,
    mergePdfLatex,
    mergePdfForNation,
    generatePageNumberFooter,
    renameHTMLFile,
    renamePDFFile,
    deleteJsonFile,
}