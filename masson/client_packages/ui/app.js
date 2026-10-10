// Masson RP — страница интерфейса (CEF). window.mp даёт платформа:
//   mp.events.add(имя, fn) — событие из клиентского кода (browser.call);
//   mp.trigger(имя, …)     — событие в клиентский код (mp.events.add в index.js).
// Вне игры (обычный браузер) mp нет — подставляем заглушку для предпросмотра.
'use strict';

const bridge = window.mp || {
  events: { add: (name, fn) => ((window.__preview ||= {})[name] = fn) },
  trigger: (...a) => console.log('[preview] trigger', ...a),
};

const $ = (id) => document.getElementById(id);
// «$5 000» — как в сообщениях сервера (GamemodeResource.Money).
const moneyNum = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const money = { format: (v) => '$' + moneyNum.format(v) };
const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

// ---------- Экраны ----------
const screens = { auth: $('auth'), create: $('create'), welcome: $('welcome'), hud: $('hud') };

function show(name, payload) {
  const inAuth = name === 'create' || name === 'welcome';
  screens.auth.hidden = !inAuth;
  screens.create.hidden = name !== 'create';
  screens.welcome.hidden = name !== 'welcome';
  screens.hud.hidden = name !== 'hud';
  setBusy(false);

  if (name === 'create') $('first').focus();
  if (name === 'welcome') { $('welcome-title').textContent = payload || '—'; $('play-btn').focus(); }
  if (name === 'hud') $('name').textContent = payload || '';
}

bridge.events.add('masson:screen', show);

// ---------- Создание персонажа ----------
const form = $('create');
const createBtn = $('create-btn');
const fields = { first: $('first'), last: $('last') };
const hints = { first: $('first-hint'), last: $('last-hint') };
const HINT = 'Латиница, с заглавной буквы';

function setBusy(busy) {
  createBtn.setAttribute('aria-busy', String(busy));
  createBtn.textContent = busy ? 'Создаём персонажа…' : 'Создать персонажа';
}

function setError(field, text) {
  for (const k of Object.keys(fields)) {
    const isErr = k === field && !!text;
    fields[k].setAttribute('aria-invalid', String(isErr));
    hints[k].textContent = isErr ? text : HINT;
    hints[k].classList.toggle('m-field__hint--error', isErr);
  }
  if (field && text) fields[field].focus();
}

// Та же проверка, что на сервере (сервер всё равно проверит сам).
function check(v) {
  if (v.length < 2) return 'Минимум 2 буквы.';
  if (!/^[A-Z][a-z]{1,15}$/.test(v)) return 'Только латинские буквы, например Ivan.';
  return null;
}
const normalize = (v) => { v = v.trim(); return v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : v; };

for (const [k, input] of Object.entries(fields)) {
  input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') setError(null); });
  input.addEventListener('blur', () => { input.value = normalize(input.value); });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (createBtn.getAttribute('aria-busy') === 'true') return;
  const first = normalize(fields.first.value);
  const last = normalize(fields.last.value);
  fields.first.value = first; fields.last.value = last;
  const e1 = check(first); if (e1) return setError('first', e1);
  const e2 = check(last); if (e2) return setError('last', e2);
  setError(null);
  setBusy(true);
  const sex = form.querySelector('input[name="sex"]:checked').value;
  bridge.trigger('masson:create', first, last, sex);
});

bridge.events.add('masson:error', (field, text) => { setBusy(false); setError(field === 'last' ? 'last' : 'first', text); });

$('play-btn').addEventListener('click', () => {
  $('play-btn').setAttribute('aria-busy', 'true');
  bridge.trigger('masson:play');
});

// ---------- HUD ----------
function setMoney(id, value) {
  const el = $(id);
  const text = money.format(Number(value) || 0);
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
}
bridge.events.add('hud:money', (cash, bank) => { setMoney('cash', cash); setMoney('bank', bank); });

const tick = () => { $('clock').textContent = clock.format(new Date()); };
tick(); setInterval(tick, 10_000);

// ---------- Уведомления ----------
const toasts = $('toasts');
bridge.events.add('hud:notify', (text) => {
  const li = document.createElement('li');
  li.className = 'toast m-glass';
  li.textContent = String(text);           // строки игроков — только textContent
  toasts.prepend(li);
  while (toasts.children.length > 4) toasts.lastElementChild.remove();
  setTimeout(() => { li.classList.add('is-leaving'); setTimeout(() => li.remove(), 240); }, 5000);
});

// ---------- Спидометр ----------
const speedo = $('speedo');
const speed = $('speed');
const bar = $('speed-bar');
bridge.events.add('hud:speed', (kmh) => {
  if (kmh < 0) { speedo.hidden = true; return; }
  speedo.hidden = false;
  speed.textContent = String(kmh);
  bar.style.transform = `scaleX(${Math.min(kmh / 240, 1)})`;
});

// Предпросмотр в обычном браузере: ?screen=create|welcome|hud
if (!window.mp) {
  const p = new URLSearchParams(location.search);
  document.body.style.background = '#2a2233 url("img/logo.jpg") center/cover';
  show(p.get('screen') || 'create', 'Ivan Petrov');
  if (p.get('screen') === 'hud') {
    setMoney('cash', 5000); setMoney('bank', 125000);
    window.__preview['hud:notify']('Анна Смирнова передала вам $1 500');
    window.__preview['hud:speed'](87);
  }
}
