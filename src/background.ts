import { AppTab } from './app/model/app-tab';
import { AppImage } from './app/model/app-image';

const fileRegEx = /[?!/\\:\*\?"<|>\|]/g;
const extRegEx = /(?:\.([^.]+))?$/;
const tabs: AppTab[] = [];

chrome.runtime.onMessage.addListener(function (request, _sender, _sendResponse) {
  if (request.method == 'download' && request.value) {
    tabs.push(...request.value);
    downloadTabs(request.value);
  }
});

function downloadTabs(tabs: AppTab[], index: number = 0) : void {
  if (index >= tabs.length) {
    return;
  }
  chrome.tabs.executeScript(tabs[index].id, { file: 'images.js' }, (results: AppImage[][]) => {
    // TODO: configurable
    const files = results[0].filter(file => file.height > 300 && file.width > 300);
    downloadFiles(tabs[index], files, 0, () => downloadTabs(tabs, index + 1));
  });
}

function downloadFiles(tab: AppTab, files: any[], index: number = 0, callback: () => void = null) : void {
  tab.progress = { loaded: index, total: files.length };
  if (tab.progress.loaded >= tab.progress.total) {
    // TODO: configurable
    chrome.tabs.remove(tab.id);
    if (callback) { callback(); }
    return;
  }

  const determiningFilenameCb = (item: chrome.downloads.DownloadItem, suggest: (suggestion?: chrome.downloads.DownloadFilenameSuggestion) => void) =>
    suggest({ filename: `${tab.title.replace(fileRegEx, '')}/Image-${index + 1}.${extRegEx.exec(item.filename)[1]}` });
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