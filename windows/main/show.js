const { BrowserWindow, Menu } = require('electron')

const isMac = process.platform === 'darwin'
const dev = process.env.NODE_ENV === 'dev'

const macMenuTemplate = [
    { role: 'appMenu' },
    { role: 'fileMenu' }
]

if (dev) {
    macMenuTemplate.push({ role: 'viewMenu' })
} else {
    macMenuTemplate.push({
        label: 'View',
        submenu: [
            { role: 'togglefullscreen' }
        ]
    })
}

macMenuTemplate.push({ role: 'windowMenu' })

module.exports = function () {
    let win = new BrowserWindow({
        width: 1250,
        height: 800,
        webPreferences: {
            devTools: dev,
            nodeIntegration: true
        }
    })

    Menu.setApplicationMenu(isMac ? Menu.buildFromTemplate(macMenuTemplate) : null)

    // 加载index.html文件
    win.loadFile('./windows/main/index.html')
}
