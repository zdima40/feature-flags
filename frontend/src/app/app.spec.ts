import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';
import { LANGUAGE_STORAGE_KEY } from './core/i18n/language';

describe('App', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(() => {
    // jsdom does not implement the media queries Taiga UI uses during bootstrap.
    vi.stubGlobal('matchMedia', (query: string) =>
      Object.assign(new EventTarget(), { matches: false, media: query }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the Rollout heading and defaults to English for an unknown preference', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    const page = await render();
    expect(
      page
        .querySelector('tui-root[tuiTheme="dark"] main h1')
        ?.textContent?.trim(),
    ).toBe('Rollout');
    expect(document.documentElement.lang).toBe('en');
    expect(
      page.querySelector('[role="radiogroup"]')?.getAttribute('aria-label'),
    ).toBe('Interface language');
    expect(
      page.querySelector<HTMLInputElement>('input[value=en]')?.checked,
    ).toBe(true);
  });

  it('restores Russian and persists a new selection', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ru');
    const page = await render();
    expect(document.documentElement.lang).toBe('ru');
    expect(
      page.querySelector<HTMLInputElement>('input[value=ru]')?.checked,
    ).toBe(true);

    page.querySelector<HTMLInputElement>('input[value=en]')?.click();
    await fixture.whenStable();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('allows changing the language when localStorage is unavailable', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError');
    });
    const page = await render();
    expect(document.documentElement.lang).toBe('en');

    page.querySelector<HTMLInputElement>('input[value=ru]')?.click();
    await fixture.whenStable();
    expect(document.documentElement.lang).toBe('ru');
    expect(
      page.querySelector('[role="radiogroup"]')?.getAttribute('aria-label'),
    ).toBe('Язык интерфейса');
  });
});
