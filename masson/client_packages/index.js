// Masson RP — клиентский код (как client_packages в RAGE:MP).
// Две страницы: ui (вход + HUD + уведомления + спидометр) и chat (фирменный чат).

const ui = mp.browsers.new('package://ui/index.html');
const chat = mp.browsers.new('package://chat/index.html');
chat.markAsChat();          // T и / открывают наш чат, встроенный скрыт
ui.inputEnabled = false;    // до экрана входа ввод проходит в игру

let screen = 'loading';     // loading | create | welcome | hud
let uiReady = false;

// ---------- Экраны ----------
function setInteractive(on) {
    ui.inputEnabled = on;
    if (on) ui.focus(); else ui.blur();
    mp.gui.cursor.show(on, on);
}

mp.events.add('masson:screen', (name, payload) => {
    screen = String(name);
    ui.call('masson:screen', screen, String(payload || ''));
    setInteractive(screen === 'create' || screen === 'welcome');
    if (screen === 'hud') pushMoney();
});

mp.events.add('masson:error', (field, text) => ui.call('masson:error', String(field), String(text)));
mp.events.add('masson:notify', (text) => ui.call('hud:notify', String(text)));

// Страница загрузилась (или поднялась после падения CEF) — попросить у сервера экран заново.
function onUiLoaded(browser) {
    if (browser !== ui) return;
    if (!uiReady) { uiReady = true; mp.events.callRemote('masson:ui:ready'); return; }
    // Восстановление после падения: вернуть текущий экран без запроса.
    mp.events.callRemote('masson:ui:ready');
    if (screen === 'create' || screen === 'welcome') ui.focus();
}
mp.events.add('browserDomReady', onUiLoaded);
mp.events.add('browserRestored', onUiLoaded);

// Из страницы
mp.events.add('masson:create', (first, last, sex) =>
    mp.events.callRemote('masson:char:create', String(first).slice(0, 16), String(last).slice(0, 16), sex === 'f' ? 'f' : 'm'));
mp.events.add('masson:play', () => mp.events.callRemote('masson:play'));

// ---------- Деньги (переменные, которые видит только сам игрок) ----------
function pushMoney() {
    const me = mp.players.local;
    ui.call('hud:money', Number(me.getVariable('masson:cash')) || 0, Number(me.getVariable('masson:bank')) || 0);
}
mp.events.addDataHandler('masson:cash', (player) => { if (player === mp.players.local) pushMoney(); });
mp.events.addDataHandler('masson:bank', (player) => { if (player === mp.players.local) pushMoney(); });

// ---------- Спидометр: в страницу не чаще 10 раз в секунду и только при изменении ----------
let lastSpeed = -2;
let lastSent = 0;
mp.events.add('render', () => {
    if (screen !== 'hud') return;
    const now = Date.now();
    if (now - lastSent < 100) return;
    lastSent = now;
    const ped = mp.players.local.handle;
    let kmh = -1;
    if (mp.game.ped.isPedInAnyVehicle(ped, false)) {
        const veh = mp.game.ped.getVehiclePedIsIn(ped, false);
        kmh = Math.round(mp.game.entity.getEntitySpeed(veh) * 3.6);
    }
    if (kmh !== lastSpeed) { lastSpeed = kmh; ui.call('hud:speed', kmh); }
});
