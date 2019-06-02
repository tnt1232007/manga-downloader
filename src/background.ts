import { AppTab } from './app/model/app-tab';
import { AppImage } from './app/model/app-image';
import { AppRequest } from './app/model/app-request';

let allTabs: AppTab[];
let tabIndex: number = 0;
let imageIndex: number = 0;
let isDownloading: boolean = false;
chrome.storage.local.get(['history'], result => {
  allTabs = result['history'] || [];
  chrome.runtime.onMessage.addListener(function (request: AppRequest, _sender, _sendResponse) {
    if (request.method === 'download' && request.value) {
      const tabs: AppTab[] = request.value;
      allTabs.push(...tabs);
      if (isDownloading) {
        return;
      }

      isDownloading = true;
      downloadImageInContentScript();
    } else if (request.method === 'blob-download' && request.value) {
      const image: AppImage = request.value;
      if (allTabs[tabIndex].images[imageIndex].data)
        return;
      allTabs[tabIndex].images[imageIndex] = image;
      downloadImageAsFile();
    } else if (request.method === 'clear') {
      allTabs = allTabs.filter(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
      chrome.storage.local.remove('history');
    }
  });
});

function downloadImageInContentScript() {
  const tab = allTabs[tabIndex];
  if (!tab)
    return;
  tab.progress = { loaded: imageIndex, total: tab.images.length };
  chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
  if (tab.progress.loaded >= tab.progress.total) {
    // TODO: configurable
    chrome.tabs.remove(tab.id);
    tabIndex += 1;
    imageIndex = 0;
    if (tabIndex >= allTabs.length) {
      isDownloading = false;
      return;
    } else {
      downloadImageInContentScript();
    }
  }
  chrome.tabs.get(tab.id, t => {
    if (t) {
      chrome.tabs.sendMessage(t.id, { method: 'xhr-download', value: tab.images[imageIndex] });
    } else {
      tabIndex += 1;
      downloadImageInContentScript();
    }
  });
}

function downloadImageAsFile() {
  const tab = allTabs[tabIndex];
  const image = tab.images[imageIndex];
  console.log(image);
  const determiningFilenameCb = (_: chrome.downloads.DownloadItem, suggest: (suggestion?: chrome.downloads.DownloadFilenameSuggestion) => void) => {
    //TODO: configurable
    const folderRegEx = /[^A-z0-9-_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệếỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ ]/g;
    const folderName = tab.title.replace(folderRegEx, '');
    const indexStr = (imageIndex + 1).toString().padStart(3, '0');
    return suggest({ filename: `${folderName}/${indexStr}-${image.name}` });
  };
  if (!chrome.downloads.onDeterminingFilename.hasListeners()) {
    chrome.downloads.onDeterminingFilename.addListener(determiningFilenameCb);
  }
  chrome.downloads.download({ 'url': image.data, filename: image.name }, id => {
    const changedCb = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id === id && delta.state && delta.state.previous === 'in_progress' && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
        chrome.downloads.onChanged.removeListener(changedCb);
        chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
        imageIndex += 1;
        downloadImageInContentScript();
      }
    };
    chrome.downloads.onChanged.addListener(changedCb);
  });
}