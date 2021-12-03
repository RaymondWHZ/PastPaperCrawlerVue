const { BrowserWindow, Menu } = require('electron')

const menuTemplate = [
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
]

module.exports = function () {
    let win = new BrowserWindow({
        width: 1250,
        height: 800,
        webPreferences: {
            devTools: true,
            nodeIntegration: true
        }
    })

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

    // 加载index.html文件
    win.loadFile('./windows/main/index.html')
}
