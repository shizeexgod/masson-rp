import os
W = r"C:\MassonRP\work\redage\dotnet\resources\NeptuneEvo"

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

# 1) Главный конструктор: движок FloV:MP работает без ICU (InvariantGlobalization) — именованные культуры недоступны.
rw(os.path.join(W, 'Main.cs'), lambda t: t.replace('new CultureInfo("en-US")', 'CultureInfo.InvariantCulture'))

# 2) Форматирование денег (греческая культура: точка между тысячами) — своя культура на основе инвариантной.
rw(os.path.join(W, r'MoneySystem\Wallet.cs'), lambda t: t.replace('CultureInfo.CreateSpecificCulture("el-GR")', 'MassonCulture.Greek'))

open(os.path.join(W, r'MoneySystem\MassonCulture.cs'), 'wb').write(b'\xef\xbb\xbf' + '''using System.Globalization;

namespace NeptuneEvo.MoneySystem
{
    // Masson RP: FloV:MP запускает ресурсы без ICU (режим InvariantGlobalization), поэтому
    // CultureInfo.CreateSpecificCulture("el-GR") бросает исключение. Тот же вид чисел: 1.234.567 и «,» для дробной части.
    internal static class MassonCulture
    {
        public static readonly CultureInfo Greek = Build();

        private static CultureInfo Build()
        {
            var culture = (CultureInfo)CultureInfo.InvariantCulture.Clone();
            var nf = culture.NumberFormat;
            nf.NumberGroupSeparator = ".";
            nf.NumberDecimalSeparator = ",";
            nf.CurrencyGroupSeparator = ".";
            nf.CurrencyDecimalSeparator = ",";
            nf.PercentGroupSeparator = ".";
            nf.PercentDecimalSeparator = ",";
            return culture;
        }
    }
}
'''.replace('\n', '\r\n').encode('utf-8'))
print('created MassonCulture.cs')
