/// <reference types='chrome'/>

import { Component, OnInit, NgZone, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbTabset } from '@ng-bootstrap/ng-bootstrap';
import { AppTab } from '../model/app-tab';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styles: []
})
export class DashboardComponent implements OnInit {
  @ViewChild('t') tabSet: NgbTabset;
  ongoingTabs: AppTab[] = [];
  newTabs: AppTab[] = [];
  completedTabs: AppTab[] = [];

  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    chrome.runtime.sendMessage({ method: 'history' }, response => {
      if (!response) return;
      this.ngZone.run(() => this.completedTabs = response.filter((tab: AppTab) => tab.progress.loaded === tab.progress.total));
    });

    chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
      if (request.method === 'tabsChanged' && request.value) {
        const tabs: AppTab[] = request.value;
        this.ngZone.run(() => {
          this.newTabs = this.newTabs.filter((tab: AppTab) => !tabs.some((tab_: AppTab) => tab_.id === tab.id));
          this.ongoingTabs = tabs.filter((tab: AppTab) => !tab.progress || tab.progress.loaded < tab.progress.total);
          this.completedTabs = tabs.filter((tab: AppTab) => tab.progress && tab.progress.loaded === tab.progress.total);
        });
      }
    });

    chrome.tabs.query({ currentWindow: true },
      tabs => this.ngZone.run(() => this.newTabs = tabs
        .filter(tab => !!tab.url)
        .filter(tab => tab.url.startsWith('http') || tab.url.startsWith('https'))
        .map(tab => new AppTab(tab))
      )
    );
  }

  submit(_form: NgForm) {
    const tabs = this.newTabs.filter(tab => tab.selected);
    chrome.runtime.sendMessage({ method: 'download', value: tabs });
  }

  clear() {
    chrome.runtime.sendMessage({ method: 'clear'});
    this.ongoingTabs = [];
    this.completedTabs = [];
  }
}
