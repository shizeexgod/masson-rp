'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { once } = require('node:events');
const crypto = require('node:crypto');
const { NativeBridge } = require('./native-bridge');
const { checkServerStatus } = require('./server-status');

// Папка данных Chromium — без «:» из имени продукта «FloV:MP Launcher»: с ним Windows не создаёт путь,
// и app.requestSingleInstanceLock() роняет процесс сразу при старте (код −36861, 08.10).
app.setPath('userData', process.env.MASSON_LAUNCHER_DATA || path.join(app.getPath('appData'), 'Masson RP Launcher'));  // MASSON_LAUNCHER_DATA — только для автотестов

let tray = null;
let trayOnClose = false;   // из настроек: крестик → в трей вместо закрытия
let quitting = false;      // true во время реального выхода (before-quit)

// Общая с игрой папка (та же, что и settings.json). session.json пишет
// сервер при входе в игре — лаунчер его читает для хэндоффа аккаунта.
const SHARED_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'FloridaV');
const SESSION_FILE = path.join(SHARED_DIR, 'session.json');

// ─── Конфиг сборки под конкретный проект ───────────────────────────────────
// Адрес сервера и CDN раньше были зашиты в код: 188.127.229.224. Для
// продаваемой платформы это значит, что лаунчер КАЖДОГО покупателя по
// умолчанию отправлял бы его игроков на чужой сервер. Перебить можно было
// только переменной окружения (игроки её не выставят) или руками в настройках.
//
// Теперь рядом с лаунчером кладётся launcher.config.json:
//   { "serverHost": "1.2.3.4", "serverPort": 7788,
//     "cdnUrl": "http://1.2.3.4/cdn", "serverName": "Мой RP" }
// Файла нет — поведение прежнее. Сохранённый выбор игрока в настройках всегда
// важнее конфига: конфиг задаёт только значение для свежей установки.
const FALLBACK_SERVER_HOST = '176.194.154.89';   // тестовый сервер владельца (VDS); проекты задают свой в launcher.config.json

function loadBuildConfig() {
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'launcher.config.json'),
    path.join(path.dirname(process.execPath), 'launcher.config.json'),
    path.join(__dirname, '..', 'launcher.config.json'),
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const cfg = {};
      // Каждое поле проверяется: битый конфиг не должен ломать запуск лаунчера.
      if (typeof raw.serverHost === 'string' && /^[A-Za-z0-9.-]{1,253}$/.test(raw.serverHost)) {
        cfg.serverHost = raw.serverHost;
      }
      const port = parseInt(raw.serverPort, 10);
      if (Number.isInteger(port) && port > 0 && port < 65536) cfg.serverPort = port;
      if (typeof raw.cdnUrl === 'string' && /^https?:\/\//.test(raw.cdnUrl)) cfg.cdnUrl = raw.cdnUrl;
      if (typeof raw.serverName === 'string' && raw.serverName.length <= 64) cfg.serverName = raw.serverName;
      // lockServer: лаунчер одного проекта — адрес сервера из конфига сборки важнее сохранённых настроек
      // (иначе настройки другого лаунчера на этом ПК, лежащие в %LOCALAPPDATA%\FloVMP, уведут игрока на чужой сервер).
      if (raw.lockServer === true) cfg.lockServer = true;
      // Адрес, откуда лаунчер сам берёт обновления (latest.yml и установщик): http(s)://host[:port]/путь/
      if (typeof raw.updateUrl === 'string' && /^https?:\/\/[A-Za-z0-9.:\/_-]{3,200}$/.test(raw.updateUrl)) cfg.updateUrl = raw.updateUrl.replace(/\/*$/, '/');
      // Закрывать лаунчер, когда игра запустилась (по умолчанию да)
      if (raw.closeOnPlay === false) cfg.closeOnPlay = false;
      return cfg;
    } catch (e) {
      console.warn(`launcher.config.json повреждён (${file}): ${e.message}`);
    }
  }
  return {};
}

const BUILD_CONFIG = loadBuildConfig();

// ─── Клиент FloV:MP, вложенный в лаунчер ────────────────────────────────────
// client-b3889 (тот же комплект, что игрок берёт у сервера): в сборке — resources\client-b3889,
// при `npm start` — client-bundle\client-b3889. Нативный помощник находит его по FLOVMP_CLIENT_DIR
// и запускает play.cmd: установка клиента, обновление, моды сервера, вход — путь обычного игрока.
const CLIENT_DIR = [
  process.resourcesPath && path.join(process.resourcesPath, 'client-b3889'),
  path.join(__dirname, '..', 'client-bundle', 'client-b3889'),
].filter(Boolean).find((d) => fs.existsSync(path.join(d, 'play.cmd'))) || '';
if (CLIENT_DIR) process.env.FLOVMP_CLIENT_DIR = CLIENT_DIR;
const CLIENT_DATA = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'FloVMP');
const AUTH_API = 'http://127.0.0.1:7799/api/auth';

// mode лаунчера → путь эндпоинта ServerLauncher. Пока сервер знает только
// register/login; остальные вернут не-ok, и UI честно это покажет.
const AUTH_ROUTES = {
  login: 'login',
  register: 'register',
  'change-password': 'change-password',
  'change-email': 'change-email',
  '2fa-enable': '2fa/enable',
  '2fa-disable': '2fa/disable',
};

// GPU shader disk-cache на Windows периодически падает с "Unable to move
// the cache: Access Denied" / "Gpu Cache Creation failed" — это шумные, но
// безвредные ошибки Chromium при гонке за кэш-каталог. Отключаем именно
// дисковый кэш шейдеров (перф почти не страдает — рекомпиляция шейдеров
// оболочки лаунчера пренебрежимо мала), чтобы консоль была чистой.
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const native = new NativeBridge();
let mainWindow = null;
let splashWindow = null;

// Показываем сразу после запуска .exe, пока грузится нативный помощник и
// первый рендер главного окна — как заставка "Проверка обновлений" у
// Majestic, только честная: время показа = реальное время загрузки
// (плюс небольшой минимум, чтобы не мигало на быстрых машинах), а не
// искусственная задержка.
const SPLASH_MIN_MS = process.env.FLOVMP_SPLASH_MIN ? parseInt(process.env.FLOVMP_SPLASH_MIN, 10) : 700;
const APP_ICON_PATH = path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 280,
    frame: false,
    backgroundColor: '#0c0c0c',
    resizable: false,
    center: true,
    show: true,
    skipTaskbar: true,
    icon: APP_ICON_PATH,
    webPreferences: { sandbox: true },
  });
  splashWindow.removeMenu();
  splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'));
}

function createWindow() {
  const splashShownAt = Date.now();
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    center: true,
    frame: false,
    backgroundColor: '#0c0c0c',
    icon: APP_ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer-gone]', details);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[did-fail-load]', code, desc, url);
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - splashShownAt;
    const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
      }
      splashWindow = null;
      mainWindow.show();
      mainWindow.focus();
    }, wait);
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', 'normal'));

  // Крестик → в трей, если так настроено (и это не реальный выход).
  mainWindow.on('close', (e) => {
    if (trayOnClose && !quitting) {
      e.preventDefault();
      mainWindow.hide();
      ensureTray();
    }
  });
}

function ensureTray() {
  if (tray) return;
  let img;
  try {
    img = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'assets', 'logo.png'));
    if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  } catch { img = nativeImage.createEmpty(); }
  tray = new Tray(img);
  tray.setToolTip('FloV:MP Launcher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── Window chrome (кастомный титлбар в renderer) ─────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:setTrayOnClose', (_e, enabled) => {
  trayOnClose = !!enabled;
  if (!trayOnClose && tray) { tray.destroy(); tray = null; }
  return trayOnClose;
});

// ─── Мост к нативной логике (реестр / запуск игры) ─────────────────────────
ipcMain.handle('native:getSettings', () => native.call('getSettings'));
ipcMain.handle('native:buildConfig', () => ({ ...BUILD_CONFIG }));
ipcMain.handle('native:saveSettings', (_e, data) => native.call('saveSettings', { data }));
// Нативный поиск знает только Epic, Steam и Rockstar (реестр и стандартные папки). Игру, поставленную в
// «E:/Games/GTAV» и подобные папки, он не находит — тогда ищем по всем локальным дискам.
function detectGtaOnDisks() {
  const rels = [
    'Games/GTAV', 'Games/GTA V', 'Games/Grand Theft Auto V', 'GTAV', 'GTA V', 'Grand Theft Auto V',
    'Games/Epic Games/GTAV', 'Epic Games/GTAV', 'Rockstar Games/Grand Theft Auto V',
    'Program Files/Rockstar Games/Grand Theft Auto V', 'Program Files/Epic Games/GTAV',
    'Program Files (x86)/Steam/steamapps/common/Grand Theft Auto V',
    'SteamLibrary/steamapps/common/Grand Theft Auto V', 'Steam/steamapps/common/Grand Theft Auto V',
    'Games/Steam/steamapps/common/Grand Theft Auto V',
  ];
  for (let c = 67; c <= 90; c++) {                       // C..Z
    const root = String.fromCharCode(c) + ':/';
    try { if (!fs.existsSync(root)) continue; } catch { continue; }
    for (const rel of rels) {
      const dir = path.normalize(path.join(root, rel));
      try {
        if (fs.existsSync(path.join(dir, 'GTA5.exe'))) return { path: dir, edition: 'Legacy', source: 'поиск по дискам' };
        if (fs.existsSync(path.join(dir, 'GTA5_Enhanced.exe'))) return { path: dir, edition: 'Enhanced', source: 'поиск по дискам' };
      } catch { /* диск недоступен */ }
    }
  }
  return null;
}
ipcMain.handle('native:detectGta', async () => {
  let found = null;
  try { found = await native.call('detectGta'); } catch { /* помощник недоступен — пробуем сами */ }
  return found || detectGtaOnDisks();
});
ipcMain.handle('native:validateGta', (_e, gtaPath) => native.call('validateGta', { path: gtaPath }));
ipcMain.handle('native:browseFolder', () => native.call('browseFolder'));
// Опрос сети не занимает однопоточную очередь нативного помощника: во время
// запуска GTA или поиска файлов окно продолжает получать ответы без задержки.
ipcMain.handle('native:serverStatus', (_e, host, port) => checkServerStatus(host, port));
// «Играть»: play.ps1 вложенного клиента запускается БЕЗ окна консоли; ход (установка, обновление, моды,
// запуск GTA) показывается в окне лаунчера. Раньше нативный помощник открывал отдельное окно cmd.
const PLAY_EXIT_CODES = {
  1: 'FLV-6001', 2: 'FLV-6001', 3: 'FLV-3002', 4: 'FLV-6003', 5: 'FLV-6002',
  6: 'FLV-4004', 7: 'FLV-4003', 8: 'FLV-4002', 9: 'FLV-4001', 10: 'FLV-2009',
};
let playProc = null;
let playWaiting = false;     // идёт ожидание процесса GTA5.exe после запуска (его можно отменить)

// Ждёт, пока в системе появится GTA5.exe (Epic/Steam/Rockstar запускают её не сразу). true — игра запустилась.
function waitForGta(timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    playWaiting = true;
    const tick = () => {
      if (!playWaiting) { resolve(false); return; }
      require('node:child_process').execFile('tasklist', ['/FI', 'IMAGENAME eq GTA5.exe', '/NH'], { windowsHide: true }, (err, out) => {
        if (!err && /GTA5\.exe/i.test(String(out))) { playWaiting = false; resolve(true); return; }
        if (Date.now() - t0 > timeoutMs) { playWaiting = false; resolve(false); return; }
        setTimeout(tick, 1500);
      });
    };
    tick();
  });
}

// Строка из консоли play.ps1 → этап для окна запуска. Тексты — из play.ps1, install-client.ps1,
// client-update.ps1 и mods-sync.ps1 клиента. Неизвестные строки этап не меняют.
function playStageFromLine(line) {
  let m;
  if (/ещё не установлен/i.test(line)) return { phase: 'Установка клиента FloV:MP…', percent: 8 };
  if (/Скачиваю среду клиента/i.test(line)) return { phase: 'Загрузка среды клиента (Chromium и .NET)…', percent: 20 };
  if (/Обновление клиента FloV:MP/i.test(line)) return { phase: 'Обновление клиента…', percent: 15 };
  if (/Клиент FloV:MP обновлён/i.test(line)) return { phase: 'Клиент обновлён', percent: 30 };
  if (/Клиент FloV:MP .*актуальн/i.test(line)) return { phase: 'Клиент актуален', percent: 30 };
  if ((m = line.match(/^\[(\d+)\/(\d+)\]\s+(.+?)\s+\(/))) {
    const i = +m[1], n = Math.max(+m[2], 1);
    return { phase: `Загрузка файлов сервера ${i} из ${n}`, percent: Math.round(40 + 50 * i / n) };
  }
  if (/Моды сервера: \d+ файлов/i.test(line)) return { phase: 'Проверка файлов сервера…', percent: 40 };
  if (/Моды сервера (установлены|на месте)|У сервера нет модов/i.test(line)) return { phase: 'Файлы сервера готовы', percent: 90 };
  if (/GTA V уже запущена/i.test(line)) return { phase: 'GTA V уже открыта — переход на сервер…', percent: 95 };
  if (/Запускаю GTA V/i.test(line)) return { phase: 'Запуск GTA V…', percent: 95 };
  return null;
}

function sendPlayProgress(data) {
  try { mainWindow?.webContents.send('download:progress', { hideStats: true, ...data }); } catch { /* окно закрыто */ }
}

function runPlayHidden(gtaPath, host, port, nickname) {
  return new Promise((resolve) => {
    if (playProc) { resolve({ success: false, error: 'Запуск уже идёт.' }); return; }
    const playPs1 = path.join(CLIENT_DIR, 'play.ps1');
    const q = (s) => String(s).replace(/'/g, "''");
    const script = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; $OutputEncoding=[Text.Encoding]::UTF8; '
      + `& '${q(playPs1)}' -Address '${q(`${host}:${port}`)}' -Name '${q(nickname)}'; exit $LASTEXITCODE`;
    const env = { ...process.env, FLOVMP_GTA_PATH: gtaPath, FLOVMP_NONINTERACTIVE: '1' };
    let proc;
    try {
      proc = require('node:child_process').spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { cwd: CLIENT_DIR, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { resolve({ success: false, error: `Не удалось запустить клиент: ${e.message}` }); return; }
    playProc = proc;
    sendPlayProgress({ phase: 'Подготовка…', percent: 3 });

    const lines = [];                  // всё, что напечатал play.ps1 (хвост — для текста ошибки)
    let lastBad = '';                  // последняя строка-ошибка (красная в консоли: «не», «ошибка», «FLV-…»)
    let flvCode = '';
    let carry = '';
    const onData = (buf) => {
      const parts = (carry + buf.toString('utf8')).split(/\r?\n/);
      carry = parts.pop();
      for (const raw of parts) {
        const line = raw.replace(/^\[FloV:MP\]\s*/, '').trim();
        if (!line) continue;
        lines.push(line); if (lines.length > 80) lines.shift();
        const code = line.match(/\b(FLV-\d{4})\b/); if (code) flvCode = code[1];
        if (/не удалось|не скачан|ошибк|не найден|нет прав|не хватает|недоступн|повреждён|не верна|не готовы/i.test(line)) lastBad = line;
        const st = playStageFromLine(line);
        if (st) sendPlayProgress(st);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', (e) => { playProc = null; resolve({ success: false, error: `Ошибка запуска клиента: ${e.message}` }); });
    proc.on('exit', (code, signal) => {
      playProc = null;
      if (signal || code === null) { resolve({ success: false, error: 'Запуск отменён.' }); return; }
      if (code === 0) {
        sendPlayProgress({ phase: 'Ожидание запуска GTA V…', percent: 97 });
        waitForGta(150000).then((started) => {
          sendPlayProgress({ phase: started ? 'Игра запущена' : 'Игра запускается…', percent: 100 });
          resolve({ success: true });
          // Игра открыта, подключение к серверу ведёт клиент — лаунчер больше не нужен.
          if (started && BUILD_CONFIG.closeOnPlay !== false) setTimeout(() => { quitting = true; app.quit(); }, 2500);
        });
        return;
      }
      const flv = flvCode || PLAY_EXIT_CODES[code] || 'FLV-6001';
      const detail = lastBad || lines[lines.length - 1] || `код выхода ${code}`;
      resolve({ success: false, error: `${flv}: ${detail}` });
    });
  });
}

ipcMain.handle('native:play', async (_e, gtaPath, host, port, nickname) => {
  const numericPort = parseInt(port, 10) || 7788;
  // Вложенный клиент: тихий запуск без окна консоли. Если его нет — прежний путь через помощник.
  if (CLIENT_DIR && fs.existsSync(path.join(CLIENT_DIR, 'play.ps1'))) {
    const dir = String(gtaPath || '').trim().replace(/^["']|["']$/g, '').replace(/[\/]+$/, '');
    if (!dir || !fs.existsSync(path.join(dir, 'GTA5.exe'))) {
      return { success: false, error: 'В папке игры не найден GTA5.exe. Укажите папку GTA V в настройках.' };
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/.test(String(host || ''))) return { success: false, error: 'Неверный адрес сервера.' };
    if (!/^[A-Za-z0-9_]{3,32}$/.test(String(nickname || ''))) return { success: false, error: 'Ник: латиница, цифры и «_», от 3 до 32 символов.' };
    return runPlayHidden(dir, host, numericPort, nickname);
  }
  return native.call('play', { gtaPath, host, port: numericPort, nickname });
});
ipcMain.handle('native:cancelPlay', async () => {
  playWaiting = false;
  if (playProc) {
    try { require('node:child_process').spawn('taskkill', ['/PID', String(playProc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* уже завершён */ }
    return true;
  }
  return native.call('cancelPlay').catch(() => null);
});

// Проверка файлов клиента — repair-client.cmd вложенного клиента в своём окне (сверяет и чинит
// установку, как «install-client.cmd -Repair» у игрока без лаунчера).
ipcMain.handle('client:verifyFiles', () => {
  const script = CLIENT_DIR && path.join(CLIENT_DIR, 'repair-client.cmd');
  if (!script || !fs.existsSync(script)) return { ok: false, message: 'клиент FloV:MP не найден рядом с лаунчером' };
  const { spawn } = require('node:child_process');
  // Строкой целиком: заголовок окна start — в кавычках, путь — тоже (в нём бывают пробелы).
  spawn(process.env.COMSPEC || 'cmd.exe', [`/d /c start "FloV:MP" "${script}"`],
    { cwd: CLIENT_DIR, detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  return { ok: true };
});
ipcMain.handle('client:openLogs', async () => {
  const dir = path.join(CLIENT_DATA, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const err = await shell.openPath(dir);
  return { ok: !err, message: err || undefined };
});
// Кэш клиента: собранный update.rpf и кэш страниц сервера — пересоздаются при следующем входе.
ipcMain.handle('client:clearCache', () => {
  let removed = 0;
  for (const name of ['cache', 'cef-cache']) {
    const dir = path.join(CLIENT_DATA, name);
    try { if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); removed++; } } catch { }
  }
  return { ok: true, removed };
});
ipcMain.handle('native:deviceInfo', () => native.call('deviceInfo').catch(() => null));
ipcMain.handle('native:detectGpu', () => native.call('detectGpu').catch(() => null));
ipcMain.handle('native:deployUpscaler', (_e, gtaPath) => native.call('deployUpscaler', { gtaPath }).catch(() => null));
ipcMain.handle('native:cleanupUpscaler', (_e, gtaPath) => native.call('cleanupUpscaler', { gtaPath }).catch(() => null));

// Авторизация / безопасность — связывается с сервером по HTTP (/api/auth/*).
// Если удаленный сервер офлайн/не отвечает, плавно переходит в локальный
// офлайн-профиль, сохраняя сессию для игры и не блокируя пользователя.
ipcMain.handle('native:auth', async (_e, mode, payload) => {
  const route = AUTH_ROUTES[mode];
  if (!route) return { ok: false, message: 'неизвестная операция' };
  const host = (payload && payload.serverHost) || process.env.FLOVMP_SERVER_HOST
    || BUILD_CONFIG.serverHost || FALLBACK_SERVER_HOST;

  // Для удалённого сервера localhost больше НЕ пробуется. Раньше при
  // недоступном сервере лаунчер отправлял логин и пароль игрока на
  // 127.0.0.1:7799 — то есть любому приложению, которое слушает этот порт на
  // машине игрока. Пароль уходит только на тот сервер, в который игрок входит.
  const isLocal = host === '127.0.0.1' || host === 'localhost';
  const targets = isLocal
    ? ['http://127.0.0.1:7799/api/auth']
    : [`http://${host}:7799/api/auth`, `http://${host}/api/auth`];

  for (const apiBase of targets) {
    try {
      const res = await fetch(`${apiBase}/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: AbortSignal.timeout(2500),
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object') return json;
      } catch {}
    } catch {}
  }

  // Сервер не ответил. Раньше здесь лаунчер отвечал «Вход выполнен» и
  // записывал сессию с введённым ником — для ЛЮБОГО пароля. Порт API у
  // боевого сервера снаружи часто закрыт, так что на деле любой пароль
  // подходил к любому логину у всех игроков. Хуже того, ответ ok: true
  // уходил и для смены пароля и 2FA: игроку сообщалось «пароль изменён»,
  // хотя ничего не менялось.
  //
  // Теперь честный отказ. Играть это не мешает: кнопка «Играть» вход не
  // требует, гость заходит под ником «Игрок», а войти можно и в самой игре.
  return {
    ok: false,
    offline: true,
    message: mode === 'login' || mode === 'register'
      ? 'Сервер авторизации сейчас недоступен. Играть можно и без входа — войдите в самой игре.'
      : 'Сервер авторизации сейчас недоступен — изменения не сохранены. Попробуйте позже.',
  };
});

ipcMain.handle('native:readSession', () => {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8');
    const s = JSON.parse(raw);
    return s && typeof s.username === 'string' && s.username ? s : null;
  } catch { return null; }
});
ipcMain.handle('native:clearSession', () => {
  try { fs.unlinkSync(SESSION_FILE); } catch {}
  return true;
});

// Нативный слой (FloVMP.Connect через C#-помощник) шлёт события прогресса
// загрузки строкой NDJSON {"event":"download","downloaded":..,"total":..,
// "speed":..,"percent":..,"phase":".."}. NativeBridge эмитит их как 'event'.
native.on?.('download', (data) => {
  mainWindow?.webContents.send('download:progress', data);
});

// ─── Движок клиента FloV:MP (Фаза 2 CDN-раздача) ──────────────────────────
// Лаунчер тонкий: сам движок (~430 МБ: libce2/CEF/flovmp-client) не вшит в
// инсталлятор, а качается один раз с CDN сервера в
// %LOCALAPPDATA%\FloridaV\engine\ и проверяется по sha256 из манифеста.
// FloVMP.Connect подхватывает его оттуда (см. PlayService.FindClientDir).
const ENGINE_DIR = path.join(SHARED_DIR, 'engine');
const ENGINE_MARKER = path.join(ENGINE_DIR, '.flovmp-engine.json');
const DEFAULT_CDN = process.env.FLOVMP_CDN || BUILD_CONFIG.cdnUrl || `http://${FALLBACK_SERVER_HOST}/cdn`;

function findLocalClientDir() {
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'runtime', 'client'),
    path.join(process.cwd(), 'runtime', 'client'),
    'C:\\FloV-MP\\runtime\\client',
    path.join(SHARED_DIR, 'runtime', 'client'),
    ENGINE_DIR,
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && (fs.existsSync(path.join(dir, 'flovmp.exe')) || fs.existsSync(path.join(dir, 'altv.exe')))) {
      return dir;
    }
  }
  return null;
}

function readEngineMarker() {
  try { return JSON.parse(fs.readFileSync(ENGINE_MARKER, 'utf8')); } catch { return null; }
}
ipcMain.handle('native:engineStatus', async (_e, cdnBase) => {
  const localDir = findLocalClientDir();
  if (localDir) {
    const marker = readEngineMarker();
    return {
      installed: true,
      path: localDir,
      version: marker?.version || '1.0.0',
      latestVersion: marker?.version || '1.0.0',
      upToDate: true,
      sizeBytes: 0,
    };
  }

  const marker = readEngineMarker();
  const entry = marker?.entry || 'flovmp.exe';
  const entryOk = fs.existsSync(path.join(ENGINE_DIR, entry))
    || fs.existsSync(path.join(ENGINE_DIR, 'flovmp.exe'))
    || fs.existsSync(path.join(ENGINE_DIR, 'altv.exe'));
  let latest = null;
  try {
    const base = (cdnBase || DEFAULT_CDN).replace(/\/+$/, '');
    const res = await fetch(`${base}/engine/engine-manifest.json`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) latest = await res.json();
  } catch {}
  return {
    installed: !!marker && entryOk,
    version: marker?.version || null,
    latestVersion: latest?.version || null,
    upToDate: !!marker && entryOk && (!latest || marker.version === latest.version),
    sizeBytes: latest?.archive?.size || latest?.totalBytes || 0,
  };
});

ipcMain.handle('native:downloadEngine', async (_e, cdnBase) => {
  const base = (cdnBase || DEFAULT_CDN).replace(/\/+$/, '');
  const send = (d) => mainWindow?.webContents.send('download:progress', d);
  try {
    send({ phase: 'Проверка версии движка…', percent: 0, downloaded: 0, total: 0, speed: 0 });
    const man = await fetch(`${base}/engine/engine-manifest.json`, { signal: AbortSignal.timeout(10000) })
      .then((r) => { if (!r.ok) throw new Error(`манифест ${r.status}`); return r.json(); });

    const marker = readEngineMarker();
    if (marker && marker.version === man.version
        && fs.existsSync(path.join(ENGINE_DIR, man.entry || 'flovmp.exe'))) {
      send({ phase: 'Движок актуален', percent: 100, done: true });
      return { ok: true, upToDate: true, version: man.version };
    }

    const arc = man.archive || {};
    const total = arc.size || man.totalBytes || 0;
    const tmp = path.join(SHARED_DIR, 'engine-download.tgz');
    fs.mkdirSync(SHARED_DIR, { recursive: true });

    send({ phase: 'Загрузка движка', percent: 0, downloaded: 0, total, speed: 0 });
    const res = await fetch(`${base}/engine/${arc.name || 'engine.tgz'}`);
    if (!res.ok || !res.body) throw new Error(`архив ${res.status}`);

    const out = fs.createWriteStream(tmp);
    const hash = crypto.createHash('sha256');
    let got = 0; const started = Date.now(); let lastTick = started;
    for await (const chunk of res.body) {
      if (!out.write(chunk)) await once(out, 'drain');
      hash.update(chunk); got += chunk.length;
      const now = Date.now();
      if (now - lastTick > 250) {
        lastTick = now;
        send({
          phase: 'Загрузка движка',
          percent: total ? (got / total) * 90 : 0,
          downloaded: got, total,
          speed: got / Math.max(0.001, (now - started) / 1000),
        });
      }
    }
    await new Promise((r) => out.end(r));

    const digest = hash.digest('hex');
    if (!arc.sha256) { fs.unlinkSync(tmp); throw new Error('в манифесте нет sha256 архива'); }
    if (digest !== arc.sha256) {
      fs.unlinkSync(tmp);
      throw new Error('битый архив (sha256 не совпал)');
    }

    const { execFile } = require('node:child_process');
    const run = (args) => new Promise((resolve, reject) => {
      execFile('tar', args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout) => err ? reject(err) : resolve(stdout || ''));
    });

    // Защита от path-traversal: до распаковки смотрим список записей и
    // отклоняем архив, где есть '..', абсолютный путь или буква диска —
    // иначе вредонос по MITM мог бы положить файл в Автозагрузку и т.п.
    send({ phase: 'Проверка архива…', percent: 92 });
    let listing = '';
    try { listing = await run(['-tzf', tmp]); }
    catch (e) { fs.unlinkSync(tmp); throw new Error(`не удалось прочитать архив (нет tar?): ${e.message}`); }
    const bad = listing.split(/\r?\n/).find((p) => {
      const s = p.trim(); if (!s) return false;
      return s.startsWith('/') || s.startsWith('\\') || /^[a-zA-Z]:/.test(s)
        || s.split(/[\\/]/).some((seg) => seg === '..');
    });
    if (bad) { fs.unlinkSync(tmp); throw new Error(`подозрительный путь в архиве: ${bad.trim()}`); }

    send({ phase: 'Распаковка движка…', percent: 93, downloaded: got, total });
    fs.rmSync(ENGINE_DIR, { recursive: true, force: true });
    fs.mkdirSync(ENGINE_DIR, { recursive: true });
    // bsdtar есть в Windows 10 1803+ / 11 (C:\Windows\System32\tar.exe)
    await run(['-xzf', tmp, '-C', ENGINE_DIR, '--no-same-owner', '--no-same-permissions']);
    fs.unlinkSync(tmp);

    // Сверяем распакованное с манифестом (хэши по файлам) — на случай
    // подмены содержимого при совпадающем размере архива.
    if (Array.isArray(man.files) && man.files.length) {
      send({ phase: 'Проверка файлов движка…', percent: 97 });
      let checked = 0;
      for (const f of man.files) {
        if (!f || !f.path || !f.sha256) continue;
        const rel = String(f.path).replace(/\\/g, '/');
        if (rel.includes('..') || rel.startsWith('/')) throw new Error(`манифест: плохой путь ${rel}`);
        const abs = path.join(ENGINE_DIR, rel);
        if (!abs.startsWith(ENGINE_DIR)) throw new Error(`манифест: выход за пределы (${rel})`);
        let h;
        try {
          const fileHash = crypto.createHash('sha256');
          for await (const chunk of fs.createReadStream(abs)) fileHash.update(chunk);
          h = fileHash.digest('hex');
        }
        catch { throw new Error(`после распаковки нет файла: ${rel}`); }
        if (h !== f.sha256) throw new Error(`файл движка не совпал с манифестом: ${rel}`);
        checked++;
      }
      send({ phase: `Проверено файлов: ${checked}`, percent: 99 });
    }

    const entryName = man.entry || 'flovmp.exe';
    if (!fs.existsSync(path.join(ENGINE_DIR, entryName)) && !fs.existsSync(path.join(ENGINE_DIR, 'altv.exe'))) {
      throw new Error('в распакованном движке нет исполняемого файла клиента');
    }

    fs.writeFileSync(ENGINE_MARKER, JSON.stringify({
      version: man.version, entry: entryName,
      installedUtc: new Date().toISOString(), sha256: digest,
    }, null, 1));

    send({ phase: 'Движок установлен', percent: 100, downloaded: total || got, total: total || got, done: true });
    return { ok: true, version: man.version };
  } catch (err) {
    send({ phase: `Ошибка загрузки движка: ${err.message}`, percent: 0, error: String(err.message), done: true });
    return { ok: false, error: String(err.message) };
  }
});

// ─── Автозапуск с Windows — настоящая системная настройка (не просто чекбокс),
// через встроенный Electron API поверх реестра Run/Startup, ничего своего
// в реестр не пишем напрямую (та же дисциплина, что и для BattlEye — не
// трогать системные вещи руками там, где есть официальный API).
ipcMain.handle('native:setAutostart', (_e, enabled) => {
  if (!app.isPackaged) {
    return !!enabled;
  }
  app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle('native:getAutostart', () => app.getLoginItemSettings().openAtLogin);

// ─── Автообновление лаунчера ────────────────────────────────────────────────
// Лаунчер сам берёт latest.yml и установщик по адресу updateUrl из launcher.config.json (раздаёт сервер),
// скачивает только изменившиеся блоки, ставит тихо и перезапускается. Заново скачивать установщик не нужно.
let updateState = { state: 'idle' };
function sendUpdate(data) {
  updateState = data;
  try { mainWindow?.webContents.send('launcher:update', data); } catch { /* окно закрыто */ }
}
ipcMain.handle('launcher:updateState', () => updateState);

function initAutoUpdate() {
  const feed = process.env.MASSON_UPDATE_URL || BUILD_CONFIG.updateUrl;
  if (!feed || (!app.isPackaged && !process.env.MASSON_UPDATE_URL)) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); }
  catch (e) { console.warn('[updater] модуль недоступен:', e.message); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;      // не успели — поставится при выходе
  autoUpdater.allowDowngrade = false;
  autoUpdater.setFeedURL({ provider: 'generic', url: feed });
  autoUpdater.on('update-available', (info) => sendUpdate({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdate({ state: 'ready', version: info.version });
    if (process.env.MASSON_UPDATE_DRYRUN) return;                 // автотест: не ставить
    if (playProc || playWaiting) return;                          // идёт запуск игры — поставится при выходе
    setTimeout(() => { quitting = true; autoUpdater.quitAndInstall(true, true); }, 4000);
  });
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'none' }));
  autoUpdater.on('error', (e) => { console.warn('[updater]', e && e.message); sendUpdate({ state: 'error' }); });
  const check = () => autoUpdater.checkForUpdates().catch((e) => console.warn('[updater] проверка:', e && e.message));
  setTimeout(check, 4000);
  setInterval(check, 30 * 60 * 1000);
}

// Одна копия лаунчера на машину. Без этого вторая копия дерётся с первой
// за кэш-каталог Chromium → "Unable to move the cache: Access Denied" и
// множество GPU-cache ошибок в консоли (главная жалоба на "ошибки").
// Вторую копию гасим, окно первой — на передний план.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createSplash();
    try {
      native.start();
    } catch (err) {
      console.error('Не удалось запустить нативный помощник:', err.message);
    }
    createWindow();
    initAutoUpdate();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  native.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { quitting = true; native.stop(); });
