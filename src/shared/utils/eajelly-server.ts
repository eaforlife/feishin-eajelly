export const EAJELLY_SERVER_URL = 'https://eajelly.xyz';

export const getEajellyHttpFallbackUrl = (url: string | undefined): string | undefined =>
    url === EAJELLY_SERVER_URL ? 'http://eajelly.xyz' : undefined;
