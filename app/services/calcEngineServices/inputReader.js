const fs = require("fs")
const { get } = require('lodash')
const { getReportPath } = require('../../../config');

const loadSingleIssue = (fileName) => {
    // const leafContent = fs.readFileSync(`${getReportPath()}input_jsons/corp_tax_evasion.json`)
    // TODO: uncomment this
    const leafContent = fs.readFileSync(`${getReportPath()}input_jsons/${fileName}.json`)
    const leafJson = JSON.parse(leafContent)

    // keys: yearData, actualPath, leafPath, holon, allPaths
    return leafJson;
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
    return get(yearTotals, `paths.${path}`)
}

const loadAllIssues = (fileName) => {
    // const dataString = fs.readFileSync(`${getReportPath()}input_jsons/multireport.json`)
    // TODO: uncomment this
    const dataString = fs.readFileSync(`${getReportPath()}input_jsons/${fileName}.json`)
    console.log('=============filename', fileName)
    const allData = JSON.parse(dataString)
    const summaryTotals = allData['yearData']
    const actualPath = allData['actualPath']
    const holon = allData['holon']
    const subPaths = allData['subPaths']
    const allPaths = allData['allPaths']
    const pdflinks = allData['pageLink']
    const umbrellaPaths = allData['umbrellaPaths']
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