'use strict';

(function initializeVocabufySelectionButton() {
  if (window.__vocabufySelectionButtonLoaded) return;
  window.__vocabufySelectionButtonLoaded = true;

  let pendingSelection = null;
  let settings = { floatingButton: true, notifications: true };
  let toastTimer = null;

  const host = document.createElement('div');
  host.id = 'vocabufy-selection-root';
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('left', '0', 'important');
  host.style.setProperty('top', '0', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .add-button {
      align-items: center; background: #14213d; border: 1px solid rgba(255,255,255,.18);
      border-radius: 12px; box-shadow: 0 12px 30px rgba(15,23,42,.28); color: #fff;
      cursor: pointer; display: none; font: 600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      gap: 7px; left: 12px; padding: 10px 13px; position: fixed; top: 12px; white-space: nowrap;
      transition: transform .12s ease, background .12s ease; z-index: 2147483647;
    }
    .add-button:hover { background: #1f3260; transform: translateY(-1px); }
    .add-button:focus-visible { outline: 3px solid rgba(45,212,191,.45); outline-offset: 2px; }
    .add-button[disabled] { cursor: wait; opacity: .72; transform: none; }
    .add-button.visible { display: inline-flex; animation: pop .14s ease-out; }
    .plus { align-items:center; background:#2dd4bf; border-radius:50%; color:#0f172a; display:inline-flex;
      font: 800 16px/18px sans-serif; height:18px; justify-content:center; width:18px; }
    .toast { align-items:center; background:#0f172a; border:1px solid rgba(255,255,255,.12); border-radius:12px;
      bottom:24px; box-shadow:0 14px 40px rgba(15,23,42,.3); color:#fff; display:none;
      font:600 13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; gap:8px; left:50%;
      max-width:min(360px,calc(100vw - 32px)); padding:11px 14px; position:fixed; transform:translateX(-50%);
      z-index:2147483647; }
    .toast.visible { display:flex; animation: rise .18s ease-out; }
    .toast.error { background:#7f1d1d; }
    .dot { background:#2dd4bf; border-radius:50%; flex:0 0 8px; height:8px; width:8px; }
    .toast.error .dot { background:#fecaca; }
    @keyframes pop { from { opacity:0; transform:scale(.94) translateY(3px); } }
    @keyframes rise { from { opacity:0; transform:translate(-50%,6px); } }
    @media (prefers-reduced-motion: reduce) { .add-button,.toast { animation:none!important; transition:none!important; } }
  `;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'add-button';
  button.setAttribute('aria-label', 'Add selected text to my vocabulary');
  const plus = document.createElement('span');
  plus.className = 'plus';
  plus.textContent = '+';
  const buttonText = document.createElement('span');
  buttonText.textContent = 'Add to my vocab';
  button.append(plus, buttonText);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const toastDot = document.createElement('span');
  toastDot.className = 'dot';
  const toastText = document.createElement('span');
  toast.append(toastDot, toastText);

  shadow.append(style, button, toast);
  (document.documentElement || document.body).appendChild(host);

  function compact(value, max = 600) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function getContext(selection, range) {
    const selected = compact(selection.toString(), 120);
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE && range.startContainer === range.endContainer) {
      const text = container.textContent || '';
      const start = Math.max(0, range.startOffset - 150);
      const end = Math.min(text.length, range.endOffset + 150);
      return compact(`${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`);
    }
    if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
    const text = compact(container?.textContent || '', 2000);
    const index = text.toLocaleLowerCase().indexOf(selected.toLocaleLowerCase());
    if (index < 0) return compact(text, 360);
    const start = Math.max(0, index - 150);
    const end = Math.min(text.length, index + selected.length + 150);
    return compact(`${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`);
  }

  function hideButton() {
    button.classList.remove('visible');
    button.disabled = false;
  }

  function showToast(message, isError = false) {
    if (!settings.notifications && !isError) return;
    window.clearTimeout(toastTimer);
    toastText.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  function positionButton(rect) {
    button.classList.add('visible');
    const margin = 10;
    const width = button.offsetWidth || 148;
    const height = button.offsetHeight || 38;
    let left = rect.left + (rect.width / 2) - (width / 2);
    let top = rect.bottom + 9;
    left = Math.min(window.innerWidth - width - margin, Math.max(margin, left));
    if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - 9);
    button.style.left = `${Math.round(left)}px`;
    button.style.top = `${Math.round(top)}px`;
  }

  function inspectSelection() {
    if (!settings.floatingButton) {
      hideButton();
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      hideButton();
      return;
    }
    const term = compact(selection.toString(), 160);
    if (!term || Array.from(term).length > 120) {
      hideButton();
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      hideButton();
      return;
    }
    pendingSelection = {
      term,
      context: getContext(selection, range),
      sourceTitle: document.title,
      sourceUrl: location.href
    };
    positionButton(rect);
  }

  function sendAddRequest(data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'vocabufy:add', data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || 'Could not save this word.'));
          return;
        }
        resolve(response);
      });
    });
  }

  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pendingSelection || button.disabled) return;
    button.disabled = true;
    const savedSelection = { ...pendingSelection };
    try {
      const response = await sendAddRequest(savedSelection);
      hideButton();
      showToast(response.status === 'updated'
        ? `“${response.entry.term}” was already saved — encounter updated.`
        : `“${response.entry.term}” added to your vocabulary.`);
    } catch (error) {
      button.disabled = false;
      showToast(error.message || 'Could not save this word.', true);
    }
  });

  document.addEventListener('pointerup', (event) => {
    if (event.target === host) return;
    window.setTimeout(inspectSelection, 0);
  }, true);

  document.addEventListener('keyup', (event) => {
    if (event.key.startsWith('Arrow') || event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta') {
      window.setTimeout(inspectSelection, 0);
    }
  }, true);

  document.addEventListener('pointerdown', (event) => {
    if (event.target !== host) hideButton();
  }, true);

  window.addEventListener('scroll', hideButton, true);
  window.addEventListener('resize', hideButton);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'vocabufy:save-result') return;
    const result = message.result;
    showToast(result?.status === 'updated'
      ? `“${result.entry.term}” was already saved — encounter updated.`
      : `“${result?.entry?.term || 'Selection'}” added to your vocabulary.`);
  });

  chrome.storage.local.get('vocabufySettings', (result) => {
    if (chrome.runtime.lastError) return;
    settings = { ...settings, ...(result.vocabufySettings || {}) };
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.vocabufySettings) return;
    settings = { ...settings, ...(changes.vocabufySettings.newValue || {}) };
    if (!settings.floatingButton) hideButton();
  });
})();
