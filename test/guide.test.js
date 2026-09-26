import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES } from '../js/views/guide.js';

const shape = (g) => ({
  sections: g.sections.map((s) => ({ ordered: !!s.ordered, items: s.items.map((i) => typeof i), after: !!s.after })),
  examples: g.examples.map((e) => Object.keys(e).filter((k) => e[k])),
});

test('every guide translation has the same structure as the English one', () => {
  for (const [code, g] of Object.entries(GUIDES)) {
    assert.deepEqual(shape(g), shape(GUIDES.en), `guide ${code}`);
  }
});
