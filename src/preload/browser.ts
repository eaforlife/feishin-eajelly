import { ipcRenderer, type IpcRendererEvent } from 'electron';

const exit = () => {
    ipcRenderer.send('window-close');
};

const maximize = () => {
    ipcRenderer.send('window-maximize');
};

const minimize = () => {
    ipcRenderer.send('window-minimize');
};

const unmaximize = () => {
    ipcRenderer.send('window-unmaximize');
};

const quit = () => {
    ipcRenderer.send('window-quit');
};

const devtools = () => {
    ipcRenderer.send('window-dev-tools');
};

const clearCache = (): Promise<void> => {
    return ipcRenderer.invoke('window-clear-cache');
};

const setMiniPlayerMode = (enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('window-mini-player-set', enabled);
};

const setMiniPlayerQueueVisible = (visible: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('window-mini-player-queue-set', visible);
};

const miniPlayerModeListener = (cb: (enabled: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, enabled: boolean) => cb(enabled);
    ipcRenderer.on('window-mini-player-changed', listener);

    return () => {
        ipcRenderer.removeListener('window-mini-player-changed', listener);
    };
};

export const browser = {
    clearCache,
    devtools,
    exit,
    maximize,
    minimize,
    miniPlayerModeListener,
    quit,
    setMiniPlayerMode,
    setMiniPlayerQueueVisible,
    unmaximize,
};

export type Browser = typeof browser;
