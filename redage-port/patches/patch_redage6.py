import os, re
W = r"C:\MassonRP\work\redage\dotnet\resources\NeptuneEvo"


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


def redis(t):
    # пароль Redis был зашит в код продавца — читаем свой из settings/redisPassword.txt
    new, n = re.subn(r'Password\s*=\s*"[^"]*",',
                     'Password = System.IO.File.Exists("settings/redisPassword.txt") ? System.IO.File.ReadAllText("settings/redisPassword.txt").Trim() : "",', t, count=1)
    print('redis password replaced:', n)
    return new


rw(os.path.join(W, r'Utils\Redis\Repository.cs'), redis)
