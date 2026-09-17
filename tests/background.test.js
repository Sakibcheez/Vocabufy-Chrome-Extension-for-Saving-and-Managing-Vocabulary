'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

const extensionRoot = path.resolve(__dirname, '..');
const storage = {};
const listeners = {};
const menus = new Map();

const chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: storage[key] };
        return { ...storage };
      },
      async set(values) {
        Object.assign(storage, values);
      }
    }
  },
  contextMenus: {
    removeAll(callback) {
      menus.clear();
      callback();
    },
    create(details, callback) {
      menus.set(details.id, details);
      callback?.();
    },
    onClicked: { addListener(listener) { listeners.contextClick = listener; } }
  },
  runtime: {
    lastError: null,
    onInstalled: { addListener(listener) { listeners.installed = listener; } },
    onStartup: { addListener(listener) { listeners.startup = listener; } },
    onMessage: { addListener(listener) { listeners.message = listener; } }
  },
  tabs: { sendMessage(_id, _message, callback) { callback?.(); } }
};

const context = vm.createContext({
  chrome,
  console,
  crypto: { randomUUID },
  Date,
  Math,
  Promise,
  URL
});

vm.runInContext(fs.readFileSync(path.join(extensionRoot, 'background.js'), 'utf8'), context, { filename: 'background.js' });

function message(type, payload = {}) {
  return new Promise((resolve) => {
    const keepChannelOpen = listeners.message({ type, ...payload }, {}, resolve);
    assert.equal(keepChannelOpen, true);
  });
}

(async () => {
  listeners.installed();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(menus.get('vocabufy-add-selection').title, 'Add to my vocab');

  const first = await message('vocabufy:add', {
    data: {
      term: '  “Serendipity!”  ',
      context: 'We found it by pure serendipity.',
      sourceTitle: 'Example Page',
      sourceUrl: 'https://example.com/article'
    }
  });
  assert.equal(first.ok, true);
  assert.equal(first.status, 'added');
  assert.equal(first.entry.term, 'Serendipity');
  assert.equal(first.entry.saveCount, 1);
  assert.equal(first.entry.sources.length, 1);

  const duplicate = await message('vocabufy:add', {
    data: {
      term: 'serendipity',
      context: 'A second encounter.',
      sourceTitle: 'Another Page',
      sourceUrl: 'https://example.org/two'
    }
  });
  assert.equal(duplicate.status, 'updated');
  assert.equal(duplicate.entry.saveCount, 2);
  assert.equal(duplicate.entry.context, 'A second encounter.');
  assert.equal(duplicate.entry.sources.length, 2);

  const second = await message('vocabufy:add', { data: { term: 'Ephemeral' } });
  assert.equal(second.status, 'added');
  let list = await message('vocabufy:list');
  assert.equal(list.entries.length, 2);

  const updated = await message('vocabufy:update', {
    id: first.entry.id,
    changes: { definition: 'A fortunate discovery by chance.', favorite: true }
  });
  assert.equal(updated.entry.favorite, true);
  assert.match(updated.entry.definition, /fortunate discovery/);

  const conflict = await message('vocabufy:update', { id: second.entry.id, changes: { term: 'SERENDIPITY' } });
  assert.equal(conflict.ok, false);
  assert.match(conflict.error, /already/);

  const settings = await message('vocabufy:update-settings', { settings: { contextMenu: false } });
  assert.equal(settings.settings.contextMenu, false);
  assert.equal(menus.size, 0);

  const imported = await message('vocabufy:import', {
    mode: 'merge',
    entries: [
      { term: 'Ephemeral', note: 'Short-lived', favorite: true },
      { term: 'Ubiquitous', definition: 'Present everywhere' }
    ]
  });
  assert.equal(imported.ok, true);
  assert.equal(imported.imported, 2);
  assert.equal(imported.total, 3);

  list = await message('vocabufy:list');
  assert.equal(new Set(list.entries.map((entry) => entry.id)).size, list.entries.length);
  assert.equal(list.entries.find((entry) => entry.term === 'Ephemeral').favorite, true);

  const deleted = await message('vocabufy:delete', { id: second.entry.id });
  assert.equal(deleted.deleted, true);
  const cleared = await message('vocabufy:clear');
  assert.equal(cleared.cleared, true);
  list = await message('vocabufy:list');
  assert.equal(list.entries.length, 0);

  console.log('background tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
