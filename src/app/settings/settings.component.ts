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

  constructor(private ngZone: NgZone, private formBuilder: FormBuilder) {}

  ngOnInit() {
    this.form = this.formBuilder.group({
      imageExtensions: 'jpg,jpeg,png,bmp,gif',
      minWidth: 100,
      minHeight: 100,
      closeAfter: true,
    });

    this.load();
    this.subscribeChanges();
  }

  load() {
    chrome.storage.local.get(['settings'], result =>
      this.ngZone.run(() => {
        if (result['settings']) {
          this.form.setValue(result['settings']);
        } else {
          chrome.storage.local.set({ settings: this.form.value });
        }
      })
    );
  }

  subscribeChanges() {
    this.form.valueChanges.subscribe(value => {
      chrome.storage.local.set({ settings: value });
    });
  }
}
