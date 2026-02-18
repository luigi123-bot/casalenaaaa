const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Sometimes helpful for startup issues
        },
        title: 'Casaleña POS',
        show: false, // Don't show until ready to prevent white flicker
        icon: path.join(__dirname, '../app/icon.png')
    });

    // Load content based on environment
    const startUrl = app.isPackaged
        ? 'https://casalena.netlify.app'
        : (process.env.ELECTRON_START_URL || 'http://localhost:3000');

    console.log('🔗 [Main] Loading URL:', startUrl);
    mainWindow.loadURL(startUrl);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Handle generic crashes or errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('❌ [Main] Failed to load:', errorCode, errorDescription);
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC Handler for Silent Printing
ipcMain.handle('print-silent', async (event, options) => {
    if (!mainWindow) return { success: false, error: 'No window' };

    try {
        // Silent print to default printer
        // 'silent: true' prints without dialog
        // 'printBackground: true' ensures styles/colors print correctly
        // 'deviceName': can specify a printer name if needed, defaults to system default
        await mainWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: options?.printerName || '', // Empty string = default printer
            margins: {
                marginType: 'none', // Critical for 58mm thermal printers
            }
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to print:', error);
        return { success: false, error: error.message };
    }
});
