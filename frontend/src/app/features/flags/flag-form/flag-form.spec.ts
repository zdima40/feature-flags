import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { appConfig } from '../../../app.config';
import { FlagResponse } from '../../../core/models/flag.model';
import { FlagForm } from './flag-form';

const timestamp = '2026-11-18T07:00:00Z';
const flag: FlagResponse = {
  id: '9fa3ca50-96bf-4a38-ae70-48e1ffaf5600',
  key: 'New_Checkout-2',
  name: 'Новая страница оплаты',
  description: 'Пробный запуск',
  createdAtUtc: timestamp,
  updatedAtUtc: timestamp,
  environments: [
    {
      environment: 'Development',
      enabled: false,
      rolloutPercentage: 0,
      updatedAtUtc: timestamp,
    },
    {
      environment: 'Staging',
      enabled: true,
      rolloutPercentage: 25,
      updatedAtUtc: timestamp,
    },
    {
      environment: 'Production',
      enabled: false,
      rolloutPercentage: 0,
      updatedAtUtc: timestamp,
    },
  ],
};
const editUrl = `/flags/${flag.id}/edit`;
const flagUrl = `/api/flags/${flag.id}`;

describe('FlagForm', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (query: string) =>
      Object.assign(new EventTarget(), { matches: false, media: query }),
    );
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    http.verify();
  });

  function element<T extends HTMLElement>(selector: string): T {
    const control = harness.routeNativeElement?.querySelector<T>(selector);
    if (!control) {
      throw new Error(`Missing element: ${selector}`);
    }
    return control;
  }

  function input(id: string): HTMLInputElement {
    return element<HTMLInputElement>(`#flag-${id}`);
  }

  function fill(id: string, value: string): void {
    const control = element<HTMLInputElement | HTMLTextAreaElement>(
      `#flag-${id}`,
    );
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function selectEnvironment(value: string): Promise<void> {
    const select = element<HTMLSelectElement>('#flag-environment');
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
  }

  function submit(): void {
    element('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  }

  function flagRequest() {
    // A pending resource keeps the fixture unstable until the GET is flushed.
    TestBed.tick();
    return http.expectOne({ method: 'GET', url: flagUrl });
  }

  function nextNavigation() {
    return firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
  }

  async function expectFlagList(environment?: string): Promise<void> {
    expect(router.url).toBe(
      environment ? `/flags?environment=${environment}` : '/flags',
    );
    TestBed.tick();
    const request = http.expectOne(
      (request) => request.method === 'GET' && request.url === '/api/flags',
    );
    expect(request.request.params.get('environment')).toBe(
      environment ?? 'Development',
    );
    request.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await harness.fixture.whenStable();
    expect(element('h2').textContent).toContain('Список флагов');
    expect(element<HTMLSelectElement>('#flag-environment').value).toBe(
      environment ?? 'Development',
    );
  }

  it('marks missing name and key after submission and sends no request', async () => {
    await harness.navigateByUrl('/flags/new', FlagForm);
    expect(input('key').disabled).toBe(false);
    expect(input('name').getAttribute('aria-invalid')).toBe('false');
    expect(input('key').getAttribute('aria-invalid')).toBe('false');
    expect(input('rollout').value).toBe('0');
    expect(input('enabled').checked).toBe(false);

    submit();
    await harness.fixture.whenStable();

    expect(input('name').getAttribute('aria-invalid')).toBe('true');
    expect(input('key').getAttribute('aria-invalid')).toBe('true');
    http.expectNone({ method: 'POST', url: '/api/flags' });
  });

  it.each([
    { field: 'name', value: '   ' },
    { field: 'key', value: 'Новый флаг!' },
    { field: 'rollout', value: '' },
    { field: 'rollout', value: '-1' },
    { field: 'rollout', value: '101' },
    { field: 'rollout', value: '12.5' },
  ])(
    'rejects $field with value "$value" before POST',
    async ({ field, value }) => {
      await harness.navigateByUrl('/flags/new', FlagForm);
      fill('name', flag.name);
      fill('key', flag.key);
      fill(field, value);
      submit();
      await harness.fixture.whenStable();

      expect(input(field).getAttribute('aria-invalid')).toBe('true');
      expect(element('[role="alert"]').textContent).toContain(
        'Проверьте отмеченные поля',
      );
      http.expectNone({ method: 'POST', url: '/api/flags' });
    },
  );

  it('sends initial settings for the selected environment and returns to the list after creation', async () => {
    await harness.navigateByUrl('/flags/new', FlagForm);
    fill('name', flag.name);
    fill('key', flag.key);
    fill('description', flag.description ?? '');
    await selectEnvironment('Staging');
    input('enabled').click();
    fill('rollout', '25');
    submit();
    await harness.fixture.whenStable();

    const post = http.expectOne({ method: 'POST', url: '/api/flags' });
    expect(post.request.body).toEqual({
      key: flag.key,
      name: flag.name,
      description: flag.description,
      environment: 'Staging',
      enabled: true,
      rolloutPercentage: 25,
    });
    expect(element('form').getAttribute('aria-busy')).toBe('true');
    expect(element<HTMLFieldSetElement>('form > fieldset').disabled).toBe(true);
    expect(harness.routeNativeElement?.textContent).toContain('Сохраняем флаг');
    submit();
    http.expectNone({ method: 'POST', url: '/api/flags' });

    const navigation = nextNavigation();
    post.flush(flag, { status: 201, statusText: 'Created' });
    await navigation;
    await expectFlagList('Staging');
  });

  it('updates the selected environment without sending the key and returns to the list', async () => {
    await harness.navigateByUrl(editUrl, FlagForm);
    const get = flagRequest();
    expect(harness.routeNativeElement?.textContent).toContain('Загружаем флаг');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    get.flush(flag);
    await harness.fixture.whenStable();

    expect(input('key').disabled).toBe(true);
    expect(input('key').value).toBe(flag.key);
    expect(input('name').value).toBe(flag.name);

    await selectEnvironment('Staging');
    expect(input('enabled').checked).toBe(true);
    expect(input('rollout').value).toBe('25');
    fill('rollout', '40');
    await selectEnvironment('Production');
    expect(input('enabled').checked).toBe(false);
    expect(input('rollout').value).toBe('0');
    await selectEnvironment('Staging');
    expect(input('rollout').value).toBe('40');
    await selectEnvironment('Production');
    expect(input('enabled').checked).toBe(false);
    expect(input('rollout').value).toBe('0');
    fill('description', '');
    input('enabled').click();
    fill('rollout', '100');
    submit();

    const patch = http.expectOne({ method: 'PATCH', url: flagUrl });
    expect(patch.request.body).toEqual({
      name: flag.name,
      description: null,
      environment: 'Production',
      enabled: true,
      rolloutPercentage: 100,
    });
    const navigation = nextNavigation();
    patch.flush({
      ...flag,
      description: null,
      environments: flag.environments.map((settings) =>
        settings.environment === 'Production'
          ? { ...settings, enabled: true, rolloutPercentage: 100 }
          : settings,
      ),
    });
    await navigation;
    await expectFlagList('Production');
  });

  it('handles a load failure and retries with GET', async () => {
    await harness.navigateByUrl(editUrl, FlagForm);
    flagRequest().flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await harness.fixture.whenStable();
    expect(element('[role="alert"]').textContent).toContain(
      'Не удалось загрузить флаг',
    );
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();

    element<HTMLButtonElement>('button').click();
    flagRequest().flush(flag);
    await harness.fixture.whenStable();
    expect(input('name').value).toBe(flag.name);
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'Не удалось загрузить флаг',
    );
  });

  it.each([
    {
      status: 409,
      body: { detail: 'A flag with this key already exists.' },
      message: 'Флаг с таким ключом уже существует.',
    },
    {
      status: 400,
      body: {
        errors: {
          name: ['Name is required.'],
          rolloutPercentage: ['Check rollout.'],
        },
      },
      message: 'Name is required.',
    },
  ])(
    'shows POST Problem Details for $status and keeps the form editable',
    async ({ status, body, message }) => {
      await harness.navigateByUrl('/flags/new', FlagForm);
      fill('name', flag.name);
      fill('key', flag.key);
      submit();
      http.expectOne({ method: 'POST', url: '/api/flags' }).flush(body, {
        status,
        statusText: 'Rejected',
        headers: { 'Content-Type': 'application/problem+json' },
      });
      await harness.fixture.whenStable();
      expect(router.url).toBe('/flags/new');
      expect(element('[role="alert"]').textContent).toContain(message);
      expect(element<HTMLFieldSetElement>('form > fieldset').disabled).toBe(
        false,
      );
      expect(input('key').value).toBe(flag.key);
      expect(input('name').value).toBe(flag.name);
      expect(harness.routeNativeElement?.textContent).not.toContain(
        'Флаг создан.',
      );
    },
  );

  it('preserves the rollout after a failed PATCH and cancels without another write', async () => {
    await harness.navigateByUrl(editUrl, FlagForm);
    flagRequest().flush(flag);
    await harness.fixture.whenStable();
    await selectEnvironment('Staging');
    fill('rollout', '55');
    submit();
    http.expectOne({ method: 'PATCH', url: flagUrl }).flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await harness.fixture.whenStable();
    expect(element('[role="alert"]').textContent).toContain(
      'Не удалось сохранить флаг',
    );
    expect(input('rollout').value).toBe('55');
    expect(element<HTMLFieldSetElement>('form > fieldset').disabled).toBe(
      false,
    );
    expect(router.url).toBe(editUrl);

    const navigation = nextNavigation();
    element<HTMLButtonElement>('form button[type="button"]').click();
    await navigation;
    await expectFlagList();
    http.expectNone({ method: 'PATCH', url: flagUrl });
  });
});
