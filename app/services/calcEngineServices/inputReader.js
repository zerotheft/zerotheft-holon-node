const fs = require("fs")
const { get } = require('lodash')
const { getReportPath } = require('../../../config');

const loadSingleIssue = () => {
    const leafContent = fs.readFileSync(`${getReportPath()}input_jsons/corp_tax_evasion.json`)
    const leafJson = JSON.parse(leafContent)

    return [leafJson.yearData, leafJson.actualPath, leafJson.holon, leafJson.allPaths]
}

const getPathYearProposals = (summaryTotals, path, year) => {
    const yearData = summaryTotals[year]
    return get(yearData, `paths.${path}.props`, {})
}

const getPathYearVotes = (proposals) => {
    let votes = []
    Object.keys(proposals).forEach((id) => {
        votes = [...votes, ...get(proposals, `${id}.voteInfo`, [])]
    })
    return votes
}

const getPathVoteTotals = (yearTotals, path) => {
    return get(yearTotals, `paths.${path}`, {})
}

const loadAllIssues = (jsonFilename) => {
    const dataString = fs.readFileSync(`${getReportPath()}input_jsons/multireport.json`)
    const allData = JSON.parse(dataString)
    summaryTotals = allData['yearData']
    actualPath = allData['actualPath']
    holon = allData['holon']
    subPaths = allData['subPaths']
    allPaths = allData['allPaths']
    pdflinks = allData['pageLink']
    umbrellaPaths = allData['umbrellaPaths']
    return { summaryTotals, actualPath, holon, allPaths, subPaths, pdflinks, umbrellaPaths }
}

const getLeafPaths = (paths, prePath = '') => {
    let leafPaths = []

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf'].includes(p)) return
        if (!paths[p])
            leafPaths.push(prePath + p)
        else
            leafPaths = [...leafPaths, ...getLeafPaths(paths[p], prePath + p + '/')]
    })

    return leafPaths
}

const getFlatPaths = (paths, prePath = '') => {
    let flatPaths = []

    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf'].includes(p)) return
        flatPaths.push(prePath + p)
        flatPaths = [...flatPaths, ...getFlatPaths(paths[p], prePath + p + '/')]
    })

    return flatPaths
}

module.exports = {
    loadSingleIssue,
    getPathYearProposals,
    getPathYearVotes,
    getPathVoteTotals,
    loadAllIssues,
    getLeafPaths,
    getFlatPaths,
}