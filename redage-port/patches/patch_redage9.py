import os
W = r"C:\MassonRP\work\redage"


def rw(path, fn):
    raw = open(path, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    t = raw.decode('utf-8-sig')
    crlf = '\r\n' in t
    t = t.replace('\r\n', '\n')
    t2 = fn(t)
    if t2 == t:
        print('NO CHANGE', path)
        return
    if crlf:
        t2 = t2.replace('\n', '\r\n')
    open(path, 'wb').write((b'\xef\xbb\xbf' if bom else b'') + t2.encode('utf-8'))
    print('patched', path)


NAMETAGS = '''// Masson RP: FloV:MP не передаёт в событие render список ников (в RAGE:MP он есть), и nametags.forEach падало
// на каждом кадре. Список собираем сами: игроки в зоне стрима с экранными координатами.
function massonNametags() {
	const res = [];
	try {
		const lp = global.localplayer;
		if (!lp) return res;
		const lpPos = lp.position;
		mp.players.forEachInStreamRange(player => {
			try {
				if (player === lp || !mp.players.exists(player)) return;
				const pos = player.position;
				const distance = mp.game.system.vdist(pos.x, pos.y, pos.z, lpPos.x, lpPos.y, lpPos.z);
				if (distance > MaxStreeamDist) return;
				const s = mp.game.graphics.world3dToScreen2d(pos.x, pos.y, pos.z + 1.0);
				if (s) res.push([player, s.x, s.y, distance]);
			} catch (e) { }
		});
	} catch (e) { }
	return res;
}

'''


def gamertag(t):
    if 'massonNametags' in t:
        return t
    old = "gm.events.add('render', (nametags) => {\n\ttry {\n\t\tif (!global.loggedin) return;\n"
    assert old in t, 'gamertag render head not found'
    new = NAMETAGS + old + "\t\tif (!nametags) nametags = massonNametags();\n"
    return t.replace(old, new, 1)


JSON_HELPER = '''// Masson RP: поля внешности персонажа с сервера могут прийти пустыми — разбор не должен ронять весь экран выбора.
function massonJson(value, fallback) {
    try {
        if (value === undefined || value === null || value === '' || value === 'undefined') return fallback;
        const r = typeof value === 'string' ? JSON.parse(value) : value;
        return (r === undefined || r === null) ? fallback : r;
    } catch (e) {
        console.log('[MASSON] massonJson: ' + e + ' | ' + String(value).slice(0, 60));
        return fallback;
    }
}

'''


def character(t):
    if 'massonJson' in t:
        return t
    marker = 'let InitPlayerCharDeb = 0;\n'
    assert marker in t, 'InitPlayerCharDeb not found'
    t = t.replace(marker, JSON_HELPER + marker, 1)
    reps = [
        ('JSON.parse (customData.Hair)', 'massonJson (customData.Hair, { Hair: 0, Color: 0, HighlightColor: 0 })'),
        ('JSON.parse (customData.Tattoos)', 'massonJson (customData.Tattoos, {})'),
        ('JSON.parse (customData.Parents)', 'massonJson (customData.Parents, { Mother: 0, Father: 0, Similarity: 0.5, SkinSimilarity: 0.5 })'),
        ('JSON.parse (customData.Features)', 'massonJson (customData.Features, [])'),
        ('JSON.parse (customData.Appearance)', 'massonJson (customData.Appearance, [])'),
    ]
    for a, b in reps:
        n = t.count(a)
        print(a, '->', n)
        t = t.replace(a, b)
    return t


rw(os.path.join(W, r'src_client\player\gamertag.js'), gamertag)
rw(os.path.join(W, r'src_client\player\character.js'), character)
