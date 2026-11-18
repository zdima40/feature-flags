import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

async function checkPage(page: Page): Promise<void> {
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsViewport, `${page.url()} should not scroll horizontally`).toBe(
    true,
  );

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations, page.url()).toEqual([]);
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  await expect(target.and(page.locator(':focus-visible'))).toBeFocused();
}

async function checkTextfield(field: Locator): Promise<void> {
  await expect(field).toBeVisible();
  const height = await field.evaluate(
    (input) => input.getBoundingClientRect().height,
  );
  expect(height).toBeGreaterThanOrEqual(44);
}

for (const width of [1440, 390]) {
  test.describe(`accessibility at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('checks the list, form, and history with axe and keyboard navigation', async ({
      page,
      request,
    }) => {
      await page.addInitScript(() =>
        localStorage.setItem('rollout.language', 'ru'),
      );
      const key = `accessibility-${randomUUID()}`;
      const created = await request.post('/api/flags', {
        data: {
          name: key,
          key,
          description: 'Проверка доступности',
          environment: 'Development',
          enabled: true,
          rolloutPercentage: 25,
        },
      });
      await expect(created).toBeOK();
      const location = created.headers()['location'];
      const id = location.split('/').at(-1);

      await page.goto('/flags/new');
      const name = page.getByRole('textbox', { name: 'Название' });
      const keyField = page.getByRole('textbox', { name: 'Ключ' });
      const rollout = page.getByRole('textbox', { name: 'Rollout (%)' });
      const language = page.getByRole('radio', { name: 'Русский' });
      await checkTextfield(name);
      await checkTextfield(keyField);
      await checkTextfield(rollout);
      await checkPage(page);
      await tabTo(page, language);
      await tabTo(page, name);
      await tabTo(page, keyField);
      await tabTo(page, page.getByRole('textbox', { name: 'Описание' }));
      const development = page.getByRole('tab', { name: 'Development' });
      const staging = page.getByRole('tab', { name: 'Staging' });
      const production = page.getByRole('tab', { name: 'Production' });
      await tabTo(page, development);
      await expect(development).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(staging).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(staging).toHaveAttribute('aria-selected', 'true');
      await expect(
        page.getByRole('tabpanel', { name: 'Staging' }),
      ).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await expect(production).toBeFocused();
      await page.keyboard.press('Space');
      await expect(production).toHaveAttribute('aria-selected', 'true');
      const formSwitch = page.getByRole('switch', { name: 'Флаг включён' });
      await tabTo(page, formSwitch);
      await page.keyboard.press('Space');
      await expect(formSwitch).toBeChecked();
      await tabTo(page, rollout);
      await page.keyboard.press('ArrowUp');
      await expect(rollout).toHaveValue('1%');
      await page.keyboard.press('ArrowDown');
      await expect(rollout).toHaveValue('0%');
      const save = page.getByRole('button', { name: 'Сохранить' });
      await tabTo(page, save);
      await tabTo(page, page.getByRole('button', { name: 'Отмена' }));
      await page.keyboard.press('Shift+Tab');
      await expect(save).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('alert')).toContainText(
        'Проверьте отмеченные поля.',
      );
      await checkPage(page);

      await page.goto(`/flags/${id}/edit`);
      await expect(name).toHaveValue(key);
      await checkPage(page);

      await page.goto('/flags');
      const search = page.getByRole('searchbox', { name: 'Поиск' });
      const environment = page.getByRole('combobox', { name: 'Окружение' });
      const status = page.getByRole('combobox', { name: 'Статус' });
      const history = page.getByRole('link', {
        name: `История флага «${key}»`,
      });
      await expect(history).toBeVisible();
      await checkTextfield(search);
      await checkTextfield(environment);
      await checkTextfield(status);
      await checkPage(page);
      await tabTo(page, language);
      await tabTo(page, page.getByRole('link', { name: 'Создать флаг' }));
      await tabTo(page, search);
      await page.keyboard.insertText(key);
      await expect(
        page.getByText('Всего флагов: 1', { exact: true }),
      ).toBeVisible();
      await tabTo(page, environment);
      await tabTo(page, status);
      await tabTo(page, page.getByRole('region', { name: 'Таблица флагов' }));
      await tabTo(
        page,
        page.getByRole('switch', { name: `Статус флага «${key}»` }),
      );
      await tabTo(
        page,
        page.getByRole('link', { name: `Изменить флаг «${key}»` }),
      );
      await tabTo(page, history);
      await expect(history).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('rowheader', { name: 'Флаг создан' }),
      ).toBeVisible();
      await checkPage(page);

      // Use a fresh document to check the history page's starting tab order.
      await page.reload();
      await expect(
        page.getByRole('rowheader', { name: 'Флаг создан' }),
      ).toBeVisible();
      const back = page.getByRole('link', { name: 'К списку флагов' });
      await tabTo(page, language);
      await tabTo(page, back);
      await tabTo(page, page.getByRole('region', { name: 'Таблица событий' }));
      await page.keyboard.press('Shift+Tab');
      await expect(back).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('heading', { name: 'Список флагов' }),
      ).toBeVisible();
    });
  });
}
