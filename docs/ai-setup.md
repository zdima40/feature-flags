# Build with AI: Angular

Основа: официальные разделы [LLM prompts and AI IDE setup](https://angular.dev/ai/develop-with-ai), [Angular CLI MCP](https://angular.dev/ai/mcp) и [Agent Skills](https://angular.dev/ai/agent-skills).

## Файлы проекта

- `AGENTS.md` — общие требования к Angular + C#.
- `frontend/AGENTS.md` — краткая адаптация официальных Angular Best Practices для frontend.
- `.github/instructions/angular.instructions.md` — подключение правил frontend в GitHub Copilot / VS Code.
- `.vscode/mcp.json` — Angular CLI MCP для VS Code.
- `.codex/config.toml` — Angular CLI MCP для Codex по официальному шаблону Angular CLI.

## MCP

Нужны Node.js и npm, совместимые с выбранной версией Angular. Конфигурация запускает `npx -y @angular/cli mcp`, как в документации. При первом запуске npx может загрузить Angular CLI из npm; если CLI установлен локально, npx использует локальную версию.

После создания Angular workspace в `frontend/` указывать этот каталог при вызове MCP-инструментов, принимающих путь workspace. Для проверки доступности сервера можно запустить из корня:

```sh
npx -y @angular/cli mcp --help
```

Для разработки использовать `get_best_practices` с путем workspace и `search_documentation`; для обнаружения проектов — `list_projects`.

## Контекст документации

- [llms.txt](https://angular.dev/llms.txt) — индекс документации для AI.
- [llms-full.txt](https://angular.dev/llms-full.txt) — полный контекст; подключать при необходимости, не копировать целиком в проект.
- [Исходные Best Practices](https://angular.dev/assets/context/best-practices.md) — сверять при обновлении Angular.

Официальные skills `angular-developer` и `angular-new-app` можно установить дополнительно командой из документации Angular:

```sh
npx skills add https://github.com/angular/skills
```
