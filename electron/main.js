const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
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
        icon: path.join(__dirname, '../app/icon.png'),
        autoHideMenuBar: true
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.maximize();

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

    // Configurar el auto-updater para comprobar actualizaciones
    setupAutoUpdater();
}

function setupAutoUpdater() {
    if (!app.isPackaged) {
        console.log('ℹ️ [Updater] Ignorado en modo de desarrollo');
        return;
    }

    autoUpdater.logger = console;

    // Verificar actualizaciones automáticamente cada 2 horas
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 2 * 60 * 60 * 1000);

    // Primera verificación al iniciar después de cargar la ventana
    mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify().catch(err => {
                console.error('❌ [Updater] Error comprobando actualizaciones:', err);
            });
        }, 5000); // Pequeño retraso para no interferir con la carga inicial
    });

    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 [Updater] Comprobando si hay actualizaciones...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('📥 [Updater] Nueva versión disponible:', info.version);
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('✅ [Updater] La aplicación está al día:', info.version);
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ [Updater] Error en el auto-updater:', err);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('🎁 [Updater] Nueva versión descargada:', info.version);
        dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Reiniciar y Actualizar', 'Más tarde'],
            defaultId: 0,
            cancelId: 1,
            title: 'Actualización Disponible',
            message: `Una nueva versión (${info.version}) de Casaleña POS ha sido descargada.`,
            detail: '¿Deseas reiniciar la aplicación ahora para instalar la actualización?'
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
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
            // ✅ FIX: Usar base64 en lugar de encodeURIComponent — evita límite de longitud de URL
            // encodeURIComponent falla con HTML grandes (estilos de Tailwind incluidos).
            const base64Html = Buffer.from(html, 'utf-8').toString('base64');
            await printWindow.loadURL(`data:text/html;base64,${base64Html}`);

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
