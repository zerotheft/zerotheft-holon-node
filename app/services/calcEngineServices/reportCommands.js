const { exec } = require('child_process')
const { get, startCase, isEmpty, min, max } = require("lodash")
const latex = require('node-latex')
const yaml = require('js-yaml')
const yamlConverter = require('json2yaml')

const fs = require('fs')
const os = require('os')
const homedir = os.homedir()
const platform = os.platform()
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

const timeZone = 'America/Los_Angeles'
const dateFormat = 'MMM DD, YYYY hh:mmA z'
const moment = require('moment-timezone')
const reportTime = moment.tz(moment.now(), timeZone).format(dateFormat)

var currentDate = new Date();
var inflationDate = currentDate.getFullYear();

const multiIssueReportPath = (fromWorker) => `${getReportPath()}reports${fromWorker ? '_in_progress' : ''}/multiIssueReport`
const singleIssueReportPath = (fromWorker) => `${getReportPath()}reports${fromWorker ? '_in_progress' : ''}/ztReport`
const apiPath = `${APP_PATH}/Zerotheft-Holon/holon-api`
const pleaseVoteImage = `${apiPath}/app/assets/please_vote.png`
const yesNoTemplate = `${apiPath}/app/assets/YesNo.svg`
const inflatedValuesPath = `${apiPath}/app/services/calcEngineServices/inflatedValues.json`
const chartistSvg = require('./svg-chartist');
const Chartist = require('chartist');
const sharp = require('sharp');

if (!fs.existsSync(inflatedValuesPath)) {
    const yearlyAverageUSInflationRate = require('./yearlyAverageUSInflationRate.json')
    const years = Object.keys(yearlyAverageUSInflationRate).sort().reverse()

    let inflatedValues = {}
    inflatedValues[inflationDate] = 1
    years.forEach((year, index) => {
        inflatedValues[year] = inflatedValues[parseInt(year) + 1] * (1 + (yearlyAverageUSInflationRate[year] / 100))
    })

    fs.writeFileSync(inflatedValuesPath, JSON.stringify(inflatedValues))
}
const inflatedValues = require(inflatedValuesPath)

const generateReportData = async (fileName, fromWorker) => {
    const { yearData: summaryTotals, actualPath: path, leafPath, holon, allPaths } = loadSingleIssue(fileName)

    let hideBlocks = []
    let pdfData = {}
    pdfData.pdfLink = `/issueReports/${fileName}.pdf`
    pdfData.country = 'USA'
    pdfData.generatedTime = reportTime
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
    pdfData.title = '/ ' + get(allPaths, `${leafPath.replace(/\//g, '.')}.display_name`, pathTitle)
    pdfData.subtitle = pathPrefix

    let pathData = leafPath.split('/')
    const leafSlug = pathData.pop()
    const pathSlug = pathData.join('%2F')
    pdfData.leafSlug = leafSlug
    pdfData.pathSlug = pathSlug

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

    const votedYearThefts = get(vt, `_totals.voted_year_thefts`, {})
    const leadingTheft = get(pathSummary, 'leading_theft', '$0')
    const cts = getCitizenAmounts(maxYr)
    const perCitTheft = theftAmountAbbr((realTheftAmount(leadingTheft) / cts['citizens']).toFixed(2))
    const xYrs = (parseInt(maxYr) - parseInt(minYr)) + 1

    const manyYearsPerCit = theftAmountAbbr(totalTh / cts['citizens'])

    pdfData.theft = theftAmountAbbr(get(votedYearThefts, maxYr, 0))
    pdfData.year = maxYr
    pdfData.citizen = cts.citizens
    pdfData.perCitTheft = perCitTheft

    pdfData.manyYearsTheft = theftAmountAbbr(totalTh)
    pdfData.manyYearsPerCit = manyYearsPerCit
    pdfData.xYrs = xYrs
    pdfData.minYear = minYr
    pdfData.maxYear = maxYr

    const filePath = `${singleIssueReportPath(fromWorker)}/${fileName}`
    await getTheftValueChart(yearTh, filePath)
    pdfData.theftValueChart = `${filePath}-theftValue.png`

    const { noVotes, yesVotes } = yesNoVoteTotalsSummary(voteTotals)
    await getYesNoChart(noVotes, yesVotes, filePath)
    pdfData.yesVotes = yesVotes
    pdfData.noVotes = noVotes
    pdfData.totalVotes = yesVotes + noVotes
    pdfData.yesNoChart = `${filePath}-yesNo.png`

    const { thefts: propThefts, votes: propVotes } = proposalVoteTotalsSummaryMulti(voteTotals, false)
    if (propThefts.length) {
        const bellCurveData = prepareBellCurveData(propThefts, propVotes)
        await getVotesForTheftAmountChart(bellCurveData, `${filePath}-votesForTheftAmount`, `${minYr} - ${maxYr}`)
        pdfData.votesForTheftAmountChart = `${filePath}-votesForTheftAmount.png`
    } else {
        hideBlocks.push('votesForTheftAllYearsBlock')
    }

    const lastYear = (new Date()).getFullYear() - 1
    const { thefts: propTheftslY, votes: propVotesLY } = proposalVoteTotalsSummaryMulti(voteTotals, false, lastYear)
    if (propTheftslY.length) {
        const bellCurveDataLY = prepareBellCurveData(propTheftslY, propVotesLY)
        await getVotesForTheftAmountChart(bellCurveDataLY, `${filePath}-votesForTheftAmountLastYear`, `in ${lastYear}`)
        pdfData.votesForTheftAmountLastYearChart = `${filePath}-votesForTheftAmountLastYear.png`
    } else {
        hideBlocks.push('votesForTheftLastYearBlock')
    }


    const fiveYearsAgo = lastYear - 5
    const { thefts: propTheftsFYA, votes: propVotesFYA } = proposalVoteTotalsSummaryMulti(voteTotals, false, fiveYearsAgo)
    if (propTheftsFYA.length) {
        const bellCurveDataFYA = prepareBellCurveData(propTheftsFYA, propVotesFYA)
        await getVotesForTheftAmountChart(bellCurveDataFYA, `${filePath}-votesForTheftAmountFiveYearsAgo`, `in ${fiveYearsAgo}`)
        pdfData.votesForTheftAmountFiveYearsAgoChart = `${filePath}-votesForTheftAmountFiveYearsAgo.png`
    } else {
        hideBlocks.push('votesForTheft5yearsBlock')
    }

    pdfData.stolenByYearTableData = prepareStolenByYear(votedYearThefts)
    pdfData.inflationYear = inflationDate

    const leadingProp = get(pathSummary, 'leading_proposal')
    const proposalID = get(leadingProp, 'id')
    let limitedLinesArray = []
    if (proposalID) {
        const yamlJSON = await getProposalYaml(proposalID, path)
        pdfData.leadingProposalID = proposalID
        pdfData.leadingProposalAuthor = get(yamlJSON, 'author.name')
        pdfData.leadingProposalDate = moment.tz(leadingProp['date'], timeZone).format(dateFormat)

        const leadingProposalDetail = yamlConverter.stringify(yamlJSON)
        limitedLinesArray = limitTextLines(leadingProposalDetail)

        pdfData.leadingProposalDetail = leadingProposalDetail.replace(/\\n/g, '\n')
        pdfData.leadingProposalDetailPart = limitedLinesArray.join('\n')
        // pdfData.leadingProposalDetail = yamlConverter.stringify(yamlJSON).replace(/: ?>/g, ': |')
    }
    if (isEmpty(limitedLinesArray)) hideBlocks.push('proposalYamlBlock')

    pdfData.hideBlocks = hideBlocks
    return pdfData
}

const getYesNoChart = async (noVotes, yesVotes, filePath) => {
    return new Promise((resolve, reject) => {
        const totalVotes = yesVotes + noVotes
        const yesVotePercent = ((yesVotes / totalVotes) * 100).toFixed()
        const noVotePercent = 100 - yesVotePercent
        const svgPath = `${filePath}-yesNo`

        let template = fs.readFileSync(yesNoTemplate, 'utf8')
        template = template.replace(/--yesValue--/g, yesVotePercent)
        template = template.replace(/--yesProgress--/g, yesVotePercent * 4)
        template = template.replace(/--noValue--/g, noVotePercent)
        template = template.replace(/--noProgress--/g, noVotePercent * 4)

        fs.writeFile(svgPath + '.svg', template, async (err) => {
            if (err) {
                console.error('Yes no svg:', err)
                reject({ message: `'Yes no svg: ${err}` })
            }
            console.log('Yes no svg prepared')
            await sharp(svgPath + '.svg').resize({ width: 400 }).png().toFile(svgPath + '.png')
            console.log('Yes no png created')
            resolve()
        });
    })
}

const getVotesForTheftAmountChart = async (bellCurveData, filePath, title) => {
    return new Promise((resolve, reject) => {
        const { bellCurveThefts, bellCurveVotes } = bellCurveData
        const xLow = min(bellCurveThefts)
        const xHigh = max(bellCurveThefts)
        const yLow = 0
        const yHigh = max(bellCurveVotes)
        let series = []
        const normalHighVote = yHigh
        let normalHighVoteTheft = 0
        let totalVotes = 0
        let totalVotedAmount = 0
        let validProposalsCount = 0
        bellCurveThefts.forEach((theft, index) => {
            const theftVotes = bellCurveVotes[index]
            series.push({ x: theft, y: theftVotes })
            totalVotes += theftVotes
            if (theftVotes) {
                validProposalsCount += 1
            }
            totalVotedAmount += theft * theftVotes
            if (bellCurveVotes[index] === normalHighVote) {
                normalHighVoteTheft = theft
            }
        })

        const averageYesVotedTheft = totalVotedAmount / totalVotes
        const averageYesVotes = totalVotes / validProposalsCount

        let data = {
            series: [series]
        };

        const options = {
            chartPadding: {
                right: 30,
                left: 30
            },
            width: 600,
            height: 280,
            axisX: {
                type: Chartist.AutoScaleAxis,
                scaleMinSpace: 50,
                onlyInteger: true,
                labelOffset: { y: 10 },
                offset: 0,
                high: xHigh,
                low: xLow,
                showGrid: false,
                labelInterpolationFnc: function (value) {
                    return theftAmountAbbr(value)
                }
            },
            axisY: {
                scaleMinSpace: 20,
                onlyInteger: true,
                labelOffset: { y: 6 },
                high: yHigh,
                low: yLow,
                showGrid: false,
                labelInterpolationFnc: function (value) {
                    return theftAmountAbbr(value)
                }
            }
        }

        let opts = {
            options: {
                ...options,
                axisY: { ...options.axisY, showGrid: true },
                showArea: true,
                showPoint: false,
            },
            onDraw: function (data) {
                let style = ''
                if (data.type === 'line') {
                    style += 'stroke: #521582;stroke-width: 1px;'
                }
                if (data.type === 'area') {
                    style += 'fill: #F3F2F2;fill-opacity: 1;'
                }

                data.element.attr({
                    style: style
                });
            }
        }

        const styles = `
        <style>
            text {
                font-family:sans-serif;
            }
            .ct-grids line {
                stroke-dasharray: none !important;
                stroke: rgba(0,0,0,0.1) !important;
            }
            .ct-label {
                font-size: 20px !important;
                fill: #000000 !important;
                color: #000000 !important;
            }
            .ct-label.ct-horizontal {
                text-anchor: middle !important;
            }
        </style>
        `

        const svgPath = `${filePath}`

        chartistSvg('line', data, opts).then((svg) => {
            svg = svg.replace(/(<svg[^>]+>)/, `$1${styles}`)
            data = {
                series: [
                    {
                        name: 'normal',
                        data: [
                            { x: normalHighVoteTheft, y: normalHighVote }
                        ]
                    },
                    {
                        name: 'inflated',
                        data: [
                            { x: averageYesVotedTheft, y: averageYesVotes }
                        ]
                    }
                ],
                title: title
            }

            opts = {
                options: options,
                title: { x: 0, y: 40, 'font-size': `50px`, 'font-family': 'sans-serif', 'font-weight': 'normal', fill: 'black', opacity: '0.6' },
                onDraw: function (data) {
                    if (data.type === 'bar') {
                        let style = 'stroke-width: 30px;'

                        if (data.series && data.series.name === 'inflated') {
                            style += 'stroke: #007813;'
                        } else {
                            style += 'stroke: #7F51C1;'
                        }

                        data.element.attr({
                            style: style
                        });
                    }
                }
            }


            const lineChart = svg.replace(/(<svg[^>]+>)([^*]+)(<\/svg>)/, '$2')

            chartistSvg('bar', data, opts).then((svg) => {
                svg = svg.replace(/(<svg[^>]+>)/, `$1${styles}<g class="showChartOnly">${lineChart}</g>`)
                fs.writeFile(svgPath + '.svg', svg, async (err) => {
                    if (err) {
                        console.error(`theft amount vote chart svg for ${filePath}:`, err)
                        reject({ message: `'theft amount vote chart svg for ${filePath}: ${err}` })
                    }
                    console.log(`theft amount vote chart svg prepared for ${filePath}`)
                    await sharp(svgPath + '.svg').resize({ width: 1000 }).png().toFile(svgPath + '.png')
                    console.log(`theft amount vote chart png created for ${filePath}`)
                    resolve()
                });
            })
        })
    })
}

const getTheftValueChart = async (yearTh, filePath) => {
    return new Promise((resolve, reject) => {
        let series = []
        yearTh.forEach((theft) => {
            series.push({ x: theft['Year'], y: theft['theft'] })
        })

        const data = {
            series: [series]
        };

        const options = {
            chartPadding: {
                right: 30,
                left: 30
            },
            width: 1000,
            height: 300,
            axisX: {
                type: Chartist.AutoScaleAxis,
                scaleMinSpace: 40,
                onlyInteger: true,
                labelOffset: { y: 10 },
                offset: 0,
                showGrid: false
            },
            axisY: {
                scaleMinSpace: 40,
                onlyInteger: true,
                labelOffset: { y: 6 },
                labelInterpolationFnc: function (value) {
                    return theftAmountAbbr(value)
                }
            }
        }

        const opts = {
            options: options,
            onDraw: function (data) {
                let style = ''
                if (data.type === 'point' || data.type === 'line') {
                    style += 'stroke: #7F51C1;'
                }
                if (data.type === 'point') {
                    style += 'stroke-width: 10px;'
                }
                if (data.type === 'line') {
                    style += 'stroke-width: 2px;'
                }

                data.element.attr({
                    style: style
                });
            }
        }

        const styles = `
        <style>
            text {
                font-family:sans-serif;
            }
            .ct-grids line {
                stroke-dasharray: none !important;
            }
            .ct-label {
                font-size: 18px !important;
                fill: #000000 !important;
                color: #000000 !important;
            }
            .ct-label.ct-horizontal {
                text-anchor: middle !important;
            }
        </style>
        `

        const svgPath = `${filePath}-theftValue`

        chartistSvg('line', data, opts).then((svg) => {
            svg = svg.replace(/(<svg[^>]+>)/, `$1${styles}`)
            fs.writeFile(svgPath + '.svg', svg, async (err) => {
                if (err) {
                    console.error('theft value chart svg:', err)
                    reject({ message: `'theft value chart svg: ${err}` })
                }
                console.log('theft value chart svg prepared')
                await sharp(svgPath + '.svg').resize({ width: 1000 }).png().toFile(svgPath + '.png')
                console.log('theft value chart png created')
                resolve()
            });
        })
    })
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
        stolenByYearTableData += `\\rowcolor{${i % 2 ? 'even' : 'odd'}RowColor} 
            ${prepareStolenByYearSingle(year1, stolenByYear)} &
            ${prepareStolenByYearSingle(year2, stolenByYear)} &
            ${prepareStolenByYearSingle(year3, stolenByYear)} &
            \\cellcolor{white} &
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

const limitTextLines = (content, lineLimit = 118, lineChars = 95) => {
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

const generateLatexPDF = async (pdfData, fileName, fromWorker) => {
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

        const reportPrepd = `${singleIssueReportPath(fromWorker)}/${fileName}.tex`
        const reportPDF = `${singleIssueReportPath(fromWorker)}/${fileName}.pdf`

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


const generateLatexMultiPDF = async (pdfData, fileName, fromWorker) => {
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

        template = template.replace(/--viewMore--/g, `\\href{${pdfData['holonUrl']}/path/${pdfData['pathSlug']}/issue/${pdfData['leafSlug']}}{\\color{blue}View More}`)

        const reportPrepd = `${multiIssueReportPath(fromWorker)}/${fileName}.tex`
        const reportPDF = `${multiIssueReportPath(fromWorker)}/${fileName}.pdf`

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

const generatePDFReport = async (noteBookName, fileName, fromWorker) => {
    createLog(MAIN_PATH, `Generating Report with filename: ${fileName}`)
    const pdfData = await generateReportData(fileName, fromWorker)
    return await generateLatexPDF(pdfData, fileName, fromWorker)
}

const generateNoVoteReportData = async (fileName, path, holon, allPaths) => {
    const pathData = path.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    let pdfData = {}
    pdfData.pdfLink = `/pathReports/${fileName}.pdf`
    pdfData.country = nation
    pdfData.generatedTime = reportTime
    pdfData.holonUrl = holon
    pdfData.pageID = 'ztReport/' + path

    const { pathTitle, pathPrefix } = splitPath(noNationPath)
    pdfData.title = '/ ' + get(allPaths, `${path.replace(/\//g, '.')}.display_name`, pathTitle)
    pdfData.subtitle = pathPrefix
    pdfData.pleaseVoteImage = pleaseVoteImage

    return pdfData
}

const generateNoVoteLatexPDF = async (pdfData, fileName, fromWorker) => {
    return new Promise((resolve, reject) => {
        let template = fs.readFileSync(`${templates}/reportNoVote.tex`, 'utf8')
        Object.keys(pdfData).forEach((key) => {
            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const reportPrepd = `${singleIssueReportPath(fromWorker)}/${fileName}.tex`
        const reportPDF = `${singleIssueReportPath(fromWorker)}/${fileName}.pdf`

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

const generateNoVotePDFReport = async (noteBookName, fileName, path, holon, allPaths, fromWorker) => {
    createLog(MAIN_PATH, `Generating No Vote Report with filename: ${fileName}`)
    const pdfData = await generateNoVoteReportData(fileName, path, holon, allPaths)
    return await generateNoVoteLatexPDF(pdfData, fileName, fromWorker)
}

const generateNoVoteMultiReportData = async (fileName, path, holon, subPaths, availablePdfsPaths) => {
    const pathData = path.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    let pdfData = {}
    pdfData.country = nation
    pdfData.generatedTime = reportTime
    pdfData.holonUrl = holon
    pdfData.pageID = 'multiIssueReport/' + path

    const { pathTitle, pathPrefix } = splitPath(noNationPath)
    pdfData.title = path === nation ? nation + ' Full Economy' : '/ ' + get(subPaths, 'metadata.display_name', pathTitle)
    pdfData.subtitle = pathPrefix
    pdfData.pleaseVoteImage = pleaseVoteImage

    const sourcesOfTheft = prepareSourcesOfTheftNoVote(noNationPath, nation, subPaths, availablePdfsPaths)

    pdfData.sourcesOfTheft = sourcesOfTheft

    return pdfData
}

const generateNoVoteMultiLatexPDF = async (pdfData, fileName, fromWorker) => {
    return new Promise((resolve, reject) => {
        let template = fs.readFileSync(`${templates}/reportNoVoteMulti.tex`, 'utf8')
        Object.keys(pdfData).forEach((key) => {
            const regex = new RegExp(`--${key}--`, 'g')
            template = template.replace(regex, pdfData[key])
        })

        const reportPrepd = `${multiIssueReportPath(fromWorker)}/${fileName}.tex`
        const reportPDF = `${multiIssueReportPath(fromWorker)}/${fileName}.pdf`

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

const generateNoVoteMultiPDFReport = async (noteBookName, fileName, path, holon, subPaths, availablePdfsPaths, fromWorker) => {
    createLog(MAIN_PATH, `Generating No Vote Report with filename: ${fileName}`)
    const pdfData = await generateNoVoteMultiReportData(fileName, path, holon, subPaths, availablePdfsPaths)
    return await generateNoVoteMultiLatexPDF(pdfData, fileName, fromWorker)
}

const generateMultiReportData = async (fileName, availablePdfsPaths, fromWorker) => {
    const { summaryTotals, actualPath, holon, allPaths, subPaths } = loadAllIssues(fileName)

    const pathData = actualPath.split('/')
    const nation = pathData[0]
    const noNationPath = pathData.slice(1).join('/')

    let hideBlocks = []
    let pdfData = {}
    pdfData.pdfLink = `/pathReports/${fileName}.pdf`
    pdfData.country = nation
    pdfData.generatedTime = reportTime
    pdfData.holonUrl = holon
    pdfData.pageID = 'multiIssueReport/' + actualPath

    let generatedFrom = ''
    const valueParent = get(subPaths, 'metadata.value_parent')
    if (valueParent === 'umbrella')
        generatedFrom = 'Generated from Umbrella Proposals'
    else if (valueParent === 'children')
        generatedFrom = 'Generated from Child Proposals'

    pdfData.generatedFrom = generatedFrom

    const path = actualPath == nation ? nation : noNationPath
    const { pathTitle, pathPrefix } = splitPath(actualPath)
    pdfData.title = path === nation ? nation + ' Full Economy' : '/ ' + get(subPaths, 'metadata.display_name', pathTitle)
    pdfData.subtitle = pathPrefix

    let slugData = actualPath.split('/')
    const leafSlug = slugData.pop()
    const pathSlug = slugData.join('%2F')
    pdfData.leafSlug = leafSlug
    pdfData.pathSlug = pathSlug

    const paths = allPaths[nation]

    let sumTotals = {}

    const yearPaths = summaryTotals['paths']

    if (path in yearPaths) sumTotals = yearPaths[path]['_totals']
    else if (path === nation) sumTotals = summaryTotals['_totals']

    const votedYearThefts = get(sumTotals, `${path === nation ? 'overall' : 'voted'}_year_thefts`, {})
    if (isEmpty(votedYearThefts)) hideBlocks = [...hideBlocks, 'chartBlock', 'inflationBlock']

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
    for (i = 0; i < yearTh.length; i++) {
        const yr = yearTh[i]
        minYr = minYr === null || yr['Year'] < minYr ? yr['Year'] : minYr
        maxYr = maxYr === null || yr['Year'] > maxYr ? yr['Year'] : maxYr
        totalTh += yr['theft']
    }
    if (!maxYr || !minYr) hideBlocks.push('theftAmountBlock')

    const totalTheft = sumTotals['theft'].toFixed(1)

    const cts = getCitizenAmounts(maxYr)
    const xYrs = (parseInt(maxYr) - parseInt(minYr)) + 1
    const perCit = theftAmountAbbr((totalTheft / cts['citizens']).toFixed(1))
    const manyYearsPerCit = theftAmountAbbr((totalTh / cts['citizens']).toFixed(1))

    pdfData.theft = theftAmountAbbr(get(sumTotals, `${path === nation ? 'overall' : 'voted'}_year_thefts.${maxYr}`, 0))
    pdfData.year = maxYr
    pdfData.citizen = cts.citizens
    pdfData.perCitTheft = perCit
    pdfData.manyYearsTheft = theftAmountAbbr(totalTh)
    pdfData.manyYearsPerCit = manyYearsPerCit
    pdfData.xYrs = xYrs
    pdfData.minYear = minYr
    pdfData.maxYear = maxYr

    const filePath = `${multiIssueReportPath(fromWorker)}/${fileName}`
    await getTheftValueChart(yearTh, filePath)
    pdfData.theftValueChart = `${filePath}-theftValue.png`

    pdfData.stolenByYearTableData = prepareStolenByYear(votedYearThefts)
    pdfData.inflationYear = inflationDate

    const sourcesOfTheft = prepareSourcesOfTheft(path, sumTotals, totalTheft, path, nation, subPaths, subPathTotals, availablePdfsPaths)
    pdfData.sourcesOfTheft = sourcesOfTheft

    const vt = getPathVoteTotals(summaryTotals, path)
    let limitedLinesArray = []
    if (vt && !get(vt, 'missing')) {
        const voteTotals = {
            'for': get(vt, '_totals.for', 0),
            'against': get(vt, '_totals.against', 0),
            'props': get(vt, 'props', {})
        }

        const { noVotes, yesVotes } = yesNoVoteTotalsSummary(voteTotals)
        await getYesNoChart(noVotes, yesVotes, filePath)
        pdfData.yesVotes = yesVotes
        pdfData.noVotes = noVotes
        pdfData.totalVotes = yesVotes + noVotes
        pdfData.yesNoChart = `${filePath}-yesNo.png`

        const { thefts: propThefts, votes: propVotes } = proposalVoteTotalsSummaryMulti(voteTotals, false)
        if (propThefts.length) {
            const bellCurveData = prepareBellCurveData(propThefts, propVotes)
            await getVotesForTheftAmountChart(bellCurveData, `${filePath}-votesForTheftAmount`, `${minYr} - ${maxYr}`)
            pdfData.votesForTheftAmountChart = `${filePath}-votesForTheftAmount.png`
        } else {
            hideBlocks.push('votesForTheftAllYearsBlock')
        }

        const lastYear = (new Date()).getFullYear() - 1
        const { thefts: propTheftslY, votes: propVotesLY } = proposalVoteTotalsSummaryMulti(voteTotals, false, lastYear)
        if (propTheftslY.length) {
            const bellCurveDataLY = prepareBellCurveData(propTheftslY, propVotesLY)
            await getVotesForTheftAmountChart(bellCurveDataLY, `${filePath}-votesForTheftAmountLastYear`, `in ${lastYear}`)
            pdfData.votesForTheftAmountLastYearChart = `${filePath}-votesForTheftAmountLastYear.png`
        } else {
            hideBlocks.push('votesForTheftLastYearBlock')
        }

        const fiveYearsAgo = lastYear - 5
        const { thefts: propTheftsFYA, votes: propVotesFYA } = proposalVoteTotalsSummaryMulti(voteTotals, false, fiveYearsAgo)
        if (propTheftsFYA.length) {
            const bellCurveDataFYA = prepareBellCurveData(propTheftsFYA, propVotesFYA)
            await getVotesForTheftAmountChart(bellCurveDataFYA, `${filePath}-votesForTheftAmountFiveYearsAgo`, `in ${fiveYearsAgo}`)
            pdfData.votesForTheftAmountFiveYearsAgoChart = `${filePath}-votesForTheftAmountFiveYearsAgo.png`
        } else {
            hideBlocks.push('votesForTheft5yearsBlock')
        }

        const pathSummary = analyticsPathSummary(voteTotals)

        const leadingProp = get(pathSummary, 'leading_proposal')
        const proposalID = get(leadingProp, 'id')
        if (proposalID) {
            const yamlJSON = await getProposalYaml(proposalID, path)
            pdfData.leadingProposalID = proposalID
            pdfData.leadingProposalAuthor = get(yamlJSON, 'author.name')
            pdfData.leadingProposalDate = moment.tz(leadingProp['date'], timeZone).format(dateFormat)

            const leadingProposalDetail = yamlConverter.stringify(yamlJSON)
            limitedLinesArray = limitTextLines(leadingProposalDetail)
        }
    } else {
        hideBlocks = [...hideBlocks, 'yesNoBlock', 'votesForTheftBlock']
    }
    pdfData.leadingProposalDetail = limitedLinesArray.join('\n')

    if (isEmpty(limitedLinesArray)) hideBlocks.push('proposalYamlBlock')

    pdfData.hideBlocks = hideBlocks
    return pdfData
}

const escapeSpecialChars = (text) => {
    return text.replace(/&/g, '\\&').replace(/%/g, '\\%')
}

const rowDisp = (prob, tots, indent, totalTheft, fullPath, nation, multi, availablePdfsPaths) => {
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
    const filePath = (multi ? 'multiIssueReport/' : 'ztReport/') + (fullPath !== nation ? nation + '/' : '') + fullPath

    return `\\textbf{${'\\quad '.repeat(indent)}${escapeSpecialChars(prob)}} &
    \\cellcolor{${voteyn === 'Theft' ? 'tableTheftBg' : 'tableNoTheftBg'}} \\color{white} \\centering \\textbf{${voteyn}  ${voteyn === 'Theft' ? (votepct * 100).toFixed(2) + '\\%' : ''}} &
    \\centering ${availablePdfsPaths.includes(filePath) ? `\\hyperlink{${filePath}}{View Report}` : 'View Report'} &
    ${notes} \\\\ \n`
}

const walkSubPath = (prefix, paths, indent, subPathTotals, sumTotals, nation, availablePdfsPaths) => {
    let disp = ''
    if (!paths) return disp

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf', 'metadata'].includes(p)) return
        const pp = prefix + p
        disp += rowDisp(get(paths, p + '.metadata.display_name', get(paths, p + '.display_name', startCase(p))), subPathTotals[pp], indent, sumTotals['theft'], pp, nation, !get(paths, `${p}.leaf`), availablePdfsPaths)
        disp += walkSubPath(prefix + p + '/', paths[p], indent + 1, subPathTotals, sumTotals, nation, availablePdfsPaths)
    })

    return disp
}

const prepareSourcesOfTheft = (path, sumTotals, totalTheft, fullPath, nation, subPaths, subPathTotals, availablePdfsPaths) => {
    // insert the area total as the first line
    disp = rowDisp(get(subPaths, 'metadata.display_name', get(subPaths, 'display_name', startCase(path))), sumTotals, 0, totalTheft, fullPath, nation, true, availablePdfsPaths)

    // now walk all the sub-paths from this path
    const firstPath = path == nation ? '' : path + '/'
    disp += walkSubPath(firstPath, subPaths, 1, subPathTotals, sumTotals, nation, availablePdfsPaths)

    return disp
}

const rowDispNoVote = (prob, indent, nation, multi, fullPath, availablePdfsPaths) => {
    const pathMatch = fullPath.match(/^\/?([^*]+)/)
    if (pathMatch) {
        fullPath = pathMatch[1]
    }
    const filePath = (multi ? 'multiIssueReport/' : 'ztReport/') + (fullPath !== nation ? nation + '/' : '') + fullPath

    return `\\textbf{${'\\quad '.repeat(indent)}${escapeSpecialChars(prob)}} &
    &
    \\centering ${availablePdfsPaths.includes(filePath) ? `\\hyperlink{${filePath}}{View Report}` : 'View Report'} &
     \\\\ \n`
}

const walkSubPathNoVote = (prefix, paths, indent, nation, availablePdfsPaths) => {
    let disp = ''
    if (!paths) return disp

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf', 'metadata'].includes(p)) return
        const pp = prefix + p
        disp += rowDispNoVote(get(paths, p + '.metadata.display_name', get(paths, p + '.display_name', startCase(p))), indent, nation, !get(paths, `${p}.leaf`), pp, availablePdfsPaths)
        disp += walkSubPathNoVote(pp ? pp + '/' : '', paths[p], indent + 1, nation, availablePdfsPaths)
    })

    return disp
}

const prepareSourcesOfTheftNoVote = (fullPath, nation, subPaths, availablePdfsPaths) => {
    // insert the area total as the first line
    disp = rowDispNoVote(get(subPaths, 'metadata.display_name', get(subPaths, 'display_name', startCase(fullPath))), 0, nation, true, fullPath, availablePdfsPaths)

    // now walk all the sub-paths from this path
    const firstPath = fullPath == nation ? '' : fullPath + '/'
    disp += walkSubPathNoVote(firstPath, subPaths, 1, nation, availablePdfsPaths)

    return disp
}

const generatePDFMultiReport = async (noteBookName, fileName, availablePdfsPaths, fromWorker) => {
    const pdfData = await generateMultiReportData(fileName, availablePdfsPaths, fromWorker)
    return await generateLatexMultiPDF(pdfData, fileName, fromWorker)
}

const mergePdfLatex = async (fileName, texsSequence, fromWorker, holonUrl) => {
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
        mergedTemplate = mergedTemplate.replace(/--generatedTime--/g, reportTime)
        mergedTemplate = mergedTemplate.replace(/--holonUrl--/g, holonUrl)
        mergedTemplate = mergedTemplate.replace(/--mixedContent--/g, mergedTex)

        const reportPrepd = `${multiIssueReportPath(fromWorker)}/${fileName}.tex`
        const mergedLatexPDF = `${multiIssueReportPath(fromWorker)}/${fileName}.pdf`
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