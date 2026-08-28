import isElectron from 'is-electron';

export const getServerConfig = () => {
    const env = isElectron() ? window.api.localSettings.env : window;

    return {
        legacyAuth: env.LEGACY_AUTHENTICATION === true || env.LEGACY_AUTHENTICATION === 'true',
        lock: env.SERVER_LOCK === true || env.SERVER_LOCK === 'true',
        name: env.SERVER_NAME || '',
        remoteUrl: env.REMOTE_URL || '',
        type: env.SERVER_TYPE,
        url: env.SERVER_URL || '',
    };
};

export const isLegacyAuth = () => getServerConfig().legacyAuth;

export const isServerLock = () => getServerConfig().lock;
