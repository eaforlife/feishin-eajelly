import assert from 'node:assert/strict';

import {
    EAJELLY_SERVER_URL,
    getEajellyHttpFallbackUrl,
} from '../src/shared/utils/eajelly-server.ts';

assert.equal(getEajellyHttpFallbackUrl(EAJELLY_SERVER_URL), 'http://eajelly.xyz');
assert.equal(getEajellyHttpFallbackUrl('https://example.com'), undefined);
