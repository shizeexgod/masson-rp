'use strict';
// Masson RP — раздача обновлений лаунчера (latest.yml, установщик, blockmap) по HTTP.
//   node update-server.js <порт> <папка с файлами>
// Отдаёт только файлы из папки (без вложенных путей), умеет Range — electron-updater качает только изменившиеся блоки.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = parseInt(process.argv[2], 10) || 7810;
const root = path.resolve(process.argv[3] || path.join(__dirname, 'files'));
const PREFIX = '/launcher/';
const TYPES = { '.yml': 'text/yaml; charset=utf-8', '.exe': 'application/octet-stream', '.blockmap': 'application/octet-stream' };

fs.mkdirSync(root, { recursive: true });

function send(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'bad request'); }
  if (!pathname.startsWith(PREFIX)) return send(res, 404, 'not found');
  const name = pathname.slice(PREFIX.length);
  // только имя файла: никаких «..», слэшей и дисков
  if (!name || name !== path.basename(name) || /[\\/:]/.test(name) || name.startsWith('.')) return send(res, 404, 'not found');
  const file = path.join(root, name);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found');
    const type = TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Cache-Control': name === 'latest.yml' ? 'no-cache' : 'public, max-age=3600',
      'Last-Modified': st.mtime.toUTCString(),
    };
    let start = 0, end = st.size - 1, code = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') { start = Math.max(0, st.size - parseInt(m[2], 10)); }
      else { start = parseInt(m[1], 10); if (m[2] !== '') end = Math.min(end, parseInt(m[2], 10)); }
      if (start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      code = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(code, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
});

server.keepAliveTimeout = 15000;
server.listen(port, '0.0.0.0', () => console.log(`[update-server] ${root} → http://0.0.0.0:${port}${PREFIX}`));
