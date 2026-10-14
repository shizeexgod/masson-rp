"""Masson RP, патч 10: ники над игроками в стиле проекта.

Ники рисует сам клиент игры (src_client/player/gamertag.js) нативами, не CEF-интерфейс, поэтому стиль задаётся здесь:
 - под именем тёмная плашка (как панели интерфейса) и тонкая акцентная линия розовый → сиреневый;
 - админский ник (REDNAME) — розовый вместо красного;
 - значок «говорит» — розово-фиолетовый вместо белого;
 - полосы здоровья и брони — в палитре проекта (розовая, сиреневая, красная для критичного здоровья).
Шрифт и размер не меняются: в RedAge имя «Незнакомец» набрано смесью латиницы и кириллицы под шрифт 0.

Запуск (на VDS): python patch_redage10.py [путь к рабочей копии RedAge, по умолчанию C:\\MassonRP\\work\\redage]
"""
import os, sys

W = sys.argv[1] if len(sys.argv) > 1 else r"C:\MassonRP\work\redage"
path = os.path.join(W, r"src_client\player\gamertag.js")


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


PLATE = '''		// Masson RP: плашка под именем и акцентная линия (розовый → сиреневый)
		if (player.nameWidth && player.nameHeight) {
			const plateW = player.nameWidth + 0.014, plateH = player.nameHeight + 0.008, plateY = y + player.nameHeight / 2 + 0.001;
			mp.game.graphics.drawRect(x, plateY, plateW, plateH, 10, 7, 19, 150);
			mp.game.graphics.drawRect(x - plateW / 4, plateY + plateH / 2, plateW / 2, 0.0012, 255, 102, 179, 230);
			mp.game.graphics.drawRect(x + plateW / 4, plateY + plateH / 2, plateW / 2, 0.0012, 123, 134, 255, 230);
		}

'''


def patch(t):
    if 'Masson RP: плашка под именем' in t:
        return t

    # 1. плашка перед выводом имени
    old = "		mp.game.graphics.drawText(nameTag, [\n			x,\n			y\n		], textData);\n"
    assert old in t, 'drawText имени не найден'
    t = t.replace(old, PLATE + old, 1)

    # 2. админский ник — розовый
    old = "player.nameTag = `~r~${player.name.replace('_', ' ')} (${player.remoteId})`;"
    assert old in t, 'REDNAME не найден'
    t = t.replace(old, "player.nameTag = `~q~${player.name.replace('_', ' ')} (${player.remoteId})`;", 1)

    # 3. значок «говорит» — акцентный
    old = '					let color = defaultColor;\n'
    assert old in t, 'цвет значка голоса не найден'
    t = t.replace(old, '					let color = [255, 138, 200, 255];\n', 1)

    # 4. полосы здоровья и брони в палитре проекта
    old = '''			if (realHealth >= 80)
				drawColor[0] = 0, drawColor[1] = 220, drawColor[2] = 0;
			else if (realHealth >= 20 && realHealth < 80)
				drawColor[0] = 255, drawColor[1] = 220, drawColor[2] = 0;
			else
				drawColor[0] = 255, drawColor[1] = 0, drawColor[2] = 0;
'''
    assert old in t, 'цвета здоровья не найдены'
    t = t.replace(old, '''			if (realHealth >= 60)
				drawColor[0] = 255, drawColor[1] = 102, drawColor[2] = 179;
			else if (realHealth >= 20 && realHealth < 60)
				drawColor[0] = 196, drawColor[1] = 107, drawColor[2] = 240;
			else
				drawColor[0] = 255, drawColor[1] = 101, drawColor[2] = 128;
''', 1)
    old = '''				mp.game.graphics.drawRect(x, y, width, height, 41, 66, 78, 255);
				mp.game.graphics.drawRect(x - width / 2 * (1 - armour), y, width * armour, height, 48, 108, 135, 200)'''
    assert old in t, 'полоса брони не найдена'
    t = t.replace(old, '''				mp.game.graphics.drawRect(x, y, width, height, 30, 20, 60, 220);
				mp.game.graphics.drawRect(x - width / 2 * (1 - armour), y, width * armour, height, 123, 134, 255, 230)''', 1)
    return t


rw(path, patch)
