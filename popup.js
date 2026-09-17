'use strict';

(function initializePopup() {
  const api = window.VocabufyAPI;
  const elements = {
    wordCount: document.getElementById('wordCount'),
    resultCount: document.getElementById('resultCount'),
    quickTerm: document.getElementById('quickTerm'),
    quickAddButton: document.getElementById('quickAddButton'),
    searchInput: document.getElementById('searchInput'),
    wordList: document.getElementById('wordList'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyMessage: document.getElementById('emptyMessage'),
    status: document.getElementById('status'),
    openManager: document.getElementById('openManager'),
    viewAll: document.getElementById('viewAll')
  };

  let entries = [];
  let statusTimer = null;

  function showStatus(message, error = false) {
    window.clearTimeout(statusTimer);
    elements.status.textContent = message;
    elements.status.classList.toggle('error', error);
    elements.status.classList.add('visible');
    statusTimer = window.setTimeout(() => elements.status.classList.remove('visible'), 2200);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }

  function makeButton(label, className, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = text;
    return button;
  }

  function createWordCard(entry) {
    const card = document.createElement('article');
    card.className = 'word-card';
    card.dataset.id = entry.id;

    const main = document.createElement('div');
    main.className = 'word-main';
    const titleRow = document.createElement('div');
    titleRow.className = 'word-title-row';
    const title = document.createElement('span');
    title.className = 'word-title';
    title.textContent = entry.term;
    titleRow.appendChild(title);
    if ((entry.saveCount || 1) > 1) {
      const count = document.createElement('span');
      count.className = 'encounter';
      count.textContent = `×${entry.saveCount}`;
      count.title = `Saved ${entry.saveCount} times`;
      titleRow.appendChild(count);
    }
    main.appendChild(titleRow);

    const detailText = entry.definition || entry.note || entry.context;
    if (detailText) {
      const context = document.createElement('p');
      context.className = 'word-context';
      context.textContent = detailText;
      main.appendChild(context);
    }

    const meta = document.createElement('div');
    meta.className = 'word-meta';
    const date = document.createElement('span');
    date.textContent = formatDate(entry.createdAt);
    meta.appendChild(date);
    if (entry.sourceUrl) {
      const separator = document.createElement('span');
      separator.textContent = '•';
      const link = document.createElement('a');
      link.href = entry.sourceUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = entry.sourceTitle || new URL(entry.sourceUrl).hostname;
      link.title = entry.sourceUrl;
      meta.append(separator, link);
    }
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const favorite = makeButton(entry.favorite ? 'Remove from favorites' : 'Add to favorites', `mini-button favorite-button${entry.favorite ? ' favorite' : ''}`, entry.favorite ? '★' : '☆');
    const remove = makeButton(`Delete ${entry.term}`, 'mini-button delete', '×');
    actions.append(favorite, remove);
    card.append(main, actions);
    return card;
  }

  function render() {
    const query = elements.searchInput.value.trim().toLocaleLowerCase();
    const filtered = entries.filter((entry) => [entry.term, entry.definition, entry.note, entry.context, entry.sourceTitle]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query)));
    elements.wordCount.textContent = String(entries.length);
    elements.resultCount.textContent = query ? `${filtered.length} found` : `${entries.length} total`;
    elements.wordList.replaceChildren(...filtered.slice(0, 12).map(createWordCard));
    elements.emptyState.hidden = filtered.length > 0;
    elements.wordList.hidden = filtered.length === 0;
    elements.emptyTitle.textContent = entries.length ? 'No matching words' : 'Start your vocabulary';
    elements.emptyMessage.textContent = entries.length
      ? 'Try a different search term.'
      : 'Select a word on any webpage and choose “Add to my vocab.”';
  }

  async function loadEntries() {
    try {
      const response = await api.list();
      entries = response.entries || [];
      render();
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function quickAdd() {
    const term = elements.quickTerm.value.trim();
    if (!term) {
      elements.quickTerm.focus();
      return;
    }
    elements.quickAddButton.disabled = true;
    try {
      const response = await api.add({ term });
      elements.quickTerm.value = '';
      showStatus(response.status === 'updated' ? 'Already saved — encounter updated.' : 'Added to your vocabulary.');
      await loadEntries();
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      elements.quickAddButton.disabled = false;
    }
  }

  function openManager() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  elements.quickAddButton.addEventListener('click', quickAdd);
  elements.quickTerm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void quickAdd();
  });
  elements.searchInput.addEventListener('input', render);
  elements.openManager.addEventListener('click', openManager);
  elements.viewAll.addEventListener('click', openManager);

  elements.wordList.addEventListener('click', async (event) => {
    const card = event.target.closest('.word-card');
    if (!card) return;
    const entry = entries.find((item) => item.id === card.dataset.id);
    if (!entry) return;
    try {
      if (event.target.closest('.favorite-button')) {
        await api.update(entry.id, { favorite: !entry.favorite });
        await loadEntries();
      } else if (event.target.closest('.delete')) {
        if (!window.confirm(`Delete “${entry.term}” from your vocabulary?`)) return;
        await api.remove(entry.id);
        showStatus('Word deleted.');
        await loadEntries();
      }
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  void loadEntries();
})();
