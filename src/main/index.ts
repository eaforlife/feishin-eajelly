import { is } from '@electron-toolkit/utils';
import {
    app,
    BrowserWindow,
    BrowserWindowConstructorOptions,
    desktopCapturer,
    globalShortcut,
    ipcMain,
    Menu,
    nativeImage,
    nativeTheme,
    net,
    powerSaveBlocker,
    protocol,
    Rectangle,
    screen,
    session,
    shell,
    Tray,
} from 'electron';
import electronLocalShortcut from 'electron-localshortcut';
import { autoUpdater } from 'electron-updater';
import { access, constants } from 'fs';
import path, { join } from 'path';

import packageJson from '../../package.json';
import { disableMediaKeys, enableMediaKeys } from './features/core/player/media-keys';
import { shutdownServer } from './features/core/remote';
import { store } from './features/core/settings';
import { canHandleVisualizerDisplayMedia } from './features/core/visualizer';
import log, { autoUpdaterLogInterface } from './logger';
import MenuBuilder, { MenuPlaybackState } from './menu';
import './features';
import { hotkeyToElectronAccelerator } from './utils';

import { disableAutoUpdates, isLinux, isMacOS, isWindows } from '/@/main/env';
import {
    clampWindowBoundsToDisplay,
    DEFAULT_WINDOW_BOUNDS,
    resolveWindowBounds,
} from '/@/main/utils/window-bounds';
import { PlayerRepeat, PlayerStatus, PlayerType, TitleTheme } from '/@/shared/types/types';
import { EAJELLY_SERVER_URL } from '/@/shared/utils/eajelly-server';

const GITHUB_UPDATER_CONFIG = {
    owner: 'eaforlife',
    provider: 'github' as const,
    repo: 'feishin-eajelly',
};

class AppUpdater {
    constructor() {
        autoUpdater.setFeedURL(GITHUB_UPDATER_CONFIG);
        autoUpdater.logger = autoUpdaterLogInterface;
        autoUpdater.channel = 'latest';
        autoUpdater.allowDowngrade = false;
        autoUpdater.allowPrerelease = false;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.autoRunAppAfterInstall = true;
        attachUpdaterMilestoneLogs();

        if (isMacOS()) {
            autoUpdater.autoDownload = false;
            autoUpdater
                .checkForUpdates()
                .then((result) => {
                    if (result?.isUpdateAvailable) {
                        log.info('Updater check complete', {
                            available: true,
                            version: result.updateInfo.version,
                        });
                        getMainWindow()?.webContents.send(
                            'update-available',
                            result.updateInfo.version,
                        );
                    } else {
                        log.info('Updater check complete', { available: false });
                    }
                })
                .catch((err) => log.error('Check for updates failed', err));
        } else {
            autoUpdater
                .checkForUpdatesAndNotify()
                .catch((err) => log.error('Check for updates failed', err));
        }
    }
}

function attachUpdaterMilestoneLogs(): void {
    let downloadStarted = false;

    autoUpdater.on('checking-for-update', () => {
        log.info('Updater checking for update');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Updater update available', { version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Updater update not available', { version: info.version });
    });

    autoUpdater.on('download-progress', () => {
        if (!downloadStarted) {
            downloadStarted = true;
            log.info('Updater download starting');
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Updater download complete', { version: info.version });
    });

    autoUpdater.on('error', (error) => {
        log.error('Updater error', error);
    });
}

const serverOverride = process.argv.includes('--server-override');

Object.assign(
    process.env,
    serverOverride
        ? { SERVER_LOCK: 'false', SERVER_NAME: '', SERVER_TYPE: '', SERVER_URL: '' }
        : {
              SERVER_LOCK: 'true',
              SERVER_NAME: 'EAJelly',
              SERVER_TYPE: 'jellyfin',
              SERVER_URL: EAJELLY_SERVER_URL,
          },
);

protocol.registerSchemesAsPrivileged([
    { privileges: { bypassCSP: true, corsEnabled: true }, scheme: 'feishin' },
]);

process.on('uncaughtException', (error: any) => {
    log.error('Error in main process', error);
});

if (store.get('ignore_ssl')) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
}

// From https://github.com/tutao/tutanota/commit/92c6ed27625fcf367f0fbcc755d83d7ff8fde94b
if (isLinux() && !process.argv.some((a) => a.startsWith('--password-store='))) {
    const passwordStore = store.get('password_store', 'gnome-libsecret') as string;
    app.commandLine.appendSwitch('password-store', passwordStore);
}

let mainWindow: BrowserWindow | null = null;
let tray: null | Tray = null;
let exitFromTray = false;
let forceQuit = false;
let powerSaveBlockerId: null | number = null;
let menuBuilder: MenuBuilder | null = null;
let currentPlaybackStatus: PlayerStatus = PlayerStatus.PAUSED;
let currentTaskbarArtist = '';
let currentTaskbarTrack = '';
let currentPrivateMode = false;
let currentRepeatMode: PlayerRepeat = PlayerRepeat.NONE;
let currentSidebarCollapsed = false;
let currentShuffleEnabled = false;
let miniPlayerBounds: null | Rectangle = null;
let miniPlayerMode = false;
let miniPlayerQueueVisible = false;

const MINI_PLAYER_SIZE = 360;

const getMiniPlayerBounds = (referenceBounds: Rectangle): Rectangle => {
    const workArea = screen.getDisplayMatching(referenceBounds).workArea;
    const displayPadding = 16;
    const height = Math.min(MINI_PLAYER_SIZE, workArea.height);
    const width = Math.min(MINI_PLAYER_SIZE, workArea.width);

    return {
        height,
        width,
        x: Math.max(workArea.x, workArea.x + workArea.width - width - displayPadding),
        y: Math.min(workArea.y + displayPadding, workArea.y + workArea.height - height),
    };
};

const clampMiniPlayerPosition = (bounds: Rectangle): Rectangle => {
    const workArea = screen.getDisplayMatching(bounds).workArea;
    const maxX = Math.max(workArea.x, workArea.x + workArea.width - bounds.width);
    const maxY = Math.max(workArea.y, workArea.y + workArea.height - bounds.height);

    return {
        ...bounds,
        x: Math.min(Math.max(bounds.x, workArea.x), maxX),
        y: Math.min(Math.max(bounds.y, workArea.y), maxY),
    };
};

app.on('before-quit', () => {
    if (isMacOS()) {
        forceQuit = true;
    }
    log.info('App quitting', { reason: exitFromTray ? 'tray' : 'before-quit' });
});
let playbackMenuAccelerators: MenuPlaybackState['accelerators'] = {};
let inputFocused = false;

ipcMain.on('input-focus-state', (_event, focused: boolean) => {
    const next = !!focused;
    if (inputFocused === next) return;
    inputFocused = next;
    if (isMacOS()) {
        updateMainMenu();
    }
});

if (process.env.NODE_ENV === 'production') {
    import('source-map-support').then((sourceMapSupport) => {
        sourceMapSupport.install();
    });
}

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
    import('electron-debug').then((electronDebug) => {
        electronDebug.default();
    });
}

const installExtensions = async () => {
    import('electron-devtools-installer').then((installer) => {
        const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
        const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

        installer
            .installExtension(
                extensions.map((name) => installer[name]),
                { forceDownload },
            )
            .then((installedExtensions) => {
                log.info(`Installed extension: ${installedExtensions}`);
            })
            .catch(() => {
                // Ignore
            });
    });
};

const userDataPath = app.getPath('userData');

if (isDevelopment) {
    const devUserDataPath = `${userDataPath}-dev`;
    app.setPath('userData', devUserDataPath);
}

const RESOURCES_PATH = app.isPackaged
    ? path.join(path.dirname(app.getAppPath()), 'assets')
    : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
};

export const getMainWindow = () => {
    return mainWindow;
};

const hideMainWindowToTray = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
};

export const showMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.setSkipTaskbar(false);
    mainWindow.show();
    mainWindow.focus();
    createWinThumbarButtons();
};

const getMainMenuState = (): MenuPlaybackState => ({
    accelerators: playbackMenuAccelerators,
    inputFocused,
    playbackStatus: currentPlaybackStatus,
    privateMode: currentPrivateMode,
    repeatMode: currentRepeatMode,
    shuffleEnabled: currentShuffleEnabled,
    sidebarCollapsed: currentSidebarCollapsed,
});

const rebuildMainMenu = () => {
    if (!menuBuilder || !mainWindow) return;

    menuBuilder.buildMenu(getMainMenuState());

    if (process.platform !== 'darwin') {
        Menu.setApplicationMenu(null);
    }
};

const updateMainMenu = () => {
    if (!menuBuilder || !mainWindow) return;

    menuBuilder.updateMenu(getMainMenuState());
};

export const sendToastToRenderer = ({
    message,
    type,
}: {
    message: string;
    type: 'error' | 'info' | 'success' | 'warning';
}) => {
    getMainWindow()?.webContents.send('toast-from-main', {
        message,
        type,
    });
};

const createWinThumbarButtons = () => {
    if (isWindows()) {
        const window = getMainWindow();
        const taskbarTitle = ['Now Playing', currentTaskbarTrack, currentTaskbarArtist]
            .filter(Boolean)
            .join(' - ');
        window?.setThumbnailToolTip(taskbarTitle);
        window?.setTitle(taskbarTitle);
        window?.setThumbarButtons([
            {
                click: () => getMainWindow()?.webContents.send('renderer-player-previous'),
                icon: nativeImage.createFromPath(getAssetPath('skip-previous.png')),
                tooltip: 'Previous Track',
            },
            {
                click: () => getMainWindow()?.webContents.send('renderer-player-play-pause'),
                icon: nativeImage.createFromPath(
                    getAssetPath(
                        currentPlaybackStatus === PlayerStatus.PLAYING
                            ? 'pause-circle.png'
                            : 'play-circle.png',
                    ),
                ),
                tooltip: 'Play/Pause',
            },
            {
                click: () => getMainWindow()?.webContents.send('renderer-player-next'),
                icon: nativeImage.createFromPath(getAssetPath('skip-next.png')),
                tooltip: 'Next Track',
            },
        ]);
    }
};

const createTray = () => {
    let trayIcon: Electron.NativeImage | string;

    if (isMacOS()) {
        const iconPath = getAssetPath('icons/IconTemplate.png');
        const icon = nativeImage.createFromPath(iconPath);
        icon.setTemplateImage(true);
        trayIcon = icon;
    } else if (isLinux()) {
        trayIcon = getAssetPath('icons/icon.png');
    } else {
        trayIcon = getAssetPath('icons/icon.ico');
    }

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-play-pause');
            },
            label: 'Play/Pause',
        },
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-next');
            },
            label: 'Next Track',
        },
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-previous');
            },
            label: 'Previous Track',
        },
        {
            click: () => {
                getMainWindow()?.webContents.send('renderer-player-stop');
            },
            label: 'Stop',
        },
        {
            type: 'separator',
        },
        {
            click: () => {
                if (mainWindow === null) createWindow(false);
                else {
                    showMainWindow();
                }
            },
            label: 'Open main window',
        },
        {
            click: () => {
                exitFromTray = true;
                app.quit();
            },
            label: 'Quit',
        },
    ]);

    if (!isMacOS()) {
        tray.on('click', () => {
            if (store.get('window_minimize_to_tray') && mainWindow?.isVisible()) {
                hideMainWindowToTray();
            } else {
                showMainWindow();
            }
        });
    }

    tray.setToolTip('EAJelly');
    tray.setContextMenu(contextMenu);
};

const validateUrl = (url: string): boolean => {
    // Minor security, really. Enforce only loading websites (http/https). file://
    // URLs and the like should've already been blocked, but this is another check.
    // Note that arbitrary web URLs are still allowed under this scheme, although
    // that should really only be hit by Subsonic share url (or if artist homepage
    // is allowed for ND extensions)
    return url.startsWith('http://') || url.startsWith('https://');
};

async function createWindow(first = true): Promise<void> {
    if (isDevelopment) {
        await installExtensions().catch((error) => log.error(error));
    }

    const nativeFrame = store.get('window_window_bar_style', 'linux') === 'linux';
    store.set('window_has_frame', nativeFrame);

    const nativeFrameConfig: Record<string, BrowserWindowConstructorOptions> = {
        linux: {
            autoHideMenuBar: true,
            frame: true,
        },
        macOS: {
            autoHideMenuBar: true,
            frame: true,
            titleBarStyle: 'default',
            trafficLightPosition: { x: 10, y: 10 },
        },
        windows: {
            autoHideMenuBar: true,
            frame: true,
        },
    };

    const savedBounds = store.get('bounds') as Rectangle | undefined;
    const workArea = (
        savedBounds && Number.isFinite(savedBounds.x) && Number.isFinite(savedBounds.y)
            ? screen.getDisplayMatching(savedBounds)
            : screen.getPrimaryDisplay()
    ).workArea;
    const windowBounds = resolveWindowBounds(savedBounds, workArea);

    if (
        savedBounds &&
        (windowBounds.width !== savedBounds.width || windowBounds.height !== savedBounds.height)
    ) {
        log.warn('Clamped window bounds to display', {
            saved: savedBounds,
            windowBounds,
            workArea,
        });
    }

    // Create the browser window.
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        frame: false,
        icon: isWindows() ? getAssetPath('icons/icon.ico') : getAssetPath('icons/icon.png'),
        minHeight: 120,
        minWidth: 480,
        show: false,
        webPreferences: {
            allowRunningInsecureContent: !!store.get('ignore_ssl'),
            backgroundThrottling: false,
            contextIsolation: true,
            devTools: true,
            nodeIntegration: false,
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            webSecurity: !store.get('ignore_cors'),
        },
        ...(nativeFrame && isLinux() && nativeFrameConfig.linux),
        ...(nativeFrame && isMacOS() && nativeFrameConfig.macOS),
        ...(nativeFrame && isWindows() && nativeFrameConfig.windows),
        ...DEFAULT_WINDOW_BOUNDS,
        ...windowBounds,
    });

    electronLocalShortcut.register(mainWindow, 'Ctrl+Shift+I', () => {
        mainWindow?.webContents.openDevTools();
    });

    ipcMain.on('window-dev-tools', () => {
        mainWindow?.webContents.openDevTools();
    });

    ipcMain.on('window-maximize', () => {
        mainWindow?.maximize();
    });

    ipcMain.on('window-unmaximize', () => {
        mainWindow?.unmaximize();
    });

    ipcMain.on('window-minimize', () => {
        if (store.get('window_minimize_to_tray') === true) {
            log.info('Main window minimized to tray');
            hideMainWindowToTray();
        } else {
            mainWindow?.minimize();
        }
    });

    ipcMain.on('window-close', () => {
        mainWindow?.close();
    });

    ipcMain.handle('window-mini-player-set', (_event, enabled: boolean) => {
        if (!mainWindow || miniPlayerMode === enabled) return miniPlayerMode;

        miniPlayerMode = enabled;

        if (enabled) {
            miniPlayerBounds = mainWindow.getNormalBounds();
            miniPlayerQueueVisible = false;
            const bounds = getMiniPlayerBounds(miniPlayerBounds);
            mainWindow.unmaximize();
            mainWindow.setFullScreen(false);
            mainWindow.setMinimumSize(bounds.width, bounds.height);
            mainWindow.setResizable(false);
            mainWindow.setAlwaysOnTop(true, 'floating');
            mainWindow.setAspectRatio(0);
            mainWindow.setBounds(bounds);
        } else {
            mainWindow.setAspectRatio(0);
            mainWindow.setAlwaysOnTop(false);
            mainWindow.setResizable(true);
            mainWindow.setMinimumSize(480, 120);
            if (miniPlayerBounds) mainWindow.setBounds(miniPlayerBounds);
            miniPlayerBounds = null;
        }

        mainWindow.webContents.send('window-mini-player-changed', enabled);
        return miniPlayerMode;
    });

    ipcMain.handle('window-mini-player-queue-set', (_event, visible: boolean) => {
        if (!mainWindow || !miniPlayerMode) return false;

        miniPlayerQueueVisible = visible;
        return miniPlayerQueueVisible;
    });

    ipcMain.on('window-quit', () => {
        log.info('App quitting', { reason: 'window-quit' });
        shutdownServer();
        mainWindow?.close();
        app.exit();
    });

    ipcMain.handle('window-clear-cache', async () => {
        return mainWindow?.webContents.session.clearCache();
    });

    ipcMain.on('app-restart', () => {
        // Fix for .AppImage
        if (process.env.APPIMAGE) {
            app.exit();
            app.relaunch({
                args: process.argv.slice(1).concat(['--appimage-extract-and-run']),
                execPath: process.env.APPIMAGE,
            });
            app.exit(0);
        } else {
            app.relaunch();
            app.exit(0);
        }
    });

    ipcMain.on('global-media-keys-enable', () => {
        enableMediaKeys(mainWindow);
    });

    ipcMain.on('global-media-keys-disable', () => {
        disableMediaKeys();
    });

    ipcMain.on('download-url', (_event, url: string) => {
        mainWindow?.webContents.downloadURL(url);
    });

    const globalMediaKeysEnabled = store.get('global_media_hotkeys', true) as boolean;

    if (globalMediaKeysEnabled) {
        enableMediaKeys(mainWindow);
    }

    const startWindowMinimized = store.get('window_start_minimized', false) as boolean;

    mainWindow.on('ready-to-show', () => {
        // mainWindow.show()

        if (!mainWindow) {
            throw new Error('"mainWindow" is not defined');
        }

        if (!first || !startWindowMinimized) {
            const maximized = store.get('maximized');
            const fullScreen = store.get('fullscreen');

            if (maximized) {
                mainWindow.maximize();
            }
            if (fullScreen) {
                mainWindow.setFullScreen(true);
            }

            mainWindow.show();
            createWinThumbarButtons();
        }

        log.info('Main window created', { startMinimized: startWindowMinimized && first });
    });

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        log.error('Renderer process gone', {
            exitCode: details.exitCode,
            reason: details.reason,
        });
    });

    mainWindow.webContents.on('unresponsive', () => {
        log.error('Renderer process unresponsive');
    });

    mainWindow.on('page-title-updated', (event) => {
        if (!isWindows()) return;

        event.preventDefault();
        createWinThumbarButtons();
    });

    // Mouse navigation
    mainWindow.on('app-command', (_event, command) => {
        if (
            command === 'browser-backward' &&
            mainWindow?.webContents.navigationHistory.canGoBack()
        ) {
            mainWindow.webContents.navigationHistory.goBack();
        } else if (
            command === 'browser-forward' &&
            mainWindow?.webContents.navigationHistory.canGoForward()
        ) {
            mainWindow.webContents.navigationHistory.goForward();
        }
    });

    mainWindow.on('swipe', (_event, direction) => {
        if (direction === 'right' && mainWindow?.webContents.navigationHistory.canGoForward()) {
            mainWindow.webContents.navigationHistory.goForward();
        } else if (direction === 'left' && mainWindow?.webContents.navigationHistory.canGoBack()) {
            mainWindow.webContents.navigationHistory.goBack();
        }
    });

    mainWindow.on('move', () => {
        if (!mainWindow || !miniPlayerMode) return;

        const bounds = mainWindow.getBounds();
        const clampedBounds = clampMiniPlayerPosition(bounds);
        if (clampedBounds.x === bounds.x && clampedBounds.y === bounds.y) return;

        mainWindow.setBounds(clampedBounds);
    });

    mainWindow.on('closed', () => {
        log.info('Main window closed');
        ipcMain.removeHandler('window-clear-cache');
        ipcMain.removeHandler('app-check-for-updates');
        ipcMain.removeHandler('window-mini-player-set');
        ipcMain.removeHandler('window-mini-player-queue-set');
        miniPlayerBounds = null;
        miniPlayerMode = false;
        miniPlayerQueueVisible = false;
        mainWindow = null;
    });

    if (isMacOS()) {
        mainWindow.on('show', () => {
            rebuildMainMenu();
        });

        mainWindow.on('hide', () => {
            rebuildMainMenu();
        });
    }

    mainWindow.on('close', (event) => {
        if (mainWindow) {
            const bounds = miniPlayerBounds || mainWindow.getNormalBounds();
            store.set(
                'bounds',
                clampWindowBoundsToDisplay(bounds, screen.getDisplayMatching(bounds).workArea),
            );
            store.set('maximized', mainWindow.isMaximized());
            store.set('fullscreen', mainWindow.isFullScreen());
        }

        if (!exitFromTray && store.get('window_exit_to_tray')) {
            event.preventDefault();
            log.info('Main window hidden to tray');
            hideMainWindowToTray();
        }

        if (forceQuit) {
            log.info('App quitting', { reason: 'forceQuit' });
            app.exit();
        }
    });

    mainWindow.on('minimize', () => {
        if (store.get('window_minimize_to_tray') === true) {
            log.info('Main window minimized to tray');
            setImmediate(() => {
                hideMainWindowToTray();
            });
        }
    });

    if (isWindows()) {
        app.setAppUserModelId('xyz.eajelly.desktop');
    }

    menuBuilder = new MenuBuilder(mainWindow);
    rebuildMainMenu();

    // Open URLs in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
        if (validateUrl(edata.url)) {
            shell.openExternal(edata.url);
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
        if (!canHandleVisualizerDisplayMedia()) {
            callback({});
            return;
        }

        if (!isMacOS()) {
            callback({ audio: 'loopback' });
            return;
        }

        desktopCapturer
            .getSources({ thumbnailSize: { height: 0, width: 0 }, types: ['screen'] })
            .then((sources) => {
                const source = sources[0];
                if (!source) {
                    callback({});
                    return;
                }

                callback({ audio: 'loopback', video: source });
            })
            .catch((err) => {
                log.warn('desktopCapturer.getSources failed', err);
                callback({});
            });
    });

    const theme = store.get('theme') as TitleTheme | undefined;
    nativeTheme.themeSource = theme || 'dark';

    mainWindow.webContents.setWindowOpenHandler((details) => {
        if (validateUrl(details.url)) {
            shell.openExternal(details.url);
        }
        return { action: 'deny' };
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (!disableAutoUpdates() && store.get('disable_auto_updates') !== true) {
        mainWindow.webContents.once('did-finish-load', () => new AppUpdater());
    }

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

// Only allow hardware media key handling if:
// 1. The "Enable Media Session" setting is enabled
// 2. The playback type is WEB (mpv not supported)
// 3. The platform is not Linux (because we are using mpris instead)
const enableMediaSession = store.get('mediaSession', false) as boolean;
const playbackType = store.get('playbackType', PlayerType.WEB) as PlayerType;
const shouldDisableMediaFeatures =
    isLinux() || !enableMediaSession || playbackType !== PlayerType.WEB;

const chromiumDisabledFeatures: string[] = [];
// Fractional scaling on Wayland: https://github.com/jeffvli/feishin/issues/1271#issuecomment-4063326712
if (isLinux()) {
    chromiumDisabledFeatures.push('WaylandFractionalScaleV1');
}
if (shouldDisableMediaFeatures) {
    chromiumDisabledFeatures.push('HardwareMediaKeyHandling', 'MediaSessionService');
}

if (chromiumDisabledFeatures.length > 0) {
    app.commandLine.appendSwitch('disable-features', chromiumDisabledFeatures.join(','));
}

// https://github.com/electron/electron/issues/46538#issuecomment-2808806722
app.commandLine.appendSwitch('gtk-version', '3');

// Enable garbage collection API
app.commandLine.appendSwitch('js-flags', '--expose-gc');

// Must duplicate with the one in renderer process settings.store.ts
enum BindingActions {
    GLOBAL_SEARCH = 'globalSearch',
    LOCAL_SEARCH = 'localSearch',
    MUTE = 'volumeMute',
    NEXT = 'next',
    NEXT_ALBUM = 'nextAlbum',
    PAUSE = 'pause',
    PLAY = 'play',
    PLAY_PAUSE = 'playPause',
    PREVIOUS = 'previous',
    PREVIOUS_ALBUM = 'previousAlbum',
    SHUFFLE = 'toggleShuffle',
    SKIP_BACKWARD = 'skipBackward',
    SKIP_FORWARD = 'skipForward',
    STOP = 'stop',
    TOGGLE_FULLSCREEN_PLAYER = 'toggleFullscreenPlayer',
    TOGGLE_QUEUE = 'toggleQueue',
    TOGGLE_REPEAT = 'toggleRepeat',
    VOLUME_DOWN = 'volumeDown',
    VOLUME_UP = 'volumeUp',
}

const getMenuAccelerator = (
    data: Record<BindingActions, { allowGlobal: boolean; hotkey: string; isGlobal: boolean }>,
    action: BindingActions,
) => {
    const hotkey = data[action]?.hotkey;

    if (!hotkey) return undefined;

    return hotkeyToElectronAccelerator(hotkey);
};

const HOTKEY_ACTIONS: Record<BindingActions, () => void> = {
    [BindingActions.GLOBAL_SEARCH]: () => {},
    [BindingActions.LOCAL_SEARCH]: () => {},
    [BindingActions.MUTE]: () => getMainWindow()?.webContents.send('renderer-player-volume-mute'),
    [BindingActions.NEXT]: () => getMainWindow()?.webContents.send('renderer-player-next'),
    [BindingActions.NEXT_ALBUM]: () =>
        getMainWindow()?.webContents.send('renderer-player-next-album'),
    [BindingActions.PAUSE]: () => getMainWindow()?.webContents.send('renderer-player-pause'),
    [BindingActions.PLAY]: () => getMainWindow()?.webContents.send('renderer-player-play'),
    [BindingActions.PLAY_PAUSE]: () =>
        getMainWindow()?.webContents.send('renderer-player-play-pause'),
    [BindingActions.PREVIOUS]: () => getMainWindow()?.webContents.send('renderer-player-previous'),
    [BindingActions.PREVIOUS_ALBUM]: () =>
        getMainWindow()?.webContents.send('renderer-player-previous-album'),
    [BindingActions.SHUFFLE]: () =>
        getMainWindow()?.webContents.send('renderer-player-toggle-shuffle'),
    [BindingActions.SKIP_BACKWARD]: () =>
        getMainWindow()?.webContents.send('renderer-player-skip-backward'),
    [BindingActions.SKIP_FORWARD]: () =>
        getMainWindow()?.webContents.send('renderer-player-skip-forward'),
    [BindingActions.STOP]: () => getMainWindow()?.webContents.send('renderer-player-stop'),
    [BindingActions.TOGGLE_FULLSCREEN_PLAYER]: () => {},
    [BindingActions.TOGGLE_QUEUE]: () => {},
    [BindingActions.TOGGLE_REPEAT]: () =>
        getMainWindow()?.webContents.send('renderer-player-toggle-repeat'),
    [BindingActions.VOLUME_DOWN]: () =>
        getMainWindow()?.webContents.send('renderer-player-volume-down'),
    [BindingActions.VOLUME_UP]: () =>
        getMainWindow()?.webContents.send('renderer-player-volume-up'),
};

ipcMain.on(
    'set-global-shortcuts',
    (
        _event,
        data: Record<BindingActions, { allowGlobal: boolean; hotkey: string; isGlobal: boolean }>,
    ) => {
        // Since we're not tracking the previous shortcuts, we need to unregister all of them
        globalShortcut.unregisterAll();

        for (const shortcut of Object.keys(data)) {
            const isGlobalHotkey = data[shortcut as BindingActions].isGlobal;
            const isValidHotkey =
                data[shortcut as BindingActions].hotkey &&
                data[shortcut as BindingActions].hotkey !== '';

            if (isGlobalHotkey && isValidHotkey) {
                const accelerator = hotkeyToElectronAccelerator(
                    data[shortcut as BindingActions].hotkey,
                );

                globalShortcut.register(accelerator, () => {
                    HOTKEY_ACTIONS[shortcut as BindingActions]();
                });
            }
        }

        playbackMenuAccelerators = {
            globalSearch: getMenuAccelerator(data, BindingActions.GLOBAL_SEARCH),
            next: getMenuAccelerator(data, BindingActions.NEXT),
            pause: getMenuAccelerator(data, BindingActions.PAUSE),
            play: getMenuAccelerator(data, BindingActions.PLAY),
            playPause: getMenuAccelerator(data, BindingActions.PLAY_PAUSE),
            previous: getMenuAccelerator(data, BindingActions.PREVIOUS),
            repeat: getMenuAccelerator(data, BindingActions.TOGGLE_REPEAT),
            seekBackward: getMenuAccelerator(data, BindingActions.SKIP_BACKWARD),
            seekForward: getMenuAccelerator(data, BindingActions.SKIP_FORWARD),
            shuffle: getMenuAccelerator(data, BindingActions.SHUFFLE),
            stop: getMenuAccelerator(data, BindingActions.STOP),
            volumeDown: getMenuAccelerator(data, BindingActions.VOLUME_DOWN),
            volumeUp: getMenuAccelerator(data, BindingActions.VOLUME_UP),
        };

        if (isMacOS()) {
            rebuildMainMenu();
        }

        const globalMediaKeysEnabled = store.get('global_media_hotkeys', true) as boolean;

        if (globalMediaKeysEnabled) {
            enableMediaKeys(mainWindow);
        }
    },
);

ipcMain.handle('power-save-blocker-start', (_event, { full }: { full: boolean }) => {
    if (powerSaveBlockerId !== null) {
        return powerSaveBlockerId;
    }

    powerSaveBlockerId = powerSaveBlocker.start(
        full ? 'prevent-display-sleep' : 'prevent-app-suspension',
    );
    return powerSaveBlockerId;
});

ipcMain.handle('power-save-blocker-stop', () => {
    if (powerSaveBlockerId !== null) {
        const stopped = powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
        return stopped;
    }
    return false;
});

ipcMain.handle('power-save-blocker-is-started', () => {
    return powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId);
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (isMacOS()) {
        mainWindow = null;
    } else {
        app.quit();
    }
});

const FONT_HEADERS = new Set([
    'font/collection',
    'font/otf',
    'font/sfnt',
    'font/ttf',
    'font/woff',
    'font/woff2',
]);

const bytesToInt = (array: Uint8Array, length: number): number => {
    let value = 0;
    for (let i = 0; i < length; i++) {
        value = (value << 8) + array[i];
    }

    return value;
};

const FONT_FOUR_BYTE_MAGIC_NUMBERS = new Set([
    0x4f54544f, // font/otf
    0x774f4632, // font/woff2
    0x774f4646, // font/woff
]);

const FONT_FIVE_BYTE_MAGIC_NUMBERS = new Set([
    0x0001000000, // ttf, collection, sfnt
]);

const singleInstance = isDevelopment ? true : app.requestSingleInstanceLock();

if (!singleInstance) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            showMainWindow();
        }
    });

    app.whenReady()
        .then(() => {
            log.info('App ready', {
                arch: process.arch,
                electron: process.versions.electron,
                ignoreCors: !!store.get('ignore_cors'),
                ignoreSsl: !!store.get('ignore_ssl'),
                platform: process.platform,
                version: packageJson.version,
            });

            protocol.handle('feishin', async () => {
                const filePath = store.get('local_font_path');
                if (typeof filePath !== 'string') {
                    getMainWindow()?.webContents.send('custom-font-error', filePath);

                    return new Response(null, {
                        status: 403,
                        statusText: 'Forbidden',
                    });
                }

                const response = await net.fetch('file:' + filePath);
                const contentType = response.headers.get('content-type');

                // On Linux, the mime type is included in the response header
                // In this case, we can forward the response with no further processing
                if (contentType && FONT_HEADERS.has(contentType)) {
                    return response;
                }

                // Otherwise, let's check the magic number to see if
                // the file is a font type. This is either four or five bytes
                const payload = await response.arrayBuffer();
                const magicNumber = new Uint8Array(payload.slice(0, 5));
                const fiveHex = bytesToInt(magicNumber, 5);
                const fourHex = bytesToInt(magicNumber, 4);

                if (
                    FONT_FIVE_BYTE_MAGIC_NUMBERS.has(fiveHex) ||
                    FONT_FOUR_BYTE_MAGIC_NUMBERS.has(fourHex)
                ) {
                    // We have to create a new response with the payload, since it has been read now
                    return new Response(payload, {
                        headers: response.headers,
                    });
                }

                getMainWindow()?.webContents.send('custom-font-error', filePath);

                return new Response(null, {
                    status: 403,
                    statusText: 'Forbidden',
                });
            });

            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        ...details.responseHeaders,
                        'Content-Security-Policy': [
                            "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' https://umami.jeffvli.org; style-src 'self' 'unsafe-inline'; media-src 'self' http: https: data: blob:; img-src 'self' http: https: data: blob:; connect-src 'self' http: https: ws: wss:; default-src 'self';",
                        ],
                    },
                });
            });

            createWindow();
            if (store.get('window_enable_tray', true)) {
                createTray();
            }
            app.on('activate', () => {
                // On macOS it's common to re-create a window in the app when the
                // dock icon is clicked and there are no other windows open.
                if (mainWindow === null) createWindow(false);
                else if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
                    showMainWindow();
                }
            });
        })
        .catch((error) => log.error(error));
}

// Register 'open-item' handler globally, ensuring it is only registered once
if (!ipcMain.eventNames().includes('open-item')) {
    ipcMain.handle('open-item', async (_event, path: string) => {
        return new Promise<void>((resolve, reject) => {
            access(path, constants.F_OK, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                shell.showItemInFolder(path);
                resolve();
            });
        });
    });
}

// Register 'open-application-directory' handler globally, ensuring it is only registered once
if (!ipcMain.eventNames().includes('open-application-directory')) {
    ipcMain.handle('open-application-directory', async () => {
        const userDataPath = app.getPath('userData');
        shell.openPath(userDataPath);
    });
}

ipcMain.on('update-playback', (_event, status: PlayerStatus) => {
    currentPlaybackStatus = status;

    if (isWindows()) createWinThumbarButtons();
    if (isMacOS()) updateMainMenu();
});

ipcMain.on('update-taskbar-preview', (_event, metadata?: { artist?: string; title?: string }) => {
    currentTaskbarArtist = typeof metadata?.artist === 'string' ? metadata.artist : '';
    currentTaskbarTrack = typeof metadata?.title === 'string' ? metadata.title : '';

    if (isWindows()) createWinThumbarButtons();
});

ipcMain.on('update-repeat', (_event, repeat: PlayerRepeat) => {
    currentRepeatMode = repeat;

    if (!isMacOS()) return;

    updateMainMenu();
});

ipcMain.on('update-shuffle', (_event, shuffle: boolean) => {
    currentShuffleEnabled = shuffle;

    if (!isMacOS()) return;

    updateMainMenu();
});

ipcMain.on('update-private-mode', (_event, privateMode: boolean) => {
    currentPrivateMode = privateMode;

    if (!isMacOS()) return;

    updateMainMenu();
});

ipcMain.on('update-sidebar-collapsed', (_event, collapsedSidebar: boolean) => {
    currentSidebarCollapsed = collapsedSidebar;

    if (!isMacOS()) return;

    updateMainMenu();
});
