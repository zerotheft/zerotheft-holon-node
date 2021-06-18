const fs = require('fs')
const { uniq, mean, isEmpty } = require('lodash')
const PromisePool = require('@supercharge/promise-pool')
const { getPathDetail } = require('zerotheft-node-utils/contracts/paths')
const { get, startsWith } = require('lodash')
const { exportsDir, cacheDir, createAndWrite } = require('../../common')
const { createLog, CALC_STATUS_PATH, ERROR_PATH } = require('../LogInfoServices')
const { defaultPropYear, firstPropYear } = require('./helper')
// let proposals = []
// let votes = []
let yearCacheData = []


for (let yr = firstPropYear; yr <= defaultPropYear; yr++) {
    yearCacheData.push(`YEAR_${yr}_SYNCED`)
}


const checkAllYearDataSynced = async () => {
    for (var j = 0; j < yearCacheData.length; j++) {
        const synced = await cacheServer.getAsync(yearCacheData[j])
        if (synced !== "true")
            return false
    }
    return true
}

/**
 * Get Path Proposal Years
 * @param {string} path Respective bytes value of path string
 * @param {Array} proposals Collection of proposals as array of json object
 * @returns Array of proposal years
 */
const getPathProposalYears = async (path, proposals) => {
    createLog(CALC_STATUS_PATH, `Getting Years for Proposals in ${path}`, path)
    let propYears = []

    await PromisePool
        .withConcurrency(10)
        .for(proposals)
        .process(async p => {
            if (p && p.path) {
                if (p.path === path && !isEmpty(p['theftYears'])) {
                    Object.keys(p['theftYears']).map((y => propYears.push(parseInt(y))))
                }
            }
        })
    return uniq(propYears)

}

/**
 * Get the votes of particular year of a path
 * @param {string} path 
 * @param {integer} year 
 * @param {object} votes 
 * @returns Votes array of a year
 */
const getPathYearVotes = async (path, year, votes) => {
    createLog(CALC_STATUS_PATH, `Getting Path Year Votes in ${path}`, path)
    const pathYearVotes = []
    await PromisePool
        .withConcurrency(10)
        .for(votes)
        .process(async v => {
            if (v['path'] === path && (v['votedYears'].includes(parseInt(year)) || !v['voteType'])) { // return only votes comparing with years or if its "no" votes then simply return
                pathYearVotes.push(v)
            }
        })
    return pathYearVotes
}

/**22222
 * Get Path Year vote totals
 * @param {string} path 
 * @param {integer} year 
 * @param {object} proposals 
 * @param {object} votes 
 * @returns Seperate "Yes"or"No" votes and calculate count
 */
const getPathYearVoteTotals = async (path, year, proposals, votes) => {
    createLog(CALC_STATUS_PATH, `Getting Path Year Vote Total in ${path}`, path)
    let propWithIds = {}

    let tots = { 'for': 0, 'against': 0, 'props': {} }
    let vs = await getPathYearVotes(path, year, votes)
    // let propIds = proposals.map(x => x['id'])
    await PromisePool
        .withConcurrency(20)
        .for(proposals)
        .process(async x => {
            propWithIds[x['id']] = x
        })
    await PromisePool
        .withConcurrency(20)
        .for(vs)
        .process(async v => {

            if (v === undefined) return
            let voteProposalId = `${v['proposalId']}`
            let prop
            if (voteProposalId) {
                // if (propIds.includes(voteProposalId)) {
                //     prop = proposals.filter(x => x.id === voteProposalId)[0]
                //     // prop = p[ p['id'] == voteProposalId ].iloc[0] // CONFUSED!!!!
                // }
                prop = propWithIds[voteProposalId]

            }
            // see if voter has own theft amounts else push actual theft amounts of proposal
            let amt = (!v['voteType']) ? 0 : (!isEmpty(v['altTheftAmt']) && v['altTheftAmt'][year] && v['voteType']) ? v['altTheftAmt'][year] : prop['theftYears'][year]
            if (!voteProposalId || parseInt(prop.theftAmt) <= 0) {
                tots['against'] += 1
            } else {
                tots['for'] += 1
            }
            if (!voteProposalId) {
                return
            } else if ('props' in tots && voteProposalId in tots['props']) {
                tots['props'][voteProposalId]['count'] += 1
                tots['props'][voteProposalId]['all_theft_amounts'].push(amt)
            } else {
                tots['props'][voteProposalId] = { ...prop, 'count': 1, 'all_theft_amounts': [amt] }
            }
        })

    return tots
}

/**  1111
 * Get Path Vote Totals
 * @param {string} path 
 * @param {object} proposals 
 * @param {object} votes 
 * @returns JSON object of vote totals indexed to years
 */
const getPathVoteTotals = async (year, path, proposals, votes) => {
    createLog(CALC_STATUS_PATH, `Getting Path Vote Total in ${path}`, path)
    let pvt = {}
    const years = await getPathProposalYears(path, proposals)
    await PromisePool
        .withConcurrency(10)
        .for(years)
        .process(async y => {
            if (parseInt(year) === parseInt(y))
                pvt[`${y}`] = await getPathYearVoteTotals(path, y, proposals, votes)
        })
    return pvt
}

const getHierarchyTotals = async (year, umbrellaPaths, proposals, votes, pathHierarchy, pathH = null, pathPrefix = null, vtby = null, legitimiateThreshold = 25, nation = 'USA') => {
    if (pathH && pathH.leaf)
        return
    if (pathH && pathH.leaf)
        delete pathH.leaf
    if (pathH && pathH.umbrella)
        delete pathH.umbrella
    if (pathH && pathH.display_name)
        delete pathH.display_name
    if (pathH && pathH.parent)
        delete pathH.parent
    createLog(CALC_STATUS_PATH, `Getting Hierarchy Total`)
    let isRoot = false
    if (!pathH) {
        pathH = pathHierarchy[nation]
        isRoot = true
    }

    if (!vtby) {
        vtby = {}
        // set up yearly totals
        for (let yr = firstPropYear; yr < defaultPropYear + 1; yr++) {
            if (parseInt(yr) === parseInt(year))
                vtby[`${yr}`] = { '_totals': { 'votes': 0, 'for': 0, 'against': 0, 'legit': false, 'proposals': 0, 'theft': 0, 'all_theft_amts': { '_total': 0, '_amts': [] }, 'umbrella_theft_amts': { '_total': 0, '_amts': [] } }, 'paths': {} }
        }

    }
    // walk the path hierarchy (depth-first recursive)
    for (pathName in pathH) {
        let fullPath
        if (isRoot) {
            fullPath = pathName
        } else {
            fullPath = pathPrefix + '/' + pathName
        }
        let path = pathH[pathName]
        let isLeaf = false
        if (path) {
            // dive into children before doing any processing
            await getHierarchyTotals(year, umbrellaPaths, proposals, votes, pathHierarchy, path, fullPath, vtby) //TODO: Its not returing anything so might cause issue
        } else {
            path = {}
            isLeaf = true
        }
        // distribute vote totals into path list
        let pvt = await getPathVoteTotals(year, fullPath, proposals, votes)
        for (y in pvt) {
            // walk years in the totals for each path
            let pvty = pvt[y]

            let ytots = vtby[y]['_totals']

            let votesFor = pvty['for']
            let votesAgainst = pvty['against']
            let votes = votesFor + votesAgainst
            let vprops = Object.keys(pvty['props']).length
            ytots['votes'] += votes
            ytots['proposals'] += vprops
            ytots['for'] += votesFor
            ytots['against'] += votesAgainst

            // find winning theft for the year
            let propMax
            let yesTheftAmts = []
            if ('props' in pvty) {
                for (pid in pvty['props']) {
                    let p = pvty['props'][pid]
                    p['voted_theft_amount'] = p['all_theft_amounts'].length > 0 ? mean(p['all_theft_amounts']) : p['theftAmt']
                    if (!propMax || p['count'] > propMax['count']) {
                        propMax = p
                    } else if (p['count'] == propMax['count'] && p['voted_theft_amount'] > propMax['voted_theft_amount']) {
                        propMax = p
                    }
                    // collect all theft amounts that got YES vote
                    if (p['voted_theft_amount'] > 0) yesTheftAmts.push(p['voted_theft_amount'])
                }
            }
            let theft = 0
            let reason = "No custom theft amounts from any voters"
            let avgData = {}
            if (propMax) {
                //if actual theft amount of proposal differs from voted theft amounts(which is if voter adds custom theft amount)
                if (propMax['theftYears'][y] && propMax['voted_theft_amount'] !== propMax['theftYears'][y]) { reason = 'Actual theft amount differs since proposal got custom theft amounts from voter' }
                if ((propMax['voted_theft_amount'] === 0 && votesFor < votesAgainst) || propMax['voted_theft_amount'] > 0)
                    theft = propMax['voted_theft_amount']
                else {
                    theft = mean(yesTheftAmts)
                    avgData = { 'is_theft_avg': true, 'avg_from': yesTheftAmts, '_actual_leading_prop': { 'prop_id': propMax['id'], 'actual_theft': propMax['voted_theft_amount'], 'votes': propMax['count'] } }
                }
            }
            let legit = (votes >= legitimiateThreshold)
            let need_votes = (legit) ? 0 : legitimiateThreshold - votes;
            vtby[y]['paths'][fullPath] = {
                '_totals': { 'legit': legit, 'votes': votes, 'for': votesFor, 'against': votesAgainst, 'proposals': vprops, 'theft': theft, 'reason': reason, 'voted_theft_amts': propMax ? propMax['all_theft_amounts'] : [], 'need_votes': need_votes, ...avgData },
                'props': pvty['props']
            }
            ytots['theft'] += theft
        }
    }

    // TODO: save vtby here
    return vtby
}

const doPathRollUpsForYear = (yearData, umbrellaPaths, pathHierarchy, pathH = null, pathPrefix = null, nation = 'USA') => {
    if (pathH && pathH.leaf)
        delete pathH.leaf
    if (pathH && pathH.umbrella)
        delete pathH.umbrella
    if (pathH && pathH.display_name)
        delete pathH.display_name
    if (pathH && pathH.parent)
        delete pathH.parent

    createLog(CALC_STATUS_PATH, `Rolling up report for year`)
    let isRoot = false
    if (!pathH) {
        isRoot = true
        pathH = pathHierarchy[nation]
    }
    // walk the path hierarchy
    let allLegit = true
    for (pathName in pathH) {
        let fullPath
        if (isRoot) {
            fullPath = pathName
        } else {
            fullPath = pathPrefix + '/' + pathName
        }

        let path = pathH[pathName]
        let isLeaf = false

        // depth-first - make sure we've done the work for all children before doing parents
        if (path) {
            yearData = doPathRollUpsForYear(yearData, umbrellaPaths, pathHierarchy, path, fullPath)
        } else {
            isLeaf = true
        }

        let pathData = get(yearData['paths'], fullPath)

        if (!pathData) {
            pathData = { 'missing': true, '_totals': { 'legit': false, 'votes': 0, 'for': 0, 'against': 0, 'theft': 0 } }
            yearData['paths'][fullPath] = pathData
        } // missing data, make sure to add it as not legit

        if (isLeaf) {
            if (get(pathData, 'missing')) {
                allLegit = false
            } else {
                allLegit = allLegit
            }
            continue // we have nothing more to do with leaves (they already have totals calculated)
        }

        // for interior nodes, total up everything below
        let childrenSum = { 'method': 'Sum of Path Proposals', 'votes': 0, 'for': 0, 'against': 0, 'theft': 0, 'legit': true }
        let allMissing = true
        for (tpath in yearData['paths']) {
            // we are only looking for children
            if (!(startsWith(tpath, fullPath + '/'))) {
                continue
            }

            let subpaths = tpath.slice(fullPath.length + 1).split('/')
            // make sure we are only looking one level down
            if (subpaths.length > 1) {
                continue
            }

            if (get(yearData['paths'][tpath], 'missing')) {
                childrenSum['legit'] = false // if any path missing, we can't call this fully legit
                continue
            }

            allMissing = false
            let pdt = yearData['paths'][tpath]['_totals']
            // if any children not legit, the parent sum isn't legit either
            if (!pdt['legit']) {
                childrenSum['legit'] = false
            }
            childrenSum['votes'] += pdt['votes']
            childrenSum['for'] += pdt['for']
            childrenSum['against'] += pdt['against']
            childrenSum['theft'] += pdt['theft']
        }


        let totalsData = pathData['_totals']
        let secondaryData
        // see if we've got an umbrella total
        if (get(pathData, 'missing')) {
            totalsData = childrenSum
            pathData['missing'] = allMissing // if we have any sub-path summary (even a bad one, it is no longer missing, though probably not legit)
        } else if (umbrellaPaths.includes(nation + '/' + fullPath)) {
            // set its method
            totalsData['method'] = 'Umbrella Totals'

            // if umbrella total is legit, and roll-up total is legit, and roll-up total theft greater than umbrella, use roll-up data
            if (totalsData['legit'] && childrenSum['legit'] && childrenSum['theft'] > totalsData['theft']) {
                secondaryData = totalsData
                totalsData = {
                    'method': 'Umbrella Totals',
                    'reason': `roll-up and umbrella thefts are legit and roll-up theft (${childrenSum['theft']}) is greater than umbrella theft (${totalsData['theft']})`,
                    'legit': true,
                    'votes': childrenSum['votes'],
                    'for': childrenSum['for'],
                    'against': childrenSum['against'],
                    'theft': childrenSum['theft'],
                    'need_votes': childrenSum['need_votes']
                }
            } else if (!totalsData['legit'] && childrenSum['legit']) { // if umbrella is not legit and roll-up is legit, use roll-up data
                secondaryData = totalsData
                totalsData = childrenSum
                totalsData['reason'] = `umbrella is not legit and roll-up is legit`
            } else { // otherwise, use the umbrella total, and store the children sum as secondary
                secondaryData = childrenSum
            }
        }
        if (totalsData['theft'] > 0) {
            yearData['_totals']['all_theft_amts']['_total'] += totalsData['theft']
            yearData['_totals']['all_theft_amts']['_amts'].push(totalsData['theft'])
            if (umbrellaPaths.includes(`${nation}/${fullPath}`)) {
                yearData['_totals']['umbrella_theft_amts']['_total'] += totalsData['theft']
                yearData['_totals']['umbrella_theft_amts']['_amts'].push(totalsData['theft'])
            }
        }

        yearData['paths'][fullPath]['_totals'] = totalsData
        if (!!secondaryData) {
            yearData['paths'][fullPath]['_secondary'] = secondaryData
        }
        if (!yearData['paths'][fullPath]['_totals']['legit']) {
            allLegit = false
        }
    }
    yearData['_totals']['legit'] = allLegit
    if (yearData['_totals']['umbrella_theft_amts']['_total'] > 0)
        yearData['_totals']['theft'] = yearData['_totals']['umbrella_theft_amts']['_total']
    return yearData
}

const manipulatePaths = async (paths, proposalContract, voterContract, currentPath, theftVotesSum = {}, umbrellaPaths, parentPaths = [], year, proposals = [], votes = []) => {
    createLog(CALC_STATUS_PATH, `Manipulating Path for ${currentPath}`, currentPath)
    let nestedKeys = Object.keys(paths)
    for (let i = 0; i < nestedKeys.length; i++) {
        let key = nestedKeys[i]
        let nestedValues = paths[key]
        if (['display_name', 'leaf', 'umbrella', 'parent'].includes(key)) {
            continue
        }
        let nextPath = `${currentPath}/${key}`
        if (nestedValues['leaf']) {
            try {
                let details = await getPathDetail(nextPath, year, proposalContract, voterContract, true)
                if (details.success) {
                    proposals = proposals.concat(details.pathDetails)
                    votes = votes.concat(details.allVotesInfo)

                }

            } catch (e) {
                createLog(ERROR_PATH, `calcLogic=>manipulatePaths()::Error while manipulating Path for ${nextPath} for leaf item with exception ${e.message}`)
                console.log("Path:", nextPath)
                console.log("manipulatePaths(not nested) Error::", e)
            }
        }
        else {
            if (!parentPaths.includes(nextPath) && umbrellaPaths.includes(nextPath)) {
                try {
                    let details = await getPathDetail(nextPath, year, proposalContract, voterContract, true)
                    if (details.success) {
                        proposals = proposals.concat(details.pathDetails)
                        votes = votes.concat(details.allVotesInfo)

                    }
                    parentPaths.push(nextPath)
                } catch (e) {
                    createLog(ERROR_PATH, `calcLogic=>manipulatePaths()::Error while manipulating Path for ${nextPath} for non leaf item with exception ${e.message}`)
                    console.log("Path:", nextPath)
                    console.log("manipulatePaths(nested) Error::", e)
                }
            }
            const pvData = await manipulatePaths(nestedValues, proposalContract, voterContract, nextPath, theftVotesSum, umbrellaPaths, parentPaths, year, proposals, votes)
            proposals = pvData.proposals
            votes = pvData.votes

        }
    }
    //save proposals and votes in temp file
    // await createAndWrite(`${cacheDir}/calc_year_data/${nation}`, `proposals.json`, JSON.stringify)

    return { proposals, votes }
}

/**
 * Get the all year thefts
 * @param {string} nation Name of a country
 */
const getPastYearThefts = async (nation = 'USA') => {
    const theftFile = `${exportsDir}/calc_year_data/${nation}/past_year_thefts.json`
    const syncInprogress = await cacheServer.getAsync('SYNC_INPROGRESS')
    const pastThefts = await cacheServer.hgetallAsync(`PAST_THEFTS`)

    // if file is available, syncing is not running and caching index is also available then read the cached file
    if (fs.existsSync(theftFile) && !syncInprogress && !!pastThefts) {
        return JSON.parse(fs.readFileSync(theftFile));
    }
    return await calculatePastYearThefts(nation, !!syncInprogress)
}

const calculatePastYearThefts = async (nation = 'USA', isSyncing = false) => {
    let yearTh = []
    // simple estimator - use the prior theft until it changes
    let priorTheft
    let firstTheft

    for (let year = firstPropYear; year <= defaultPropYear; year++) {
        // let tempValue = await cacheServer.hgetallAsync(`${i}`)
        // if (get(tempValue, nation)) {
        //     sumTotals[`${i}`] = JSON.parse(get(tempValue, nation))
        // }
        const cachedFile = `${exportsDir}/calc_year_data/${nation}/${year}.json`
        if (!fs.existsSync(cachedFile)) {
            continue
        }
        let p = JSON.parse(fs.readFileSync(cachedFile))
        // }

        // for (year in sumTotals) {
        // let p = sumTotals[year]

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
    // save in cache only when sync is not happening
    if (!isSyncing) {
        cacheServer.hmset('PAST_THEFTS', nation, JSON.stringify(yearTh))
        await createAndWrite(`${exportsDir}/calc_year_data/${nation}`, `past_year_thefts.json`, yearTh)
    }
    return yearTh
}

module.exports = {
    getPastYearThefts,
    calculatePastYearThefts,
    manipulatePaths,
    getHierarchyTotals,
    doPathRollUpsForYear,
    checkAllYearDataSynced,
}
