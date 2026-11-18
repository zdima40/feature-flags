import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TuiRoot } from '@taiga-ui/core';
import { TuiSegmented } from '@taiga-ui/kit';
import { Language } from './core/i18n/language';

@Component({
  imports: [RouterOutlet, TranslatePipe, TuiRoot, TuiSegmented],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly language = inject(Language);
}
