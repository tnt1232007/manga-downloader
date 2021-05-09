import { AppTab } from './app/model/app-tab';
import { AppImage } from './app/model/app-image';
import { AppRequest } from './app/model/app-request';

let allTabs: AppTab[];
let imageIndex: number = 0;
let isDownloading: boolean = false;
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
      const updatedImage: AppImage = request.value;
      if (updatedImage.data) {
        tab.images[imageIndex] = updatedImage;
        downloadImage();
      }
    }
  });
});

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
  } else {
    chrome.tabs.get(tab.id, found => {
      if (found) {
        downloadImage();
      } else {
        allTabs = allTabs.filter(t => t.id !== tab.id);
        processNextImage();
      }
    });
  }
}

function downloadImage() {
  const tab = getUnprocessedTab();
  const image = tab.images[imageIndex];
  const determiningFilenameCb = (
    item: chrome.downloads.DownloadItem,
    suggest: (suggestion?: chrome.downloads.DownloadFilenameSuggestion) => void
  ) => {
    // tslint:disable-next-line: max-line-length
    const folderRegEx = /[^A-Za-z0-9-_.,'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệếỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ ]/g;
    const folderName = tab.title.replace(folderRegEx, '');
    const indexStr = (imageIndex + 1).toString().padStart(3, '0');
    const fileName = `${image.name || item.filename}`;
    return suggest({ filename: tab.images.length > 1 ? `${folderName}/${indexStr}_${fileName}` : `${folderName}_${fileName}` });
  };
  if (!chrome.downloads.onDeterminingFilename.hasListeners()) {
    chrome.downloads.onDeterminingFilename.addListener(determiningFilenameCb);
  }
  chrome.downloads.download({ url: image.data || image.src, filename: image.name }, id => {
    const changedCb = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.error) {
        // If any error, try to download xhr in content script
        chrome.downloads.onChanged.removeListener(changedCb);
        chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
        chrome.tabs.sendMessage(tab.id, { method: 'dl-xhr-via-content', value: image });
      } else if (delta.id === id && delta.filename && !delta.filename.previous && delta.filename.current) {
        chrome.downloads.onChanged.removeListener(changedCb);
        chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
        imageIndex += 1;
        processNextImage();
      }
    };
    chrome.downloads.onChanged.addListener(changedCb);
  });
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
