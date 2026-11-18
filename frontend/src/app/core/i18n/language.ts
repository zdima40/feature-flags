import { DOCUMENT } from '@angular/common';
import { computed, inject, Service } from '@angular/core';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import { en } from './en';
import { ru } from './ru';

export type AppLanguage = 'en' | 'ru';
export const LANGUAGE_STORAGE_KEY = 'rollout.language';

export const translationProviders = provideTranslateService({
  fallbackLang: 'en',
  loader: provideTranslateLoader(() => ({
    getTranslation: (language: string) => of(language === 'ru' ? ru : en),
  })),
});

@Service()
export class Language {
  private readonly document = inject(DOCUMENT);
  private readonly translations = inject(TranslateService);

  readonly current = computed<AppLanguage>(() =>
    this.translations.currentLang() === 'ru' ? 'ru' : 'en',
  );

  initialize(): void {
    let language: string | null | undefined;
    try {
      language =
        this.document.defaultView?.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // Browser settings can disable access to localStorage.
    }
    this.apply(language === 'ru' ? 'ru' : 'en');
  }

  select(language: AppLanguage): void {
    this.apply(language);
    try {
      this.document.defaultView?.localStorage.setItem(
        LANGUAGE_STORAGE_KEY,
        language,
      );
    } catch {
      // The selection still applies to the current page.
    }
  }

  private apply(language: AppLanguage): void {
    this.translations.use(language);
    this.document.documentElement.lang = language;
  }
}
