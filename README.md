# Vocabufy

Vocabufy is a private Chrome extension for collecting unfamiliar words while browsing. Select a word or short phrase, then left-click the floating **Add to my vocab** button beside the selection. Vocabufy saves the term, nearby sentence context, page title, source URL, and date in Chrome's local extension storage.

## Install in Chrome

1. Extract `Vocabufy.zip` to a permanent folder on your computer.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the extracted `Vocabufy` folder—the folder that directly contains `manifest.json`.
6. Pin Vocabufy from Chrome's Extensions menu for quick access.

## Save a word

1. Highlight a word or short phrase on a normal webpage.
2. Left-click **Add to my vocab** beside the selection.
3. Alternatively, right-click selected text and choose **Add to my vocab**.
4. Click the Vocabufy toolbar icon to search recent words or add one manually.
5. Choose **Open full vocabulary** to edit definitions and notes, mark favorites, filter, sort, export, or import your collection.

Vocabufy detects duplicates without regard to letter case. Saving the same word again updates its latest context and source, increases its encounter count, and preserves up to 20 recent source pages.

## Backup and restore

Open the full vocabulary page and choose **Export** to download a JSON backup. Choose **Import** to merge another Vocabufy backup into the current library or replace the current library after confirmation.

## Privacy

- Vocabulary data is stored in `chrome.storage.local` on the current Chrome profile.
- Vocabufy does not send words, page content, or browsing history to a server.
- No analytics, advertising, tracking, account, or external API is included.
- Uninstalling the extension normally removes its local data. Export a backup first if the words matter to you.

## Chrome limitations

Chrome does not allow extensions to inject a save button into protected pages such as `chrome://` pages or the Chrome Web Store. For local `file://` pages, open Vocabufy's extension details and enable **Allow access to file URLs**. Some embedded viewers, browser PDFs, cross-origin frames, and form controls manage selection internally, so the floating button may not appear there; the right-click option can still work where Chrome supplies selected text.

## Project structure

- `manifest.json` — Chrome Manifest V3 configuration
- `background.js` — storage, deduplication, import, settings, and context-menu logic
- `content.js` — isolated selection button and save notification
- `popup.*` — toolbar popup and quick-add interface
- `manager.*` — full vocabulary manager
- `api.js` — internal message client shared by extension pages
- `icons/` — extension icons

## Version

1.0.0
