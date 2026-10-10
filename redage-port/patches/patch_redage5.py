import os, re
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


def character(t):
    # 1) clearClothes: индекс пола мог быть boolean/NaN -> clothesEmpty[gender] == undefined (ошибка из client_tc)
    n = t.count('global.clothesEmpty[gender][')
    t = t.replace('global.clothesEmpty[gender][', 'massonEmpty(gender)[')
    t = t.replace('function clearClothes(ped, gender) {',
                  'function massonEmpty(g) { return global.clothesEmpty[g] || global.clothesEmpty[Number(g) ? 1 : 0] || global.clothesEmpty[1]; }\n\nfunction clearClothes(ped, gender) {', 1)
    t = t.replace('mp.events.callRemote("client_trycatch", "player/character", "clearClothes", e.toString());',
                  "console.log('[MASSON] clearClothes: gender=' + gender + ' (' + typeof gender + ') ' + e);\n        mp.events.callRemote(\"client_trycatch\", \"player/character\", \"clearClothes\", e.toString());", 1)
    print('clearClothes replacements:', n)

    # 2) initChars: трассировка
    old = "gm.events.add('client.characters.initChars', async () => {\n    try {\n        InitPlayerCharDeb = 0;"
    assert old in t, 'initChars head'
    t = t.replace(old, "gm.events.add('client.characters.initChars', async () => {\n    console.log('[MASSON] initChars: начало');\n    try {\n        InitPlayerCharDeb = 0;", 1)
    old = "        await global.wait(200);\n\n        initInterface ();\n\n    } catch (e) {"
    assert old in t, 'initChars tail'
    t = t.replace(old, "        await global.wait(200);\n\n        console.log('[MASSON] initChars: вызываю initInterface');\n        initInterface ();\n\n    } catch (e) {\n        console.log('[MASSON] initChars упал (этап ' + InitPlayerCharDeb + '): ' + e + ' | ' + (e && e.stack));", 1)

    # 3) принудительное открытие экрана слотов (используется страховкой в toslots)
    old = "const UpdateGender = async (gender) => {"
    assert old in t, 'UpdateGender'
    t = t.replace(old, "global.__massonForceChars = () => initInterface(false);\n\n" + old, 1)
    return t


rw(os.path.join(W, r'src_client\player\character.js'), character)


def hud(t):
    old = ("\t\t\tconsole.log('[MASSON] toslots: за 15 с затемнение не снято — снимаю принудительно');\n"
           "\t\t\tglobal.FadeScreen (false, 500);\n")
    assert old in t, 'watchdog'
    new = ("\t\t\tconsole.log('[MASSON] toslots: за 15 с экран слотов не открылся — открываю принудительно');\n"
           "\t\t\ttry { if (global.__massonForceChars) global.__massonForceChars(); } catch (e) { console.log('[MASSON] force: ' + e); }\n"
           "\t\t\tglobal.FadeScreen (false, 500);\n")
    return t.replace(old, new, 1)


rw(os.path.join(W, r'src_client\player\hud.js'), hud)


def shim(t):
    if 'hasVariable' in t:
        return t
    return t + """
try {
    // world/stream.js: object.hasVariable('furniture') — у объектов FloV:MP нет hasVariable (ошибка playerReady из client_tc).
    if (typeof Object.prototype.hasVariable !== 'function') {
        Object.defineProperty(Object.prototype, 'hasVariable', {
            configurable: true, writable: true, enumerable: false,
            value: function (key) {
                try { const v = this.getVariable(key); return v !== undefined && v !== null; } catch (e) { return false; }
            },
        });
    }
} catch (e) { }
"""


rw(os.path.join(W, r'client_packages\flov-shim.js'), shim)
# сама прослойка живёт и в проекте (redage-port/flov-shim.js) — на VDS копия в work\redage\client_packages
