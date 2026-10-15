import { describe, expect, it } from 'vitest';
import { globToRegExp, matchesAnyGlob } from '../src/util.js';

describe('globToRegExp', () => {
  it('matches literal paths', () => {
    expect(globToRegExp('a/b.json').test('a/b.json')).toBe(true);
    expect(globToRegExp('a/b.json').test('a/x.json')).toBe(false);
  });

  it('* does not cross directories', () => {
    expect(globToRegExp('src/*.ts').test('src/a.ts')).toBe(true);
    expect(globToRegExp('src/*.ts').test('src/nested/a.ts')).toBe(false);
  });

  it('** crosses directories', () => {
    expect(globToRegExp('test/**').test('test/a/b/c.md')).toBe(true);
  });
});

describe('matchesAnyGlob', () => {
  it('matches the file itself', () => {
    expect(matchesAnyGlob('settings.json', ['settings.json'])).toBe(true);
  });

  it('matches everything under a directory glob', () => {
    expect(matchesAnyGlob('test/fixtures/a/b.json', ['test/fixtures/**'])).toBe(true);
  });

  it('treats a bare directory as an ancestor match', () => {
    expect(matchesAnyGlob('test/fixtures/a.json', ['test/fixtures'])).toBe(true);
    expect(matchesAnyGlob('test/fixturesX/a.json', ['test/fixtures'])).toBe(false);
  });

  it('returns false when nothing matches', () => {
    expect(matchesAnyGlob('src/cli.ts', ['test/**', 'dist/**'])).toBe(false);
  });
});
