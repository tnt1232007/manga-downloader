import { AppTab } from './app/model/app-tab';
import { AppImage } from './app/model/app-image';
import { AppRequest } from './app/model/app-request';

let allTabs: AppTab[];
let imageIndex: number = 0;
chrome.storage.local.get(['history'], result => {
  allTabs = result['history'] || [];
  chrome.runtime.onMessage.addListener(function(request: AppRequest, _sender, _sendResponse) {
    if (request.method === 'download' && request.value) {
      const tabs: AppTab[] = request.value;
      allTabs.push(...tabs);
      processNextImage();
    } else if (request.method === 'blob-download' && request.value) {
      const tab = getUnprocessedTab();
      const updatedImage: AppImage = request.value;
      if (updatedImage.data) {
        tab.images[imageIndex] = updatedImage;
        downloadImage();
      }
    } else if (request.method === 'clear') {
      allTabs = allTabs.filter(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
      chrome.storage.local.remove('history');
    }
  });
});

function processNextImage() {
  const tab = getUnprocessedTab();
  if (!tab) return;
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
    const folderRegEx = /[^A-z0-9-_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệếỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ ]/g;
    const folderName = tab.title.replace(folderRegEx, '');
    const indexStr = (imageIndex + 1).toString().padStart(3, '0');
    return suggest({ filename: `${folderName}/${indexStr}-${image.name || item.filename}` });
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
        chrome.tabs.sendMessage(tab.id, { method: 'xhr-download', value: image });
      } else if (
        delta.id === id &&
        delta.state &&
        delta.state.previous === 'in_progress' &&
        (delta.state.current === 'complete' || delta.state.current === 'interrupted')
      ) {
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
  const tab = allTabs.find(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
  if (!tab) {
    // If all tab are processed, save to history
    chrome.storage.local.set({ history: allTabs });
  }
  return tab;
}

function closeTab(tab: AppTab): void {
  chrome.storage.local.get(['settings'], result => {
    if (result['settings']['closeAfter']) {
      chrome.tabs.remove(tab.id);
    }
  });
}