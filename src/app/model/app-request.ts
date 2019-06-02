export interface AppRequest {
    method: 'tabsChanged' | 'clear' | 'download' | 'xhr-download' | 'blob-download';
    value: any
}