/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
/* eslint-disable no-underscore-dangle */
const fs = require('fs')
const { uniq, mean, isEmpty, filter } = require('lodash')
const PromisePool = require('@supercharge/promise-pool')
const { getPathDetail, getUmbrellaPaths, ExcludedKeys } = require('zerotheft-node-utils/contracts/paths')
const { get, startsWith } = require('lodash')
const { exportsDir, createAndWrite } = require('../../common')
const { createLog, CALC_STATUS_PATH, ERROR_PATH } = require('../LogInfoServices')
const { defaultPropYear } = require('./helper')

/**
 * Get Path Proposal Years of a specific path
 * @param {string} path Respective bytes value of path string
 * @param {Array} proposals Collection of proposals as array of json object
 * @returns Array of proposal years
 */
const getPathProposalYears = async (path, proposals) => {
  createLog(CALC_STATUS_PATH, `Getting Years for Proposals in ${path}`, path)
  const propYears = []

  await PromisePool.withConcurrency(10)
    .for(proposals)
    .process(async p => {
      if (p && p.path) {
        if (p.path === path && !isEmpty(p.theftYears)) {
          Object.keys(p.theftYears).map(y => propYears.push(parseInt(y)))
        }
      }
    })
  return uniq(propYears)
}

/**
 * Get Path Vote Totals
 * @param {string} path
 * @param {object} proposals
 * @param {object} votes
 * @returns JSON object of vote totals indexed to years
 */
const getPathVoteTotals = async (path, proposals, votes) => {
  createLog(CALC_STATUS_PATH, `Getting Path Vote Total in ${path}`, path)
  let pvt = {}
  const years = await getPathProposalYears(path, proposals)

  // await PromisePool
  //     .withConcurrency(10)
  //     .for(years)
  //     .process(async y => {
  // if (parseInt(year) === parseInt(y))
  if (years.length > 0) {
    pvt = await getPathYearVoteTotals(path, proposals, votes, years)
  }
  // })
  return pvt
}
/**
 * Get Path Year vote totals
 * @param {string} path
 * @param {integer} year
 * @param {object} proposals
 * @param {object} votes
 * @returns Seperate "Yes" or "No" votes and calculate count
 */
const getPathYearVoteTotals = async (path, proposals, votes, years) => {
  createLog(CALC_STATUS_PATH, `Getting Path Year Vote Total in ${path}`, path)
  const propWithIds = {}

  const tots = { for: 0, against: 0, props: {} }
  // get only votes of specific path
  const vs = await getPathYearVotes(path, votes)
  // let propIds = proposals.map(x => x['id'])
  // get all the proposal ids from proposals list
  await PromisePool.withConcurrency(20)
    .for(proposals)
    .process(async x => {
      propWithIds[x.id] = x
    })
  await PromisePool.withConcurrency(1)
    .for(vs)
    .process(async v => {
      if (v === undefined) return
      const voteProposalId = `${v.proposalId}`
      let prop
      if (voteProposalId) {
        // if (propIds.includes(voteProposalId)) {
        //     prop = proposals.filter(x => x.id === voteProposalId)[0]
        //     // prop = p[ p['id'] == voteProposalId ].iloc[0] // CONFUSED!!!!
        // }
        prop = propWithIds[voteProposalId]
      }

      if (!voteProposalId || parseInt(prop.theftAmt) <= 0) {
        tots.against += 1
      } else {
        tots.for += 1
      }
      if (!voteProposalId) {
        return
      }
      if ('props' in tots && voteProposalId in tots.props) {
        tots.props[voteProposalId].count += 1
        // tots['props'][voteProposalId]['all_theft_amounts'] = amt
      } else {
        // tots['props'][voteProposalId] = { ...prop, 'count': 1, 'all_theft_amounts': amt }
        tots.props[voteProposalId] = { ...prop, count: 1, all_theft_amounts: {}, voted_year_thefts: {} }
      }
      const propAllTheftAmts = tots.props[voteProposalId].all_theft_amounts

      // see if voter has own theft amounts else push actual theft amounts of proposal
      await PromisePool.withConcurrency(10)
        .for(years)
        .process(async year => {
          const yrAmt = !v.voteType
            ? 0
            : !isEmpty(v.altTheftAmt) && v.altTheftAmt[year] && v.voteType
              ? v.altTheftAmt[year]
              : prop.theftYears[year]
          propAllTheftAmts[year] ? propAllTheftAmts[year].push(yrAmt) : (propAllTheftAmts[year] = [yrAmt])
        })
      tots.props[voteProposalId].all_theft_amounts = propAllTheftAmts
    })

  return tots
}
/**
 * Get the votes of proposals of a specific path
 * @param {string} path
 * @param {integer} year
 * @param {object} votes
 * @returns Votes array of a year
 */
const getPathYearVotes = async (path, votes) => {
  createLog(CALC_STATUS_PATH, `Getting Path Year Votes in ${path}`, path)
  const pathYearVotes = []
  await PromisePool.withConcurrency(10)
    .for(votes)
    .process(async v => {
      // if (v['path'] === path && (v['votedYears'].includes(parseInt(year)) || !v['voteType'])) { // return only votes that matches year or if its "no" votes then simply return
      if (v.path === path) {
        // return only votes that matches year or if its "no" votes then simply return
        pathYearVotes.push(v)
      }
    })
  return pathYearVotes
}

const getHierarchyTotals = async (
  umbrellaInfo,
  proposals,
  votes,
  pathHierarchy,
  pathH = null,
  pathPrefix = null,
  vtby = null,
  legitimiateThreshold = 40,
  nation = 'USA'
) => {
  if (pathH && pathH.leaf) {
    return
  }
  pathH &&
    ExcludedKeys.forEach(k => {
      delete pathH[k]
    })

  createLog(CALC_STATUS_PATH, `Getting Hierarchy Total`)
  let isRoot = false
  if (!pathH) {
    pathH = pathHierarchy[nation]
    isRoot = true
  }

  if (!vtby) {
    vtby = {}
    vtby = {
      _totals: {
        votes: 0,
        for: 0,
        against: 0,
        legit: false,
        proposals: 0,
        last_year_theft: 0,
        overall_year_thefts: {},
        theft: 0,
        all_theft_amts: { _total: 0, _amts: [] },
        umbrella_theft_amts: { _total: 0, _amts: [] },
      },
      paths: {},
    }
  }
  // walk the path hierarchy (depth-first recursive)
  for (const pathName in pathH) {
    let fullPath
    if (isRoot) {
      fullPath = pathName
    } else {
      fullPath = `${pathPrefix}/${pathName}`
    }

    let path = pathH[pathName]
    let isLeaf = false

    if (path) {
      // dive into children before doing any processing
      await getHierarchyTotals(umbrellaInfo, proposals, votes, pathHierarchy, path, fullPath, vtby)
    } else {
      path = {}
      isLeaf = true
    }

    // distribute vote totals into path list
    const pvt = await getPathVoteTotals(fullPath, proposals, votes)
    // if (fullPath === "industries/finance") {
    //   console.log(umbrellaInfo, fullPath)

    // }
    if (isEmpty(pvt)) continue
    // for (y in pvt) {
    const ytots = vtby._totals

    const votesFor = pvt.for
    const votesAgainst = pvt.against
    const tVotes = votesFor + votesAgainst
    const vprops = Object.keys(pvt.props).length
    ytots.votes += tVotes
    ytots.proposals += vprops
    ytots.for += votesFor
    ytots.against += votesAgainst

    // find winning theft for the year
    let propMax
    const yesTheftAmts = []

    if ('props' in pvt) {
      for (const pid in pvt.props) {
        const p = pvt.props[pid]
        let actlVotedAmt = 0
        Object.keys(p.all_theft_amounts).forEach(yr => {
          const avgYrTheft = mean(p.all_theft_amounts[yr])
          if (!Number.isNaN(avgYrTheft)) {
            actlVotedAmt += avgYrTheft
            p.voted_year_thefts[yr] = avgYrTheft // average theft amount from every year. Theft amount can be custom theft amount entered.
          }
        })
        p.wining_theft_amt = actlVotedAmt > 0 ? actlVotedAmt : p.theftAmt
        // p['voted_theft_amount'] = p['all_theft_amounts'].length > 0 ? mean(p['all_theft_amounts']) : p['theftAmt']
        if (!propMax || p.count > propMax.count) {
          propMax = p
        } else if (p.count === propMax.count && p.wining_theft_amt > propMax.wining_theft_amt) {
          propMax = p
        }
        // collect all theft amounts that got YES vote
        if (p.wining_theft_amt > 0) yesTheftAmts.push(p.wining_theft_amt)
      }
    }
    let theft = 0
    let reason = 'No custom theft amounts from any voters'
    let avgData = {}
    // if (propMax) {
    //     //if actual theft amount of proposal differs from voted theft amounts(which is if voter adds custom theft amount)
    //     if (propMax['theftYears'][y] && propMax['voted_theft_amount'] !== propMax['theftYears'][y]) { reason = 'Actual theft amount differs since proposal got custom theft amounts from voter' }
    //     if ((propMax['voted_theft_amount'] === 0 && votesFor < votesAgainst) || propMax['voted_theft_amount'] > 0)
    //         theft = propMax['voted_theft_amount']
    //     else {
    //         theft = mean(yesTheftAmts)
    //         avgData = { 'is_theft_avg': true, 'avg_from': yesTheftAmts, '_actual_leading_prop': { 'prop_id': propMax['id'], 'actual_theft': propMax['voted_theft_amount'], 'votes': propMax['count'] } }
    //     }
    // }

    if (propMax) {
      // if actual theft amount of proposal differs from voted theft amounts(which is if voter adds custom theft amount)
      if (propMax.wining_theft_amt !== propMax.theftAmt) {
        reason = 'Actual theft amount differs since proposal got custom theft amounts from voter'
      }
      if ((propMax.wining_theft_amt === 0 && votesFor < votesAgainst) || propMax.wining_theft_amt > 0) {
        theft = propMax.wining_theft_amt
      } else {
        theft = mean(yesTheftAmts)
        avgData = {
          is_theft_avg: true,
          avg_from: yesTheftAmts,
          _actual_leading_prop: {
            prop_id: propMax.id,
            actual_theft: propMax.wining_theft_amt,
            votes: propMax.count,
          },
        }
      }
    }
    //TODO: We might need to use unlockVotes as legitimateThreshold later
    let unlockVotes = parseInt(path.unlock_votes)

    //This is only true if for umbrella
    if (Object.keys(umbrellaInfo).includes(fullPath) && !unlockVotes) {
      unlockVotes = umbrellaInfo[fullPath].unlock_votes
    }
    const legit = tVotes >= legitimiateThreshold
    const need_votes = legit ? 0 : legitimiateThreshold - tVotes
    vtby.paths[fullPath] = {
      _totals: {
        unlock_votes: unlockVotes,
        legit,
        votes: tVotes,
        for: votesFor,
        against: votesAgainst,
        proposals: vprops,
        theft,
        reason,
        leading_proposal: get(propMax, 'id', null),
        voted_year_thefts: propMax ? propMax.voted_year_thefts : {},
        need_votes,
        ...avgData,
      },
      props: pvt.props,
    }
    // Only add in total theft if the path is umbrella. This case can be visualized where there are no any proposals in umbrella
    // console.log(Object.keys(umbrellaPaths), fullPath)
    // if (Object.keys(umbrellaPaths).includes(fullPath)) {
    //   console.log('vitra chiryo')
    //   ytots.theft += theft
    // }
  }

  return vtby
}

/**
 * Method that does the umbrella and children data rollups.
 * It loops through all the path and manipulates individually.
 * It gives the proper reason why the rollups are done per path
 */
const doPathRollUpsForYear = (
  yearData,
  umbrellaPaths,
  pathHierarchy,
  pathH = null,
  pathPrefix = null,
  nation = 'USA'
) => {
  pathH &&
    ExcludedKeys.forEach(k => {
      delete pathH[k]
    })

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
      fullPath = `${pathPrefix}/${pathName}`
    }

    const path = pathH[pathName]
    let isLeaf = false
    // depth-first - make sure we've done the work for all children before doing parents
    if (path) {
      yearData = doPathRollUpsForYear(yearData, umbrellaPaths, pathHierarchy, path, fullPath)
    } else {
      isLeaf = true
    }

    let pathData = get(yearData.paths, fullPath)

    if (!pathData) {
      pathData = {
        missing: true,
        _totals: { legit: false, votes: 0, for: 0, against: 0, theft: 0, voted_year_thefts: {} },
      }
      yearData.paths[fullPath] = pathData
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
    const childrenSum = {
      method: 'Sum of Path Proposals',
      votes: 0,
      for: 0,
      against: 0,
      theft: 0,
      legit: true,
      voted_year_thefts: {},
    }
    let allMissing = true
    for (const tpath in yearData.paths) {
      // we are only looking for children
      if (!startsWith(tpath, `${fullPath}/`)) {
        continue
      }

      const subpaths = tpath.slice(fullPath.length + 1).split('/')
      // make sure we are only looking one level down
      if (subpaths.length > 1) {
        continue
      }

      if (get(yearData.paths[tpath], 'missing')) {
        childrenSum.legit = false // if any path missing, we can't call this fully legit
        continue
      }

      allMissing = false
      const pdt = yearData.paths[tpath]._totals

      // if any children not legit, the parent sum isn't legit either
      if (!pdt.legit) {
        childrenSum.legit = false
      }
      childrenSum.votes += pdt.votes
      childrenSum.for += pdt.for
      childrenSum.against += pdt.against
      childrenSum.theft += pdt.theft
    }
    let totalsData = pathData._totals
    const isUmbrella = Object.keys(umbrellaPaths).includes(fullPath)
    // if (!isUmbrella) {
    //   totalsData.theft = 0
    // }
    let secondaryData

    // if total is missing for non umbrella or total is missing for umbrella and umbrella's value parent is children
    if (get(pathData, 'missing') && !isUmbrella) {
      totalsData = childrenSum
      pathData.missing = allMissing // if we have any sub-path summary (even a bad one, it is no longer missing, though probably not legit)
    } else if (isUmbrella) {
      if (umbrellaPaths[fullPath].value_parent === 'children') {
        // if umbrella total is legit, and roll-up total is legit, and roll-up total theft greater than umbrella, use roll-up data
        if (totalsData.legit && childrenSum.legit && childrenSum.theft > totalsData.theft) {
          secondaryData = totalsData
          totalsData = {
            method: 'Sum of Path Proposals',
            reason: `roll-up and umbrella thefts are legit and roll-up theft (${childrenSum.theft}) is greater than umbrella theft (${totalsData.theft})`,
            legit: true,
            votes: childrenSum.votes,
            for: childrenSum.for,
            against: childrenSum.against,
            theft: childrenSum.theft,
            need_votes: childrenSum.need_votes,
            value_parent: umbrellaPaths[fullPath].value_parent,
            unlock_votes: umbrellaPaths[fullPath].unlock_votes,
          }
        } else if (!totalsData.legit && childrenSum.legit) {
          // if umbrella is not legit and roll-up is legit, use roll-up data
          secondaryData = totalsData
          totalsData = childrenSum
          totalsData.reason = `umbrella is not legit and roll-up is legit`
          totalsData.value_parent = umbrellaPaths[fullPath].value_parent
          totalsData.unlock_votes = umbrellaPaths[fullPath].unlock_votes

        } else {
          // otherwise, use the umbrella total, and store the children sum as secondary
          secondaryData = childrenSum
        }
      } else {
        totalsData.method = 'Umbrella Totals'
        secondaryData = childrenSum
        totalsData.value_parent = umbrellaPaths[fullPath].value_parent
        totalsData.unlock_votes = umbrellaPaths[fullPath].unlock_votes
      }
    }
    // else {
    //     // set its method
    //     totalsData['method'] = 'Umbrella Totals'
    //     secondaryData = childrenSum
    //     totalsData['value_parent'] = umbrellaPaths[fullPath]['value_parent']

    //     // // if umbrella total is legit, and roll - up total is legit, and roll - up total theft greater than umbrella, use roll - up data
    //     // if (totalsData['legit'] && childrenSum['legit'] && childrenSum['theft'] > totalsData['theft']) {
    //     //     secondaryData = totalsData
    //     //     totalsData = {
    //     //         'method': 'Umbrella Totals',
    //     //         'reason': `roll-up and umbrella thefts are legit and roll-up theft (${childrenSum['theft']}) is greater than umbrella theft (${totalsData['theft']})`,
    //     //         'legit': true,
    //     //         'votes': childrenSum['votes'],
    //     //         'for': childrenSum['for'],
    //     //         'against': childrenSum['against'],
    //     //         'theft': childrenSum['theft'],
    //     //         'need_votes': childrenSum['need_votes']
    //     //     }
    //     // } else if (!totalsData['legit'] && childrenSum['legit']) { // if umbrella is not legit and roll-up is legit, use roll-up data
    //     //     secondaryData = totalsData
    //     //     totalsData = childrenSum
    //     //     totalsData['reason'] = `umbrella is not legit and roll-up is legit`
    //     // } else { // otherwise, use the umbrella total, and store the children sum as secondary
    //     //     secondaryData = childrenSum
    //     // }
    // }

    if (totalsData.theft > 0 && fullPath !== 'industries') {
      yearData._totals.all_theft_amts._total += totalsData.theft
      yearData._totals.all_theft_amts._amts.push(totalsData.theft)
      if (Object.keys(umbrellaPaths).includes(fullPath)) {
        yearData._totals.umbrella_theft_amts._total += totalsData.theft
        yearData._totals.umbrella_theft_amts._amts.push(totalsData.theft)
      }
    }

    yearData.paths[fullPath]._totals = totalsData
    if (secondaryData) {
      yearData.paths[fullPath]._secondary = secondaryData
    }
    if (!yearData.paths[fullPath]._totals.legit) {
      allLegit = false
    }
    // if (Object.keys(umbrellaPaths).includes(fullPath) && !isEmpty(yearData['paths'][fullPath]['_totals']['voted_year_thefts'])) {
    //     Object.keys(yearData['paths'][fullPath]['_totals']['voted_year_thefts']).forEach((yr) => {
    //         let th = yearData['paths'][fullPath]['_totals']['voted_year_thefts'][yr]
    //         yearData['_totals']['overall_year_thefts'][yr] = yearData['_totals']['overall_year_thefts'][yr] ? yearData['_totals']['overall_year_thefts'][yr] + th : th
    //     })
    // }
  }
  yearData._totals.legit = allLegit
  // if (yearData['_totals']['umbrella_theft_amts']['_total'] > 0)
  //     yearData['_totals']['theft'] = yearData['_totals']['umbrella_theft_amts']['_total']
  // if (yearData['_totals']['umbrella_theft_amts']['_total'] > 0)
  //     yearData['_totals']['theft'] = yearData['_totals']['umbrella_theft_amts']['_total']
  // yearData['_totals']['last_year_theft'] = yearData['_totals']['overall_year_thefts'][defaultPropYear + 1] || yearData['_totals']['overall_year_thefts'][defaultPropYear]
  return yearData
}

const parentVotedYearTheftsRollups = async (yearData, umbrellaPaths) => {
  const childrenSumUmbrellas = filter(
    Object.keys(umbrellaPaths),
    uPath => umbrellaPaths[uPath].value_parent === 'children'
  )
  Object.keys(yearData.paths).forEach(path => {
    const pathData = yearData.paths[path]
    // work for industries umbrella first
    if (
      Object.keys(umbrellaPaths).includes(path) &&
      path.indexOf('industries/') > -1 &&
      !isEmpty(pathData._totals.voted_year_thefts)
    ) {
      Object.keys(pathData._totals.voted_year_thefts).forEach(yr => {
        const th = pathData._totals.voted_year_thefts[yr]
        yearData.paths.industries._totals.voted_year_thefts[yr] = yearData.paths.industries._totals.voted_year_thefts[
          yr
        ]
          ? yearData.paths.industries._totals.voted_year_thefts[yr] + th
          : th
      })
    } else if (!Object.keys(umbrellaPaths).includes(path) && !isEmpty(pathData._totals.voted_year_thefts)) {
      // umbrellas other than industries
      if (
        childrenSumUmbrellas.some(umb => path.includes(umb)) &&
        yearData.paths[path.split('/')[0]]._totals.method === 'Sum of Path Proposals'
      ) {
        Object.keys(pathData._totals.voted_year_thefts).forEach(yr => {
          // let th = pathData['_totals']['voted_year_thefts'][yr]
          const th = pathData._totals.voted_year_thefts[yr]
          yearData.paths[path.split('/')[0]]._totals.voted_year_thefts[yr] = yearData.paths[path.split('/')[0]]._totals
            .voted_year_thefts[yr]
            ? yearData.paths[path.split('/')[0]]._totals.voted_year_thefts[yr] + th
            : th
        })
      }
    }
  })

  // Now all umbrellas have got voted_year_thefts.
  Object.keys(yearData.paths).forEach(path => {
    if (Object.keys(umbrellaPaths).includes(path) && !isEmpty(yearData.paths[path]._totals.voted_year_thefts)) {
      Object.keys(yearData.paths[path]._totals.voted_year_thefts).forEach(yr => {
        const th = yearData.paths[path]._totals.voted_year_thefts[yr]
        yearData._totals.overall_year_thefts[yr] = yearData._totals.overall_year_thefts[yr]
          ? yearData._totals.overall_year_thefts[yr] + th
          : th
      })
    }
  })
  if (yearData._totals.umbrella_theft_amts._total > 0) {
    yearData._totals.theft = yearData._totals.umbrella_theft_amts._total
  }
  yearData._totals.last_year_theft =
    yearData._totals.overall_year_thefts[defaultPropYear + 1] || yearData._totals.overall_year_thefts[defaultPropYear]
}
const manipulatePaths = async (
  paths,
  proposalContract,
  voterContract,
  currentPath,
  theftVotesSum = {},
  umbrellaPaths,
  parentPaths = [],
  proposals = [],
  votes = []
) => {
  createLog(CALC_STATUS_PATH, `Manipulating Path for ${currentPath}`, currentPath)
  const nestedKeys = Object.keys(paths)
  for (let i = 0; i < nestedKeys.length; i++) {
    const key = nestedKeys[i]
    const nestedValues = paths[key]
    if (ExcludedKeys.includes(key)) {
      continue
    }
    const nextPath = `${currentPath}/${key}`
    if (nestedValues.leaf) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const details = await getPathDetail(nextPath, proposalContract, voterContract, true)
        if (details.success) {
          proposals = proposals.concat(details.allDetails)
          votes = votes.concat(details.allVotesInfo)
        }
      } catch (e) {
        createLog(
          ERROR_PATH,
          `calcLogic=>manipulatePaths()::Error while manipulating Path for ${nextPath} for leaf item with exception ${e.message}`
        )
        console.log('Path:', nextPath)
        console.log('manipulatePaths(not nested) Error::', e)
      }
    } else {
      if (!parentPaths.includes(nextPath) && umbrellaPaths.includes(nextPath)) {
        try {
          const details = await getPathDetail(nextPath, proposalContract, voterContract, true)
          if (details.success) {
            proposals = proposals.concat(details.allDetails)
            votes = votes.concat(details.allVotesInfo)
          }
          parentPaths.push(nextPath)
        } catch (e) {
          createLog(
            ERROR_PATH,
            `calcLogic=>manipulatePaths()::Error while manipulating Path for ${nextPath} for non leaf item with exception ${e.message}`
          )
          console.log('Path:', nextPath)
          console.log('manipulatePaths(nested) Error::', e)
        }
      }
      // eslint-disable-next-line no-await-in-loop
      const pvData = await manipulatePaths(
        nestedValues,
        proposalContract,
        voterContract,
        nextPath,
        theftVotesSum,
        umbrellaPaths,
        parentPaths,
        proposals,
        votes
      )
      proposals = pvData.proposals
      votes = pvData.votes
    }
  }

  return { proposals, votes }
}

/**
 * Get the all year thefts
 * @param {string} nation Name of a country
 */
const getPastYearThefts = async (nation = 'USA') => {
  const theftFile = `${exportsDir}/calc_data/${nation}/past_year_thefts.json`
  const syncInprogress = await cacheServer.getAsync('SYNC_INPROGRESS')
  const pastThefts = await cacheServer.hgetallAsync(`PAST_THEFTS`)

  // if file is available, syncing is not running and caching index is also available then read the cached file
  if (fs.existsSync(theftFile) && !syncInprogress && !!pastThefts) {
    return JSON.parse(fs.readFileSync(theftFile))
  }
  return await calculatePastYearThefts(nation, !!syncInprogress)
}

const calculatePastYearThefts = async (nation = 'USA', isSyncing = false) => {
  const yearTh = []
  // simple estimator - use the prior theft until it changes
  let priorTheft
  let firstTheft

  // for (let year = firstPropYear; year <= defaultPropYear; year++) {
  // let tempValue = await cacheServer.hgetallAsync(`${i}`)
  // if (get(tempValue, nation)) {
  //     sumTotals[`${i}`] = JSON.parse(get(tempValue, nation))
  // }
  const cachedFile = `${exportsDir}/calc_data/${nation}/calc_summary.json`

  if (!fs.existsSync(cachedFile)) {
    throw new Error('no calc summary file')
  }
  const p = JSON.parse(fs.readFileSync(cachedFile))
  // }

  // for (year in sumTotals) {
  // let p = sumTotals[year]

  let yd = { Year: year, theft: priorTheft, 'Determined By': 'estimation' }
  if (!p || get(p, 'missing')) {
    yearTh.push(yd)
    // continue
    throw new Error('missing')
  } else if (p._totals.legit) {
    yd['Determined By'] = 'voting'
    yd.theft = p._totals.theft
  } else {
    // not legit
    yd['Determined By'] = 'incomplete voting'
    yd.theft = p._totals.theft
  }

  if (!firstTheft) {
    firstTheft = yd.theft
  }
  priorTheft = yd.theft

  yearTh.push(yd)
  // }

  // second pass - back-fill any early years with firstTheft estimate
  for (yd in yearTh) {
    if (!yd.theft) {
      yd.theft = firstTheft
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
      if (lastTh && lastThIdx < idx - 1) {
        const diff = yd.theft - lastTh
        const gap = idx - lastThIdx
        step = diff / gap

        for (let backIdx = lastThIdx + 1; backIdx < idx; backIdx++) {
          lastTh += step
          yearTh[backIdx].theft = lastTh
        }
      } else if (lastTh && lastThIdx == idx - 1) {
        step = yd.theft - lastTh
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
      lastTh = yd.theft
      lastThIdx = idx
    }
  })
  // fourth pass - apply preStep to years before first not missing
  if (preIdx) {
    lastTh = yearTh[preIdx].theft
    for (let pi = preIdx - 1; pi < -1; pi--) {
      lastTh -= preStep
      if (lastTh <= 0) {
        yearTh[pi].theft = 0
      } else {
        yearTh[pi].theft = lastTh
      }
    }
  }
  // fifth pass - apply postStep to years after last not missing
  if (postIdx && postIdx < yearTh.length - 1) {
    lastTh = yearTh[postIdx].theft
    for (let pi = postIdx + 1; pi < yearTh.length; pi++) {
      lastTh += postStep
      if (lastTh <= 0) {
        yearTh[pi].theft = 0
      } else {
        yearTh[pi].theft = lastTh
      }
    }
  }
  // save in cache only when sync is not happening
  if (!isSyncing) {
    cacheServer.hmset('PAST_THEFTS', nation, JSON.stringify(yearTh))
    await createAndWrite(`${exportsDir}/calc_data/${nation}`, `past_year_thefts.json`, yearTh)
  }
  return yearTh
}

module.exports = {
  getPastYearThefts,
  calculatePastYearThefts,
  manipulatePaths,
  getHierarchyTotals,
  doPathRollUpsForYear,
  parentVotedYearTheftsRollups,
}
