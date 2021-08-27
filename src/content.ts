import { AppTab } from './app/model/app-tab';
import { AppImage } from './app/model/app-image';
import { AppRequest } from './app/model/app-request';

chrome.runtime.onMessage.addListener((request: AppRequest, _sender, _sendResponse) => {
  if (request.method === 'dl-xhr-via-content' && request.value) {
    const tab: AppTab = request.value.tab;
    const image: AppImage = request.value.image;
    downloadImage(tab, image);
  }
});

function downloadImage(tab: AppTab, image: AppImage) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.timeout = 30000;
  xhr.onload = (_) => {
    if (xhr.status === 200) {
      image.name = getImageName(xhr);
      image.data = URL.createObjectURL(xhr.response);
      chrome.runtime.sendMessage({
        method: 'dl-blob-via-background',
        value: { tab, image },
      });
      console.log(`[${new Date()}] [${image.index}] ${image.src}`);
    }
  };
  xhr.onloadend = (_) => {
    if (xhr.status != 200) {
      chrome.runtime.sendMessage({ method: 'dl-failed', value: { tab, image } });
    }
  };
  xhr.ontimeout = (_) => {
    chrome.runtime.sendMessage({ method: 'dl-failed', value: { tab, image } });
  };
  xhr.open('GET', image.src, true);
  xhr.send();
}

function getImageName(xhr: XMLHttpRequest) {
  // Try get from Content Disposition
  const disposition = xhr.getResponseHeader('Content-Disposition');
  if (disposition && disposition.indexOf('inline') !== -1) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      return matches[1].replace(/['"]/g, '');
    }
  }

  // Try get from Reponse URL
  if (xhr.responseURL) {
    const filenameRegex = /\S+\/(\S+)$/;
    const matches = filenameRegex.exec(xhr.responseURL);
    if (matches != null && matches[1]) {
      return matches[1];
    }
  }

  return null;
}
