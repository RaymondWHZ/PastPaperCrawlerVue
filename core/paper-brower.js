
const filterKeys = ['year', 'season', 'paper', 'region', 'type']

const seasonMap = {
    y: 'Whole Year',
    m: 'March',
    s: 'May/June',
    w: 'November',
}

const typeMap = {
    qp: 'Question Paper (qp)',
    ms: 'Mark Scheme (ms)',
    er: 'Examiner Report (er)',
}

const PaperBrowser = {

    mode: 'all',
    modeCache: {},
    setMode(mode) {  // 'qpms' or 'all'
        this.mode = mode
        if (this.rawData.length === 0) return
        this.prepare()
    },

    shownPapers: [],

    // changing attributes of this object will automatically change content of paperAnswerPairs and papers
    filter: {
        name: '',

        year: [],
        season: [],
        paper: [],
        region: [],
        type: [],
    },

    filterApplied: false,

    filterOptions: {
        year: [],
        season: [],
        paper: [],
        region: [],
        type: [],
    },

    allPapers: [],
    rawData: [],

    applyFilter() {
        let filterApplied = false
        filterKeys.forEach(key => {
            if (this.filter[key].length > 0) {
                filterApplied = true
            }
        })
        if (this.filterApplied !== filterApplied) {
            this.filterApplied = filterApplied
        }

        const filterName = this.filter.name.toLowerCase()
        this.shownPapers = this.allPapers.filter(paper => {
            if (filterName) {
                if (!paper.name.toLowerCase().includes(filterName)) {
                    if (this.mode === 'qpms') {
                        if (!paper.qpmsName.toLowerCase().includes(filterName)) return false
                    } else {
                        return false
                    }
                }
            }
            for (const key of filterKeys) {
                const field = this.filter[key]
                if (field.length > 0) {
                    const includes = field.includes(paper.info[key])
                    if (!includes) return false
                }
            }
            return true
        })
    },

    prepareAllPapers() {
        if (this.mode === 'qpms') {
            if (this.modeCache.qpms.allPapers) {
                this.allPapers = this.modeCache.qpms.allPapers
            } else {
                this.allPapers = this.rawData
                    .filter(p => ['qp', 'ms'].includes(p.info.type))
                    .map(p => ({ value: p, comp: p.name.substring(5, 8) + p.name.substring(12) }))
                    .sort((a, b) => {
                        if (a.comp < b.comp) return -1
                        if (a.comp > b.comp) return 1
                        return 0
                    })
                    .map(p => p.value)
                this.modeCache.qpms.allPapers = this.allPapers
            }
        } else {
            this.allPapers = this.rawData
        }
    },

    prepareFilter() {
        this.filter = new Proxy({
            // name filter checks whether 'name' is in the paper's 'name'
            name: '',

            year: [],
            season: [],
            paper: [],
            region: [],
            type: [],
        }, {
            set: (target, p, value, receiver) => {
                Reflect.set(target, p, value, receiver)

                setTimeout(() => {
                    this.applyFilter()
                }, 0)

                return true
            }
        })
    },

    prepareFilterOptions() {
        const cache = this.modeCache[this.mode].filterOptions
        if (cache) {
            this.filterOptions = cache
        } else {
            const options = {
                year: new Set(),
                season: new Set(),
                paper: new Set(),
                region: new Set(),
                type: new Set(),
            }
            this.allPapers.forEach(p => filterKeys.forEach(k => options[k].add(p.info[k])))
            filterKeys.forEach(k => {
                let hasOther = options[k].delete('other')
                const arr = Array.from(options[k]).sort()
                if (hasOther) arr.push('other')
                options[k] = arr
            })
            options.year = options.year.map(o => ({
                value: o,
                label: o,
            }))
            options.season = options.season.map(o => ({
                value: o,
                label: o,
            }))
            options.paper = options.paper.map(o => ({
                value: o,
                label: o,
            }))
            options.region = options.region.map(o => ({
                value: o,
                label: o,
            }))
            options.type = options.type.map(o => ({
                value: o,
                label: o,
            }))
            this.modeCache[this.mode].filterOptions = this.filterOptions = options
        }
    },

    prepare() {
        if (!this.modeCache[this.mode]) {
            this.modeCache[this.mode] = {}
        }

        // prepare variable allPapers
        this.prepareAllPapers()

        // prepare variable filterOptions
        this.prepareFilterOptions()

        // apply filter for the first time to move data into shownPapers
        this.applyFilter()
    },

    removeAllFilters() {
        // clear filter by replacing it with a new value
        this.prepareFilter()
        this.applyFilter()
    },

    // add papers into browser replacing all previous ones
    // each paper instance will be referenced to new array without copy
    // a field 'info' will be added to it (which should not be altered outside)
    feedPapers(papers) {
        // keep a reference to rawData
        this.rawData = papers
        this.modeCache = {}

        // calculate paper info
        this.rawData.forEach(p => {
            const name = p.name.substring(0, p.name.lastIndexOf('.'))
            const info = {}
            filterKeys.forEach(k => info[k] = 'other')
            const reg = /[0-9]{4}_([a-z])([0-9]{2})_(?:([a-z]{2})(?:_([0-9])([0-9])?(\+[0-9])?)?)?/
            const res = name.match(reg)
            p.qpmsName = p.name
            if (res) {
                info.year = res[2] ? ('20' + res[2]) : 'other'
                info.season = res[1] ? (seasonMap[res[1]] ?? res[1]) : 'other'
                info.paper = res[4] ? ('Paper ' + res[4]) : 'other'
                info.region = res[5] ? ('Region ' + res[5]) : 'other'
                if (res[6]) {
                    info.paper = 'Paper 1+'
                }
                if (res[3]) {
                    if (!res[4] && res[3] === 'ms') {
                        info.paper = 'Paper 1+'
                    }
                    info.type = res[3]
                } else {
                    info.type = 'other'
                }
                if (info.type === 'qp' || info.type === 'ms') {
                    p.qpmsName = `${info.year} ${info.season} ${info.paper} ${info.region === 'other' ? '' : info.region} ${info.type.toUpperCase()}`
                }
            }
            p.info = info
        })

        // clear filter by replacing it with a new value
        this.prepareFilter()

        this.prepare()
    },
}

module.exports = {
    PaperBrowser,
}
