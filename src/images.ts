import { AppImage } from './app/model/app-image';

enum ImageType {
  IMG,
  TEXT,
  LINK,
  INPUT_IMG,
  BACKGROUND,
  ROOT,
}

function extractAll(): AppImage[] {
  try {
    const rootImage = extractLinkImg(document.URL);
    if (!!rootImage) rootImage.type = ImageType.ROOT;
    const imgLst: AppImage[] = [
      rootImage,
      ...extractImgs(document.getElementsByTagName('img'), source => source.src),
      ...extractImgs(document.images, source => source.currentSrc),
      ...extractImgs(document.getElementsByTagName('source'), source => source.srcset),
      ...extractInputImgs(document.getElementsByTagName('input')),
      ...extractLinkImgs(document.getElementsByTagName('a')),
    ];
    return imgLst.filter(value => !!value).filter((value, index, array) => array.findIndex(item => item.src === value.src) === index);
  } catch (error) {
    return [error];
  }
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
      const image = <AppImage>{ type: ImageType.IMG, src: img.src, width: w, height: h };
      imgLst.push(image);
    } catch (error) {
      throw error;
    }
  }
  return imgLst;
}

function extractInputImgs<T extends HTMLInputElement>(sources: HTMLCollectionOf<T>): AppImage[] {
  const imgLst: AppImage[] = [];
  for (var i = 0; i < sources.length; i++) {
    var input = sources[i];
    if (input.type.toUpperCase() === 'IMAGE') {
      const image = <AppImage>{ type: ImageType.INPUT_IMG, src: input.src, width: 0, height: 0 };
      imgLst.push(image);
    }
  }
  return imgLst;
}

function extractLinkImgs<T extends HTMLAnchorElement>(sources: HTMLCollectionOf<T>): AppImage[] {
  const imgLst: AppImage[] = [];
  for (var i = 0; i < sources.length; i++) {
    const image = extractLinkImg(sources[i].href);
    if (!!image) imgLst.push(image);
  }
  return imgLst;
}

function extractLinkImg(href: string): AppImage {
  const ExtFilter = ['.jpg','.jpeg','.png','.bmp','.gif'];
    return ExtFilter.some(v => href.toLowerCase().endsWith(v))
     ? <AppImage>{ type: ImageType.LINK, src: href, width: 0, height: 0 }
     : null;
}

extractAll();
