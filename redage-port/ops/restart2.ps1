# Masson RP: штатная остановка сервера, смена настроек, переустановка RedAge из рабочей копии, запуск.
param([switch]$Force)
$ErrorActionPreference = 'Stop'
$root = 'C:\MassonRP'
function Step($t) { Write-Host "`n=== $t" -ForegroundColor Cyan }
Step 'проверка: игроков нет'
$last = Get-Content "$root\server\server.log" -Encoding UTF8 | Where-Object { $_ -match 'онлайн \d+/' } | Select-Object -Last 1
if ($last -notmatch 'онлайн 0/' -and -not $Force) { throw "на сервере есть игроки: $last" }
$tail = Get-Content "$root\server\server.log" -Encoding UTF8 -Tail 400 | Where-Object { $_ -match 'подключается|отключился' } | Select-Object -Last 1
"последнее событие входа: $tail"

Step 'штатная остановка (Ctrl+C консоли сервера)'
schtasks /Create /F /SC ONCE /ST 23:59 /TN "MassonRP-CtrlC" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $root\scripts-masson\ctrlc.ps1" /IT /RU maksi | Out-Null
schtasks /Run /TN "MassonRP-CtrlC" | Out-Null
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) { Start-Sleep 3; if (-not (Get-Process FloVMP-Server, flovmp-server, mariadbd -ErrorAction SilentlyContinue)) { break } }
schtasks /Delete /F /TN "MassonRP-CtrlC" | Out-Null
if (Get-Process FloVMP-Server, flovmp-server, mariadbd -ErrorAction SilentlyContinue) { throw 'сервер не остановился штатно за 120 с' }
'остановлен'

Step 'настройки'
$u = New-Object Text.UTF8Encoding $false
$envPath = "$root\config\flovmp.env"
$lines = [Collections.Generic.List[string]](Get-Content $envPath -Encoding UTF8)
$done = $false
for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match '^\s*#?\s*FLOVMP_ANTICHEAT\s*=') { $lines[$i] = 'FLOVMP_ANTICHEAT=off'; $done = $true; break } }
if (-not $done) { $lines.Add('FLOVMP_ANTICHEAT=off') }
[IO.File]::WriteAllLines($envPath, $lines, $u)
'FLOVMP_ANTICHEAT=off'
$t = "$root\server\server.toml"
$s = [IO.File]::ReadAllText($t, $u); $s = [regex]::Replace($s, '(?m)^\s*"gamemode",\s*\r?\n', ''); [IO.File]::WriteAllText($t, $s, $u)

Step 'установка RedAge'
Set-Location $root
& powershell -NoProfile -ExecutionPolicy Bypass -File "$root\scripts-masson\port-redage.ps1" -Source "$root\src\redage" -InstallOnly 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 4

Step 'после установки'
$o = "$root\server\client_packages\browser-origins.txt"
if (Test-Path $o) { $l = Get-Content $o -Encoding UTF8 | Where-Object { $_ -notmatch 'googletagmanager' }; [IO.File]::WriteAllLines($o, $l, $u) }
Get-ChildItem "$root\server\client_packages" -Recurse -File -Filter *.map -ErrorAction SilentlyContinue | ForEach-Object { [IO.File]::Delete($_.FullName) }
"MASSON markers in server main.js: " + ([regex]::Matches([IO.File]::ReadAllText("$root\server\client_packages\main.js"), 'MASSON\]')).Count
$s = [IO.File]::ReadAllText($t, $u); $s = [regex]::Replace($s, '(?m)^\s*"gamemode",\s*\r?\n', ''); [IO.File]::WriteAllText($t, $s, $u)
'resources: ' + ((Select-String -Path $t -Pattern '^\s*"' | ForEach-Object { $_.Line.Trim() }) -join ' ')

Step 'запуск'
schtasks /Create /F /SC ONCE /ST 23:59 /TN "MassonRP-Start" /TR "$root\FloVMP-Server.exe" /IT /RU maksi | Out-Null
schtasks /Run /TN "MassonRP-Start" | Out-Null
Start-Sleep 75
schtasks /Delete /F /TN "MassonRP-Start" | Out-Null
'процессы: ' + ((Get-Process mariadbd, flovmp-server, FloVMP-Server -ErrorAction SilentlyContinue | ForEach-Object Name | Sort-Object -Unique) -join ', ')
$log = Get-Content "$root\server\server.log" -Encoding UTF8
'ошибок в журнале: ' + ($log | Where-Object { $_ -match '\[Error\]' }).Count
$log | Where-Object { $_ -match 'Клиентские пакеты|Проверка движения' } | Select-Object -Last 2
Get-ChildItem "$root\server\logs" -ErrorAction SilentlyContinue | Select-Object Name, Length | Format-Table -AutoSize | Out-String
