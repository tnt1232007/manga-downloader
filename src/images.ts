import { AppImage } from './app/model/app-image';

enum ImageType {
  IMG,
  TEXT,
  LINK,
  INPUT_IMG,
  BACKGROUND,
}

function extractAll(): AppImage[] {
  const imgLst: AppImage[] = [
    ...extractImgs(document.getElementsByTagName('img'), source => source.src),
    ...extractImgs(document.images, source => source.currentSrc),
    ...extractImgs(document.getElementsByTagName('source'), source => source.srcset),
    ...extractInputImgs(document.getElementsByTagName('input')),
    ...extractLinkImgs(document.getElementsByTagName('a')),
  ];
  return imgLst.filter((value, index, array) => array.findIndex(item => item.src === value.src) === index);
}

function extractImgs<T extends HTMLImageElement | HTMLSourceElement>(sources: HTMLCollectionOf<T>, srcSelector: (source: T) => string): AppImage[] {
  const imgLst: AppImage[] = [];
  for (let i = 0; i < sources.length; i++) {
    try {
      const source = sources[i];
      const img = new Image();
      img.src = srcSelector(source);
      if (!img.src) { continue; }

      let w = Math.max(img.width, img.naturalWidth);
      let h = Math.max(img.height, img.naturalHeight);
      imgLst.push({ type: ImageType.IMG, src: img.src, width: w, height: h });
    } catch (error) {
      console.debug(sources[i]);
    }
  }
  return imgLst;
}

function extractInputImgs<T extends HTMLInputElement>(sources: HTMLCollectionOf<T>): AppImage[] {
  const imgLst: AppImage[] = [];
  for (var i = 0; i < sources.length; i++) {
    var input = sources[i];
    if (input.type.toUpperCase() === 'IMAGE') {
      imgLst.push({ type: ImageType.INPUT_IMG, src: input.src, width: 0, height: 0 });
    }
  }
  return imgLst;
}

function extractLinkImgs<T extends HTMLAnchorElement>(sources: HTMLCollectionOf<T>): AppImage[] {
  const imgLst: AppImage[] = [];
  for (var i = 0; i < sources.length; i++) {
    var link = sources[i];
    var href = link.href;
    if (href.endsWith('.jpg') || href.endsWith('.jpeg') || href.endsWith('.bmp') || href.endsWith('.ico') || href.endsWith('.gif') || href.endsWith('.png')) {
      imgLst.push({ type: ImageType.LINK, src: href, width: 0, height: 0 });
    }
  }
  return imgLst;
}

extractAll();