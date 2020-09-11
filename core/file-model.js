
const fs = require('fs')
const path = require('path')

// add a watcher over watchingFiles without replacing them
// it is not recommended to edit this field afterwards
// promised: each element in watching files should be an object that has property 'name' that indicates their name
// and they will have a field named 'existed' that is a boolean that indicates whether they are present
// call close() of the returned value to end watching (the method will not reset field 'existed')
function watchChange(watchPath, watchingFiles, onChangedState) {
    // fs.mkdirSync(watchPath, { recursive: true })
    // const watcher = fs.watch(watchPath, (event, filename) => {
    //     if (event === 'rename') {
    //         const target = watchingFiles.find(f => f.name === filename)
    //         if (target) {
    //             target.existed = fs.existsSync(path.join(watchPath, filename))
    //             onChangedState(f)
    //         }
    //     }
    // })
    // let dirExists = true
    const fullScan = () => {
        watchingFiles.forEach(f => {
            f.existed = fs.existsSync(path.join(watchPath, f.name))
            onChangedState(f)
        })
        // console.log('scanned')
    }
    fullScan()
    const interval = setInterval(fullScan, 2000)
    return {
        close() {
            // watcher.close()
            clearInterval(interval)
        },
    }
}

module.exports = {
    watchChange,
}
