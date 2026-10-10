'use strict';

const http = require('node:http');
const net = require('node:net');

function readInfo(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: '/info', timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) req.destroy();
      });
      res.on('end', () => {
        try {
          const info = JSON.parse(body);
          resolve({ online: true, players: Number(info.players) || 0,
            maxPlayers: Number(info.maxPlayers) || 128 });
        } catch { resolve(null); }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

// У FloV:MP есть HTTP-раздача на «порт игры + 20» (моды и клиентские пакеты): ответ 200 = сервер жив.
// Запрос чистый, поэтому в журнале сервера не появляется строк «неподдерживаемый клиент».
function probeMods(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: '/mods/manifest.json', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
  });
}

function probeTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (online) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      // Сервер FloV:MP не отдаёт число игроков по TCP — честно говорим «неизвестно», а не «1 из 128».
      resolve({ online, players: 0, maxPlayers: 0, countKnown: false });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function checkServerStatus(host, port, options = {}) {
  if (typeof host !== 'string' || !/^[a-zA-Z0-9.:-]{1,253}$/.test(host)) {
    return { online: false, players: 0, maxPlayers: 0 };
  }
  const gamePort = Number(port);
  if (!Number.isInteger(gamePort) || gamePort < 1 || gamePort > 65535) {
    return { online: false, players: 0, maxPlayers: 0 };
  }
  const infoTimeout = options.infoTimeout ?? 800;
  const tcpTimeout = options.tcpTimeout ?? 1500;
  const info = await readInfo(host, gamePort, infoTimeout);
  if (info) return info;
  if (options.fallbackHttp !== false && gamePort !== 80) {
    const fallback = await readInfo(host, 80, infoTimeout);
    if (fallback) return fallback;
  }
  if (gamePort + 20 <= 65535 && await probeMods(host, gamePort + 20, infoTimeout * 2)) {
    return { online: true, players: 0, maxPlayers: 0, countKnown: false };
  }
  // Раздачи нет — пробуем TCP: игровой порт (7788) у FloV:MP — UDP, TCP слушает шлюз «порт игры + 10» (7798).
  const ports = [gamePort + 10, gamePort].filter((p) => p <= 65535);
  const results = await Promise.all(ports.map((p) => probeTcp(host, p, tcpTimeout)));
  return results.find((r) => r.online) || results[0];
}

module.exports = { checkServerStatus };
