export enum ImageType {
  IMG,
  TEXT,
  LINK,
  INPUT_IMG,
  BACKGROUND,
  ROOT,
}

export class AppImage {
  type: ImageType;
  src: string;
  data: any;
  name: string;
  width: number;
  height: number;
}
