import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';

describe('App', () => {
  beforeEach(() => {
    // jsdom does not implement the media queries Taiga UI uses during bootstrap.
    vi.stubGlobal('matchMedia', (query: string) =>
      Object.assign(new EventTarget(), { matches: false, media: query }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the Rollout heading inside the dark theme', async () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const fixture = TestBed.createComponent(App);

    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(
      page
        .querySelector('tui-root[tuiTheme="dark"] main h1')
        ?.textContent?.trim(),
    ).toBe('Rollout');
  });
});
