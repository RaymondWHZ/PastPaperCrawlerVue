/*

This file implements an object called Paper Browser, which is in charge of
presenting the tedious paper list in a more desirable way. Its function
includes extracting paper information and paraphrase its name as well as
basic filtering.

Before using, feed a list of paper files into the object, and it will analyze
the list automatically. When a new list is fed in, all previous filters will
be removed.

 */


// all possible filtering keys
const filterKeys = ['year', 'season', 'paper', 'region', 'type']

// map season code to more detailed description
const seasonMap = {
    y: 'Year',
    m: 'March',
    s: 'May/June',
    w: 'November',
}

const PaperBrowser = {

    // stores the original file list fed in to browser
    rawData: [],

    // current mode, can be one between 'qpms' or 'all', do not alter it directly
    mode: 'all',

    // saves the processed list for both modes to allow instant switch back
    modeCache: {},

    // only set mode using this function
    setMode(mode) {  // 'qpms' or 'all'
        this.mode = mode
        if (this.rawData.length > 0) {
            this.update()
        }
    },

    // stores the whole list under current mode ('qpms' or 'all')
    allPapers: [],

    // updates the variable allPapers
    updateAllPapers() {
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

    // a listener will be attached to this object
    // changing attributes in this object will automatically change the shown content
    filter: {
        name: '',

        year: [],
        season: [],
        paper: [],
        region: [],
        type: [],
    },

    // initialize the filter object with one with change listener
    createFilterObject() {
        this.filter = new Proxy({
            // name filter checks whether 'name' is in the paper's 'name'
            name: '',

            year: [],
            season: [],
            paper: [],
            region: [],
            type: [],
        }, {
            set: (target, p, value, receiver) => {  // listen to any change to the object
                // apply the change to the actual object
                Reflect.set(target, p, value, receiver)

                // async the apply filter step as it takes time
                setTimeout(() => {
                    this.applyFilter()  // actuate filters
                }, 0)

                return true
            }
        })
    },

    // all possible values to choose from for all filter aspects
    filterOptions: {
        year: [],
        season: [],
        paper: [],
        region: [],
        type: [],
    },

    // updates filter options according to all paper list
    updateFilterOptions() {
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

    filterApplied: false,

    // the resulting list after process and filter
    // using an attribute instead a function to hold the resulting list is to allow direct reference from VUE front end
    shownPapers: [],

    // apply filters and update shownPapers
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

    // updates everything
    update() {
        // create cache object if not exist
        if (!this.modeCache[this.mode]) {
            this.modeCache[this.mode] = {}
        }

        // prepare variable allPapers
        this.updateAllPapers()

        // prepare variable filterOptions
        this.updateFilterOptions()

        // apply filter for the first time to move data into shownPapers
        this.applyFilter()
    },

    // feed papers into browser replacing all previous ones
    // each paper instance will be referenced to new array without copy
    // a field 'info' will be added to each file, which should not be altered outside
    feedPapers(papers) {
        // keep a reference to rawData
        this.rawData = papers
        this.modeCache = {}

        // process paper info
        this.rawData.forEach(p => {
            const name = p.name.substring(0, p.name.lastIndexOf('.'))  // exclude extension

            const info = {}  // temp array to store info
            filterKeys.forEach(k => info[k] = 'other')  // set all keys to 'other'

            // e.g. 9709_s20_qp_41
            // reg[1] = 's'
            // reg[2] = '20'
            // reg[3] = 'qp' (optional)
            // reg[4] = '4' (optional)
            // reg[5] = '1' (optional)
            // e.g. 9709_s04_qp_1+2+3+4
            // reg[6] = '+2+3+4' (optional)
            const reg = /[0-9]{4}_([a-z])([0-9]{2})_(?:([a-z]{2})(?:_([0-9])([0-9])?(\+[0-9])?)?)?/

            const res = name.match(reg)
            p.qpmsName = p.name  // by default, qpmsName is the same as name
            if (res) {
                info.year = res[2] ? ('20' + res[2]) : 'other'
                info.season = res[1] ? (seasonMap[res[1]] ?? res[1]) : 'other'
                info.paper = res[4] ? ('Paper ' + res[4]) : 'other'
                info.region = res[5] ? ('Region ' + res[5]) : 'other'
                if (res[6]) {  // this is when paper number is something like 1+2+3+4
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
                    // set qpmsName to a clearer presentation
                    // e.g. 2020 May/June Paper 4 Region 1 QP
                    p.qpmsName = `${info.year} ${info.season} ${info.paper} ${info.region === 'other' ? '' : info.region} ${info.type.toUpperCase()}`
                }
            }
            p.info = info
        })

        // clear filter by replacing it with a new value
        this.createFilterObject()

        this.update()
    },
}

module.exports = {
    PaperBrowser,
}
