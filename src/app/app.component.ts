import { Component } from '@angular/core';
import { displayName, version, author } from '../../package.json';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent {
  public displayName = displayName;
  public version = version;
  public author = author;
}
