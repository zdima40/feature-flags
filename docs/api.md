# HTTP API Rollout

| Метод и путь                  | Ответ при успехе                                |
| ----------------------------- | ----------------------------------------------- |
| `GET /api/flags`              | `200`, страница флагов для выбранного окружения |
| `GET /api/flags/{id}`         | `200`, флаг со всеми тремя окружениями          |
| `POST /api/flags`             | `201`, созданный флаг и заголовок `Location`    |
| `PATCH /api/flags/{id}`       | `200`, обновлённый флаг                         |
| `GET /api/flags/{id}/history` | `200`, страница событий аудита                  |

Идентификаторы `id` имеют формат UUID. Даты передаются по ISO 8601 в UTC.

При локальном запуске API доступны [Swagger UI](http://localhost:5155/swagger) и [документ OpenAPI](http://localhost:5155/openapi/v1.json).

## Создание и обновление

Тело `POST` включает `key`, `name`, `environment`, `enabled`, `rolloutPercentage` и необязательное `description`.

```json
{
  "key": "New-Checkout",
  "name": "Новая страница оплаты",
  "description": "Пробный запуск",
  "environment": "Staging",
  "enabled": true,
  "rolloutPercentage": 25
}
```

Ключ допускает латинские буквы, цифры, дефис и подчёркивание. SQLite проверяет уникальность ключа без учёта регистра. API сохраняет исходное написание. Имя должно содержать хотя бы один непробельный символ. Значения `environment` совпадают по регистру с `Development`, `Staging` или `Production`. Процент rollout задаётся целым числом от 0 до 100. При создании два остальных окружения получают `enabled: false` и `rolloutPercentage: 0`.

В `PATCH` можно передать `name`, `description`, `environment`, `enabled` и `rolloutPercentage`. Пропущенные значения сохраняются. `description: null` очищает описание. Остальные переданные поля требуют значения. `key` неизменяем и должен отсутствовать в теле. При передаче `enabled` или `rolloutPercentage` укажите `environment`.

```json
{
  "description": null,
  "environment": "Staging",
  "enabled": false,
  "rolloutPercentage": 0
}
```

Объект флага в ответе содержит `id`, `key`, `name`, `description`, `createdAtUtc`, `updatedAtUtc` и массив `environments`. Каждая запись `environments` содержит `environment`, `enabled`, `rolloutPercentage` и `updatedAtUtc`. Дата флага относится к общим полям, дата окружения — к его настройкам. Повтор запроса с теми же значениями сохраняет даты и историю.

## Список и история

Оба маршрута возвращают объект с `items`, `totalCount`, `page` и `pageSize`. По умолчанию `page=1` и `pageSize=20`. Диапазон `pageSize` — от 1 до 100. Страница за пределами результатов содержит пустой `items` и полное `totalCount` с учётом фильтров.

- **Список.** `environment` по умолчанию равен `Development`. `search` ищет подстроку имени или ключа. Поиск игнорирует регистр латинских букв. `enabled` принимает `true` или `false`. Пустой либо пропущенный фильтр статуса возвращает флаги с обоими статусами. Элемент списка содержит `id`, `key`, `name`, `description`, `environment`, `enabled`, `rolloutPercentage` и `updatedAtUtc` с самой поздней датой общих полей и выбранного окружения. Сортировка идёт по возрастанию ключа без учёта регистра.
- **История.** Элементы содержат `id`, `featureFlagId`, `environment`, `field`, `oldValue`, `newValue`, `actor` и `changedAtUtc`. События идут по убыванию `changedAtUtc`, при совпадении дат — по возрастанию `id`. Создание записывает одно событие `created` с ключом в `newValue`. Обновление записывает по событию на изменённое поле. Значения передаются строками или `null`. У событий общих полей `environment` равен `null`. Актор демо — `demo-user`.

Пример запроса второй страницы включённых флагов Staging с поиском по слову `checkout`.

```http
GET /api/flags?environment=Staging&search=checkout&enabled=true&page=2&pageSize=20
```

Если найдены три флага, вторая страница вернётся с кодом `200` и таким телом.

```json
{
  "items": [],
  "totalCount": 3,
  "page": 2,
  "pageSize": 20
}
```

## Ошибки

Ошибки имеют формат `application/problem+json`. Некорректный запрос возвращает `400`, отсутствующий флаг — `404`, дубликат ключа — `409`. При ошибках валидации полей объект `errors` сопоставляет имена полей со списками сообщений.

Например, в ответе на `GET /api/flags?pageSize=101` будут следующие поля.

```json
{
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "pageSize": ["Page size must be between 1 and 100."]
  }
}
```
