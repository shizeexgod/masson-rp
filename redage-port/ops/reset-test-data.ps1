# Пересоздаёт базы RedAge из чистых дампов, пока сервер остановлен. Прерывается, если в базе есть что-то кроме тестовых данных.
$ErrorActionPreference = 'Stop'
$root = 'C:\MassonRP'
$envmap = @{}; foreach ($l in Get-Content "$root\config\flovmp.env" -Encoding UTF8) { if ($l -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $envmap[$Matches[1]] = $Matches[2].Trim() } }
$db = @{}; foreach ($l in Get-Content "$root\config\redage-db.env" -Encoding UTF8) { if ($l -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $db[$Matches[1]] = $Matches[2].Trim() } }
$maria = "$root\mariadb\bin\mariadb.exe"
$base = @('--no-defaults', '--user=root', '--host=127.0.0.1', '--port=3306', '--skip-ssl', '--default-character-set=utf8mb4')

if (Get-Process mariadbd, flovmp-server, FloVMP-Server -ErrorAction SilentlyContinue) { throw 'сервер или база ещё запущены' }
$proc = Start-Process -FilePath "$root\mariadb\bin\mariadbd.exe" -ArgumentList "--defaults-file=$root\mariadb-data\my.ini" -WindowStyle Hidden -PassThru
$env:MYSQL_PWD = $envmap.FLOVMP_DB_ROOT_PASSWORD
for ($i = 0; $i -lt 40; $i++) { Start-Sleep 1; if ((Test-NetConnection 127.0.0.1 -Port 3306 -WarningAction SilentlyContinue).TcpTestSucceeded) { break } }
try {
    $acc = [int](& $maria @base -N -e "SELECT COUNT(*) FROM ra3_main.accounts")
    $chr = [int](& $maria @base -N -e "SELECT COUNT(*) FROM ra3_main.characters")
    $logins = (& $maria @base -N -e "SELECT login FROM ra3_main.accounts") -join ','
    "до сброса: аккаунтов $acc ($logins), персонажей $chr"
    if ($acc -gt 1 -or $chr -gt 1 -or ($acc -eq 1 -and $logins -ne 'masson_bot1')) { throw 'в базе есть не только тестовые данные — сброс отменён' }
    foreach ($n in 'ra3_main', 'ra3_mainconfig', 'ra3_mainlogs') {
        & $maria @base -e "DROP DATABASE IF EXISTS $n; CREATE DATABASE $n CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        $suffix = $n -replace '^ra3_', ''
        $dump = "$root\work\redage\database\$suffix.sql"
        cmd /c "`"$maria`" $($base -join ' ') $n < `"$dump`""
        if ($LASTEXITCODE -ne 0) { throw "ошибка загрузки $dump" }
        $t = & $maria @base -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$n'"
        "$n <- $suffix.sql: $t таблиц"
    }
    "после сброса: аккаунтов " + (& $maria @base -N -e "SELECT COUNT(*) FROM ra3_main.accounts") + ", персонажей " + (& $maria @base -N -e "SELECT COUNT(*) FROM ra3_main.characters")
    # права пользователя redage на пересозданные базы (на всякий случай)
    & $maria @base -e "GRANT ALL PRIVILEGES ON ra3_main.* TO 'redage'@'localhost'; GRANT ALL PRIVILEGES ON ra3_mainconfig.* TO 'redage'@'localhost'; GRANT ALL PRIVILEGES ON ra3_mainlogs.* TO 'redage'@'localhost'; GRANT ALL PRIVILEGES ON ra3_main.* TO 'redage'@'127.0.0.1'; GRANT ALL PRIVILEGES ON ra3_mainconfig.* TO 'redage'@'127.0.0.1'; GRANT ALL PRIVILEGES ON ra3_mainlogs.* TO 'redage'@'127.0.0.1'; FLUSH PRIVILEGES;"
}
finally {
    & "$root\mariadb\bin\mariadb-admin.exe" --no-defaults --user=root --host=127.0.0.1 --port=3306 --skip-ssl shutdown 2>&1 | Out-Null
    $env:MYSQL_PWD = $null
    for ($i = 0; $i -lt 40; $i++) { Start-Sleep 1; if (-not (Get-Process mariadbd -ErrorAction SilentlyContinue)) { break } }
    'база остановлена: ' + (-not (Get-Process mariadbd -ErrorAction SilentlyContinue))
}
# карты кода игрокам не нужны
$maps = Get-ChildItem "$root\server\client_packages" -Recurse -File -Filter *.map -ErrorAction SilentlyContinue
"карт кода в client_packages: $($maps.Count)"
$maps | ForEach-Object { [IO.File]::Delete($_.FullName) }
