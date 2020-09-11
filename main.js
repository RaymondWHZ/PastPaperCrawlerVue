const { app } = require('electron')
const showWindow = require('./windows/main/show')

app.setName('Past Paper Crawler')

app.whenReady().then(showWindow)
