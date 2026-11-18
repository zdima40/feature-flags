import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 900 } });

test('switches live content with the keyboard and restores the selection after reload', async ({
  page,
}) => {
  await page.goto('/flags/new');
  const html = page.locator('html');
  const english = page.getByRole('radio', { name: 'English' });
  const russian = page.getByRole('radio', { name: 'Русский' });
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(english).toBeChecked();
  await expect(page).toHaveTitle('Create flag | Rollout');
  const axe = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ]);
  expect((await axe.analyze()).violations).toEqual([]);
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Draft flag');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Check the marked fields.',
  );

  await english.focus();
  await page.keyboard.press('ArrowRight');
  await expect(russian).toBeFocused();
  await expect(russian).toBeChecked();
  await expect(html).toHaveAttribute('lang', 'ru');
  await expect(page).toHaveTitle('Создать флаг | Rollout');
  await expect(page.getByRole('textbox', { name: 'Название' })).toHaveValue(
    'Draft flag',
  );
  await expect(page.getByRole('alert')).toContainText(
    'Проверьте отмеченные поля.',
  );

  await page.reload();
  await expect(russian).toBeChecked();
  await expect(html).toHaveAttribute('lang', 'ru');
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(
    page.getByRole('heading', { name: 'Список флагов' }),
  ).toBeVisible();
  const status = page.getByRole('combobox', { name: 'Статус' });
  await status.selectOption({ label: 'Выключенные' });

  await english.check();
  await expect(
    page.getByRole('heading', { name: 'Feature flags' }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue(
    'Disabled',
  );
  await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
  await page.reload();
  await expect(english).toBeChecked();
  await expect(html).toHaveAttribute('lang', 'en');
});
