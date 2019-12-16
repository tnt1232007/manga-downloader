/// <reference types='chrome'/>

import { Component, OnInit, NgZone, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbTabset, NgbTabChangeEvent } from '@ng-bootstrap/ng-bootstrap';
import { AppTab } from '../model/app-tab';
import { AppImage } from '../model/app-image';
import { AppRequest } from '../model/app-request';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styles: [],
})
export class DashboardComponent implements OnInit {
  @ViewChild('t') tabSet: NgbTabset;
  ongoingTabs: AppTab[] = [];
  newTabs: AppTab[] = [];
  completedTabs: AppTab[] = [];

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.loadNew();
    this.subscribeBackgroundChanged();
  }

  public tabChanged($event: NgbTabChangeEvent) {
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

  public submit(_form: NgForm) {
    const tabs = this.newTabs.filter(tab => tab.selected);
    chrome.runtime.sendMessage({ method: 'download', value: tabs });
    this.tabSet.select('ongoingTab');
  }

  public clear() {
    chrome.runtime.sendMessage({ method: 'clear' });
    this.ongoingTabs = [];
    this.completedTabs = [];
  }

  private subscribeBackgroundChanged() {
    chrome.runtime.onMessage.addListener((request: AppRequest, _sender, _sendResponse) => {
      if (request.method === 'tabsChanged' && request.value) {
        const allTabs: AppTab[] = request.value;
        this.ngZone.run(() => {
          this.newTabs = this.newTabs.filter((tab: AppTab) => !allTabs.some((tab_: AppTab) => tab_.id === tab.id));
          this.ongoingTabs = allTabs.filter(
            (tab: AppTab) => !(tab.progress && tab.progress.loaded === tab.progress.total)
          );
          this.completedTabs = allTabs.filter(
            (tab: AppTab) => tab.progress && tab.progress.loaded === tab.progress.total
          );
        });
      }
    });
  }

  private loadNew() {
    chrome.tabs.query({ currentWindow: true }, tabs => {
      chrome.storage.local.get(['settings'], result => {
        const settings = result['settings'];
        if (!settings) {
          this.ngZone.run(() => this.tabSet.select('settingsTab'));
          return;
        }

        this.ngZone.run(() => this.newTabs = tabs
          .filter(tab => !!tab.url)
          .filter(tab => tab.url.startsWith('http') || tab.url.startsWith('https'))
          .map(tab => new AppTab(tab))
        );
        const imageExtensions = settings['imageExtensions'].split(',').map((ext: string) => '.' + ext);
        const sizeFilter = (image: AppImage) =>
          image.height > settings['minHeight'] && image.width > settings['minWidth'];
        const extFilter = (image: AppImage) => imageExtensions.some(v => image.src.toLowerCase().indexOf(v) >= 0);
        for (let i = 0; i < this.newTabs.length; i++) {
          const tab = this.newTabs[i];
          chrome.tabs.executeScript(tab.id, { file: 'images.js' }, (results: AppImage[][]) => {
            this.ngZone.run(() => {
              console.log(results[0]);
              tab.images = results[0].filter(image => sizeFilter(image) && extFilter(image));
              tab.selected = tab.images.length > 0;
            });
          });
        }
      });
    });
  }

  private loadHistory() {
    chrome.storage.local.get(['history'], result =>
      this.ngZone.run(() => (this.completedTabs = result['history'] || []))
    );
  }
}
