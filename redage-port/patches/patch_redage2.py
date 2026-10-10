import io, re, sys, os
W = r"C:\MassonRP\work\redage"

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

# --- A) серверный лог RedAge в файл (консоль движка не сохраняется) ---------------------------------
def logging_patch(t):
    if 'MassonFileLog' in t: return t
    t = t.replace('                Console.WriteLine(ctext + $" | {Reference} | {text}");\n',
                  '                var massonLine = ctext + $" | {Reference} | {text}";\n                Console.WriteLine(massonLine);\n                MassonFileLog.Append(massonLine);\n', 1)
    sink = '''
    // Masson RP: консоль RedAge на FloV:MP не попадает в server.log — пишем её ещё и в logs/redage-ГГГГММДД.log.
    internal static class MassonFileLog
    {
        private static readonly object Lock = new object();
        public static void Append(string line)
        {
            try
            {
                lock (Lock)
                {
                    System.IO.Directory.CreateDirectory("logs");
                    System.IO.File.AppendAllText(System.IO.Path.Combine("logs", "redage-" + DateTime.Now.ToString("yyyyMMdd") + ".log"), line + "\n");
                }
            }
            catch { }
        }
    }
'''
    i = t.rindex('}')   # закрывающая скобка namespace
    return t[:i] + sink + t[i:]
rw(os.path.join(W, r'dotnet\resources\NeptuneEvoSDK\Logging.cs'), logging_patch)

# --- B) клиент: ожидания не дольше нескольких секунд и с записью в журнал клиента ------------------
def load_model_patch(t):
    if 'MASSON' in t: return t
    t = t.replace("        let d = 0;\n        while (!mp.game.streaming.hasModelLoaded(requiredModel)) {\n            if (d > 5000) return resolve(false);",
                  "        let d = 0; const massonT0 = Date.now();\n        while (!mp.game.streaming.hasModelLoaded(requiredModel)) {\n            if (d > 5000 || Date.now() - massonT0 > 4000) { console.log('[MASSON] loadModel: модель не загрузилась за 4 с: ' + requiredModel); return resolve(false); }", 1)
    return t
rw(os.path.join(W, r'src_client\index.js'), load_model_patch)

def anim_patch(t):
    if 'MASSON' in t: return t
    t = t.replace("    let time = 0;\n    while (!mp.game.streaming.hasAnimDictLoaded(animDictionary)) {\n        if (time > 5000)\n            return resolve(",
                  "    let time = 0; const massonT0 = Date.now();\n    while (!mp.game.streaming.hasAnimDictLoaded(animDictionary)) {\n        if (time > 5000 || Date.now() - massonT0 > 3000) {\n            console.log('[MASSON] requestAnimDict: словарь не загрузился за 3 с: ' + animDictionary);\n            return resolve(", 1)
    # закрыть добавленную скобку после return resolve(...);
    t = t.replace("translateText(\"Ошибка requestAnimDict. Dict: \") + animDictionary);\n        time++;", "translateText(\"Ошибка requestAnimDict. Dict: \") + animDictionary);\n        }\n        time++;", 1)
    return t
rw(os.path.join(W, r'src_client\synchronization\animation.js'), anim_patch)

def entity_patch(t):
    if 'MASSON' in t: return t
    t = t.replace("        let d = 0;\n\t\twhile (!entity || !entity.doesExist() || entity.handle === 0) {\n            if (d > 1000) return resolve(translateText(\"Ошибка IsLoadEntity.\"));",
                  "        let d = 0; const massonT0 = Date.now();\n\t\twhile (!entity || !entity.doesExist() || entity.handle === 0) {\n            if (d > 1000 || Date.now() - massonT0 > 2500) { console.log('[MASSON] IsLoadEntity: сущность не появилась за 2,5 с'); return resolve(translateText(\"Ошибка IsLoadEntity.\")); }", 1)
    return t
rw(os.path.join(W, r'src_client\inventory\attachments.js'), entity_patch)
