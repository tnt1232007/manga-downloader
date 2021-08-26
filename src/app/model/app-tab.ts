import { AppImage } from './app-image';

export class AppTab {
  index: number;
  id: number;
  title: string;
  url: string;
  selected: boolean;
  images: AppImage[];
  progress: ProgressEventInit;
  message: string;

  constructor(tab: chrome.tabs.Tab) {
    this.id = tab.id;
    this.title = tab.title;
    this.url = tab.url;
  }
}
