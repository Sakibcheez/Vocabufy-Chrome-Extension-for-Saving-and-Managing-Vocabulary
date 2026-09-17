'use strict';

(function exposeVocabufyApi() {
  function request(type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, ...payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || 'Vocabufy could not complete the request.'));
          return;
        }
        resolve(response);
      });
    });
  }

  window.VocabufyAPI = Object.freeze({
    add: (data) => request('vocabufy:add', { data }),
    list: () => request('vocabufy:list'),
    update: (id, changes) => request('vocabufy:update', { id, changes }),
    remove: (id) => request('vocabufy:delete', { id }),
    clear: () => request('vocabufy:clear'),
    import: (entries, mode = 'merge') => request('vocabufy:import', { entries, mode }),
    getSettings: () => request('vocabufy:get-settings'),
    updateSettings: (settings) => request('vocabufy:update-settings', { settings })
  });
})();
