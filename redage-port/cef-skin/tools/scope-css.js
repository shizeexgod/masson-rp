// Masson RP: собирает design/*.css в один файл overlay/src/masson/masson.css, где каждый селектор
// начинается с .mp (корень интерфейса Masson). Так стили дизайна не пересекаются со старыми стилями RedAge.
//
// Запуск:  node scope-css.js <папка node_modules с postcss>
// Пример:  node scope-css.js C:\...\cef-dev\src_cef\node_modules
const fs = require('fs');
const path = require('path');

const nm = process.argv[2];
if (!nm) { console.error('укажите путь к node_modules с postcss'); process.exit(1); }
const postcss = require(path.join(nm, 'postcss'));

const ROOT = '.mp';
const dir = path.join(__dirname, '..', 'design');
const out = path.join(__dirname, '..', 'overlay', 'src', 'masson', 'masson.css');
const files = ['tokens.css', 'hud.css', 'ui.css', 'screens.css', 'polish.css',
    ...fs.readdirSync(dir).filter(f => /^inline-.*\.css$/.test(f)).sort(), 'game.css'];

function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel) return sel;
  if (sel === ':root' || sel === 'html' || sel === 'body' || sel === 'html, body') return ROOT;
  if (/^(html|body|:root)\b/.test(sel)) return sel.replace(/^(html|body|:root)\s*/, ROOT + ' ').trim();
  if (sel === '*') return ROOT + ' *';
  if (sel.startsWith('*::') || sel.startsWith('*:')) return ROOT + ' ' + sel;
  return ROOT + ' ' + sel;
}

let css = '';
for (const f of files) css += fs.readFileSync(path.join(dir, f), 'utf8') + '\n';

const root = postcss.parse(css);
root.walkRules(rule => {
  // внутри @keyframes селекторы — проценты, не трогаем
  if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  const seen = new Set();
  rule.selectors = rule.selectors.map(scopeSelector).filter(s => { if (seen.has(s)) return false; seen.add(s); return true; });
});
// html/body-свойства (фон, шрифт) теперь у .mp — добавляем то, чего не было у root
root.append(postcss.parse(
  `${ROOT} { font-family: var(--font); color: var(--text); -webkit-font-smoothing: antialiased; }\n`));

let result = root.toString();
// пути шрифтов — рядом с файлом
result = result.replace(/url\(["']?fonts\//g, 'url("./fonts/');
result = result.replace(/url\("\.\/fonts\/([^")]+)"?\)/g, 'url("./fonts/$1")');
fs.writeFileSync(out, result);
console.log('masson.css', result.length, 'байт');
