// Силуэт города для фона экранов входа (детерминированный, без внешних файлов). Порт из дизайна (ui.js).
export function skylineSvg() {
    let x = 0, seed = 7, out = '';
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < 1920) {
        const w = 60 + rnd() * 120, h = 90 + rnd() * 210, y = 320 - h;
        out += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#0d0916" />`;
        for (let wy = y + 14; wy < 310; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 14) {
            if (rnd() > .86) out += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="8" fill="${rnd() > .5 ? '#ff66b3' : '#9aaaff'}" opacity="${(.25 + rnd() * .4).toFixed(2)}"/>`;
        }
        x += w + 4 + rnd() * 10;
    }
    return `<svg viewBox="0 0 1920 320" width="1920" height="320" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="skyfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1230" stop-opacity="0"/><stop offset="1" stop-color="#0b0a10" stop-opacity=".9"/></linearGradient></defs>${out}<rect width="1920" height="320" fill="url(#skyfade)"/></svg>`;
}
