/// <reference types='chrome'/>

import { Component, OnInit, NgZone } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

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
    enableExcludeUrls: false,
    excludeUrls: '',
    closeAfter: true,
  };

  constructor(private ngZone: NgZone, private formBuilder: FormBuilder) {}

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
    this.form.controls['enableExcludeUrls'].valueChanges.subscribe(value => {
      if (value) {
        this.form.controls['excludeUrls'].enable();
      } else {
        this.form.controls['excludeUrls'].disable();
      }
    });
  }
}
