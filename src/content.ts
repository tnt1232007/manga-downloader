import { AppRequest } from './app/model/app-request';
import { AppImage } from './app/model/app-image';

chrome.runtime.onMessage.addListener((request: AppRequest, _sender, _sendResponse) => {
  if (request.method === 'dl-xhr-via-content' && request.value) {
    const image: AppImage = request.value;
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.onload = _ => {
      if (xhr.status === 200) {
        const disposition = xhr.getResponseHeader('Content-Disposition');
        if (disposition && disposition.indexOf('inline') !== -1) {
          const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
          const matches = filenameRegex.exec(disposition);
          if (matches != null && matches[1]) {
            image.name = matches[1].replace(/['"]/g, '');
          }
        }
        image.data = URL.createObjectURL(xhr.response);
        chrome.runtime.sendMessage({ method: 'dl-blob-via-background', value: image });
      }
    };
    xhr.onloadend = _ => {
      if (xhr.status == 404) {
        image.data = null;
        chrome.runtime.sendMessage({ method: 'dl-blob-via-background', value: image });
      }
    };
    xhr.open('GET', image.src, true);
    xhr.send();
  }
});
