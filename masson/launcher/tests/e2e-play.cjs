// Сквозная проверка тестовой сборки лаунчера: открыть собранный лаунчер (dist/win-unpacked),
// ввести ник и адрес как игрок, нажать «Играть» — лаунчер должен запустить play.cmd вложенного клиента.
//   node tests/e2e-play.cjs <ник> [адрес] [порт]
// Снимок окна — tests/screenshots/e2e-play.png. Дальше вход видно в журнале клиента
// (%LOCALAPPDATA%\FloVMP\logs\client-3889.log) и в окне консоли play.cmd.
'use strict';
const path = require('node:path');
const { _electron: electron } = require('playwright');

(async () => {
  const [nick = 'Tester_1', host = '188.130.132.82', port = '7788'] = process.argv.slice(2);
  const fs = require('node:fs');
  const dir = path.join(__dirname, '..', 'dist', 'win-unpacked');
  const found = fs.readdirSync(dir).find((f) => /launcher\.exe$/i.test(f));
  const app = await electron.launch({ executablePath: path.join(dir, found) });
  // Первое окно — заставка (splash.html), она закрывается; ждём главное окно index.html.
  let win = null;
  for (let i = 0; i < 60 && !win; i++) {
    win = app.windows().find((w) => !w.isClosed() && /index\.html/.test(w.url())) || null;
    if (!win) await new Promise((r) => setTimeout(r, 500));
  }
  if (!win) throw new Error('главное окно лаунчера не открылось');
  await win.waitForSelector('#btn-play', { timeout: 30000 });
  await win.waitForTimeout(2500);   // заставка и загрузка настроек
  const setField = (id, value) => win.evaluate(([i, v]) => {
    const el = document.getElementById(i);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  }, [id, value]);
  console.log('ник:', await setField('set-nick', nick));
  console.log('адрес:', await setField('set-host', host), await setField('set-port', port));
  console.log('подсказка:', await win.textContent('#set-nick-hint'));
  await win.click('#btn-play');
  await win.waitForTimeout(6000);
  console.log('статус:', (await win.textContent('#play-status')) || '(пусто)');
  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
  await win.screenshot({ path: path.join(__dirname, 'screenshots', 'e2e-play.png') });
  await app.close();
})().catch((e) => { console.error('ошибка:', e.message); process.exit(1); });
