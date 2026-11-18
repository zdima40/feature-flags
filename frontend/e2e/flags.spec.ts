import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('creates a flag, changes one environment and shows the audit history', async ({
  page,
}) => {
  const key = `checkout-${randomUUID()}`;
  const name = `Оплата ${key}`;
  await page.goto('/flags');
  await page.getByRole('link', { name: 'Создать флаг' }).click();
  await page.getByLabel('Название', { exact: true }).fill(name);
  await page.getByLabel('Ключ', { exact: true }).fill(key);
  const environment = page.getByLabel('Окружение', { exact: true });
  const enabled = page.getByLabel('Флаг включён');
  const rollout = page.getByRole('spinbutton', { name: 'Rollout (%)' });
  const save = page.getByRole('button', { name: 'Сохранить' });
  await environment.selectOption('Staging');
  await enabled.check();
  await rollout.fill('25');
  await save.click();
  await expect(
    page.getByRole('heading', { name: 'Редактирование флага' }),
  ).toBeVisible();
  await expect(page.getByLabel('Ключ', { exact: true })).toBeDisabled();
  await expect(environment).toHaveValue('Staging');
  await expect(enabled).toBeChecked();
  await expect(rollout).toHaveValue('25');

  await enabled.uncheck();
  await rollout.fill('60');
  await save.click();
  await expect(
    page.getByText('Флаг сохранён. Настройки Staging обновлены.'),
  ).toBeVisible();
  await page.reload();
  for (const other of ['Development', 'Production']) {
    await environment.selectOption(other);
    await expect(enabled).not.toBeChecked();
    await expect(rollout).toHaveValue('0');
  }
  await environment.selectOption('Staging');
  await expect(enabled).not.toBeChecked();
  await expect(rollout).toHaveValue('60');

  await page.getByRole('button', { name: 'Отмена' }).click();
  await page.getByRole('searchbox', { name: 'Поиск' }).fill(key);
  await page.getByRole('link', { name: `История флага «${name}»` }).click();
  const rows = page.getByRole('row');
  await expect(rows).toHaveCount(4);
  const status = rows.filter({ hasText: 'Статус' });
  await expect(status.getByRole('rowheader')).toHaveText(/Статус\s+Staging/);
  await expect(
    status.getByRole('cell', { name: 'true', exact: true }),
  ).toBeVisible();
  await expect(
    status.getByRole('cell', { name: 'false', exact: true }),
  ).toBeVisible();
  const change = rows.filter({ hasText: 'Rollout' });
  await expect(change.getByRole('rowheader')).toHaveText(/Rollout\s+Staging/);
  await expect(
    change.getByRole('cell', { name: '25', exact: true }),
  ).toBeVisible();
  await expect(
    change.getByRole('cell', { name: '60', exact: true }),
  ).toBeVisible();
  await expect(rows.last().getByRole('rowheader')).toHaveText('Флаг создан');
  await expect(rows.last().getByRole('cell', { name: key })).toBeVisible();
  await expect(
    rows.last().getByRole('cell', { name: 'demo-user' }),
  ).toBeVisible();
});

test('searches by name and key, filters by environment and status, and paginates', async ({
  page,
  request,
}) => {
  const prefix = `page-${randomUUID()}`;
  const name = `Поиск ${prefix.slice(5)}`;
  for (let i = 0; i <= 20; i++) {
    const response = await request.post('/api/flags', {
      data: {
        name,
        key: `${prefix}-${String(i).padStart(2, '0')}`,
        environment: 'Development',
        enabled: i === 20,
        rolloutPercentage: 0,
      },
    });
    await expect(response).toBeOK();
  }

  await page.goto('/flags');
  const search = page.getByRole('searchbox', { name: 'Поиск' });
  const next = page.getByRole('button', { name: 'Вперёд' });
  const rows = page.getByRole('row');
  await search.fill(name);
  await expect(page.getByText('Всего флагов: 21')).toBeVisible();
  await expect(rows).toHaveCount(21);
  await next.click();
  await expect(page.getByText('Страница 2 из 2')).toBeVisible();
  await expect(rows).toHaveCount(2);
  await expect(rows.last()).toContainText(`${prefix}-20`);

  const status = page.getByLabel('Статус', { exact: true });
  await status.selectOption('true');
  await expect(page.getByText('Страница 1 из 1')).toBeVisible();
  await expect(
    page.getByText('Всего флагов: 1', { exact: true }),
  ).toBeVisible();
  await expect(rows.last()).toContainText(`${prefix}-20`);
  await page
    .getByLabel('Окружение', { exact: true })
    .selectOption('Production');
  await expect(
    page.getByText('По заданным фильтрам флаги не найдены.'),
  ).toBeVisible();
  await status.selectOption('false');
  await expect(page.getByText('Всего флагов: 21')).toBeVisible();
  await next.click();
  await expect(page.getByText('Страница 2 из 2')).toBeVisible();
  await search.fill(`${prefix}-00`);
  await expect(page.getByText('Страница 1 из 1')).toBeVisible();
  await expect(rows).toHaveCount(2);
  await expect(rows.last()).toContainText(`${prefix}-00`);
});

test('keeps the confirmed status after a failed quick toggle and retries', async ({
  page,
  request,
}) => {
  const key = `toggle-${randomUUID()}`;
  const response = await request.post('/api/flags', {
    data: {
      name: key,
      key,
      environment: 'Development',
      enabled: false,
      rolloutPercentage: 0,
    },
  });
  await expect(response).toBeOK();
  await page.route('**/api/flags/*', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({ status: 500 })
      : route.fallback(),
  );

  await page.goto('/flags');
  await page.getByRole('searchbox', { name: 'Поиск' }).fill(key);
  const toggle = page.getByRole('switch', { name: `Статус флага «${key}»` });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(page.getByRole('alert')).toContainText(
    'Не удалось обновить статус',
  );
  await expect(toggle).not.toBeChecked();

  await page.unroute('**/api/flags/*');
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.reload();
  await page.getByRole('searchbox', { name: 'Поиск' }).fill(key);
  await expect(toggle).toBeChecked();
});
