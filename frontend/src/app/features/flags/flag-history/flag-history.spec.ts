import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { FlagAuditEvent, PageResponse } from '../../../core/models/flag.model';
import { FlagHistory } from './flag-history';

const flagId = '9fa3ca50-96bf-4a38-ae70-48e1ffaf5600';
const created: FlagAuditEvent = {
  id: 'created-event',
  featureFlagId: flagId,
  environment: null,
  field: 'created',
  oldValue: null,
  newValue: 'new-checkout',
  actor: 'demo-user',
  changedAtUtc: '2026-11-18T07:00:00Z',
};
const updated: FlagAuditEvent = {
  ...created,
  id: 'updated-event',
  environment: 'Staging',
  field: 'rolloutPercentage',
  oldValue: '0',
  newValue: '25',
  changedAtUtc: '2026-11-18T07:25:00Z',
};

function result(
  items: FlagAuditEvent[],
  totalCount = items.length,
  page = 1,
): PageResponse<FlagAuditEvent> {
  return { items, totalCount, page, pageSize: 20 };
}

describe('FlagHistory', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (query: string) =>
      Object.assign(new EventTarget(), { matches: false, media: query }),
    );
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/flags/${flagId}/history`, FlagHistory);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    http.verify();
  });

  function historyRequest(page = 1) {
    TestBed.tick();
    return http.expectOne({
      method: 'GET',
      url: `/api/flags/${flagId}/history?page=${page}&pageSize=20`,
    });
  }

  it('renders the API order, changed values, actor and browser-local time', async () => {
    historyRequest().flush(result([updated, created]));
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement!;
    const rows = page.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Staging');
    expect(rows[0].querySelector('th')?.textContent).toContain('Rollout');
    expect(
      Array.from(rows[0].cells)
        .slice(2)
        .map((cell) => cell.textContent.trim()),
    ).toEqual(['0', '25', 'demo-user']);
    expect(rows[1].querySelector('th')?.textContent).toContain('Флаг создан');
    expect(rows[1].cells[2].textContent.trim()).toBe('—');
    expect(rows[1].cells[3].textContent.trim()).toBe(created.newValue);
    const time = rows[0].querySelector('time');
    expect(time?.dateTime).toBe(updated.changedAtUtc);
    expect(time?.textContent?.trim()).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(updated.changedAtUtc)),
    );
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/flags');
  });

  it('requests both pages from the server and uses the total event count', async () => {
    historyRequest().flush(result([updated], 21));
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement!;
    const [previous, next] =
      page.querySelectorAll<HTMLButtonElement>('nav button');
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(page.textContent).toContain('Всего событий: 21');
    expect(page.textContent).toMatch(/Страница 1\s+из 2/);

    next.click();
    const second = historyRequest(2);
    expect(page.textContent).toContain('Загружаем историю');
    second.flush(result([created], 21, 2));
    await harness.fixture.whenStable();
    expect(page.querySelector('tbody')?.textContent).toContain('Флаг создан');
    expect(page.textContent).toMatch(/Страница 2\s+из 2/);
    expect(next.getAttribute('aria-disabled')).toBe('true');

    previous.click();
    historyRequest().flush(result([updated], 21));
    await harness.fixture.whenStable();
    expect(page.querySelector('tbody')?.textContent).toContain('Rollout');
    expect(page.textContent).toMatch(/Страница 1\s+из 2/);
  });

  it('shows an error, retries the request and handles empty history', async () => {
    historyRequest().flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement!;
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Не удалось загрузить историю флага',
    );
    expect(page.textContent).not.toContain('Событий пока нет');
    page.querySelector<HTMLButtonElement>('[role="alert"] + button')!.click();
    historyRequest().flush(result([]));
    await harness.fixture.whenStable();

    expect(page.querySelector('[role="status"]')?.textContent).toContain(
      'Событий пока нет',
    );
    expect(page.textContent).toContain('Всего событий: 0');
    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelector('table')).toBeNull();
  });
});
