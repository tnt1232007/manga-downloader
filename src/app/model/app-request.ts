export interface AppRequest {
  method: 'tabsChanged' | 'init' | 'downloadNew' | 'downloadManual' | 'abortOngoing' | 'clearHistory' | 'dl-xhr-via-content' | 'dl-blob-via-background' | 'dl-failed';
  value: any;
}
