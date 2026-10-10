# Правки RedAge при переносе на FloV:MP (рабочая копия C:\MassonRP\work\redage)

Исходники RedAge не менялись (C:\MassonRP\src\redage). Все правки — в рабочей копии, из неё идёт установка.
Повтор: `C:\MassonRP\scripts-masson\port-redage.ps1 -Source C:\MassonRP\src\redage -SkipBuild`,
затем остановить сервер (Ctrl+C) и `-InstallOnly`.

| Что | Где | Зачем |
|---|---|---|
| Доступ к базе (пользователь redage) | settings/mainDB.json | отдельный пользователь вместо root |
| Newtonsoft.Json 13.0.3, System.Drawing.Common 9.0.0 | NeptuneEvo.csproj | убраны критическая и высокая уязвимости (NU1904) |
| Строки подключения заполняются сразу | NeptuneEvoSDK/MySQL.cs | `Connection` был пуст до `MySQL.Init()`; пустой хост = адреса компьютера, а MariaDB слушает только 127.0.0.1 |
| Регистрация подключений LinqToDB при загрузке сборки | NeptuneEvo/Database/MassonBootstrap.cs | ResourceStart срабатывал раньше конструктора Main («MainDB is not defined») |
| Прослойка mp.version.core / mp.dist / setPosition | client_packages/flov-shim.js + require в index.js | вызовы, которых нет в FloV:MP |
| Диагностика соединения | MySQL.cs (MassonDiag), masson-diag.txt | можно убрать после первой недели работы |
| Убраны googletagmanager из browser-origins.txt | server/client_packages | аналитика Google в интерфейсе игрока не нужна |

Не перенесено намеренно: `conf.json` (название «Masson RP» остаётся), моды game_resources (`--mods`),
бинарники RAGE:MP (ragemp-server.exe, linux_x64.tar.gz, bin/, BugTrap).

## Дополнение 10.10.2026
| Что | Где | Зачем |
|---|---|---|
| `new CultureInfo("en-US")` → инвариантная культура; `el-GR` → `MassonCulture.Greek` | Main.cs, MoneySystem/Wallet.cs, MoneySystem/MassonCulture.cs | движок FloV:MP работает без ICU; из-за ошибки не завершалась инициализация Main |
| Журнал консоли в файл `logs/redage-ГГГГММДД.log` | NeptuneEvoSDK/Logging.cs | консоль RedAge нигде не сохранялась |
| Ожидания моделей/анимаций/сущностей — не дольше 2,5–4 с | src_client/index.js, synchronization/animation.js, inventory/attachments.js | на клиенте они могли ждать больше минуты |
| Трассировка сцены персонажей `[MASSON]`, страховка 15 с на экране слотов (принудительный `initInterface(false)`) | src_client/player/character.js, hud.js, camera/other.js | чёрный экран с кругом после `toslots` |
| Запасной индекс пола в `clearClothes` | src_client/player/character.js | ошибка `cannot read property 1 of undefined` из `client_tc` |
| `hasVariable` для объектов | client_packages/flov-shim.js | ошибка `playerReady: not a function` из `client_tc` |
| Нарезка больших событий сервер → клиент (`masson.chunk`) | NeptuneEvoSDK/Trigger.cs + flov-shim.js | FloV:MP отбрасывает события длиннее 3800 символов (`doorsControl`, `client.phone.gps.init`) |
| Нарезка и для `Main.Trigger.ClientEvent(ExtPlayer…)`, порог по размеру JSON (patch_redage8) | NeptuneEvo/Main.cs + Trigger.cs | собственный Trigger RedAge шёл мимо нарезки: `doorsControl` (404 двери) и `gps.init` отбрасывались |
| Список ников для `render` собираем сами (patch_redage9) | src_client/player/gamertag.js | FloV:MP не передаёт `nametags`, `nametags.forEach` падало на каждом кадре (`client_tc`: `player/gamertag render`) — вероятная причина лагов/slow-mo |
| Безопасный разбор полей внешности `massonJson` (patch_redage9) | src_client/player/character.js | `InitPlayerChar - 2: SyntaxError` — пустое поле Hair/Tattoos/… роняло весь экран персонажей |
| Пароль Redis из `settings/redisPassword.txt` | Utils/Redis/Repository.cs | свой Redis с паролем, слушает только 127.0.0.1 |
| `max_connections=500` | mariadb-data\my.ini | RedAge не может выставить сам (нужны права SUPER) |
| `FLOVMP_ANTICHEAT=off` | config\flovmp.env | RedAge переносит игроков на клиенте; платформа возвращала их обратно |

Скрипты правок — `patches/`, операционные скрипты — `ops/`.
