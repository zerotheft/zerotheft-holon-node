const { exec } = require('child_process')
const { get, min, max, startCase } = require("lodash")
const latex = require('node-latex')
const yaml = require('js-yaml')
const fs = require('fs')
const homedir = require('os').homedir()
const { getReportPath } = require('../../../config');
const { JUPYTER_PATH, WKPDFTOHTML_PATH, APP_PATH } = require('zerotheft-node-utils/config')
const { createLog, MAIN_PATH } = require('../LogInfoServices')
const { loadSingleIssue, getPathYearProposals, getPathYearVotes, getPathVoteTotals, loadAllIssues, getLeafPaths, getFlatPaths } = require('./inputReader')
const { getCitizenAmounts, realTheftAmount, theftAmountAbbr, usaPopulation } = require('./helper')
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

const generateReportData = (fileName, year) => {
    const [summaryTotals, path, holon, allPaths] = loadSingleIssue(fileName)

    let pdfData = {}
    pdfData.pdfLink = `/issueReports/${fileName}.pdf`
    pdfData.year = year
    pdfData.country = 'USA'
    pdfData.holonUrl = holon

    const pdfReportPath = `${holon}/issueReports/${fileName}.pdf`
    const props = getPathYearProposals(summaryTotals, path, year)
    const votes = getPathYearVotes(props)
    const vt = getPathVoteTotals(summaryTotals[year], path)
    const voteTotals = {
        'for': vt['_totals']['for'],
        'against': vt['_totals']['against'],
        'props': vt['props']
    }

    const pathSummary = analyticsPathSummary(voteTotals)

    const { pathTitle, pathPrefix } = splitPath(path)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix

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

    pdfData.yesNoPieData = '300/No,968/Yes'
    // pdfData.yesNoPieData = yesNoPieData.join(',')

    const { bellCurveThefts, bellCurveVotes } = prepareBellCurveData(propThefts, propVotes)

    let votesForTheftAmountData = 'Theft Votes\n';
    bellCurveThefts.forEach((theft, index) => {
        votesForTheftAmountData += `${theft} ${bellCurveVotes[index]}\n`
    })
    pdfData.votesForTheftAmountData = votesForTheftAmountData


    const leadingProp = get(pathSummary, 'leading_proposal')


    pdfData.leadingProposalID = leadingProp['proposalid']
    pdfData.leadingProposalAuthor = get(leadingProp, 'detail.author.name')
    pdfData.leadingProposalDate = leadingProp['date']
    pdfData.leadingProposalDetail = latexSpecialChars(yaml.safeDump(leadingProp['detail'], { skipInvalid: true }).replace(/: ?>/g, ': |'))

    return pdfData
}

function latexSpecialChars(detail) {
    const characterToSkip = {
        "#": "\\#",
        "\\$": "\\$",
        "%": "\\%",
        "&": "\\&",
        "~": "\\~{}",
        "_": "\\_",
        "^": "\\^{}",
        "{": "\\{",
        "}": "\\}",
        "\n": "\n\\break{}",
    };

    Object.keys(characterToSkip).forEach((key) => {
        const regex = new RegExp(key, 'g')
        console.log('=========', regex)
        detail = detail.replace(regex, characterToSkip[key])
    })

    return detail
}

const prepareBellCurveData = (propThefts, propVotes) => {
    let axTh = []
    let axVt = []

    // now "linearize" the prop_thefts data
    if (propThefts.length > 0) {
        propThefts = propThefts.map((theft) => parseInt(theft))
        let minTh = min(propThefts)
        let maxTh = max(propThefts)
        let minIncr = null

        // find the minimum increment between thefts
        propThefts.forEach((t, i) => {
            if (i == 0) return
            const incr = t - propThefts[i - 1]
            if (minIncr === null || incr < minIncr) minIncr = incr
        })

        if (minIncr === null) {
            minIncr = propThefts[0] * 0.1
        } else if (minTh > 0) {
            minIncr = min([minTh, minIncr])
        }

        // special cases
        // - single theft, three "columns"
        // - two thefts , five "columns"
        if (propThefts.length == 1) {
            minIncr = propThefts[0] * 0.2
        } else if (propThefts.length == 2) {
            minIncr = minIncr / 3
        }

        // push one increment out in either direction
        minTh = minTh - minIncr
        maxTh = maxTh + minIncr
        const rng = maxTh - minTh

        let cells
        if (minIncr == 0)
            cells = 0
        else
            cells = parseInt(rng / minIncr)

        if (cells > 100) {
            cells = 100
            minIncr = rng / 100
        }

        minIncr = parseInt(minIncr.toFixed())
        minTh = parseInt(minTh)
        maxTh = parseInt(maxTh)

        // now we create a new dataset that is distributed across the axis
        thIdx = 0
        nextTh = propThefts[0]

        for (th = minTh; th < maxTh; th += minIncr) {
            axTh.push(th)
            // we have to allow for some slop, so the "next_th" and "max_th" checks need to be reduced by 
            // about 1% of the increment to allow for rounding errors
            const nextThThreshold = nextTh - (minIncr * 0.01)
            const maxThThreshold = maxTh - (minIncr * 0.01)
            if (th > maxThThreshold || th < nextThThreshold) {
                axVt.push(0)
            } else {
                axVt.push(propVotes[thIdx])
                thIdx += 1
                nextTh = thIdx < propThefts.length ? propThefts[thIdx] : 0
            }

        }

        // append for the last step
        axTh.push(maxTh)
        axVt.push(0)
    }

    return { bellCurveThefts: axTh, bellCurveVotes: axVt }
}

const generateLatexPDF = async (pdfData, fileName) => {
    let template = fs.readFileSync(`${homedir}/zerotheft-holon-node/app/services/calcEngineServices/templates/report.tex`, 'utf8')
    Object.keys(pdfData).forEach((key) => {
        const regex = new RegExp(`--${key}--`, 'g')
        template = template.replace(regex, pdfData[key])
    })

    const reportPrepd = `${getReportPath()}reports/ztReport/${fileName}.tex`
    const reportPDF = `${getReportPath()}reports/ztReport/${fileName}.pdf`

    fs.writeFileSync(reportPrepd, template, function (err) {
        if (err) throw err;
        console.log('report Prepared');
    });

    const input = fs.createReadStream(reportPrepd)
    const output = fs.createWriteStream(reportPDF)
    const pdf = latex(input)
    return { pdf, output, reportPrepd }
    // pdf.pipe(output)
    // pdf.on('error', err => {
    //     console.error('generateLatexPDF::', err)
    //     // return { message: err, success: false }
    // })
    // pdf.on('finish', () => {
    //     console.log('PDF generated!')
    //     fs.unlinkSync(reportPrepd)
    //     // return { message: 'pdf generated sucessfully', success: true }
    // })
}


const generateLatexMultiPDF = (pdfData, fileName) => {
    let template = fs.readFileSync(`${homedir}/zerotheft-holon-node/app/services/calcEngineServices/templates/multiReport.tex`, 'utf8')
    Object.keys(pdfData).forEach((key) => {
        const regex = new RegExp(`--${key}--`, 'g')
        template = template.replace(regex, pdfData[key])
    })

    const reportPrepd = `${getReportPath()}reports/multiIssueReport/${fileName}.tex`
    const reportPDF = `${getReportPath()}reports/multiIssueReport/${fileName}.pdf`

    fs.writeFileSync(reportPrepd, template, function (err) {
        if (err) throw err;
        console.log('multi report Prepared');
    });

    const input = fs.createReadStream(reportPrepd)
    const output = fs.createWriteStream(reportPDF)
    const pdf = latex(input)

    pdf.pipe(output)
    pdf.on('error', err => console.error(err))
    pdf.on('finish', () => {
        console.log('PDF generated!')
        fs.unlinkSync(reportPrepd)
    })
}

const generatePDFReport = async (noteBookName, fileName, year, isPdf = 'false') => {
    createLog(MAIN_PATH, `Generating Report for the year ${year} with filename: ${fileName}`)
    const pdfData = generateReportData(fileName, year)
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

const generateMultiReportData = (fileName, year) => {
    const { summaryTotals, actualPath, holon, allPaths, subPaths, pdflinks, umbrellaPaths } = loadAllIssues()

    let pdfData = {}
    pdfData.pdfLink = `/pathReports/${fileName}.pdf`
    pdfData.year = year
    pdfData.country = 'USA'
    pdfData.holonUrl = holon
    const { pathTitle, pathPrefix } = splitPath(actualPath)
    pdfData.title = pathTitle
    pdfData.subtitle = pathPrefix

    const population = usaPopulation(year)
    const pdfReportPath = `${holon}/pathReports/${fileName}.pdf`

    const nation = actualPath.split('/')[0]
    const paths = allPaths[nation]

    const path = actualPath == nation ? 'USA' : actualPath.split('/').slice(1).join('/')
    const leafPaths = getLeafPaths(paths)
    let sumTotals = {}

    const yearPaths = summaryTotals[year]['paths']

    if (path in yearPaths) sumTotals = yearPaths[path]['_totals']
    else if (path === nation) sumTotals = summaryTotals[year]['_totals']

    const subPathsFlat = []
    const flatPaths = getFlatPaths(paths)
    const pageNo = 7
    if (path === nation) {
        subPathsFlat = flatPaths
        pageNo = 7
        sumTotals['pageno'] = 1
    } else {
        flatPaths.forEach((p) => {
            if (p.indexOf(path + '/') === 0) subPathsFlat.push(p)
        })
    }

    const { pageNo: resultPageNo, summaryTotalsPaths } = assignPageNumbers(summaryTotals[year]['paths'], paths, '', pageNo)
    summaryTotals[year]['paths'] = summaryTotalsPaths

    const subPathTotals = {}
    subPathsFlat.forEach((p) => {
        if (p in summaryTotals[year]['paths']) subPathTotals[p] = summaryTotals[year]['paths'][p]['_totals']
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

    const sourcesOfTheft = prepareSourcesOfTheft(path, sumTotals, totalTheft, path, pdflinks, holon, nation, subPaths, subPathTotals)

    pdfData.sourcesOfTheft = sourcesOfTheft

    return pdfData
}

const rowDisp = (prob, tots, indent, totalTheft, fullPath, pdflinks, holon) => {
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

    const notes = 'need_votes' in tots && tots['need_votes'] > 0 ? 'Needs ' + tots['need_votes'] + ' more votes for High Confidence' : theft ? theftAbbr : ''

    const filename = pdflinks //if path == nation else json_file

    return `\\textbf{${'\\quad '.repeat(indent)}${probPretty}} &
    \\cellcolor{${voteyn === 'Theft' ? 'tableTheftBg' : 'tableNoTheftBg'}} \\color{white} \\centering \\textbf{${voteyn} ${votepct * 100}\\%} &
    \\href{${holon}/pathReports/${filename}.pdf#page=${page}}{Page ${page}} &
    ${notes} \\\\ \n`
}

const walkSubPath = (prefix, paths, indent, subPathTotals, sumTotals, pdflinks, holon) => {
    let disp = ''
    if (!paths) return

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf'].includes(p)) return
        const pp = prefix + p
        disp += rowDisp(p, subPathTotals[pp], indent, sumTotals['theft'], pp, pdflinks, holon)
        disp += walkSubPath(prefix + p + '/', paths[p], indent + 1, subPathTotals, sumTotals, pdflinks, holon)
    })

    return disp
}

const prepareSourcesOfTheft = (path, sumTotals, totalTheft, fullPath, pdflinks, holon, nation, subPaths, subPathTotals) => {
    // insert the area total as the first line
    disp = rowDisp(path, sumTotals, 0, totalTheft, fullPath, pdflinks, holon)

    // now walk all the sub-paths from this path
    const firstPath = path == nation ? '' : path + '/'
    disp += walkSubPath(firstPath, subPaths, 1, subPathTotals, sumTotals, pdflinks, holon)

    return disp
}

const generatePDFMultiReport = (noteBookName, fileName, year, isPdf = 'false') => {
    const pdfData = generateMultiReportData(fileName, year)
    generateLatexMultiPDF(pdfData, fileName)
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

const mergePdfLatex = (fileName, pdfsSequence) => {
    let mergedLatex = `\\documentclass{article}
    \\usepackage{pdfpages}
    \\begin{document}
    `
    pdfsSequence.forEach((pdf) => {
        mergedLatex += `\\includepdf[pages=-]{${pdf}}
        `
    })
    mergedLatex += `\\end{document}`

    const mergedLatexTemplate = `${getReportPath()}reports/multiIssueReport/${fileName}.tex`
    const mergedLatexPDF = `${getReportPath()}reports/multiIssueReport/${fileName}.pdf`
    fs.writeFileSync(mergedLatexTemplate, mergedLatex, function (err) {
        if (err) throw err;
        console.log('full report Prepared');
    });

    const input = fs.createReadStream(mergedLatexTemplate)
    const output = fs.createWriteStream(mergedLatexPDF)
    const pdf = latex(input)

    pdf.pipe(output)
    pdf.on('error', err => console.error(err))
    pdf.on('finish', () => {
        console.log('PDF generated!')
        fs.unlinkSync(mergedLatexTemplate)
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