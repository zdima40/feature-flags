import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  computed,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTaiga, tuiIconsProvider } from '@taiga-ui/core';
import { TUI_PAGINATION_TEXTS } from '@taiga-ui/kit';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    provideTaiga({ mode: 'dark' }),
    {
      provide: TUI_PAGINATION_TEXTS,
      useValue: computed(() => ['Назад', 'Вперёд'] as const),
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
