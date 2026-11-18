import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class LocalizedTitle extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translations = inject(TranslateService);
  private readonly key = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const key = this.key();
      const label = key ? this.translations.instant(key) : undefined;
      this.title.setTitle(
        typeof label === 'string' ? `${label} | Rollout` : 'Rollout',
      );
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot));
  }
}
