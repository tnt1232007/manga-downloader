import { AppTab } from './app/model/app-tab';
import { AppImage } from './app/model/app-image';

const fileRegEx = /[?!/\\:\*\?"<|>\|]/g;
let tabs: AppTab[];
chrome.storage.local.get(['history'], result => {
  tabs = result['history'] || [];
  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    if (request.method === 'download' && request.value) {
      tabs.push(...request.value);
      downloadTabs(request.value);
    } else if (request.method === 'clear') {
      tabs = tabs.filter(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
      chrome.storage.local.remove('history');
    }
  });
});

function downloadTabs(tabs: AppTab[], index: number = 0): void {
  if (index >= tabs.length) {
    return;
  }
  downloadFiles(tabs[index], tabs[index].images, 0, () => downloadTabs(tabs, index + 1));
}

function downloadFiles(tab: AppTab, files: AppImage[], index: number = 0, callback: () => void = null): void {
  tab.progress = { loaded: index, total: files.length };
  chrome.runtime.sendMessage({ method: 'tabsChanged', value: tabs });
  if (tab.progress.loaded >= tab.progress.total) {
    // TODO: configurable
    chrome.tabs.remove(tab.id);
    if (callback) { callback(); }
    return;
  }

  const determiningFilenameCb = (item: chrome.downloads.DownloadItem, suggest: (suggestion?: chrome.downloads.DownloadFilenameSuggestion) => void) => {
    const folderName = tab.title.replace(fileRegEx, '');
    const indexStr = (index + 1).toString().padStart(3, '0');
    return suggest({ filename: `${folderName}/${indexStr}-${item.filename}` });
  };
  chrome.downloads.onDeterminingFilename.addListener(determiningFilenameCb);
  chrome.downloads.download({ 'url': files[index].src }, id => {
    const changedCb = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id === id && delta.state && delta.state.previous === 'in_progress' && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
        chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
        chrome.downloads.onChanged.removeListener(changedCb);
        downloadFiles(tab, files, index + 1, callback);
      }
    };
    chrome.downloads.onChanged.addListener(changedCb);
  });
}