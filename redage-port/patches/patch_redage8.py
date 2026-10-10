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


def sdk(t):
    if 'MaxJsonChars' in t:
        return t
    # класс открываем для Main.cs (там свой Trigger.ClientEvent(ExtPlayer), он перекрывал SDK-версию и шёл мимо нарезки)
    t = t.replace('internal static class MassonChunk', 'public static class MassonChunk', 1)
    # лимит FloV:MP считается по JSON всех аргументов (кавычки экранируются, кириллица = 2 байта), а не по длине строки
    old = 'private const int BigArgChars = 2600;     // строка длиннее — режем'
    assert old in t, 'BigArgChars not found'
    t = t.replace(old, 'private const int BigArgChars = 600;      // строка длиннее — проверяем размер JSON\n'
                       '        private const int MaxJsonChars = 2400;    // JSON аргументов больше — режем (лимит платформы 3800 символов)\n'
                       '        private const int MaxJsonBytes = 3000;    // и больше по байтам (лимит 4096 на проводе)', 1)
    old = 'var json = Newtonsoft.Json.JsonConvert.SerializeObject(args);\n'
    assert old in t, 'SerializeObject not found'
    t = t.replace(old, old + '            if (json.Length <= MaxJsonChars && System.Text.Encoding.UTF8.GetByteCount(json) <= MaxJsonBytes) return false;\n', 1)
    t = t.replace('private const int PartChars = 900;', 'private const int PartChars = 700;', 1)
    return t


def main_cs(t):
    if 'MassonChunk.TrySend' in t:
        return t
    old = ('        public static void ClientEvent(ExtPlayer player, string eventName, params object[] args)\n'
           '        {\n            try\n            {\n')
    assert old in t, 'Main.ClientEvent head not found'
    return t.replace(old, old + '                if (Redage.SDK.MassonChunk.TrySend(player, eventName, args)) return;\n', 1)


rw(os.path.join(W, r'dotnet\resources\NeptuneEvoSDK\Trigger.cs'), sdk)
rw(os.path.join(W, r'dotnet\resources\NeptuneEvo\Main.cs'), main_cs)
