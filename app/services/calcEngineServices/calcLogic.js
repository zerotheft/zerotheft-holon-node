const fs = require('fs')
const { uniq, mean } = require('lodash')
const PromisePool = require('@supercharge/promise-pool')
const { getPathDetail } = require('zerotheft-node-utils/contracts/paths')
const { get, startsWith } = require('lodash')
const { exportsDir, createAndWrite } = require('../../common')
const { createLog, CALC_STATUS_PATH, ERROR_PATH } = require('../LogInfoServices')
const { defaultPropYear, firstPropYear } = require('./constants')
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

const getPathProposalYears = async (path, proposals) => {
    createLog(CALC_STATUS_PATH, `Getting Years for Proposals in ${path}`, path)
    let propYears = []

    // proposals.forEach(p => {
    //     if (p && p.path) {
    //         if (p.path === path) {
    //             propYears.push(p['year'])
    //         }
    //     }
    // })
    await PromisePool
        .withConcurrency(10)
        .for(proposals)
        .process(async p => {
            if (p && p.path) {
                if (p.path === path) {
                    propYears.push(p['year'])
                }
            }
        })
    return uniq(propYears)

}

const getPathYearVotes = async (path, year, votes) => {
    createLog(CALC_STATUS_PATH, `Getting Path Year Votes in ${path}`, path)
    const pathYearVotes = []
    const { results, errors } = await PromisePool
        .withConcurrency(10)
        .for(votes)
        .process(async v => {

            if (v['path'] === path && v['year'] === year) {
                return v
            }
        })

    return results
}

const getPathYearVoteTotals = async (path, year, proposals, votes) => {
    createLog(CALC_STATUS_PATH, `Getting Path Year Vote Total in ${path}`, path)
    let tots = { 'for': 0, 'against': 0, 'props': {} }
    let vs = await getPathYearVotes(path, `${year}`, votes)

    // let p = proposals //getProposals() // v
    let propIds = proposals.map(x => x['id'])
    await PromisePool
        .withConcurrency(10)
        .for(vs)
        .process(async v => {
            if (v === undefined) return
            // for (let vi = 0; vi < vs.length; vi++) {
            //     let v = vs[vi]
            //TODO work on this v 
            let voteProposalId = `${v['proposalId']}`
            let prop
            if (voteProposalId) {
                if (propIds.includes(voteProposalId)) {
                    prop = proposals.filter(x => parseInt(x.id) === parseInt(voteProposalId))[0]
                    // prop = p[ p['id'] == voteProposalId ].iloc[0] // CONFUSED!!!!
                }
            }
            if (!voteProposalId || parseInt(prop.theftAmt) <= 0) {
                tots['against'] += 1
            } else {
                tots['for'] += 1
            }
            if (!voteProposalId) {
                return
            } else if ('props' in tots && voteProposalId in tots['props']) {
                tots['props'][voteProposalId]['count'] += 1
            } else {
                let theft = parseInt(prop.theftAmt)
                tots['props'][voteProposalId] = { ...prop, 'proposalid': voteProposalId, 'description': prop['description'], 'theft': theft, 'count': 1 }
            }
        })

    return tots
}

const getPathVoteTotals = async (path, proposals, votes) => {
    createLog(CALC_STATUS_PATH, `Getting Path Vote Total in ${path}`, path)
    let pvt = {}
    const years = await getPathProposalYears(path, proposals)

    await PromisePool
        .withConcurrency(10)
        .for(years)
        .process(async y => {
            pvt[`${y}`] = await getPathYearVoteTotals(path, y, proposals, votes)
        })
    return pvt
}

const getHierarchyTotals = async (umbrellaPaths, proposals, votes, pathHierarchy, pathH = null, pathPrefix = null, vtby = null, legitimiateThreshold = 25, nation = 'USA') => {
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
        for (let year = firstPropYear; year < defaultPropYear + 1; year++) {
            vtby[`${year}`] = { '_totals': { 'votes': 0, 'for': 0, 'against': 0, 'legit': false, 'proposals': 0, 'theft': 0, 'all_theft_amts': { '_total': 0, '_amts': [] }, 'umbrella_theft_amts': { '_total': 0, '_amts': [] } }, 'paths': {} }
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
            await getHierarchyTotals(umbrellaPaths, proposals, votes, pathHierarchy, path, fullPath, vtby) //TODO: Its not returing anything so might cause issue
        } else {
            path = {}
            isLeaf = true
        }
        // distribute vote totals into path list
        let pvt = await getPathVoteTotals(fullPath, proposals, votes)
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
                    if (!propMax || p['count'] > propMax['count']) {
                        propMax = p
                    } else if (p['count'] == propMax['count'] && p['theft'] > propMax['theft']) {
                        propMax = p
                    }
                    // collect all theft amounts that got YES vote
                    if (p['theft'] > 0) yesTheftAmts.push(p['theft'])
                }
            }
            let theft = 0
            let avgData = {}
            if (propMax) {
                if ((propMax['theft'] === 0 && votesFor < votesAgainst) || propMax['theft'] > 0)
                    theft = propMax['theft']
                else {
                    theft = mean(yesTheftAmts)
                    avgData = { 'is_theft_avg': true, 'avg_from': yesTheftAmts, '_actual_leading_prop': { 'prop_id': propMax['id'], 'actual_theft': propMax['theft'], 'votes': propMax['count'] } }
                }
            }
            let legit = (votes >= legitimiateThreshold)
            let need_votes = (legit) ? 0 : legitimiateThreshold - votes;
            vtby[y]['paths'][fullPath] = {
                '_totals': { 'legit': legit, 'votes': votes, 'for': votesFor, 'against': votesAgainst, 'proposals': vprops, 'theft': theft, 'need_votes': need_votes, ...avgData },
                'props': pvty['props']
            }
            ytots['theft'] += theft
        }
    }
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
    return { proposals, votes }
}

/**
 * Get the all year thefts
 * @param {string} nation 
 */
const getPastYearThefts = async (nation = 'USA') => {
    const theftFile = `${exportsDir}/calc_year_data/${nation}/past_year_thefts.json`
    const syncInprogress = await cacheServer.getAsync('SYNC_INPROGRESS')
    if (fs.existsSync(theftFile) && !syncInprogress) {
        return JSON.parse(fs.readFileSync(theftFile));
    }
    return await calculatePastYearThefts(nation)
}

const calculatePastYearThefts = async (nation = 'USA') => {
    let yearTh = []


    let sumTotals = {}
    for (i = defaultPropYear; i >= firstPropYear; i--) {
        let tempValue = await cacheServer.hgetallAsync(`${i}`)
        if (get(tempValue, nation)) {
            sumTotals[`${i}`] = JSON.parse(get(tempValue, nation))
        }
    }
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
    // save in cache
    cacheServer.hmset('PAST_THEFTS', nation, JSON.stringify(yearTh))
    await createAndWrite(`${exportsDir}/calc_year_data/${nation}`, `past_year_thefts.json`, yearTh)
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
