'use strict';

const ENTRIES_KEY = 'vocabufyEntries';
const SETTINGS_KEY = 'vocabufySettings';
const MENU_ID = 'vocabufy-add-selection';
const MAX_TERM_LENGTH = 120;

const DEFAULT_SETTINGS = Object.freeze({
  floatingButton: true,
  contextMenu: true,
  notifications: true
});

let mutationQueue = Promise.resolve();

function enqueueMutation(operation) {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.catch(() => undefined);
  return result;
}

function compactText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanTerm(value) {
  let term = compactText(value, MAX_TERM_LENGTH + 40);
  term = term.replace(/^[\s"“”'‘’()[\]{}<>.,!?;:…—–\-]+|[\s"“”'‘’()[\]{}<>.,!?;:…—–\-]+$/gu, '');
  return Array.from(term).slice(0, MAX_TERM_LENGTH).join('').trim();
}

function normalizeTerm(value) {
  return cleanTerm(value).normalize('NFKC').toLocaleLowerCase();
}

function safeUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href.slice(0, 2048) : '';
  } catch {
    return '';
  }
}

function makeId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function getEntries() {
  const result = await chrome.storage.local.get(ENTRIES_KEY);
  return Array.isArray(result[ENTRIES_KEY]) ? result[ENTRIES_KEY] : [];
}

async function setEntries(entries) {
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
}

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

function buildSource(data, now) {
  const url = safeUrl(data.sourceUrl);
  if (!url) return null;
  return {
    url,
    title: compactText(data.sourceTitle, 180) || url,
    savedAt: now
  };
}

function createEntry(data, now = new Date().toISOString()) {
  const term = cleanTerm(data.term);
  if (!term) throw new Error('Please select or enter a valid word.');
  const source = buildSource(data, now);
  return {
    id: makeId(),
    term,
    normalizedTerm: normalizeTerm(term),
    definition: compactText(data.definition, 1000),
    note: compactText(data.note, 1000),
    context: compactText(data.context, 600),
    sourceTitle: source?.title || '',
    sourceUrl: source?.url || '',
    sources: source ? [source] : [],
    favorite: Boolean(data.favorite),
    saveCount: 1,
    createdAt: now,
    lastSeenAt: now
  };
}

async function addEntry(data) {
  const term = cleanTerm(data?.term);
  if (!term) throw new Error('Please select or enter a valid word.');
  const normalized = normalizeTerm(term);
  const now = new Date().toISOString();
  const entries = await getEntries();
  const existingIndex = entries.findIndex((entry) => normalizeTerm(entry.term) === normalized);

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    const source = buildSource(data || {}, now);
    const sources = Array.isArray(existing.sources) ? [...existing.sources] : [];
    if (source) {
      const priorIndex = sources.findIndex((item) => item.url === source.url);
      if (priorIndex >= 0) sources.splice(priorIndex, 1);
      sources.unshift(source);
    }
    const updated = {
      ...existing,
      normalizedTerm: normalized,
      context: compactText(data.context, 600) || existing.context || '',
      sourceTitle: source?.title || existing.sourceTitle || '',
      sourceUrl: source?.url || existing.sourceUrl || '',
      sources: sources.slice(0, 20),
      saveCount: Math.max(1, Number(existing.saveCount) || 1) + 1,
      lastSeenAt: now
    };
    entries[existingIndex] = updated;
    await setEntries(entries);
    return { status: 'updated', entry: updated };
  }

  const entry = createEntry({ ...data, term }, now);
  entries.unshift(entry);
  await setEntries(entries);
  return { status: 'added', entry };
}

async function updateEntry(id, changes) {
  const entries = await getEntries();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error('That vocabulary item no longer exists.');

  const current = entries[index];
  const nextTerm = Object.prototype.hasOwnProperty.call(changes, 'term') ? cleanTerm(changes.term) : current.term;
  if (!nextTerm) throw new Error('A vocabulary item must have a word or phrase.');
  const nextNormalized = normalizeTerm(nextTerm);
  const conflict = entries.some((entry, entryIndex) => entryIndex !== index && normalizeTerm(entry.term) === nextNormalized);
  if (conflict) throw new Error('That word is already in your vocabulary.');

  const updated = {
    ...current,
    term: nextTerm,
    normalizedTerm: nextNormalized,
    definition: Object.prototype.hasOwnProperty.call(changes, 'definition') ? compactText(changes.definition, 1000) : current.definition || '',
    note: Object.prototype.hasOwnProperty.call(changes, 'note') ? compactText(changes.note, 1000) : current.note || '',
    context: Object.prototype.hasOwnProperty.call(changes, 'context') ? compactText(changes.context, 600) : current.context || '',
    favorite: Object.prototype.hasOwnProperty.call(changes, 'favorite') ? Boolean(changes.favorite) : Boolean(current.favorite)
  };
  entries[index] = updated;
  await setEntries(entries);
  return updated;
}

async function deleteEntry(id) {
  const entries = await getEntries();
  const filtered = entries.filter((entry) => entry.id !== id);
  if (filtered.length === entries.length) return false;
  await setEntries(filtered);
  return true;
}

function normalizeImportedEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  try {
    const created = createEntry(raw, raw.createdAt && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString());
    const lastSeenAt = raw.lastSeenAt && !Number.isNaN(Date.parse(raw.lastSeenAt)) ? raw.lastSeenAt : created.createdAt;
    const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
    const sources = rawSources.map((item) => {
      const url = safeUrl(item?.url);
      if (!url) return null;
      return {
        url,
        title: compactText(item.title, 180) || url,
        savedAt: item.savedAt && !Number.isNaN(Date.parse(item.savedAt)) ? item.savedAt : lastSeenAt
      };
    }).filter(Boolean).slice(0, 20);
    return {
      ...created,
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 160) : created.id,
      favorite: Boolean(raw.favorite),
      saveCount: Math.max(1, Math.floor(Number(raw.saveCount) || 1)),
      lastSeenAt,
      sources: sources.length ? sources : created.sources
    };
  } catch {
    return null;
  }
}

async function importEntries(rawEntries, mode) {
  if (!Array.isArray(rawEntries)) throw new Error('The selected file does not contain a valid vocabulary list.');
  const imported = rawEntries.map(normalizeImportedEntry).filter(Boolean);
  if (!imported.length && rawEntries.length) throw new Error('No valid vocabulary items were found in this file.');
  const current = mode === 'replace' ? [] : await getEntries();
  const byTerm = new Map(current.map((entry) => [normalizeTerm(entry.term), entry]));

  for (const entry of imported) {
    const key = normalizeTerm(entry.term);
    const existing = byTerm.get(key);
    if (!existing) {
      byTerm.set(key, entry);
      continue;
    }
    const sources = [...(entry.sources || []), ...(existing.sources || [])];
    const uniqueSources = sources.filter((source, index, list) => list.findIndex((item) => item.url === source.url) === index).slice(0, 20);
    byTerm.set(key, {
      ...existing,
      definition: existing.definition || entry.definition,
      note: existing.note || entry.note,
      context: existing.context || entry.context,
      favorite: existing.favorite || entry.favorite,
      saveCount: Math.max(existing.saveCount || 1, entry.saveCount || 1),
      sources: uniqueSources,
      lastSeenAt: new Date(Math.max(Date.parse(existing.lastSeenAt) || 0, Date.parse(entry.lastSeenAt) || 0)).toISOString()
    });
  }

  const usedIds = new Set();
  const merged = Array.from(byTerm.values()).map((entry) => {
    let id = entry.id;
    if (!id || usedIds.has(id)) id = makeId();
    usedIds.add(id);
    return id === entry.id ? entry : { ...entry, id };
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  await setEntries(merged);
  return { imported: imported.length, total: merged.length };
}

async function refreshContextMenu() {
  const settings = await getSettings();
  await new Promise((resolve) => chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    resolve();
  }));
  if (!settings.contextMenu) return;
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Add to my vocab',
    contexts: ['selection']
  }, () => void chrome.runtime.lastError);
}

chrome.runtime.onInstalled.addListener(() => {
  void refreshContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  void enqueueMutation(() => addEntry({
    term: info.selectionText,
    context: '',
    sourceTitle: tab?.title || '',
    sourceUrl: tab?.url || info.pageUrl || ''
  })).then((result) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'vocabufy:save-result', result }, () => void chrome.runtime.lastError);
  }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handle = async () => {
    switch (message?.type) {
      case 'vocabufy:add':
        return enqueueMutation(() => addEntry(message.data || {}));
      case 'vocabufy:list':
        return { entries: await getEntries() };
      case 'vocabufy:update':
        return { entry: await enqueueMutation(() => updateEntry(message.id, message.changes || {})) };
      case 'vocabufy:delete':
        return { deleted: await enqueueMutation(() => deleteEntry(message.id)) };
      case 'vocabufy:clear':
        await enqueueMutation(() => setEntries([]));
        return { cleared: true };
      case 'vocabufy:import':
        return enqueueMutation(() => importEntries(message.entries, message.mode));
      case 'vocabufy:get-settings':
        return { settings: await getSettings() };
      case 'vocabufy:update-settings': {
        const current = await getSettings();
        const settings = { ...current };
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          if (Object.prototype.hasOwnProperty.call(message.settings || {}, key)) settings[key] = Boolean(message.settings[key]);
        }
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        await refreshContextMenu();
        return { settings };
      }
      default:
        throw new Error('Unknown Vocabufy request.');
    }
  };

  void handle()
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || 'Something went wrong.' }));
  return true;
});
