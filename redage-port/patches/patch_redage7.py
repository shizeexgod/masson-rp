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


CHUNK_CS = '''
    // Masson RP: FloV:MP принимает событие сервер -> клиент только до 3800 символов и 4096 байт на проводе,
    // а RedAge шлёт целиком списки дверей, GPS и т. п. Большое событие режется на части (masson.chunk),
    // клиентская прослойка (client_packages/flov-shim.js) собирает их и вызывает исходное событие.
    internal static class MassonChunk
    {
        private const int BigArgChars = 2600;     // строка длиннее — режем
        private const int PartChars = 900;        // длина одной части (кириллица в JSON даёт до 3600 байт — в пределах 4096)
        private const int PartsPerTick = 6;       // частей за раз — очередь игрока не переполняется
        private const int TickMs = 40;
        private static int _id;

        public static bool TrySend(GTANetworkAPI.Player player, string eventName, object[] args)
        {
            if (player == null || args == null || args.Length == 0) return false;
            bool big = false;
            foreach (var a in args)
            {
                if (a is string s) { if (s.Length > BigArgChars) big = true; }
                else if (!(a == null || a is bool || a is int || a is uint || a is long || a is ulong || a is short || a is ushort ||
                           a is byte || a is sbyte || a is float || a is double || a is decimal)) return false;   // сущности и объекты не режем
            }
            if (!big) return false;

            var json = Newtonsoft.Json.JsonConvert.SerializeObject(args);
            var id = System.Threading.Interlocked.Increment(ref _id);
            var total = (json.Length + PartChars - 1) / PartChars;
            for (int i = 0; i < total; i++)
            {
                var part = json.Substring(i * PartChars, System.Math.Min(PartChars, json.Length - i * PartChars));
                var index = i;
                var name = i == 0 ? eventName : "";
                GTANetworkAPI.NAPI.Task.Run(() =>
                {
                    try { if (player != null) GTANetworkAPI.NAPI.ClientEvent.TriggerClientEvent(player, "masson.chunk", id, index, total, name, part); }
                    catch (System.Exception) { }
                }, (long)(i / PartsPerTick) * TickMs);
            }
            return true;
        }
    }
'''


def trigger(t):
    if 'MassonChunk' in t:
        return t
    old = "        public static void ClientEvent(Player player, string eventName, params object[] args)\n        {\n            try\n            {\n"
    assert old in t, 'ClientEvent head not found'
    t = t.replace(old, old + "                if (MassonChunk.TrySend(player, eventName, args)) return;\n", 1)
    # класс — внутрь того же namespace, после последней закрывающей скобки класса Trigger
    i = t.rindex('}')       # конец namespace
    return t[:i] + CHUNK_CS + t[i:]


rw(os.path.join(W, r'dotnet\resources\NeptuneEvoSDK\Trigger.cs'), trigger)


def shim(t):
    if 'masson.chunk' in t:
        return t
    return t + """
try {
    // Сборка больших событий сервера, нарезанных на части (см. MassonChunk в Trigger.cs): [id, номер, всего, имя события, часть].
    const massonParts = {};
    mp.events.add('masson.chunk', function (id, index, total, name, part) {
        try {
            const c = massonParts[id] || (massonParts[id] = { parts: [], got: 0, total: total, name: '', at: Date.now() });
            if (name) c.name = name;
            if (c.parts[index] === undefined) { c.parts[index] = part; c.got++; }
            if (c.got >= c.total) {
                delete massonParts[id];
                const args = JSON.parse(c.parts.join(''));
                mp.events.call(c.name, ...args);
            }
        } catch (e) { console.log('[MASSON] masson.chunk: ' + e); }
    });
} catch (e) { }
"""


rw(os.path.join(W, r'client_packages\flov-shim.js'), shim)
