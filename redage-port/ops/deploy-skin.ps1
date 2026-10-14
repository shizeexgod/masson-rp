# Masson RP: выкладка скина интерфейсов на VDS (однократная задача планировщика под maksi)
$ErrorActionPreference = 'Continue'
$root = 'C:\MassonRP'
$work = "$root\work\redage"
$log = "$root\logs\skin-deploy.log"
function L($t) { ('{0:HH:mm:ss} {1}' -f (Get-Date), $t) | Add-Content -Path $log -Encoding UTF8 }
Remove-Item $log -ErrorAction SilentlyContinue
L 'начало'

# 1. Игроки на сервере?
$last = Get-Content "$root\server\server.log" -Encoding UTF8 | Where-Object { $_ -match 'онлайн \d+/' } | Select-Object -Last 1
if ($last -notmatch 'онлайн 0/') { L "на сервере есть игроки, выкладка отменена: $last"; exit 2 }

# 2. Резервная копия прежнего интерфейса
$bk = "$root\backups\interface-before-skin-$(Get-Date -Format yyyyMMdd-HHmmss)"
if (Test-Path "$work\client_packages\interface") { robocopy "$work\client_packages\interface" $bk /E /NFL /NDL /NJH /NJS /NP | Out-Null; L "резервная копия: $bk" }
if (Test-Path "$work\src_cef\src\views\player\newauthentication") { robocopy "$work\src_cef\src\views\player\newauthentication" "$bk-src-newauthentication" /E /NFL /NDL /NJH /NJS /NP | Out-Null }

# 3. Наложение скина
$py = 'C:\Program Files\Python312\python.exe'
$env:PYTHONIOENCODING = 'utf-8'
& $py "$root\work\cef-skin\tools\apply-cef-skin.py" "$work\src_cef" 2>&1 | ForEach-Object { L "apply: $_" }

# 3b. Патч клиента: ники над игроками (patch 10)
& $py "$root\scripts-masson\patch_redage10.py" $work 2>&1 | ForEach-Object { L "patch10: $_" }

# 4. Сборка CEF (Node 16)
$node = "$root\tools-ext\node16"
$env:Path = "$node;$env:Path"
Push-Location "$work\src_cef"
$env:NODE_ENV = 'production'
& "$node\npm.cmd" run build 2>&1 | Select-Object -Last 8 | ForEach-Object { L "build: $_" }
$rc = $LASTEXITCODE
Pop-Location
L "сборка завершена, код $rc"
# 4b. Сборка клиента (main.js) с патчем ников
Push-Location "$work\src_client"
& "$node\npm.cmd" run build 2>&1 | Select-Object -Last 5 | ForEach-Object { L "client build: $_" }
Pop-Location
L ('main.js обновлён: ' + ((Get-Item "$work\client_packages\main.js").LastWriteTime -gt (Get-Date).AddMinutes(-15)))
$bundle = "$work\client_packages\interface\build\bundle.js"
$ok = (Test-Path $bundle) -and ((Get-Item $bundle).LastWriteTime -gt (Get-Date).AddMinutes(-10)) -and ([IO.File]::ReadAllText("$work\client_packages\interface\build\bundle.css").Contains('.mp '))
L "bundle свежий и содержит стили Masson: $ok"
if (-not $ok) { L 'сборка не удалась, сервер не трогаю'; exit 3 }

# 5. Установка и перезапуск
L 'перезапуск сервера (restart2.ps1)'
& powershell -NoProfile -ExecutionPolicy Bypass -File "$root\scripts-masson\restart2.ps1" 2>&1 | Select-Object -Last 14 | ForEach-Object { L "restart: $_" }
L ('процессы: ' + ((Get-Process FloVMP-Server, flovmp-server, mariadbd -ErrorAction SilentlyContinue | ForEach-Object Name) -join ','))
L 'конец'
