import os, re
W = r"C:\MassonRP\work\redage\src_client"

def rw(path, fn):
    raw = open(path, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    t = raw.decode('utf-8-sig')
    crlf = '\r\n' in t
    t = t.replace('\r\n', '\n')
    t2 = fn(t)
    if t2 == t:
        print('NO CHANGE', path); return
    if crlf: t2 = t2.replace('\n', '\r\n')
    open(path, 'wb').write((b'\xef\xbb\xbf' if bom else b'') + t2.encode('utf-8'))
    print('patched', path)

# FadeScreen: трассировка и отметка «затемнение снято»
def fade(t):
    old = "global.FadeScreen = (state, duration) => {\n    mp.gui.emmit(`window.FadeScreen(${state}, ${duration})`);\n}"
    assert old in t, 'FadeScreen not found'
    new = ("global.FadeScreen = (state, duration) => {\n"
           "    console.log('[MASSON] FadeScreen ' + state + ' ' + duration);\n"
           "    if (!state) global.__massonFadeOffAt = Date.now();\n"
           "    mp.gui.emmit(`window.FadeScreen(${state}, ${duration})`);\n}")
    return t.replace(old, new, 1)
rw(os.path.join(W, r'camera\other.js'), fade)

# toslots: трассировка + страховка — если за 15 с затемнение не снято, снимаем (иначе чёрный экран с кругом навсегда)
def slots(t):
    old = "gm.events.add('toslots', function (data, customizationsData, clothes, accessory) {\n\tmp.gui.emmit(`window.listernEvent ('queueText', false);`);\n\n\tglobal.FadeScreen (true, 0);\n"
    assert old in t, 'toslots not found'
    new = (old +
           "\tconsole.log('[MASSON] toslots получен');\n"
           "\tglobal.__massonToslotsAt = Date.now();\n"
           "\tsetTimeout(() => {\n"
           "\t\tif (!(global.__massonFadeOffAt > global.__massonToslotsAt)) {\n"
           "\t\t\tconsole.log('[MASSON] toslots: за 15 с затемнение не снято — снимаю принудительно');\n"
           "\t\t\tglobal.FadeScreen (false, 500);\n"
           "\t\t}\n"
           "\t}, 15000);\n")
    return t.replace(old, new, 1)
rw(os.path.join(W, r'player\hud.js'), slots)

# character.js: этапы сцены и ошибки в журнал клиента
def character(t):
    t = re.sub(r"(crushStartCharacterCustomization = (\d+);)", r"\1 console.log('[MASSON] сцена персонажей: этап \2');", t)
    old = "        mp.events.callRemote(\"client_trycatch\", \"player/character\", \"StartCharacterCustomization - \" + crushStartCharacterCustomization, e.toString());"
    assert old in t, 'catch not found'
    t = t.replace(old, "        console.log('[MASSON] StartCharacterCustomization упал на этапе ' + crushStartCharacterCustomization + ': ' + e + ' | ' + (e && e.stack));\n" + old, 1)
    t = t.replace("gm.events.add('initCustomizationCharsData', (customizationsData, clothes, accessory, charsSlot) => {\n    try {",
                  "gm.events.add('initCustomizationCharsData', (customizationsData, clothes, accessory, charsSlot) => {\n    console.log('[MASSON] initCustomizationCharsData');\n    try {", 1)
    t = t.replace("gm.events.add('CreatorCamera', (isCreate = false) => {\n    StartCharacterCustomization (isCreate);",
                  "gm.events.add('CreatorCamera', (isCreate = false) => {\n    console.log('[MASSON] CreatorCamera isCreate=' + isCreate);\n    StartCharacterCustomization (isCreate);", 1)
    # initInterface без try/catch: ошибка в асинхронной функции пропадала бесследно и экран оставался чёрным
    old2 = "const initInterface = async (isCreate) => {\n"
    assert old2 in t, 'initInterface not found'
    t = t.replace(old2, "const initInterface = async (isCreate) => {\n  try {\n    console.log('[MASSON] initInterface isCreate=' + isCreate);\n", 1)
    old3 = "    global.FadeScreen (false, 1500);\n\n    initCustomization = true;\n}\n"
    assert old3 in t, 'initInterface tail not found'
    t = t.replace(old3, "    global.FadeScreen (false, 1500);\n\n    initCustomization = true;\n  } catch (e) {\n    console.log('[MASSON] initInterface упал: ' + e + ' | ' + (e && e.stack));\n    global.FadeScreen (false, 800);\n    mp.events.callRemote(\"client_trycatch\", \"player/character\", \"initInterface\", String(e));\n  }\n}\n", 1)
    return t
rw(os.path.join(W, r'player\character.js'), character)
