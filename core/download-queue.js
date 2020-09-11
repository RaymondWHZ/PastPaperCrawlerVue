const fs = require('fs')
const https = require('https')
const path = require('path')

/*

Task: {
    // attributes
    id: number,
    filename: string,
    url: string,
    targetFilePath: string,
    progress: [0-100],
    status: 'waiting' | 'loading' | 'aborted' | 'success' | 'fail',

    // operations
    _start: () => void,
    resume: () => void,
    abort: () => void,
    remove: () => void,
}

 */


const taskList = []  // Task[]
let id = 0
let activeCount = 0
const maxActiveCount = 150

function getDeducedTimeout() {
    return Math.max(50 * activeCount, 1000)
}

let abortingAll = false

function taskIn() {
    activeCount += 1
}
function taskOut() {
    activeCount -= 1
}
function attemptStartWaitingTask() {
    if (!abortingAll && activeCount < maxActiveCount) {
        const nextTask = taskList.find(task => task.status === 'waiting')
        if (nextTask) {
            nextTask.resume()
        }
    }
}

const DownloadQueue = {
    addTask(url, targetPath) {
        const filename = url.slice(url.lastIndexOf('/') + 1)
        const targetFilePath = path.join(targetPath, filename)
        const downloadingTempPath = targetFilePath + '.downloading'
        let request = null
        let retryTimeout = undefined
        id += 1
        const task = {
            id,
            filename,
            url,
            targetFilePath,
            downloadingTempPath,
            progress: 0,
            status: '',
            _start() {
                this.progress = 0
                clearTimeout(retryTimeout)
                retryTimeout = setTimeout(() => {
                    request.abort()
                    this._start()
                }, 2000)
                request = https.get(url, {  }, (res) => {
                    let receivedLength = 0
                    const contentLengthField = res.headers["content-length"]
                    const totalLength = Number.parseInt(contentLengthField)

                    fs.mkdirSync(targetPath, { recursive: true })
                    res.pipe(fs.createWriteStream(downloadingTempPath))

                    clearTimeout(retryTimeout)
                    retryTimeout = setTimeout(() => {
                        request.abort()
                        this._start()
                    }, getDeducedTimeout())
                    res.on('data', (chunk) => {
                        clearTimeout(retryTimeout)
                        retryTimeout = setTimeout(() => {
                            request.abort()
                            this._start()
                        }, getDeducedTimeout())
                        receivedLength += chunk.length
                        this.progress = Math.round(100 * receivedLength / totalLength)
                    })
                    res.on('end', () => {
                        if (this.status !== 'aborted') {
                            taskOut()
                            attemptStartWaitingTask()

                            clearTimeout(retryTimeout)
                            if (res.complete) {
                                this.status = 'success'
                                fs.renameSync(downloadingTempPath, targetFilePath)
                            } else {
                                this.status = 'fail'
                                if (fs.existsSync(downloadingTempPath))
                                    fs.unlinkSync(downloadingTempPath)
                            }
                        }
                    })
                    res.on('error', () => {
                        clearTimeout(retryTimeout)
                        setTimeout(() => this._start(), getDeducedTimeout())
                    })
                })
            },
            resume() {
                if (this.status === 'loading' || this.status === 'success') return
                this.progress = 0

                if (activeCount < maxActiveCount) {
                    this.status = 'loading'
                    taskIn()
                    this._start()
                } else {
                    this.status = 'waiting'
                }
            },
            abort() {
                if (this.status === 'loading') {
                    taskOut()
                    attemptStartWaitingTask()

                    clearTimeout(retryTimeout)
                    request.abort()
                    if (fs.existsSync(downloadingTempPath))
                        fs.unlinkSync(downloadingTempPath)
                    this.status = 'aborted'
                } else if (this.status !== 'success' && this.status !== 'fail') {
                    this.status = 'aborted'
                }
            },
            remove() {
                const index = taskList.findIndex(task => task.id === this.id)
                if (index !== -1) {
                    taskList.splice(index, 1)
                    this.abort()
                }
            },
        }
        task.resume()
        taskList.push(task)
    },

    getTaskList() {
        return taskList
    },

    abortAll() {
        abortingAll = true
        taskList.forEach(task => task.abort())
        abortingAll = false
    },

    resumeAll() {
        taskList.forEach(task => task.resume())
    },

    clearTaskList() {
        this.abortAll()
        taskList.splice(0, taskList.length)
    },
}

module.exports = {
    DownloadQueue,
}
