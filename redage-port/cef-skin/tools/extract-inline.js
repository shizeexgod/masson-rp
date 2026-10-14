// Masson RP: вынимает inline-стили <style> из HTML-макетов дизайна в design/inline-<имя>.css.
// Эти файлы подхватывает scope-css.js (ставит перед правилами корень .mp).
// Запуск: node extract-inline.js <папка с макетами дизайна> auth characters creator ...
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
const names = process.argv.slice(3);
if (!src || !names.length) { console.error('node extract-inline.js <папка> <имя> ...'); process.exit(1); }
const dst = path.join(__dirname, '..', 'design');

for (const n of names) {
    const html = fs.readFileSync(path.join(src, n + '.html'), 'utf8');
    const blocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1].trim());
    const out = `/* из ${n}.html дизайна */\n` + blocks.join('\n') + '\n';
    fs.writeFileSync(path.join(dst, `inline-${n}.css`), out);
    console.log(n, blocks.length, 'блок(ов),', out.length, 'байт');
}
