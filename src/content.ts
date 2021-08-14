import { AppRequest } from './app/model/app-request';
import { AppImage, ImageStatus } from './app/model/app-image';

chrome.runtime.onMessage.addListener((request: AppRequest, _sender, _sendResponse) => {
  if (request.method === 'dl-xhr-via-content' && request.value) {
    const image: AppImage = request.value;
    downloadImage(image);
  }
});

let retry = 0;
function downloadImage(image: AppImage) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.timeout = 7000;
  xhr.onload = (_) => {
    if (xhr.status === 200) {
      retry = 0;
      image.name = getImageName(xhr);
      image.data = URL.createObjectURL(xhr.response);
      chrome.runtime.sendMessage({
        method: 'dl-blob-via-background',
        value: image,
      });
    }
  };
  xhr.onloadend = (_) => {
    if (xhr.status == 404) {
      chrome.runtime.sendMessage({ method: 'dl-failed' });
    }
  };
  xhr.ontimeout = (_) => {
    if (retry < 3) {
      downloadImage(image);
      retry += 1;
    } else {
      chrome.runtime.sendMessage({ method: 'dl-failed' });
      retry = 0;
    }
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
