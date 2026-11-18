import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  computed,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  signal,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideTaiga, TUI_DARK_MODE, tuiIconsProvider } from '@taiga-ui/core';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { TUI_ENGLISH_LANGUAGE } from '@taiga-ui/i18n/languages/english';
import { TUI_RUSSIAN_LANGUAGE } from '@taiga-ui/i18n/languages/russian';
import { routes } from './app.routes';
import { Language, translationProviders } from './core/i18n/language';
import { LocalizedTitle } from './core/i18n/localized-title';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    translationProviders,
    provideAppInitializer(() => inject(Language).initialize()),
    { provide: TitleStrategy, useClass: LocalizedTitle },
    {
      provide: TUI_DARK_MODE,
      useFactory: () => {
        // Rollout has a fixed theme, so Taiga UI does not need to access storage.
        const dark = signal(true);
        return Object.assign(dark, { reset: () => dark.set(true) });
      },
    },
    provideTaiga({ mode: 'dark' }),
    {
      provide: TUI_LANGUAGE,
      useFactory: () => {
        const language = inject(Language).current;
        return computed(() =>
          language() === 'ru' ? TUI_RUSSIAN_LANGUAGE : TUI_ENGLISH_LANGUAGE,
        );
      },
    },
    tuiIconsProvider({
      '@tui.chevron-down':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '@tui.chevron-left':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '@tui.chevron-right':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    }),
  ],
};
