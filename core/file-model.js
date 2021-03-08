/*

This file implements folder monitoring function.

 */


const fs = require('fs')
const path = require('path')

function updateWatchingFilesStatus(watchPath, watchingFiles, handleChangeState) {
    watchingFiles.forEach(file => {
        const existedBeforeUpdating = file.existed
        const filePath = path.join(watchPath, file.name)
        file.existed = fs.existsSync(filePath)
        if (existedBeforeUpdating !== file.existed) {
            handleChangeState(file)
        }
    })
}

function executePeriodically(action) {  // returns the interval object
    action()
    return setInterval(
        action,
        2000
    )
}

function makeWatchControllerObject(intervalObject) {
    return {
        close() {
            clearInterval(intervalObject)
        }
    }
}

// add a watcher over watchingFiles, a list of file instances
// each file instance should have a field 'name' to represent the file name
// a field 'existed' will be placed into each file instance to represent whether the file is existed on disk
// the field will be automatically updated
// the function returns a watcherController instance, call watcherController.close() to end watching
function watchChange(watchPath, watchingFiles, handleChangeState) {
    const intervalObject = executePeriodically(() => {
        updateWatchingFilesStatus(watchPath, watchingFiles, handleChangeState)
    })
    return makeWatchControllerObject(intervalObject)
}

module.exports = {
    watchChange,
}
