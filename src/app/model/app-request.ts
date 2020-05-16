export interface AppRequest {
    method: 'tabsChanged' | 'init' | 'clear' | 'download' | 'xhr-download' | 'blob-download';
    value: any
}
