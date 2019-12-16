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
      downloadImageInContentScript();
    } else if (request.method === 'blob-download' && request.value) {
      const tab = allTabs.find(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
      const image: AppImage = request.value;
      if (tab.images[imageIndex].data) return;
      tab.images[imageIndex] = image;
      downloadImageAsFile();
    } else if (request.method === 'clear') {
      allTabs = allTabs.filter(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
      chrome.storage.local.remove('history');
    }
  });
});

function downloadImageInContentScript() {
  const tab = allTabs.find(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
  if (!tab) {
    chrome.storage.local.set({ history: allTabs });
    return;
  }
  tab.progress = { loaded: imageIndex, total: tab.images.length };
  chrome.runtime.sendMessage({ method: 'tabsChanged', value: allTabs });
  if (tab.progress.loaded >= tab.progress.total) {
    chrome.storage.local.get(['settings'], result => {
      if (result['settings']['closeAfter']) {
        chrome.tabs.remove(tab.id);
      }
    });
    imageIndex = 0;
    downloadImageInContentScript();
  } else {
    chrome.tabs.get(tab.id, found => {
      if (found) {
        chrome.tabs.sendMessage(found.id, { method: 'xhr-download', value: tab.images[imageIndex] });
      } else {
        allTabs = allTabs.filter(t => t.id !== tab.id);
        downloadImageInContentScript();
      }
    });
  }
}

function downloadImageAsFile() {
  const tab = allTabs.find(tab => !(tab.progress && tab.progress.loaded === tab.progress.total));
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
  chrome.downloads.download({ url: image.data, filename: image.name }, id => {
    const changedCb = (delta: chrome.downloads.DownloadDelta) => {
      if (
        delta.id === id &&
        delta.state &&
        delta.state.previous === 'in_progress' &&
        (delta.state.current === 'complete' || delta.state.current === 'interrupted')
      ) {
        chrome.downloads.onChanged.removeListener(changedCb);
        chrome.downloads.onDeterminingFilename.removeListener(determiningFilenameCb);
        imageIndex += 1;
        downloadImageInContentScript();
      }
    };
    chrome.downloads.onChanged.addListener(changedCb);
  });
}
