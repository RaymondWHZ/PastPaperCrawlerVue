/*

This file acts like a proxy to access past paper websites.

It manages website switching, recent subjects, and data cache.

 */


const path = require('path')

const { getDataSourcesFolderPath } = require('./util')

function setTitleAppend(s) {
    document.title = 'Past Paper Crawler - ' + s
}

function clearTitleAppend() {
    document.title = 'Past Paper Crawler'
}

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

async function indexSubjects(websiteName = undefined) {
    let website
    if (websiteName === undefined) {
        website = selectedWebsite()
    } else {
        website = allWebsites[websiteName]
    }
    const levels = website.getLevels()
    let completeCount = 0
    setTitleAppend(`Indexing subjects: 0%`)
    const tempSubjectsCache = {}

    try {
        const tasks = levels.map(level => new Promise(async (resolve, reject) => {
            try {
                const value = await website.getSubjects(level)
                tempSubjectsCache[level.name] = {
                    website: selectedWebsiteName,
                    data: value,
                }
                completeCount += 1
                setTitleAppend(`Indexing subjects: ${Math.round(100 * completeCount / levels.length)}%`)
                resolve()
            } catch (e) {
                reject(e)
            }
        }))
        await Promise.all(tasks)
        ResourcePoolObject.subjects = tempSubjectsCache
        saveResourcePoolObject()
    } finally {
        clearTitleAppend()
    }
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

let getPapersSessionID = 0

const ResourcePool = {
    getCurrentWebsiteName() {
        return selectedWebsiteName
    },

    getWebsiteNameList() {
        return Object.keys(allWebsites)
    },

    // must be called before doing anything
    async init(websiteName = undefined) {
        const websiteNameList = this.getWebsiteNameList()
        if (websiteNameList.length === 0) {
            throw Error('At least one data source should be defined in data source file')
        }
        if (websiteName === undefined) {
            websiteName = websiteNameList[0]
        } else if (!websiteNameList.includes(websiteName)) {
            throw Error(`Website ${websiteName} not available`)
        }
        selectedWebsiteName = websiteName
        const loadResult = loadResourcePoolObject()
        if (!loadResult) {
            await indexSubjects()
        }
        indexRecentSubjects()
    },

    async indexWebsite(websiteName) {
        if (!this.getWebsiteNameList().includes(websiteName)) {
            throw Error(`Website ${websiteName} not available`)
        }
        await indexSubjects(websiteName)

        // if no error is raised in previous step
        indexRecentSubjects()
        selectedWebsiteName = websiteName
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

        // copy a new session ID
        getPapersSessionID += 1
        const sessionID = getPapersSessionID

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

        try {
            const website = selectedWebsite()
            const papers = await website.getPapers(subject, p =>{
                // Update title only when session ID unchanged
                if (sessionID === getPapersSessionID) {
                    setTitleAppend(`Loading papers: ${p}%`)
                }
            })

            // Abort operation if session ID changed (it means a new getPaper session is started)
            // or when the subject is removed from recent subjects
            if (sessionID !== getPapersSessionID || !ResourcePoolObject.recentSubjects.includes(code)) {
                return []
            }

            ResourcePoolObject.papers[code] = {
                website: selectedWebsiteName,
                data: papers,
            }
            saveResourcePoolObject()

            return papers
        } finally {
            if (sessionID === getPapersSessionID) {
                clearTitleAppend()
            }
        }
    },
}

module.exports = {
    ResourcePool,
}
