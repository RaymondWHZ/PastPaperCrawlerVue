
const path = require('path')
const { remote: { app } } = require('electron')

module.exports = {
    getDataSourcesFolderPath() {
        const dev = process.env.NODE_ENV === 'dev'
        return path.join(app.getAppPath(), dev ? 'resources' : '..', 'data-sources')
    }
}
