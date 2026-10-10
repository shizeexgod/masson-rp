<#
  Masson RP — выпуск новой версии лаунчера для автообновления.

    1. поднять "version" в masson\launcher\package.json (например 0.2.1);
    2. cd masson\launcher; npx electron-builder --win --publish never;
    3. powershell -ExecutionPolicy Bypass -File scripts\publish-launcher.ps1

  Скрипт заливает latest.yml, установщик и blockmap на VDS в C:\MassonRP\launcher-updates.
  Игроки получат обновление сами: лаунчер раз в 30 минут и при запуске смотрит latest.yml, скачивает
  только изменившиеся блоки, ставит тихо и перезапускается.
  Свежий установщик для новых игроков — masson\launcher\dist\MassonRP-Launcher-Setup-<версия>.exe.
#>
param(
    [string]$Key = "$env:USERPROFILE\.ssh\claude_key",
    [string]$Server = '176.194.154.89',
    [int]$SshPort = 2222
)
$ErrorActionPreference = 'Stop'
$dist = Join-Path $PSScriptRoot '..\masson\launcher\dist' | Resolve-Path
$yml = Join-Path $dist 'latest.yml'
if (-not (Test-Path $yml)) { throw "нет $yml — сначала соберите лаунчер" }
$version = ((Get-Content $yml | Where-Object { $_ -match '^version:' }) -replace 'version:\s*', '').Trim()
$exe = Join-Path $dist "MassonRP-Launcher-Setup-$version.exe"
$map = "$exe.blockmap"
foreach ($f in $exe, $map) { if (-not (Test-Path $f)) { throw "нет файла $f" } }
Write-Host "Выпускаю лаунчер $version ($([math]::Round((Get-Item $exe).Length / 1MB)) МБ)"

$ssh = @('-p', $SshPort, '-i', $Key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes')
$scp = @('-P', $SshPort, '-i', $Key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes')
$remote = "maksi@${Server}:C:/MassonRP/launcher-updates"

# Сначала установщик и blockmap, потом latest.yml: игрок не увидит версию, файлов которой ещё нет.
foreach ($f in $exe, $map) { & scp @scp $f "$remote/" 2>$null; if ($LASTEXITCODE -ne 0) { throw "не удалось залить $f" } }
& scp @scp $yml "$remote/" 2>$null; if ($LASTEXITCODE -ne 0) { throw 'не удалось залить latest.yml' }

# Проверка с самого сервера
$check = & ssh @ssh "maksi@$Server" 'curl.exe -s http://127.0.0.1:7810/launcher/latest.yml' 2>$null
if (($check -join "`n") -notmatch "version:\s*$([regex]::Escape($version))") { throw 'сервер не отдаёт новую версию' }
Write-Host "Готово: latest.yml на сервере — версия $version" -ForegroundColor Green

# Старые установщики (оставляем две последние версии)
$cleanup = @'
$d = 'C:\MassonRP\launcher-updates'
Get-ChildItem $d -Filter 'MassonRP-Launcher-Setup-*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 2 | ForEach-Object { [IO.File]::Delete($_.FullName); [IO.File]::Delete($_.FullName + '.blockmap') }
'@
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cleanup))
& ssh @ssh "maksi@$Server" "powershell -NoProfile -EncodedCommand $enc" 2>$null | Out-Null
