const { min, max } = require("lodash")

const today = new Date()
const defaultPropYear = today.getFullYear() - 1
const firstPropYear = defaultPropYear - 60

// Number of taxpayers (returns) from 2001
// source: IRS
taxpayerMinYear = 2001
taxpayerCounts = [
    130255237, // 2001
    130076443,
    130423626,
    132226042,
    134372678, // 2005
    138394754,
    142978806,
    142450569,
    140494127,
    142892051, // 2010
    145370240,
    144928472,
    147351299,
    148606578,
    150493263, // 2015
    150272154,
    152235000,
    154444000,
    155798000 // 2019
]

// US citizen count, 2001-2019, in millions
// source: https://www.multpl.com/united-states-population/table/by-year
citizenMinYear = 2001
citizenCounts = [
    180670000,//1960
    183690000,
    186540000,
    189240000,
    191890000,
    194300000,
    196560000,
    198710000,
    200710000,
    202680000,
    205050000, //1970
    207660000,
    209900000,
    211910000,
    213850000,
    215970000,
    218040000,
    220240000,
    222580000,
    225060000,
    227220000, //1980
    229470000,
    231660000,
    233790000,
    235820000,
    237920000,
    240130000,
    242290000,
    244500000,
    246820000,
    249620000, //1990
    252980000, //1991
    256510000, //1992
    259920000,
    263130000,
    266280000,
    269390000,
    272650000,
    275850000,
    279040000,
    282160000,//2000
    284970000, // 2001
    287630000,
    290110000,
    292810000,
    295520000, // 2005
    298380000,
    301230000,
    304090000,
    306770000,
    309320000, // 2010
    311560000,
    313830000,
    315990000,
    318300000,
    320640000, // 2015
    322940000,
    324990000,
    326690000,
    329880000, // 2019
    330660000 //  2020
]


const theftAmountAbbr = (amt, pos) => {
    if (amt < Math.pow(10, 3)) {
        return amt + ''
    }

    let suffix = ''
    if (amt >= Math.pow(10, 12)) {
        amt /= Math.pow(10, 12)
        suffix = 'T'
    } else if (amt >= Math.pow(10, 9)) {
        amt /= Math.pow(10, 9)
        suffix = 'B'
    } else if (amt >= Math.pow(10, 6)) {
        amt /= Math.pow(10, 6)
        suffix = 'M'
    } else if (amt >= Math.pow(10, 3)) {
        amt /= Math.pow(10, 3)
        suffix = 'K'
    }

    return amt.toFixed(2).replace(/\.00$/, '') + suffix
}

const realTheftAmount = (dollar) => {
    let values = dollar.match(/^\$?\s?([\d]+|([\d]{1,3},(([\d]{3},)+)?[\d]{3}))(\.[\d]+)?\s?([KMBT])?$/)
    let baseValue = values[1].replace(/,/g, '')
    let multiplier = 1
    if (values[6]) {
        let denotor = values[6].toUpperCase()
        switch (denotor) {
            case 'K':
                multiplier = Math.pow(10, 3)
                break
            case 'M':
                multiplier = Math.pow(10, 6)
                break
            case 'B':
                multiplier = Math.pow(10, 9)
                break
            case 'T':
                multiplier = Math.pow(10, 12)
                break
        }
    }
    baseValue = baseValue + (values[5] || '.0')

    return baseValue * multiplier
}

const getPeopleAmounts = (year, minYr, cts) => {
    let yoff = year - minYr
    if (yoff < 0) {
        yoff = 0
    } else if (yoff >= cts.length) {
        yoff = cts.length - 1
    }

    return cts[yoff]
}

const getCitizenAmounts = (year) => {
    return {
        'citizens': getPeopleAmounts(year, citizenMinYear, citizenCounts),
        'taxpayers': getPeopleAmounts(year, taxpayerMinYear, taxpayerCounts)
    }
}

const usaPopulation = (year) => {
    populations = { "2020": 330660000, "2019": 329880000, "2018": 326690000, "2017": 324990000, "2016": 322940000, "2015": 320640000, "2014": 318300000, "2013": 315990000, "2012": 313830000, "2011": 311560000, "2010": 309320000, "2009": 306770000, "2008": 304090000, "2007": 301230000, "2006": 298380000, "2005": 295520000, "2004": 292810000, "2003": 290110000, "2002": 287630000, "2001": 284970000, "2000": 282160000, "1999": 279040000, "1998": 275850000, "1997": 272650000, "1996": 269390000, "1995": 266280000, "1994": 263130000, "1993": 259920000, "1992": 256510000, "1991": 252980000, "1990": 249620000, "1989": 246820000, "1988": 244500000, "1987": 242290000, "1986": 240130000, "1985": 237920000, "1984": 235820000, "1983": 233790000, "1982": 231660000, "1981": 229470000, "1980": 227220000, "1979": 225060000, "1978": 222580000, "1977": 220240000, "1976": 218040000, "1975": 215970000, "1974": 213850000, "1973": 211910000, "1972": 209900000, "1971": 207660000, "1970": 205050000, "1969": 202680000, "1968": 200710000, "1967": 198710000, "1966": 196560000, "1965": 194300000, "1964": 191890000, "1963": 189240000, "1962": 186540000, "1961": 183690000, "1960": 180670000, "1959": 177830000, "1958": 174880000, "1957": 171980000, "1956": 168900000, "1955": 165930000, "1954": 163030000, "1953": 160180000, "1952": 157550000, "1951": 154880000, "1950": 152270000, "1949": 149190000, "1948": 146630000, "1947": 144130000, "1946": 141390000, "1945": 139930000, "1944": 138400000, "1943": 136740000, "1942": 134860000, "1941": 133400000, "1940": 132120000, "1939": 130880000, "1938": 129820000, "1937": 128820000, "1936": 128050000, "1935": 127250000, "1934": 126370000, "1933": 125580000, "1932": 124840000, "1931": 124040000, "1930": 123080000, "1929": 121770000, "1928": 120510000, "1927": 119040000, "1926": 117400000, "1925": 115830000, "1924": 114110000, "1923": 111950000, "1922": 110050000, "1921": 108540000, "1920": 106460000, "1919": 104510000, "1918": 103210000, "1917": 103270000, "1916": 101960000, "1915": 100550000, "1914": 99110000, "1913": 97220000, "1912": 95330000, "1911": 93860000, "1910": 92410000, "1909": 90490000, "1908": 88710000, "1907": 87010000, "1906": 85450000, "1905": 83820000, "1904": 82170000, "1903": 80630000, "1902": 79160000, "1901": 77580000, "1900": 76090000 }
    return populations[year]
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

module.exports = {
    defaultPropYear,
    firstPropYear,
    theftAmountAbbr,
    realTheftAmount,
    getCitizenAmounts,
    usaPopulation,
    prepareBellCurveData
}