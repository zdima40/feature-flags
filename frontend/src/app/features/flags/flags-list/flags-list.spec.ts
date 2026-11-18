import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { appConfig } from '../../../app.config';
import {
  FlagListItem,
  FlagResponse,
  PageResponse,
} from '../../../core/models/flag.model';
import { FlagsList } from './flags-list';

const flag: FlagListItem = {
  id: '9fa3ca50-96bf-4a38-ae70-48e1ffaf5600',
  key: 'new-checkout',
  name: 'Новая страница оплаты',
  description: 'Пробный запуск',
  environment: 'Development',
  enabled: false,
  rolloutPercentage: 25,
  updatedAtUtc: '2026-11-18T07:00:00Z',
};

const enabledFlag: FlagListItem = { ...flag, enabled: true };
const updatedFlag: FlagResponse = {
  id: flag.id,
  key: flag.key,
  name: flag.name,
  description: flag.description,
  createdAtUtc: flag.updatedAtUtc,
  updatedAtUtc: flag.updatedAtUtc,
  environments: [enabledFlag],
};

function result(
  items: FlagListItem[],
  totalCount = items.length,
  page = 1,
): PageResponse<FlagListItem> {
  return { items, totalCount, page, pageSize: 20 };
}

describe('FlagsList', () => {
  let fixture: ComponentFixture<FlagsList>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) =>
      Object.assign(new EventTarget(), { matches: false, media: query }),
    );
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FlagsList);
    page = fixture.nativeElement;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    http.verify();
  });

  function element<T extends HTMLElement>(selector: string): T {
    const item = page.querySelector<T>(selector);
    if (!item) {
      throw new Error(`Missing element: ${selector}`);
    }
    return item;
  }

  function listRequest(
    params: Partial<
      Record<'environment' | 'page' | 'enabled' | 'search', string>
    > = {},
  ) {
    // The resource keeps the fixture unstable until this request is flushed.
    TestBed.tick();
    const request = http.expectOne(
      (request) => request.method === 'GET' && request.url === '/api/flags',
      'GET flags page',
    );
    const query = request.request.params;
    expect(
      Object.fromEntries(query.keys().map((key) => [key, query.get(key)])),
    ).toEqual({
      environment: 'Development',
      page: '1',
      pageSize: '20',
      ...params,
    });
    return request;
  }

  function changeFilter(selector: string, value: string): void {
    const input = element<HTMLInputElement | HTMLSelectElement>(selector);
    input.value = value;
    input.dispatchEvent(
      new Event(input instanceof HTMLInputElement ? 'input' : 'change'),
    );
  }

  it('loads the first page, displays flag details and provides links', async () => {
    const request = listRequest();
    expect(page.textContent).toContain('Загружаем флаги');

    request.flush(result([flag], 38));
    await fixture.whenStable();

    const row = element<HTMLTableRowElement>('tbody tr');
    for (const text of [
      flag.name,
      flag.key,
      flag.description,
      flag.environment,
      'Выключен',
      '25%',
    ]) {
      expect(row.textContent).toContain(text);
    }
    expect(row.querySelector('time')?.dateTime).toBe(flag.updatedAtUtc);
    expect(page.textContent).toContain('Всего флагов: 38');
    expect(
      Array.from(page.querySelectorAll('a'), (link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/flags/new',
      `/flags/${flag.id}/edit`,
      `/flags/${flag.id}/history`,
    ]);
  });

  it.each([
    {
      selector: '#flag-environment',
      value: 'Staging',
      params: { environment: 'Staging' },
    },
    {
      selector: '#flag-search',
      value: ' new-checkout ',
      params: { search: 'new-checkout' },
    },
    { selector: '#flag-status', value: 'false', params: { enabled: 'false' } },
  ])(
    'resets to page one when $selector changes',
    async ({ selector, value, params }) => {
      listRequest().flush(result([flag], 21));
      await fixture.whenStable();

      element<HTMLButtonElement>('nav button:last-child').click();
      listRequest({ page: '2' }).flush(result([flag], 21, 2));
      await fixture.whenStable();
      expect(page.textContent).toMatch(/Страница 2\s+из 2/);

      changeFilter(selector, value);
      listRequest(params).flush(result([]));
      await fixture.whenStable();
      expect(page.textContent).toMatch(/Страница 1\s+из 1/);
      expect(page.textContent).toContain('Всего флагов: 0');
    },
  );

  it('shows the empty state and prevents paging past the result', async () => {
    listRequest().flush(result([]));
    await fixture.whenStable();

    expect(page.textContent).toContain('Флагов пока нет');
    expect(page.querySelector('table')).toBeNull();
    const next = element<HTMLButtonElement>('nav button:last-child');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    next.click();
    await fixture.whenStable();
    http.expectNone((request) => request.url === '/api/flags');
  });

  it('shows a load error and retries the same request', async () => {
    listRequest().flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await fixture.whenStable();

    expect(page.textContent).toContain('Не удалось загрузить список флагов');
    element<HTMLButtonElement>('[role="alert"] + button').click();
    listRequest().flush(result([flag]));
    await fixture.whenStable();
    expect(page.textContent).toContain(flag.name);
    expect(page.textContent).not.toContain(
      'Не удалось загрузить список флагов',
    );
  });

  it('keeps the confirmed status and re-enables the switch after a failed PATCH', async () => {
    listRequest().flush(result([enabledFlag]));
    await fixture.whenStable();

    const toggle = element<HTMLInputElement>('[role="switch"]');
    expect(toggle.checked).toBe(true);
    expect(toggle.getAttribute('aria-disabled')).toBe('false');
    expect(toggle.disabled).toBe(false);
    toggle.click();
    TestBed.tick();
    expect(page.textContent).toContain('Сохранение');
    const patch = http.expectOne({
      method: 'PATCH',
      url: `/api/flags/${flag.id}`,
    });
    expect(patch.request.body).toEqual({
      environment: 'Development',
      enabled: false,
    });
    await fixture.whenStable();
    expect(toggle.checked).toBe(true);
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    toggle.click();
    TestBed.tick();
    http.expectNone((request) => request.method === 'PATCH');

    patch.flush(null, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();
    expect(toggle.checked).toBe(true);
    expect(toggle.getAttribute('aria-disabled')).toBe('false');
    expect(element('[role="alert"]').textContent).toContain(
      'Не удалось обновить статус',
    );
  });

  it('shows the saved status after refreshing the page', async () => {
    listRequest().flush(result([flag]));
    await fixture.whenStable();
    const toggle = element<HTMLInputElement>('[role="switch"]');

    toggle.click();
    const patch = http.expectOne({
      method: 'PATCH',
      url: `/api/flags/${flag.id}`,
    });
    expect(patch.request.body).toEqual({
      environment: 'Development',
      enabled: true,
    });
    expect(toggle.checked).toBe(false);
    patch.flush(updatedFlag);
    listRequest().flush(result([enabledFlag]));
    await fixture.whenStable();

    expect(toggle.checked).toBe(true);
    expect(page.textContent).toContain('в Development обновлён');
  });

  it('moves to the last available page if toggling removes a filtered row', async () => {
    listRequest().flush(result([flag]));
    await fixture.whenStable();
    changeFilter('#flag-status', 'false');
    listRequest({ enabled: 'false' }).flush(result([flag], 21));
    await fixture.whenStable();
    element<HTMLButtonElement>('nav button:last-child').click();
    listRequest({ enabled: 'false', page: '2' }).flush(result([flag], 21, 2));
    await fixture.whenStable();

    element<HTMLInputElement>('[role="switch"]').click();
    TestBed.tick();
    http
      .expectOne({ method: 'PATCH', url: `/api/flags/${flag.id}` })
      .flush(updatedFlag);
    listRequest({ enabled: 'false', page: '2' }).flush(result([], 20, 2));
    listRequest({ enabled: 'false' }).flush(
      result([{ ...flag, id: 'other-flag' }], 20),
    );
    await fixture.whenStable();

    expect(page.textContent).toContain('Всего флагов: 20');
    expect(page.textContent).toMatch(/Страница 1\s+из 1/);
  });

  it('refreshes a pending search when the status changes', async () => {
    listRequest().flush(result([flag]));
    await fixture.whenStable();

    element<HTMLInputElement>('[role="switch"]').click();
    const patch = http.expectOne({
      method: 'PATCH',
      url: `/api/flags/${flag.id}`,
    });
    changeFilter('#flag-search', 'checkout');
    const earlierGet = listRequest({ search: 'checkout' });

    patch.flush(updatedFlag);
    listRequest({ search: 'checkout' }).flush(result([enabledFlag]));
    await fixture.whenStable();

    expect(earlierGet.cancelled).toBe(true);
    expect(element<HTMLInputElement>('[role="switch"]').checked).toBe(true);
  });
});
