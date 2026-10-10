$ErrorActionPreference = 'Stop'
$root = 'C:\MassonRP'
# MariaDB: больше соединений (RedAge не может выставить сам: нужны права SUPER)
$ini = "$root\mariadb-data\my.ini"
$t = [IO.File]::ReadAllText($ini)
if ($t -notmatch 'max_connections') {
    $t = $t -replace '(?m)^(\[mysqld\]\s*\r?\n)', "`$1max_connections=500`r`n"
    [IO.File]::WriteAllText($ini, $t, (New-Object Text.ASCIIEncoding))
    'my.ini: max_connections=500'
}
# Redis
& powershell -NoProfile -ExecutionPolicy Bypass -File "$root\scripts-masson\setup-redis.ps1" 2>&1 | ForEach-Object { "$_" }
# патч кода Redis у RedAge
& 'C:\Program Files\Python312\python.exe' "$root\scripts-masson\patch_redage6.py" 2>&1 | ForEach-Object { "$_" }
# клиент
$node = "$root\tools-ext\node16"; $env:Path = "$node;$env:Path"
Set-Location "$root\work\redage\src_client"
& "$node\npm.cmd" run build 2>&1 | Select-Object -Last 2 | ForEach-Object { "$_" }
"MASSON markers in main.js: " + ([regex]::Matches([IO.File]::ReadAllText("$root\work\redage\client_packages\main.js"), 'MASSON\]')).Count
