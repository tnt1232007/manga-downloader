import { AppTab } from './app/model/app-tab';
import { AppImage, ImageStatus } from './app/model/app-image';
import { AppRequest } from './app/model/app-request';

let allTabs: AppTab[];
let imageIndex: number = 0;
let isDownloading: boolean = false;
let failedHosts = {};
chrome.storage.local.get(['history'], (result) => {
  allTabs = result['history'] || [];
  chrome.runtime.onMessage.addListener(function (request: AppRequest, _sender, _sendResponse) {
    if (request.method === 'init') {
      chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
    } else if (request.method === 'downloadNew' && request.value) {
      const tabs: AppTab[] = request.value;
      allTabs.push(...tabs);
      let maxIndex = allTabs.reduce((left, right) => ((left.index || 0) > (right.index || 0) ? left : right)).index || 0;
      allTabs.forEach((tab) => {
        if (tab.index) return;
        maxIndex += 1;
        tab.index = maxIndex;
      });
      if (!isDownloading) {
        isDownloading = true;
        processNextImage();
      }
    } else if (request.method === 'downloadManual' && request.value) {
      const original = extractRequest(request);
      chrome.tabs.get(original.tab.id, (found) => {
        if (found) {
          downloadTabImage(original.tab, original.image);
        } else {
          downloadTabImageByUrl(original.tab, original.image);
        }
      });
    } else if (request.method === 'abortOngoing') {
      isDownloading = false;
      allTabs = allTabs.filter((tab) => tab.progress && tab.progress.loaded === tab.progress.total);
    } else if (request.method === 'clearHistory') {
      allTabs = allTabs.filter((tab) => !(tab.progress && tab.progress.loaded === tab.progress.total));
      chrome.storage.local.remove('history');
    } else if (request.method === 'dl-blob-via-background' && request.value) {
      const original = extractRequest(request);
      original.image.name = request.value.image.name;
      original.image.data = request.value.image.data;
      downloadTabImage(original.tab, original.image);
    } else if (request.method === 'dl-failed' && request.value) {
      const original = extractRequest(request);
      original.image.status = ImageStatus.FAILED;
      imageIndex += 1;
      processNextImage();
    }
  });
});

let retry = 0;
function processNextImage() {
  if (!isDownloading) {
    chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
    chrome.storage.local.get(['settings'], (result) => {
      const maxHistory = result['settings']['maxHistory'] || 100;
      allTabs = allTabs.filter((_, index) => index >= allTabs.length - maxHistory);
      chrome.storage.local.set({ history: allTabs.filter((tab) => tab.progress && tab.progress.loaded === tab.progress.total) });
    });
    imageIndex = 0;
    return;
  }

  // Find the in progress tab, or new tab
  const tab = allTabs.filter((tab) => tab.progress).find((tab) => tab.progress.loaded < tab.progress.total) || allTabs.find((tab) => !tab.progress);
  if (!tab) {
    imageIndex = 0;
    isDownloading = false;
    return;
  }

  tab.progress = { loaded: imageIndex, total: tab.images.length };
  chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
  if (tab.progress.loaded === tab.progress.total) {
    // Tab is finished, save history and fetch next tab
    chrome.storage.local.get(['settings'], (result) => {
      const maxHistory = result['settings']['maxHistory'] || 100;
      allTabs = allTabs.filter((_, index) => index >= allTabs.length - maxHistory);
      chrome.storage.local.set({ history: allTabs.filter((tab) => tab.progress && tab.progress.loaded === tab.progress.total) });
    });
    imageIndex = 0;
    closeTab(tab);
    processNextImage();
  } else {
    chrome.tabs.get(tab.id, (found) => {
      if (found) {
        // Tab still opened, good to go
        downloadTabImage(tab, tab.images[imageIndex]);
        retry = 0;
      } else {
        if (retry < 10) {
          // Tab cannot be edited right now (user may be dragging a tab), wait for a second and retry
          setTimeout(() => {
            processNextImage();
            retry += 1;
          }, 1000);
        } else {
          // Retry 10 times already, tab is really closed, skip it and continue
          allTabs = allTabs.filter((t) => t.id !== tab.id);
          retry = 0;
        }
      }
    });
  }
}

function extractRequest(request: AppRequest) {
  const requestTab = request.value.tab;
  const tab = allTabs.find((t) => t.id == requestTab.id) || allTabs.find((t) => t.url == requestTab.url);
  const image = tab.images[request.value.image.index];
  return { tab, image };
}

function downloadTabImage(tab: AppTab, image: AppImage) {
  const sourceURL = new URL(image.data || image.src);
  image.status = ImageStatus.QUEUED;
  if (failedHosts[sourceURL.host] > 3) {
    tab.message = 'This site blocks background downloading. Please keep or re-opened the tab for manual download.';
    chrome.tabs.sendMessage(tab.id, { method: 'dl-xhr-via-content', value: { tab, image } });
  } else {
    const filenameCallBack = (item: chrome.downloads.DownloadItem, suggest: (suggestion?: chrome.downloads.DownloadFilenameSuggestion) => void) => {
      const folderRegEx = /[<>:"/|?*\\]/g;
      const folderName = tab.title.replace(folderRegEx, '');
      const indexStr = (image.index + 1).toString().padStart(3, '0');
      image.name = `${indexStr}_${image.name || item.filename}`;
      const suggestName = tab.images.length > 1 ? `${folderName}/${image.name}` : `${folderName}_${image.name}`;
      return suggest({ filename: suggestName });
    };
    const changedCallBack = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.error) {
        // If any error, try to download xhr in content script
        chrome.downloads.onChanged.removeListener(changedCallBack);
        chrome.downloads.onDeterminingFilename.removeListener(filenameCallBack);
        chrome.tabs.sendMessage(tab.id, { method: 'dl-xhr-via-content', value: { tab, image } });
        failedHosts[sourceURL.host] = failedHosts[sourceURL.host] ? failedHosts[sourceURL.host] + 1 : 1;
      } else if (delta.filename && delta.filename.current.endsWith(image.name) ) {
        chrome.downloads.onChanged.removeListener(changedCallBack);
        chrome.downloads.onDeterminingFilename.removeListener(filenameCallBack);
        image.status = ImageStatus.DOWNLOADED;
        imageIndex += 1;
        processNextImage();
      }
    };
    if (!chrome.downloads.onDeterminingFilename.hasListeners()) {
      chrome.downloads.onDeterminingFilename.addListener(filenameCallBack);
    }
    if (!chrome.downloads.onChanged.hasListeners()) {
      chrome.downloads.onChanged.addListener(changedCallBack);
    }
    chrome.downloads.download({ url: sourceURL.href, filename: image.name });
  }
}

function closeTab(tab: AppTab): void {
  chrome.storage.local.get(['settings'], (result) => {
    if (result['settings']['closeAfter']) {
      if (tab.images.some((image) => image.status != ImageStatus.DOWNLOADED)) return;
      chrome.tabs.remove(tab.id);
    }
  });
}

function downloadTabImageByUrl(tab: AppTab, image: AppImage) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const openTab = tabs.find((t) => t.url === tab.url);
    if (!openTab) {
      console.error('Please open the page to download images from this site');
      return;
    }
    tab.id = openTab.id;
    downloadTabImage(tab, image);
  });
}
