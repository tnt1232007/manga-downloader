/// <reference types="chrome"/>

import { Component, OnInit, NgZone } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AppTab } from '../model/app-tab';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styles: []
})
export class DashboardComponent implements OnInit {
  tabs: AppTab[];

  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    chrome.tabs.query({ currentWindow: true }, tabs => this.ngZone.run(() => {
      this.tabs = tabs
        .filter(tab => !!tab.url)
        .filter(tab => tab.url.startsWith('http') || tab.url.startsWith('https'))
        .map(tab => new AppTab(tab));
    }));
  }

  submit(_form: NgForm) {
    const tabs = this.tabs.filter(tab => tab.selected);
    chrome.runtime.sendMessage({ method: "download", value: tabs });
  }
}
