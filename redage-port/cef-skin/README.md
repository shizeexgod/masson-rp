# Скин интерфейсов Masson RP для RedAge (CEF)

Накладывается поверх рабочей копии RedAge (`C:\MassonRP\work\redage\src_cef`), исходники RedAge не меняются.

- `design/` — CSS, шрифты и картинки из дизайна (`Logo mason/Masson RP HUD`), без правок, кроме `game.css` (поправки для игры).
- `overlay/src/` — Svelte-компоненты и ресурсы, копируются в `src_cef/src/` по тем же путям (заменённые экраны RedAge лежат на тех же путях, что и оригиналы).
- `tools/scope-css.js` — собирает `design/*.css` в `overlay/src/masson/masson.css`, подставляя корень `.mp` (стили Masson не пересекаются со стилями RedAge). Нужен postcss из `node_modules` сборки CEF: `node scope-css.js <node_modules>`.
- `tools/extract-inline.js` — вынимает inline-стили из HTML-макетов дизайна в `design/inline-*.css`.
- `tools/apply-cef-skin.py <src_cef>` — копирует overlay в рабочую копию.

Порядок: `extract-inline` (если менялись макеты) → `scope-css` → `apply-cef-skin` → `npm run build` в `src_cef` (Node 16) → установка (`restart2.ps1`).

Готово: вход, регистрация, восстановление; выбор персонажа; создание персонажа (6 шагов).
Не сделано: HUD, чат, уведомления, остальные экраны (см. `ПРОМПТ-CLAUDE-DESIGN.md`, `Logo mason/Masson RP HUD/.../SPEC-DEV.md`).
