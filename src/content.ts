import { AppRequest } from './app/model/app-request';
import { AppImage } from './app/model/app-image';

chrome.runtime.onMessage.addListener((request: AppRequest, _sender, _sendResponse) => {
  if (request.method === 'dl-xhr-via-content' && request.value) {
    const image: AppImage = request.value;
    downloadImage(image);
  }
});

function downloadImage(image: AppImage) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.timeout = 30000;
  xhr.onload = (_) => {
    if (xhr.status === 200) {
      image.name = getImageName(xhr);
      image.data = URL.createObjectURL(xhr.response);
      chrome.runtime.sendMessage({
        method: 'dl-blob-via-background',
        value: image,
      });
      console.log(image.src);
    }
  };
  xhr.onloadend = (_) => {
    if (xhr.status == 404 || xhr.status == 0) {
      chrome.runtime.sendMessage({ method: 'dl-failed' });
    }
  };
  xhr.ontimeout = (_) => {
    chrome.runtime.sendMessage({ method: 'dl-failed' });
    console.error(image.src);
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
