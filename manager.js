'use strict';

(function initializeManager() {
  const api = window.VocabufyAPI;
  const elements = {
    totalStat: document.getElementById('totalStat'),
    favoriteStat: document.getElementById('favoriteStat'),
    weekStat: document.getElementById('weekStat'),
    revisitedStat: document.getElementById('revisitedStat'),
    allCount: document.getElementById('allCount'),
    favoritesCount: document.getElementById('favoritesCount'),
    revisitedCount: document.getElementById('revisitedCount'),
    librarySummary: document.getElementById('librarySummary'),
    manualTerm: document.getElementById('manualTerm'),
    manualAdd: document.getElementById('manualAdd'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    entriesList: document.getElementById('entriesList'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyMessage: document.getElementById('emptyMessage'),
    importButton: document.getElementById('importButton'),
    exportButton: document.getElementById('exportButton'),
    importFile: document.getElementById('importFile'),
    clearButton: document.getElementById('clearButton'),
    floatingButtonSetting: document.getElementById('floatingButtonSetting'),
    contextMenuSetting: document.getElementById('contextMenuSetting'),
    notificationSetting: document.getElementById('notificationSetting'),
    editDialog: document.getElementById('editDialog'),
    editForm: document.getElementById('editForm'),
    editId: document.getElementById('editId'),
    editTerm: document.getElementById('editTerm'),
    editDefinition: document.getElementById('editDefinition'),
    editNote: document.getElementById('editNote'),
    editContext: document.getElementById('editContext'),
    editFavorite: document.getElementById('editFavorite'),
    closeDialog: document.getElementById('closeDialog'),
    cancelEdit: document.getElementById('cancelEdit'),
    saveEdit: document.getElementById('saveEdit'),
    status: document.getElementById('status')
  };

  let entries = [];
  let activeFilter = 'all';
  let statusTimer = null;

  function showStatus(message, error = false) {
    window.clearTimeout(statusTimer);
    elements.status.textContent = message;
    elements.status.classList.toggle('error', error);
    elements.status.classList.add('visible');
    statusTimer = window.setTimeout(() => elements.status.classList.remove('visible'), 2600);
  }

  function formatDate(value, includeYear = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) }).format(date);
  }

  function sourceHost(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'file:' ? 'Local file' : parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'Source';
    }
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

  function createEntryRow(entry) {
    const row = document.createElement('article');
    row.className = 'entry-row';
    row.dataset.id = entry.id;

    const termCell = document.createElement('div');
    termCell.className = 'term-cell';
    const termLine = document.createElement('div');
    termLine.className = 'term-line';
    const term = document.createElement('span');
    term.className = 'term';
    term.textContent = entry.term;
    termLine.appendChild(term);
    if ((entry.saveCount || 1) > 1) {
      const encounter = document.createElement('span');
      encounter.className = 'encounter';
      encounter.textContent = `SEEN ×${entry.saveCount}`;
      termLine.appendChild(encounter);
    }
    const added = document.createElement('small');
    added.textContent = `Added ${formatDate(entry.createdAt, true)}`;
    termCell.append(termLine, added);

    const detailCell = document.createElement('div');
    detailCell.className = 'detail-cell';
    if (entry.definition) {
      const definition = document.createElement('p');
      definition.className = 'definition';
      definition.textContent = entry.definition;
      detailCell.appendChild(definition);
    }
    const supporting = entry.note || entry.context;
    const detail = document.createElement('p');
    detail.textContent = supporting || 'Add a definition, note, or example sentence.';
    if (!supporting && !entry.definition) detail.className = 'placeholder';
    detailCell.appendChild(detail);

    const sourceCell = document.createElement('div');
    sourceCell.className = 'source-cell';
    if (entry.sourceUrl) {
      const source = document.createElement('a');
      source.href = entry.sourceUrl;
      source.target = '_blank';
      source.rel = 'noreferrer';
      source.textContent = entry.sourceTitle || sourceHost(entry.sourceUrl);
      source.title = entry.sourceUrl;
      const host = document.createElement('small');
      host.textContent = sourceHost(entry.sourceUrl);
      sourceCell.append(source, host);
    } else {
      const manual = document.createElement('small');
      manual.textContent = 'Manually added';
      sourceCell.appendChild(manual);
    }

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const favorite = makeButton(entry.favorite ? 'Remove from favorites' : 'Add to favorites', `icon-button favorite-button${entry.favorite ? ' favorite' : ''}`, entry.favorite ? '★' : '☆');
    const edit = makeButton(`Edit ${entry.term}`, 'icon-button edit', '✎');
    const remove = makeButton(`Delete ${entry.term}`, 'icon-button delete', '×');
    actions.append(favorite, edit, remove);
    row.append(termCell, detailCell, sourceCell, actions);
    return row;
  }

  function getVisibleEntries() {
    const query = elements.searchInput.value.trim().toLocaleLowerCase();
    const filtered = entries.filter((entry) => {
      const matchesText = [entry.term, entry.definition, entry.note, entry.context, entry.sourceTitle]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
      if (!matchesText) return false;
      if (activeFilter === 'favorites') return Boolean(entry.favorite);
      if (activeFilter === 'revisited') return (entry.saveCount || 1) > 1;
      return true;
    });
    const sort = elements.sortSelect.value;
    return filtered.sort((a, b) => {
      if (sort === 'oldest') return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      if (sort === 'az') return a.term.localeCompare(b.term, undefined, { sensitivity: 'base' });
      if (sort === 'za') return b.term.localeCompare(a.term, undefined, { sensitivity: 'base' });
      if (sort === 'most-seen') return (b.saveCount || 1) - (a.saveCount || 1) || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }

  function render() {
    const favorites = entries.filter((entry) => entry.favorite).length;
    const revisited = entries.filter((entry) => (entry.saveCount || 1) > 1).length;
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thisWeek = entries.filter((entry) => Date.parse(entry.createdAt) >= oneWeekAgo).length;
    const visible = getVisibleEntries();
    const hasQuery = Boolean(elements.searchInput.value.trim());

    elements.totalStat.textContent = String(entries.length);
    elements.favoriteStat.textContent = String(favorites);
    elements.weekStat.textContent = String(thisWeek);
    elements.revisitedStat.textContent = String(revisited);
    elements.allCount.textContent = String(entries.length);
    elements.favoritesCount.textContent = String(favorites);
    elements.revisitedCount.textContent = String(revisited);
    elements.librarySummary.textContent = `${visible.length} ${visible.length === 1 ? 'item' : 'items'} shown`;
    elements.entriesList.replaceChildren(...visible.map(createEntryRow));
    elements.entriesList.hidden = visible.length === 0;
    elements.emptyState.hidden = visible.length > 0;
    elements.emptyTitle.textContent = entries.length ? 'No matching words' : 'No words yet';
    elements.emptyMessage.textContent = entries.length
      ? (hasQuery ? 'Try another search term or clear your filters.' : 'There are no words in this filter yet.')
      : 'Select a word on a webpage and click “Add to my vocab.”';
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

  async function manualAdd() {
    const term = elements.manualTerm.value.trim();
    if (!term) {
      elements.manualTerm.focus();
      return;
    }
    elements.manualAdd.disabled = true;
    try {
      const response = await api.add({ term });
      elements.manualTerm.value = '';
      showStatus(response.status === 'updated' ? 'Already saved — encounter updated.' : 'Added to your vocabulary.');
      await loadEntries();
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      elements.manualAdd.disabled = false;
    }
  }

  function openEditDialog(entry) {
    elements.editId.value = entry.id;
    elements.editTerm.value = entry.term || '';
    elements.editDefinition.value = entry.definition || '';
    elements.editNote.value = entry.note || '';
    elements.editContext.value = entry.context || '';
    elements.editFavorite.checked = Boolean(entry.favorite);
    elements.editDialog.showModal();
    elements.editTerm.focus();
  }

  function closeEditDialog() {
    elements.editDialog.close();
  }

  async function saveEdit(event) {
    event.preventDefault();
    elements.saveEdit.disabled = true;
    try {
      await api.update(elements.editId.value, {
        term: elements.editTerm.value,
        definition: elements.editDefinition.value,
        note: elements.editNote.value,
        context: elements.editContext.value,
        favorite: elements.editFavorite.checked
      });
      closeEditDialog();
      showStatus('Vocabulary item updated.');
      await loadEntries();
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      elements.saveEdit.disabled = false;
    }
  }

  function exportEntries() {
    const payload = {
      app: 'Vocabufy',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocabufy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus(`Exported ${entries.length} ${entries.length === 1 ? 'word' : 'words'}.`);
  }

  async function importFile(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const importedEntries = Array.isArray(parsed) ? parsed : parsed?.entries;
      if (!Array.isArray(importedEntries)) throw new Error('This is not a valid Vocabufy JSON backup.');
      let mode = 'merge';
      if (entries.length) {
        const merge = window.confirm(`Import ${importedEntries.length} items?\n\nChoose OK to merge them with your current vocabulary. Choose Cancel to stop or select replacement.`);
        if (!merge) {
          const replace = window.confirm('Replace your entire current vocabulary with this file? This cannot be undone.');
          if (!replace) return;
          mode = 'replace';
        }
      }
      const result = await api.import(importedEntries, mode);
      showStatus(`Imported ${result.imported} items. ${result.total} total words now saved.`);
      await loadEntries();
    } catch (error) {
      showStatus(error.message || 'Could not import that file.', true);
    } finally {
      elements.importFile.value = '';
    }
  }

  async function loadSettings() {
    try {
      const response = await api.getSettings();
      elements.floatingButtonSetting.checked = response.settings.floatingButton;
      elements.contextMenuSetting.checked = response.settings.contextMenu;
      elements.notificationSetting.checked = response.settings.notifications;
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function updateSetting(key, value) {
    try {
      await api.updateSettings({ [key]: value });
      showStatus('Setting saved.');
    } catch (error) {
      showStatus(error.message, true);
      await loadSettings();
    }
  }

  elements.manualAdd.addEventListener('click', manualAdd);
  elements.manualTerm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void manualAdd();
  });
  elements.searchInput.addEventListener('input', render);
  elements.sortSelect.addEventListener('change', render);
  document.querySelector('.filter-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('.filter-tab');
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((item) => item.classList.toggle('active', item === button));
    render();
  });

  elements.entriesList.addEventListener('click', async (event) => {
    const row = event.target.closest('.entry-row');
    if (!row) return;
    const entry = entries.find((item) => item.id === row.dataset.id);
    if (!entry) return;
    try {
      if (event.target.closest('.favorite-button')) {
        await api.update(entry.id, { favorite: !entry.favorite });
        await loadEntries();
      } else if (event.target.closest('.edit')) {
        openEditDialog(entry);
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

  elements.editForm.addEventListener('submit', saveEdit);
  elements.closeDialog.addEventListener('click', closeEditDialog);
  elements.cancelEdit.addEventListener('click', closeEditDialog);
  elements.editDialog.addEventListener('click', (event) => {
    if (event.target === elements.editDialog) closeEditDialog();
  });
  elements.editDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeEditDialog();
  });

  elements.exportButton.addEventListener('click', exportEntries);
  elements.importButton.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', () => {
    const [file] = elements.importFile.files;
    if (file) void importFile(file);
  });

  elements.clearButton.addEventListener('click', async () => {
    if (!entries.length) {
      showStatus('Your vocabulary is already empty.');
      return;
    }
    if (!window.confirm(`Permanently delete all ${entries.length} saved words? This cannot be undone.`)) return;
    try {
      await api.clear();
      showStatus('All saved words were deleted.');
      await loadEntries();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  elements.floatingButtonSetting.addEventListener('change', () => void updateSetting('floatingButton', elements.floatingButtonSetting.checked));
  elements.contextMenuSetting.addEventListener('change', () => void updateSetting('contextMenu', elements.contextMenuSetting.checked));
  elements.notificationSetting.addEventListener('change', () => void updateSetting('notifications', elements.notificationSetting.checked));

  void Promise.all([loadEntries(), loadSettings()]);
})();
