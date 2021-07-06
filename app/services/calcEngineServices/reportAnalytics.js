const { get, max, startCase, isEmpty } = require("lodash")
const { paths } = require("zerotheft-node-utils")
const { theftAmountAbbr, realTheftAmount } = require("./helper")
const proposalVoteTotalsSummaryMulti = (voteTotals, cleanTheft = true) => {
    let sums = {}
    Object.keys(voteTotals.props).forEach((key) => {
        const prop = voteTotals.props[key]
        const theft = prop.theftAmt
        if (theft <= 0) {
            return
        }

        const ct = parseInt(prop['count'])
        if (!get(sums, theft)) {
            sums[theft] = ct
        } else {
            sums[theft] += ct
        }
    })

    let thefts = []
    let votes = []
    Object.keys(sums).sort((a, b) => { return parseInt(a) - parseInt(b) }).map((th) => {
        const thv = cleanTheft ? theftAmountAbbr(th) : th
        thefts.push(thv)
        votes.push(sums[th])
    })

    return { thefts, votes }
}

const pathSummary = (voteTotals, isSummary = false, cleanTheft = true) => {
    if (isSummary) {
        const thv = cleanTheft ? theftAmountAbbr(voteTotals.theft) : voteTotals.theft
        return {
            'total_votes': voteTotals['votes'],
            'total_against': voteTotals['against'],
            'total_for': voteTotals['for'],
            'leading_theft': thv,
            'leading_theft_votes': 0,
            'leading_prop': null
        }
    }

    let summary = {
        'total_votes': voteTotals['for'] + voteTotals['against'],
        'total_against': voteTotals['against'],
        'total_for': voteTotals['for'],
        'leading_theft': null,
        'leading_theft_votes': 0,
        'leading_prop': null
    }

    let leadingProp = null
    Object.keys(voteTotals.props).forEach((key) => {
        const prop = voteTotals.props[key]
        if (prop.voted_theft_amount <= 0) {
            return
        }
        const count = prop['count']
        leadingProp = leadingProp === null || leadingProp['count'] < count ? prop : leadingProp
    })


    const { thefts: t, votes: v } = proposalVoteTotalsSummaryMulti(voteTotals, cleanTheft)
    const maxVotesIndex = v.indexOf(max(v))

    summary['leading_theft'] = t[maxVotesIndex]
    summary['leading_theft_votes'] = v[maxVotesIndex]

    summary['leading_proposal'] = leadingProp
    return summary
}


const getPastYearsTheftForMulti = (sumtotals, path, nation = 'USA') => {
    let yearTh = []
    // simple estimator - use the prior theft until it changes
    let priorTheft = null
    let firstTheft = null
    let p
    if (path === nation) {
        p = sumtotals
    } else {
        p = get(sumtotals, `paths.${path}`)
    }

    const yearlyThefts = get(p, `_totals.${path === nation ? 'overall' : 'voted'}_year_thefts`)
    if (!(get(p, 'missing') && get(p, `_totals.value_parent`) === 'umbrella') && !isEmpty(yearlyThefts)) {
        Object.keys(yearlyThefts).forEach((year) => {
            const theft = yearlyThefts[year]
            let yd = { 'Year': year, 'theft': theft, 'Determined By': 'voting', 'Theft': theftAmountAbbr(theft) }
            // let yd = { 'Year': year, 'theft': priorTheft, 'Determined By': 'estimation' }

            // if (get(p, '_totals.legit')) {
            //     if (theft <= 0) {
            //         yd['Determined By'] = 'incomplete voting'
            //         yd['theft'] = 0
            //     } else {
            //         yd['Determined By'] = 'voting'
            //         yd['theft'] = theft
            //     }
            // } else { // not legit
            //     if (theft <= 0) {
            //         yd['theft'] = 0
            //     } else {
            //         yd['theft'] = theft
            //     }
            //     yd['Determined By'] = 'incomplete voting'
            // }

            // firstTheft = firstTheft ? firstTheft : yd['theft']
            // priorTheft = yd['theft']

            yearTh.push(yd)
        })
    }

    // second pass - back-fill any early years with first_theft estimate
    // Object.keys(yearTh).forEach((key) => {
    //     const yd = yearTh[key]
    //     if (!yd.theft) yd.theft = firstTheft
    //     yd['Theft'] = theftAmountAbbr(yd['theft'])
    // })

    // third pass - step-estimate any theft between two legit/incomplete years
    // let lastTh = null
    // let lastThIdx = -1
    // let preStep = null
    // let preIdx = null
    // let postStep = null
    // let postIdx = null
    // yearTh.forEach((yd, idx) => {
    //     if (yd['Determined By'] === 'voting' || yd['Determined By'] == 'incomplete voting') {
    //         // if we had a legit in the past, back-fill all estimation cases between
    //         let step = null
    //         if (lastTh && lastThIdx < (idx - 1)) {
    //             const diff = yd['theft'] - lastTh
    //             const gap = idx - lastThIdx
    //             step = diff / gap

    //             for (backIdx = lastThIdx + 1; backIdx < idx; backIdx++) {
    //                 lastTh += step
    //                 yearTh[backIdx]['theft'] = lastTh
    //                 yearTh[backIdx]['Theft'] = theftAmountAbbr(lastTh)
    //             }

    //         } else if (lastTh && lastThIdx == (idx - 1)) {
    //             step = yd['theft'] - lastTh
    //         }

    //         // prepare for fourth/fifth passes
    //         if (step) {
    //             if (preStep === null && idx > 0) {
    //                 preStep = step
    //                 preIdx = idx
    //             }
    //             postStep = step
    //             postIdx = idx
    //         }

    //         lastTh = yd['theft']
    //         lastThIdx = idx
    //     }
    // })

    // fourth pass - apply preStep to years before first not missing
    // if (preIdx) {
    //     let lastTh = get(yearTh, `${preIdx}.theft`)
    //     for (pi = preIdx - 1; pi >= 0; pi--) {
    //         lastTh -= preStep
    //         if (lastTh <= 0) {
    //             yearTh[pi]['theft'] = 0
    //             yearTh[pi]['Theft'] = theftAmountAbbr(0)
    //         } else {
    //             yearTh[pi]['theft'] = lastTh

    //             yearTh[pi]['Theft'] = theftAmountAbbr(lastTh)
    //         }
    //     }
    // }
    // # fifth pass - apply postStep to years after last not missing
    // if (postIdx && postIdx < yearTh.length - 1) {
    //     let lastTh = get(yearTh, `${postIdx}.theft`)
    //     for (pi = postIdx + 1; pi < yearTh.length; pi++) {
    //         lastTh += postStep
    //         if (lastTh <= 0) {
    //             yearTh[pi]['theft'] = 0
    //             yearTh[pi]['Theft'] = theftAmountAbbr(0)
    //         } else {
    //             yearTh[pi]['theft'] = lastTh

    //             yearTh[pi]['Theft'] = theftAmountAbbr(lastTh)
    //         }
    //     }
    // }

    return yearTh
}

const yesNoVoteTotalsSummary = (voteTotals) => {
    return { noVotes: voteTotals['against'], yesVotes: voteTotals['for'] }
}

const splitPath = (path) => {
    let pathData = path.split('/').map((pathChunk) => startCase(pathChunk))
    const pathTitle = pathData.pop()
    const pathPrefix = pathData.join(' - ')

    return { pathTitle, pathPrefix }
}

const leafPageCount = 4 // summary page, 3 pages of YAML (including blanks)
const umbrellaPageCount = 4 // summary page, 3 pages of YAML (including blanks)
const rollupPageCount = 3 // summary page, 2 breakdown table page (including blanks, hoping this will be enough)

const assignPageNumbers = (summaryTotalsPaths, paths, prefix = '', pageNo = 1) => {
    Object.keys(paths).forEach((p) => {
        if (['parent', 'display_name', 'umbrella', 'leaf', 'metadata'].includes(p)) return

        const pp = prefix + p
        if (pp in summaryTotalsPaths) {
            const st = summaryTotalsPaths[pp]['_totals']
            summaryTotalsPaths[pp]['_totals']['pageno'] = pageNo
            const method = st['method']
            if (method == 'Umbrella Totals')
                pageNo += umbrellaPageCount
            else if (method == 'Sum of Path Proposals')
                pageNo += rollupPageCount
            else if ('votes' in st && st['votes'] > 0)
                pageNo += leafPageCount
            else
                summaryTotalsPaths[pp]['_totals']['pageno'] = -1 // this path's report is not included
        }

        const result = assignPageNumbers(summaryTotalsPaths, paths[p], pp + '/', pageNo)
        pageNo = result.pageNo
        summaryTotalsPaths = result.summaryTotalsPaths
    })

    return { pageNo, summaryTotalsPaths }
}

module.exports = {
    pathSummary,
    splitPath,
    yesNoVoteTotalsSummary,
    proposalVoteTotalsSummaryMulti,
    getPastYearsTheftForMulti,
    assignPageNumbers
}