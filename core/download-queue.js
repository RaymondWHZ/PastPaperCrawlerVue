/*

This file implements the download function for the application.

It maintains a list of download tasks, each with the following structure:

Task: {
    // attributes
    id: number,
    filename: string,
    url: string,
    targetFilePath: string,
    progress: [0-100],
    status: 'waiting' | 'loading' | 'aborted' | 'success' | 'fail',

    // methods
    _start: () => void,
    resume: () => void,
    abort: () => void,
    remove: () => void,
}

The task first creates a temp file with extension '.downloading' and pipe data into it. Once all data is
put in the file, the file is renamed to its original (target) name.

 */

const fs = require('fs')
const https = require('https')
const path = require('path')

const taskList = []  // Task[], the central task list

let id = 0
function generateNewTaskId() {  // provide a new unique id for a new task
    id += 1
    return id
}

// the total number of tasks in running state
const activeTaskIDs = new Set()

// the maximum allowed number of tasks in running state
const maxActiveCount = 150

// add a task to active task set, called when task starts running
function taskIn(task) {
    activeTaskIDs.add(task.id)
}

// remove a task from active task set, called when a task finish
function taskOut(task) {
    activeTaskIDs.delete(task.id)
    attemptStartWaitingTask()  // probably another task can be started, as one previous task is completed
}

// returns true when current number of running tasks is smaller than maximum
function isAbleToStartNewTask() {
    return activeTaskIDs.size < maxActiveCount
}

// this variable aims to prevent the application from starting new tasks when abort all command is given
let abortingAll = false

// starts a task in waiting state when not aborting all and number available
function attemptStartWaitingTask() {
    if (!abortingAll && isAbleToStartNewTask()) {
        const nextTask = taskList.find(task => task.status === 'waiting')
        if (nextTask) {
            nextTask.resume()
        }
    }
}

function deleteTempFile(task) {
    if (fs.existsSync(task.downloadingTempPath))  // delete if exists
        fs.unlinkSync(task.downloadingTempPath)
}

function renameTempFileToTarget(task) {
    fs.renameSync(task.downloadingTempPath, task.targetFilePath)
}

// extract the length of data from the response
function getContentLength(res) {
    const contentLengthField = res.headers["content-length"]
    return Number.parseInt(contentLengthField)
}

function makeDirectory(targetPath) {
    const dir = path.dirname(targetPath)
    fs.mkdirSync(dir, { recursive: true })
}

// actually start the https request for the task
function startTaskRequest(task) {
    taskIn(task)
    return new Promise(resolve => {
        // resetRetryTimeout(task)
        task.progress = 0
        task.request = https.get(task.url, {}, res => {
            // resetRetryTimeout(task)

            // pipe data to temp path
            const tempPath = task.downloadingTempPath
            makeDirectory(tempPath)
            res.pipe(fs.createWriteStream(tempPath))

            // listen progress change
            let receivedLength = 0
            const totalLength = getContentLength(res)
            res.on('data', (chunk) => {
                // resetRetryTimeout(task)
                receivedLength += chunk.length
                task.progress = Math.round(100 * receivedLength / totalLength)
            })

            res.on('end', () => {
                // clearRetryTimeout(task)
                taskOut(task)
                if (res.complete) {
                    renameTempFileToTarget(task)
                    resolve('success')
                } else if (res.aborted) {
                    deleteTempFile(task)
                    resolve('aborted')
                } else {
                    deleteTempFile(task)
                    resolve('fail')
                }
            })

            res.on('error', () => {
                // resetRetryTimeout()
                taskOut(task)
                deleteTempFile(task)
                resolve('fail')
            })
        })
    })
}

// actually ends the https request for the task
function endTaskRequest(task) {
    task.progress = 0
    task.request?.abort()
}

function extractFilenameFromUrl(url) {
    return url.slice(url.lastIndexOf('/') + 1)
}

// returns a new task based on url and target file path
function createTask(url, targetPath) {
    const filename = extractFilenameFromUrl(url)
    const targetFilePath = path.join(targetPath, filename)
    const downloadingTempPath = targetFilePath + '.downloading'
    return {
        id: generateNewTaskId(),
        url,
        targetPath,
        filename,
        targetFilePath,
        downloadingTempPath,
        progress: 0,
        status: '',
        resume() {
            if (this.status === 'loading' || this.status === 'success') {
                return
            }

            if (isAbleToStartNewTask()) {
                this.status = 'loading'
                startTaskRequest(this).then(status => {
                    this.status = status
                })
            } else {
                this.status = 'waiting'
            }
        },
        abort() {
            if (this.status === 'loading') {
                endTaskRequest(this)
                this.status = 'aborted'
            } else if (this.status === 'waiting') {
                this.status = 'aborted'
            }
        }
    }
}

const DownloadQueue = {
    // add a new task to queue and start running it if possible
    addTask(url, targetPath) {
        const task = createTask(url, targetPath)
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

    // remove the task from queue and stop it
    removeTask(task) {
        const index = taskList.findIndex(t => t.id === task.id)
        if (index !== -1) {
            taskList.splice(index, 1)
            task.abort()
        }
    },

    clearTaskList() {
        this.abortAll()
        taskList.splice(0, taskList.length)  // remove all
    },
}

module.exports = {
    DownloadQueue,
}
