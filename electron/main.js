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

    // Load content: prefer environment variable, default to production URL
    // The ELECTRON_START_URL environment variable will be set by package.json scripts for development.
    const startUrl = process.env.ELECTRON_START_URL || 'https://casalena.netlify.app';

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
    const { html, printerName } = options || {};

    try {
        if (html) {
            // Create a hidden window for printing specific HTML content
            let printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            // Load the HTML content
            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

            // Print silently
            await new Promise((resolve, reject) => {
                printWindow.webContents.print({
                    silent: true,
                    printBackground: true,
                    deviceName: printerName || '',
                    margins: { marginType: 'none' }
                }, (success, failureReason) => {
                    printWindow.close();
                    if (success) resolve();
                    else reject(new Error(failureReason));
                });
            });
        } else {
            // Fallback: Print the main window if no HTML provided
            if (!mainWindow) return { success: false, error: 'No window' };
            await mainWindow.webContents.print({
                silent: true,
                printBackground: true,
                deviceName: printerName || '',
                margins: { marginType: 'none' }
            });
        }
        return { success: true };
    } catch (error) {
        console.error('❌ [Main] Failed to print:', error);
        return { success: false, error: error.message };
    }
});
