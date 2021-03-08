/*

Export websites in the form:

{
    <website name>: <website instance>,
    ...
}

Each website instance should contain following functions:

Website: {
    getLevels(),
    async getSubjects(level),
    async getPapers(subject, progressUpdate)
}

 */


const https = require('https')

function getDOMList(url, selector) {
    console.log(`Loading URL: ${url}`)
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let rawData = ''
            res.on('data', chunk => { rawData += chunk; })
            res.on('end', () => {
                console.log(`Received result from URL: ${url}`)
                const parser = new DOMParser()
                const doc = parser.parseFromString(rawData, 'text/html')
                resolve(doc.querySelectorAll(selector))
            })
        }).on('error', e => {
            reject(e)
        })
    })
}


/*

startUrl: string
The url to begin with

selector: string
Unified selector for every page

judge: (element) => JudgeResult
The function called for every element found in page according to selector
JudgeResult indicates what to do next. It can be:
1. Scan another page:
{
    page: string  // the url of the page to scan
}
2. Add a certain piece of data to result:
{
    result: Object  // formatted result value
}
(case 1 has a greater priority than 2)
3. Do nothing to this element:
{}  // Any object without attributes 'page' and 'result'

progressUpdate: (progress) => void
Called to update scan progress (rounded to 0-100)

Do not pass in parameter 'avoid' from the outside
The function use it to tracks which pages are scanned to avoid infinite recursion

All results returned by calls to judge will be collected and returned in an array

 */
async function smartCrawler(startUrl, selector, judge, progressUpdate = () => {}, avoid = undefined) {
    if (!avoid) {
        avoid = new Set()
    }
    if (avoid.has(startUrl)) {
        return []  // return empty value if page is seen before
    }
    avoid.add(startUrl)

    progressUpdate(0)

    const elements = await getDOMList(startUrl, selector)
    const tasks = []

    let completedCount = 0
    elements.forEach(e => {
        tasks.push(new Promise((resolve, reject) => {
            const resolve1 = r => {
                completedCount += 1
                progressUpdate(Math.round(100 * completedCount / elements.length))
                resolve(r)
            }
            const judgeResult = judge(e, startUrl)
            if (judgeResult.page) {
                smartCrawler(judgeResult.page, selector, judge, () => {}, avoid)
                    .then(r => {
                        resolve1(r)
                    })
                    .catch(r => {
                        reject(r)
                    })
            } else if (judgeResult.result) {
                resolve1([judgeResult.result])
            } else {
                resolve1([])
            }
        }))
    })
    const results = await Promise.all(tasks)
    const ret = results.reduce((previousValue, currentValue) => previousValue.concat(currentValue), [])
    console.log('File list created:')
    console.log(ret)
    return ret
}


const GCEGuide = {
    host: 'https://papers.gceguide.com',
    getLevels() {
        return [
            {
                name: 'IGCSE',
                url: '/IGCSE/',
            },
            {
                name: 'AS & A-Level',
                url: '/A Levels/',
            },
            {
                name: 'O-Level',
                url: '/O Levels/',
            },
        ]
    },
    async getSubjects(level) {
        const url = this.host + encodeURI(level.url)
        const dom = await getDOMList(url, '#paperslist > li > a')
        const result = []
        dom.forEach(element => {
            if (element.innerHTML !== 'error_log') {
                result.push({
                    level,
                    name: element.innerHTML,
                    url: element.attributes.href.value,
                })
            }
        })
        return result
    },
    async getPapers(subject, progressUpdate = () => {}) {
        const url = this.host + encodeURI(subject.level.url) + encodeURI(subject.url) + '/'
        const result = await smartCrawler(
            url,
            '#paperslist > li > a',
            (e, currentUrl) => {
                const href = e.attributes['href']?.value
                if (!href) return {}
                if (href.includes('.')) {
                    return {
                        result: {
                            name: href,
                            url: currentUrl + encodeURI(href)
                        },
                    }
                } else {
                    return {
                        page: currentUrl + encodeURI(href) + '/'
                    }
                }
            },
            progressUpdate
        )
        result.sort((a, b) => {
            if (a.name < b.name) return -1
            if (a.name > b.name) return 1
            return 0
        })
        return result
    },
}

const PapaCambridge = {
    host: 'https://pastpapers.papacambridge.com/',
    getLevels() {
        return [
            {
                name: 'IGCSE',
                url: '?dir=Cambridge%20International%20Examinations%20%28CIE%29/IGCSE/',
            },
            {
                name: 'AS & A-Level',
                url: '?dir=Cambridge%20International%20Examinations%20%28CIE%29/AS%20and%20A%20Level/',
            },
            {
                name: 'O-Level',
                url: '?dir=Cambridge%20International%20Examinations%20%28CIE%29/GCE%20International%20O%20Level/',
            },
        ]
    },
    async getSubjects(level) {
        const url = this.host + level.url
        const dom = await getDOMList(url, '#data > div > div > div.col-lg-8.blog_sidebar_left > div > table > tbody > tr > td > a')
        const result = []
        dom.forEach(element => {
            // console.log(element)
            if (element.attributes['data-name'].value !== '..') {
                result.push({
                    level,
                    name: element.attributes['data-name'].value,
                    url: element.attributes.href.value,
                })
            }
        })
        return result
    },
    async getPapers(subject, progressUpdate = () => {}) {
        const startUrl = this.host + subject.url
        const result = await smartCrawler(
            startUrl,
            '#data > div > div > div.col-lg-8.blog_sidebar_left > div > table > tbody > tr > td',
            e => {
                const href = e.attributes['data-href']?.value
                if (!href) return {}
                if (href.startsWith('?dir=')) {
                    return {
                        page: this.host + href
                    }
                }

                const name = e.attributes['data-name']?.value
                if (name && name !== '..') {
                    return {
                        result: {
                            name,
                            url: this.host + href
                        }
                    }
                }
                return {}
            },
            progressUpdate
        )
        result.sort((a, b) => {
            if (a.name < b.name) return -1
            if (a.name > b.name) return 1
            return 0
        })
        return result
    },
}

module.exports = {
    'GCE Guide (faster)': GCEGuide,
    'Papa Cambridge (more papers and subjects)': PapaCambridge,
}
