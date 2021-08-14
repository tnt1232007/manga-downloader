export const enum ImageType {
  IMG,
  TEXT,
  LINK,
  INPUT_IMG,
  BACKGROUND,
  ROOT,
}

export const enum ImageStatus {
  NEW,
  QUEUED,
  DOWNLOADED,
  FAILED,
}

export class AppImage {
  type: ImageType;
  src: string;
  data: any;
  name: string;
  width: number;
  height: number;
  status: ImageStatus = ImageStatus.NEW;
}
