import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)],
  );
}

test('the service worker precaches every app file, so the app works offline', () => {
  const src = readFileSync(join(root, 'sw.js'), 'utf8');
  const shell = [...src.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);
  const expected = [...files('js'), ...files('css'), ...files('icons'), 'index.html', 'manifest.webmanifest'];
  for (const f of expected) assert.ok(shell.includes(f), `sw.js SHELL is missing ${f}`);
});
