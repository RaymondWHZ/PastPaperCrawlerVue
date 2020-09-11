
const path = require('path')

const { remote: { app } } = require('electron')

const { getDataSourcesFolderPath } = require('./util')

const allWebsites = require(path.join(getDataSourcesFolderPath(), 'index'))

let selectedWebsiteName = 'GCEGuide'
const selectedWebsite = () => allWebsites[selectedWebsiteName]

function getSubjectCode(subject) {
    const { name } = subject
    const numbers = name?.match(/[0-9]{4}/g)
    if (!numbers) return null
    return numbers[numbers.length - 1]
}

/*

Structure:

ResourcePoolObject: {
    recentSubjects: {
        [index]: string  // only subject codes
    },
    subjects: {
        [levelName]: {
            websiteName: string,
            data: [{ name: string, url: string }]
        }
    },
    papers: {
        [subjectCode]: {
            websiteName: string,
            data: [{ name: string, url: string }]
        }
    }
}

 */
let ResourcePoolObject = {
    recentSubjects: [],
    subjects: {},
    papers: {},
}

let subjectDict = {}
let recentSubjectsCached = []

const StorageKey = 'resource-pool-object'

// return true if read successfully
function loadResourcePoolObject() {
    const data = localStorage.getItem(StorageKey)
    if (!data) return false
    ResourcePoolObject = JSON.parse(data)
    return true
}

function saveResourcePoolObject() {
    const data = JSON.stringify(ResourcePoolObject)
    localStorage.setItem(StorageKey, data)
}

async function indexSubjects() {
    return new Promise((resolve, reject) => {
        const website = selectedWebsite()
        const levels = website.getLevels()
        let count = levels.length
        levels.forEach(level => {
            // console.log(level)
            website.getSubjects(level).then(value => {
                // console.log(value)
                ResourcePoolObject.subjects[level.name] = {
                    website: selectedWebsiteName,
                    data: value,
                }
                count -= 1
                if (count === 0) {
                    initiated = true
                    saveResourcePoolObject()
                    resolve()
                }
            })
        })
    })
}

function indexRecentSubjects() {
    subjectDict = []
    Object.values(ResourcePoolObject.subjects).forEach(({ data: subjects }) => {
        subjects.forEach(s => {
            subjectDict[getSubjectCode(s)] = s
        })
    })
    recentSubjectsCached.splice(0, recentSubjectsCached.length)
    recentSubjectsCached.push(...ResourcePoolObject.recentSubjects.map(code => subjectDict[code] ?? {
        name: `Unavailable (${code})`,
        disabled: true,
    }))
    console.log(recentSubjectsCached)
}

let initiated = false
const ResourcePool = {
    getWebsiteNameList() {
        return Object.keys(allWebsites)
    },

    // must be called before doing anything
    async init(website = 'GCEGuide') {
        selectedWebsiteName = website
        const loadResult = loadResourcePoolObject()
        if (!loadResult) {
            await indexSubjects()
        }
        indexRecentSubjects()
    },

    getWebsites() {
        return Object.keys(allWebsites)
    },

    async selectWebsite(website) {
        // TODO change website function
        selectedWebsiteName = website
        await indexSubjects()
        indexRecentSubjects()
    },

    async rebuildIndex() {
        await indexSubjects()
        indexRecentSubjects()
    },

    getLevels() {
        return selectedWebsite().getLevels()
    },

    getSubjects(level) {
        return ResourcePoolObject.subjects[level.name].data
    },

    getRecentSubjects() {
        return recentSubjectsCached
    },

    removeRecentSubject(subject) {
        const code = getSubjectCode(subject)
        const index = ResourcePoolObject.recentSubjects.indexOf(code)
        if (index !== -1) {
            ResourcePoolObject.recentSubjects.splice(index, 1)
            delete ResourcePoolObject.papers[getSubjectCode(subject)]
            recentSubjectsCached.splice(index, 1)
            saveResourcePoolObject()
        }
    },

    async getPapers(subject, forceReload = false) {
        console.log(selectedWebsiteName)
        if (subject.disabled) return []

        const code = getSubjectCode(subject)

        if (!ResourcePoolObject.recentSubjects.includes(code)) {
            ResourcePoolObject.recentSubjects.unshift(code)
            recentSubjectsCached.unshift(subject)
            saveResourcePoolObject()
        }

        if (!forceReload) {
            const cache = ResourcePoolObject.papers[code]
            if (cache && cache.website === selectedWebsiteName) return cache.data
        }

        const website = selectedWebsite()
        const papers = await website.getPapers(subject)

        if (!ResourcePoolObject.recentSubjects.includes(code)) {
            return []
        }
        ResourcePoolObject.papers[code] = {
            website: selectedWebsiteName,
            data: papers,
        }
        saveResourcePoolObject()

        return papers
    },
}

module.exports = {
    ResourcePool,
}
