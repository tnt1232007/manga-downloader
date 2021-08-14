import { AppTab } from './app/model/app-tab';
import { ImageStatus } from './app/model/app-image';
import { AppRequest } from './app/model/app-request';

let allTabs: AppTab[];
let imageIndex: number = 0;
let isDownloading: boolean = false;
let failedHosts = {};
chrome.storage.local.get(['history'], result => {
  allTabs = result['history'] || [];
  chrome.runtime.onMessage.addListener(function (request: AppRequest, _sender, _sendResponse) {
    if (request.method === 'init') {
      chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
    } else if (request.method === 'downloadNew' && request.value) {
      const tabs: AppTab[] = request.value;
      allTabs.push(...tabs);
      if (!isDownloading) {
        isDownloading = true;
        processNextImage();
      }
    } else if (request.method === 'abortOngoing') {
      imageIndex = 0;
      isDownloading = false;
      allTabs = allTabs.filter(tab => tab.progress && tab.progress.loaded === tab.progress.total);
    } else if (request.method === 'clearHistory') {
      allTabs = allTabs.filter(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
      chrome.storage.local.remove('history');
    } else if (request.method === 'dl-blob-via-background' && request.value) {
      const tab = getUnprocessedTab();
      tab.images[imageIndex].name = request.value.name;
      tab.images[imageIndex].data = request.value.data;
      downloadImage();
    } else if (request.method === 'dl-failed') {
      const tab = getUnprocessedTab();
      tab.images[imageIndex].status = ImageStatus.FAILED;
      imageIndex += 1;
      processNextImage();
    }
  });
});

let retry = 0;
function processNextImage() {
  const tab = getUnprocessedTab();
  if (!isDownloading) {
    return;
  }

  if (!tab) {
    imageIndex = 0;
    isDownloading = false;
    return;
  }

  tab.progress = { loaded: imageIndex, total: tab.images.length };
  chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
  if (tab.progress.loaded >= tab.progress.total) {
    imageIndex = 0;
    closeTab(tab);
    processNextImage();
    retry = 0;
  } else {
    // Check if tab still opened
    chrome.tabs.get(tab.id, found => {
      if (found) {
        downloadImage();
      } else {
        // Tab is really closed unexpectedly, remove it and continue
        if (retry >= 10) {
          allTabs = allTabs.filter(t => t.id !== tab.id);
          retry = 0;
        }
        // Workaround for Error "Tabs cannot be edited right now (user may be dragging a tab)"
        setTimeout(() => {
          processNextImage();
          retry += 1;
        }, 1000);
      }
    });
  }
}

function downloadImage() {
  const tab = getUnprocessedTab();
  const image = tab.images[imageIndex];
  const sourceURL = new URL(image.data || image.src);
  image.status = ImageStatus.QUEUED;
  if (failedHosts[sourceURL.host] > 3) {
    chrome.tabs.sendMessage(tab.id, { method: 'dl-xhr-via-content', value: image });
  } else {
    const determiningFilenameCb = (
      item: chrome.downloads.DownloadItem,
      suggest: (suggestion?: chrome.downloads.DownloadFilenameSuggestion) => void
    ) => {
      const folderRegEx = /[^A-Za-z0-9-_.,'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệếỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ ]/g;
      const folderName = tab.title.replace(folderRegEx, '');
      const indexStr = (imageIndex + 1).toString().padStart(3, '0');
      image.name = `${indexStr}_${image.name || item.filename}`;
      const suggestName = tab.images.length > 1 ? `${folderName}/${image.name}` : `${folderName}_${image.name}`;
      return suggest({ filename: suggestName });
    };
    if (!chrome.downloads.onDeterminingFilename.hasListeners()) {
      chrome.downloads.onDeterminingFilename.addListener(determiningFilenameCb);
    }
    chrome.downloads.download({ url: sourceURL.href, filename: image.name }, id => {
      const changedCb = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.error) {
          // If any error, try to download xhr in content script
          chrome.downloads.onChanged.removeListener(changedCb);
          chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
          chrome.tabs.sendMessage(tab.id, { method: 'dl-xhr-via-content', value: image });
          failedHosts[sourceURL.host] = failedHosts[sourceURL.host] ? failedHosts[sourceURL.host] + 1 : 1;
        } else if (delta.id === id && delta.filename && !delta.filename.previous && delta.filename.current) {
          chrome.downloads.onChanged.removeListener(changedCb);
          chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
          image.status = ImageStatus.DOWNLOADED;
          imageIndex += 1;
          processNextImage();
        }
      };
      chrome.downloads.onChanged.addListener(changedCb);
    });
  }
}

function getUnprocessedTab(): AppTab {
  const unprocessedTab = allTabs.find(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
  if (!unprocessedTab) {
    chrome.storage.local.get(['settings'], result => {
      const maxHistory = result['settings']['maxHistory'] || 100;
      allTabs = allTabs.filter((_, index) => index >= allTabs.length - maxHistory);
      chrome.storage.local.set({ history: allTabs });
    });
  }
  return unprocessedTab;
}

function closeTab(tab: AppTab): void {
  chrome.storage.local.get(['settings'], result => {
    if (result['settings']['closeAfter']) {
      chrome.tabs.remove(tab.id);
    }
  });
}
