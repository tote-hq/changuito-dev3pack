import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_LANG, LANGS, langFrom, langFromCookieHeader } from '../lang.ts';

describe('default language', () => {
  it('is English, and English is listed before Spanish', () => {
    assert.equal(DEFAULT_LANG, 'en');
    assert.deepEqual(LANGS, ['en', 'es']);
  });

  it('keeps a Spanish cookie and treats anything else as English', () => {
    assert.equal(langFrom('es'), 'es');
    assert.equal(langFrom('en'), 'en');
    assert.equal(langFrom(undefined), 'en');
    assert.equal(langFrom('fr'), 'en');
    assert.equal(langFrom(''), 'en');
    assert.equal(langFromCookieHeader(null), 'en');
    assert.equal(langFromCookieHeader('chg_lang=es'), 'es');
    assert.equal(langFromCookieHeader('chg_lang=nope'), 'en');
  });
});
