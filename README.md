# Rollout

Rollout — панель управления feature flags. API хранит настройки отдельно для Development, Staging и Production. Процент rollout сохраняется как настройка для будущего распределения пользователей.

## Локальный запуск frontend

Используйте Node.js 24.18.0 и npm 11.16.0. Из корня репозитория запустите API в отдельном терминале:

```sh
dotnet run --project backend/Rollout.Api --launch-profile http
```

Во втором терминале выполните:

```sh
cd frontend
npm ci
npm start
```

Angular доступен на [http://localhost:4200](http://localhost:4200). Dev-сервер направляет запросы `/api/*` на `http://localhost:5155`, включая вложенные маршруты. Для проверки откройте [список флагов через прокси](http://localhost:4200/api/flags).

## Локальный запуск backend

Установите [.NET SDK 10.0.404](https://dotnet.microsoft.com/en-us/download/dotnet/10.0). Выполняйте команды из корня репозитория.

```sh
dotnet restore backend/Rollout.slnx --locked-mode
dotnet dev-certs https --trust
dotnet run --project backend/Rollout.Api --launch-profile https
```

- Swagger UI доступен по адресу [https://localhost:7155/swagger](https://localhost:7155/swagger). Для пробного запроса раскройте `GET /api/flags` и нажмите `Try it out` → `Execute`.
- Документ OpenAPI доступен по адресу [https://localhost:7155/openapi/v1.json](https://localhost:7155/openapi/v1.json). Оба адреса включены в окружении `Development`.
- Для локального HTTP-прокси используйте профиль `http` на [http://localhost:5155](http://localhost:5155).

При старте API применяет миграции EF Core. По умолчанию база создаётся в `backend/Rollout.Api/rollout.db`. Для другого файла задайте переменную `ConnectionStrings__Rollout`, например `Data Source=/path/to/rollout.db`. Явно заданный относительный путь отсчитывается от рабочей папки процесса.

Описание маршрутов и DTO приведено в [контракте API](docs/api.md).

## Проверки backend

```sh
dotnet restore backend/Rollout.slnx --locked-mode
dotnet build backend/Rollout.slnx --no-restore
dotnet test backend/Rollout.slnx --no-build
dotnet format backend/Rollout.slnx --verify-no-changes --no-restore
```

Интеграционные тесты применяют миграции к отдельным временным файлам SQLite. Для работы с миграциями выполните `dotnet tool restore` из `backend/`.
