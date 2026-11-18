# Rollout

Rollout — панель управления feature flags. API хранит настройки отдельно для Development, Staging и Production. Процент rollout сохраняется как настройка для будущего распределения пользователей.

## Требования

- Node.js 24.18.0 и npm 11.16.0. Версия Node.js указана в [`.nvmrc`](frontend/.nvmrc).
- .NET SDK 10.0.404. Версия SDK указана в [`global.json`](global.json).
- Сборка Chromium от Playwright для E2E. Команда установки приведена ниже.

## Локальный запуск

В первом терминале из корня репозитория восстановите зависимости и запустите API.

```sh
dotnet restore backend/Rollout.slnx --locked-mode
dotnet run --project backend/Rollout.Api --launch-profile http --no-restore
```

Во втором терминале установите зависимости и запустите Angular.

```sh
cd frontend
npm ci
npm start
```

Откройте [список флагов](http://localhost:4200/flags). Angular проксирует запросы `/api/**` на `http://localhost:5155`. Можно проверить [ответ API через прокси](http://localhost:4200/api/flags) и открыть [Swagger UI](http://localhost:5155/swagger).

При старте API применяет миграции EF Core. По умолчанию база создаётся в `backend/Rollout.Api/rollout.db`.

| Переменная                   | Назначение                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConnectionStrings__Rollout` | Строка подключения к SQLite. Пример для отдельного файла — `Data Source=/path/to/rollout.db`. Если путь относительный, он отсчитывается от рабочей папки процесса API. |
| `ASPNETCORE_ENVIRONMENT`     | В обоих локальных профилях задано `Development`. В этом окружении доступны Swagger UI и документ OpenAPI.                                                              |

Для запуска API по HTTPS выполните из корня репозитория:

```sh
dotnet dev-certs https --trust
dotnet run --project backend/Rollout.Api --launch-profile https
```

Профиль `https` открывает [Swagger UI](https://localhost:7155/swagger) и [OpenAPI](https://localhost:7155/openapi/v1.json) на порту 7155. Для работы Angular через dev-прокси запускайте профиль `http` на порту 5155. Маршруты и DTO описаны в [контракте API](docs/api.md).

## Проверки frontend

Эти команды запускают сборку, линтер, проверку форматирования и тесты из `frontend/`.

```sh
npm run build
npm run lint
npm run format:check
npm run test:ci
npm run typecheck:e2e
```

`npm test` запускает Vitest в режиме наблюдения, а `npm run format` применяет форматирование. Сборка сначала подключает CSS темы Taiga UI, затем графитовую палитру Rollout и слои Tailwind. Preflight отключён, чтобы сохранить стандартные отступы обычного текста в диалогах.

## Проверки backend

```sh
dotnet restore backend/Rollout.slnx --locked-mode
dotnet build backend/Rollout.slnx --configuration Release --no-restore
dotnet test backend/Rollout.slnx --configuration Release --no-build
dotnet format backend/Rollout.slnx --verify-no-changes --no-restore
```

Интеграционные тесты применяют миграции к отдельным временным файлам SQLite. Для работы с миграциями выполните `dotnet tool restore` из `backend/`.

## E2E и доступность

После `dotnet restore backend/Rollout.slnx --locked-mode` из корня репозитория выполните команды из `frontend/`.

```sh
npm ci
npm exec -- playwright install chromium
npm run e2e
```

`npm run e2e` вызывает `ng e2e`. Playwright запускает Angular на `127.0.0.1:4210` и API на `127.0.0.1:5165`. Оба порта должны быть свободны. Для API используется сборка Release и отдельный файл SQLite во временной папке системы. После прогона процессы завершаются, а временная БД удаляется.

- Для запуска с открытым Chromium используйте `npm run e2e -- --headed`. Чтобы запустить только проверки доступности, добавьте `--grep accessibility`.
- HTML-отчёт создаётся в `frontend/playwright-report/index.html`. Открыть его из `frontend/` можно командой `npm exec -- playwright show-report`.
- При сбое trace и скриншот сохраняются в `frontend/test-results/` и доступны из отчёта.
- GitHub Actions устанавливает Chromium с Linux-зависимостями командой `npm exec -- playwright install --with-deps chromium`. При падении E2E workflow публикует отчёт, trace и скриншоты в артефакте `playwright-results`.

Этапы работы с агентом и результаты проверок описаны в [журнале разработки](docs/ai-development.md).
