/// <reference types='chrome'/>

import { Component, OnInit, NgZone } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { AppTab } from '../model/app-tab';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: [],
})
export class SettingsComponent implements OnInit {
  form: FormGroup;
  defaultSettings: any = {
    imageExtensions: 'jpg,jpeg,png,bmp,gif',
    minWidth: 300,
    minHeight: 300,
    maxHistory: 100,
    enableAlterUrls: false,
    alterUrls: '',
    newAlterUrls: '',
    enableExcludeUrls: false,
    excludeUrls: '',
    closeAfter: true,
  };

  constructor(private ngZone: NgZone, private formBuilder: FormBuilder) { }

  ngOnInit() {
    this.form = this.formBuilder.group(this.defaultSettings);
    this.loadForm();
    this.formChanged();
  }

  private loadForm() {
    chrome.storage.local.get(['settings'], result => {
      if (result['settings']) {
        this.ngZone.run(() => this.form.setValue(result['settings']));
      } else {
        chrome.storage.local.set({ settings: this.defaultSettings });
      }
    });
  }

  private formChanged() {
    this.form.valueChanges.subscribe(value => {
      chrome.storage.local.set({ settings: value });
    });
  }

  public addAllCurrentImages() {
    chrome.storage.local.get(['new'], result => {
      if (result['new']) {
        const excludeUrls = this.form.getRawValue().excludeUrls;
        const allCurrentUrls = (<AppTab[]>result['new']).reduce((prevTabs, currTab) => `${prevTabs}${currTab.images.reduce((prevImages, currImage) => `${prevImages}${currImage.src}\n`, '')}\n`, '');
        this.ngZone.run(() => this.form.patchValue({ excludeUrls: `${excludeUrls}\n-- ${new Date().toLocaleString()}\n${allCurrentUrls}`.trim() }));
      }
    });
  }
}
