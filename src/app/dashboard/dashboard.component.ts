/// <reference types='chrome'/>

import { Component, OnInit, NgZone, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbTabset, NgbTabChangeEvent } from '@ng-bootstrap/ng-bootstrap';
import { AppTab } from '../model/app-tab';
import { AppImage, ImageType } from '../model/app-image';
import { AppRequest } from '../model/app-request';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styles: [],
})
export class DashboardComponent implements OnInit {
  @ViewChild('t', { static: true }) tabSet: NgbTabset;
  ongoingTabs: AppTab[] = [];
  newTabs: AppTab[] = [];
  completedTabs: AppTab[] = [];
  private init: boolean;

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.setDefaultReferer();
    this.loadNew();
    this.subscribeBackgroundChanged();
    chrome.runtime.sendMessage({ method: 'init' });
    this.init = true;
  }

  public tabChanged($event: NgbTabChangeEvent) {
    this.init = false;
    switch ($event.nextId) {
      case 'newTab':
        this.loadNew();
        break;
      case 'ongoingTab':
        break;
      case 'historyTab':
        this.loadHistory();
        break;
      case 'settingsTab':
        break;
      default:
        break;
    }
  }

  public refreshNew() {
    this.loadNew();
  }

  public downloadNew(_form: NgForm) {
    const tabs = this.newTabs.filter((tab) => tab.selected);
    chrome.runtime.sendMessage({ method: 'downloadNew', value: tabs });
    this.tabSet.select('ongoingTab');
  }

  public abortOngoing() {
    chrome.runtime.sendMessage({ method: 'abortOngoing' });
    this.ongoingTabs = [];
  }

  public clearHistory() {
    chrome.runtime.sendMessage({ method: 'clearHistory' });
    this.ongoingTabs = [];
    this.completedTabs = [];
  }

  // Modify the referrer header so images can be requested using the original website's origin
  private setDefaultReferer() {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const referer = new URL(details.url);
        details.requestHeaders.push({
          name: 'Referer',
          value: referer.host,
        });
        return { requestHeaders: details.requestHeaders };
      },
      { types: ['image', 'media', 'object'], urls: [] },
      ['blocking', 'requestHeaders', 'extraHeaders']
    );
  }

  private subscribeBackgroundChanged() {
    chrome.runtime.onMessage.addListener((request: AppRequest, _sender, _sendResponse) => {
      if (request.method === 'tabsChanged' && request.value) {
        const allTabs: AppTab[] = request.value;
        const isTabCompleted = (tab: AppTab) => tab.progress && tab.progress.loaded === tab.progress.total;
        this.ngZone.run(() => {
          this.newTabs = this.newTabs.filter((tab: AppTab) => !allTabs.some((tab_: AppTab) => tab_.id === tab.id && tab_.url === tab.url));
          this.ongoingTabs = allTabs.filter((tab: AppTab) => !isTabCompleted(tab));
          this.completedTabs = allTabs.filter((tab: AppTab) => isTabCompleted(tab));

          if (this.init && this.ongoingTabs.length > 0) {
            this.tabSet.select('ongoingTabs');
          }
        });
      }
    });
  }

  private loadNew() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result['settings'];
        if (!settings) {
          this.ngZone.run(() => this.tabSet.select('settingsTab'));
          return;
        }
        this.ngZone.run(() => {
          this.newTabs = tabs
            .filter((tab) => !!tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https')))
            .map((tab) => new AppTab(tab));
        });

        const sizeFilter = (image: AppImage) => (!image.height && !image.width) || (image.height > settings['minHeight'] && image.width > settings['minWidth']);
        const imageExtensions = (<string>settings['imageExtensions']).split(',').map((ext: string) => '.' + ext);
        const extFilter = (image: AppImage) => imageExtensions.some((ext: string) => image.src.toLowerCase().indexOf(ext) >= 0);
        const excludeUrls = (<string>settings['excludeUrls'])
          .split('\n')
          .filter((regex) => !regex.startsWith('//') || !regex.startsWith('--'))
          .map((wildcard: string) => new RegExp(`^${wildcard.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i'));
        const excludeFilter = (image: AppImage) => excludeUrls.every((regex: RegExp) => !regex.test(image.src));
        for (let i = 0; i < this.newTabs.length; i++) {
          const tab = this.newTabs[i];
          chrome.tabs.executeScript(tab.id, { file: 'images.js' }, (results: AppImage[][]) => {
            this.ngZone.run(() => {
              tab.images = results[0];
              tab.images = tab.images.filter((image) => image.type === ImageType.ROOT || (sizeFilter(image) && extFilter(image)));
              if (settings['enableAlterUrls']) {
                const alterUrls = (<string>settings['alterUrls']).split('\n').filter((regex) => !regex.startsWith('//') || !regex.startsWith('--'));
                const newAlterUrls = (<string>settings['newAlterUrls']).split('\n').filter((regex) => !regex.startsWith('//') || !regex.startsWith('--'));
                for (let i = 0; i < alterUrls.length; i++) {
                  const url = alterUrls[i];
                  const newUrl = newAlterUrls[i];
                  const regex = new RegExp(url, 'i');
                  tab.images.forEach((image) => (image.src = image.src.replace(regex, newUrl)));
                }
              }
              tab.images = tab.images.filter((image) => !settings['enableExcludeUrls'] || excludeFilter(image));
              tab.selected = tab.images.length > 0;
              chrome.storage.local.set({ new: this.newTabs });
            });
          });
        }
      });
    });
  }

  private loadHistory() {
    chrome.storage.local.get(['history'], (result) => this.ngZone.run(() => (this.completedTabs = result['history'] || [])));
  }
}
