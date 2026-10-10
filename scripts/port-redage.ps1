<#
  Masson RP — перенос RedAge 3.0 (RAGE:MP) на FloV:MP одной командой.

  Запуск на VDS (PowerShell), сервер FloV:MP перед шагом установки должен быть остановлен:
    powershell -ExecutionPolicy Bypass -File C:\MassonRP\scripts-masson\port-redage.ps1 -Source C:\MassonRP\src\redage

  Что делает (исходную папку не меняет, всё — в рабочей копии C:\MassonRP\work\redage):
    1. проверяет структуру RedAge (dotnet\resources, src_cef, src_client, database, settings);
    2. отчёт совместимости FloV:MP (migrate.py --dry-run) — ничего не пишет, кроме папки отчёта;
    3. собирает интерфейсы CEF (src_cef) и клиент (src_client) на Node 16.14;
    4. загружает SQL-дампы в ra3_main / ra3_mainconfig / ra3_mainlogs (только в пустые базы);
    5. вписывает доступ к базе из config\redage-db.env в settings\mainDB.json рабочей копии;
    6. переносит в сервер: migrate.py --verify-cs --install-into (с бэкапом и откатом FloV:MP).

  Параметры:
    -Source      папка RedAge (обязательно)
    -ReportOnly  только шаги 1–2
    -SkipBuild   не собирать CEF/клиент (если client_packages уже собраны)
    -SkipDb      не трогать базы
    -InstallOnly только шаг 6 на подготовленной копии (папка work, см. $Work ниже)
                 (после остановки сервера FloV:MP; Masson-геймод из server.toml убирают заранее)
#>
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [switch]$ReportOnly,
    [switch]$SkipBuild,
    [switch]$SkipDb,
    [switch]$InstallOnly
)
$ErrorActionPreference = 'Stop'
$Root    = 'C:\MassonRP'
$Python  = 'C:\Program Files\Python312\python.exe'
$Node    = Join-Path $Root 'tools-ext\node16'
$Maria   = Join-Path $Root 'mariadb\bin\mariadb.exe'
$Migrate = Join-Path $Root 'tools\rage-migrate\migrate.py'
$Work    = Join-Path $Root 'work\redage'
$Stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$Reports = Join-Path $Root "migration\$Stamp"

function Step($n, $t) { Write-Host "`n[$n] $t" -ForegroundColor Magenta }
function Ok($t)   { Write-Host "    OK  $t" -ForegroundColor Green }
function Warn($t) { Write-Host "    !!  $t" -ForegroundColor Yellow }
function Fail($t) { Write-Host "    XX  $t" -ForegroundColor Red; exit 1 }
function Read-EnvFile($path) {
    $m = @{}
    foreach ($l in Get-Content -LiteralPath $path -Encoding UTF8) {
        if ($l -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $m[$Matches[1]] = $Matches[2].Trim() }
    }
    $m
}
function Run-Npm($dir, [string[]]$npmArgs) {
    $env:Path = "$Node;$env:Path"
    Push-Location $dir
    try {
        & (Join-Path $Node 'npm.cmd') @npmArgs
        if ($LASTEXITCODE -ne 0) { Fail "npm $($npmArgs -join ' ') в $dir завершился с кодом $LASTEXITCODE" }
    } finally { Pop-Location }
}

if ($InstallOnly) {
    if (-not (Test-Path $Work)) { Fail "нет подготовленной копии $Work" }
    New-Item -ItemType Directory -Force $Reports | Out-Null
}
else {
# --- 1. Структура -----------------------------------------------------------
Step 1 'Проверка исходников RedAge'
$Source = [IO.Path]::GetFullPath($Source)
if (-not (Test-Path $Source)) { Fail "нет папки $Source" }
$need = @('dotnet\resources', 'src_cef', 'src_client', 'database', 'settings')
foreach ($n in $need) {
    if (Test-Path (Join-Path $Source $n)) { Ok $n } else { Warn "нет $n — проверьте, что указан корень сборки" }
}
$sln = Get-ChildItem (Join-Path $Source 'dotnet\resources') -Filter *.sln -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($sln) { Ok "решение C#: $($sln.Name)" } else { Warn 'не найдено .sln в dotnet\resources' }
New-Item -ItemType Directory -Force $Reports | Out-Null

# --- 2. Отчёт совместимости ------------------------------------------------
Step 2 'Отчёт совместимости FloV:MP (dry-run, исходники не меняются)'
& $Python $Migrate $Source --dry-run --report-dir (Join-Path $Reports 'report-dry') --install-into $Root
if ($LASTEXITCODE -ne 0) { Warn "migrate.py вернул $LASTEXITCODE — смотрите отчёт" }
Ok "отчёт: $Reports\report-dry\migration-report.md"
if ($ReportOnly) { exit 0 }

# --- рабочая копия --------------------------------------------------------
Step '2b' "Рабочая копия → $Work"
if (Test-Path $Work) {
    $old = "$Work.old-$Stamp"; Move-Item $Work $old; Warn "прежняя копия сохранена: $old"
}
New-Item -ItemType Directory -Force (Split-Path $Work) | Out-Null
robocopy $Source $Work /E /NFL /NDL /NJH /NJS /XD node_modules .git | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "robocopy завершился с кодом $LASTEXITCODE" }
Ok 'скопировано'

# --- 3. Сборка CEF и клиента -----------------------------------------------
if (-not $SkipBuild) {
    Step 3 'Сборка интерфейсов (src_cef) и клиента (src_client) на Node 16.14'
    $cef = Join-Path $Work 'src_cef'
    if (Test-Path $cef) {
        Run-Npm $cef @('install', '--legacy-peer-deps', '--no-audit', '--no-fund')
        Run-Npm $cef @('run', 'build'); Ok 'CEF собран'
    }
    $cli = Join-Path $Work 'src_client'
    if (Test-Path $cli) {
        Run-Npm $cli @('install', '--no-audit', '--no-fund')
        Run-Npm $cli @('run', 'build'); Ok 'клиент собран'
    }
}

# --- 4–5. База данных ------------------------------------------------------
$dbEnvPath = Join-Path $Root 'config\redage-db.env'
if (-not $SkipDb) {
    Step 4 'Загрузка SQL-дампов в ra3_* (только в пустые базы)'
    if (-not (Test-Path $dbEnvPath)) { Fail "нет $dbEnvPath" }
    $db = Read-EnvFile $dbEnvPath
    $env:MYSQL_PWD = $db.REDAGE_DB_PASSWORD
    $base = @('--no-defaults', "--user=$($db.REDAGE_DB_USER)", "--host=$($db.REDAGE_DB_HOST)", "--port=$($db.REDAGE_DB_PORT)", '--skip-ssl', '--default-character-set=utf8mb4')
    $dumps = Get-ChildItem (Join-Path $Work 'database') -Filter *.sql -Recurse -ErrorAction SilentlyContinue
    foreach ($name in @($db.REDAGE_DB_MAIN, $db.REDAGE_DB_CONFIG, $db.REDAGE_DB_LOGS)) {
        # ra3_mainconfig.sql / ra3_mainlogs.sql / ra3_main.sql — точное имя важнее «содержит»
        $dump = $dumps | Where-Object { $_.BaseName -ieq $name } | Select-Object -First 1
        if (-not $dump) {
            $suffix = $name -replace '^ra3_', ''
            $dump = $dumps | Where-Object { $_.BaseName -imatch "(^|_)$suffix$" } | Select-Object -First 1
        }
        if (-not $dump) { Warn "дамп для $name не найден — загрузите вручную"; continue }
        $tables = & $Maria @base -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$name'"
        if ([int]$tables -gt 0) { Warn "$name уже содержит $tables таблиц — пропускаю"; continue }
        cmd /c "`"$Maria`" $($base -join ' ') $name < `"$($dump.FullName)`""
        if ($LASTEXITCODE -ne 0) { Fail "ошибка загрузки $($dump.Name) в $name" }
        $tables = & $Maria @base -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$name'"
        Ok "$($dump.Name) → $name ($tables таблиц)"
    }
    Remove-Item Env:\MYSQL_PWD

    Step 5 'Доступ к базе в settings\mainDB.json рабочей копии'
    $mainDb = Join-Path $Work 'settings\mainDB.json'
    if (Test-Path $mainDb) {
        $j = Get-Content $mainDb -Raw -Encoding UTF8 | ConvertFrom-Json
        $set = @{ host = $db.REDAGE_DB_HOST; server = $db.REDAGE_DB_HOST; port = [int]$db.REDAGE_DB_PORT;
                  user = $db.REDAGE_DB_USER; username = $db.REDAGE_DB_USER; uid = $db.REDAGE_DB_USER;
                  password = $db.REDAGE_DB_PASSWORD; pass = $db.REDAGE_DB_PASSWORD; pwd = $db.REDAGE_DB_PASSWORD }
        $changed = @()
        foreach ($p in $j.PSObject.Properties) {
            $k = $p.Name.ToLowerInvariant()
            if ($set.ContainsKey($k)) { $p.Value = $set[$k]; $changed += $p.Name }
        }
        [IO.File]::WriteAllText($mainDb, ($j | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
        if ($changed) { Ok "заполнено: $($changed -join ', ') (значения не выводятся)" } else { Warn 'поля не распознаны — заполните mainDB.json вручную' }
    } else { Warn 'settings\mainDB.json не найден' }
    # Строки подключения, «зашитые» в C# (Config.tt / ServerStruct.tt и их .cs) — только список для ручной правки
    Get-ChildItem (Join-Path $Work 'dotnet\resources') -Include *.tt, *.cs -Recurse -ErrorAction SilentlyContinue |
        Select-String -Pattern '(Server|Host|Data Source)\s*=\s*[^;"]+;.*(Database|Initial Catalog)\s*=' -List |
        ForEach-Object { Warn "строка подключения в C#: $($_.Path):$($_.LineNumber) — проверьте" }
}

}  # конец шагов 1–5 (не выполняются при -InstallOnly)

# --- 6. Установка в FloV:MP ------------------------------------------------
Step 6 'Перенос в сервер FloV:MP (сборка C# под .NET 10, бэкап и откат — мигратор)'
if (Get-Process flovmp-server, FloVMP-Server -ErrorAction SilentlyContinue) {
    Fail 'сервер FloV:MP запущен — остановите его (Ctrl+C в окне сервера) и запустите скрипт снова с -SkipBuild -SkipDb'
}
& $Python $Migrate $Work `
    --report-dir (Join-Path $Reports 'report') `
    --prepare-dir (Join-Path $Reports 'stage') `
    --verify-cs --install-into $Root --copy-config settings --allow-origins --no-conf
if ($LASTEXITCODE -ne 0) { Fail "мигратор вернул $LASTEXITCODE — отчёт: $Reports\report\migration-report.md" }
Ok "готово. Отчёт: $Reports\report\migration-report.md"
Write-Host "`nДальше: dlcpacks (client_packages\game_resources\dlcpacks\dlcpacks.txt) и запуск FloVMP-Server.exe" -ForegroundColor Cyan
