# Masson RP: Redis для RedAge (подтверждение почты и сообщения между серверами). Слушает только 127.0.0.1, пароль свой.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = 'C:\MassonRP'
$dir = "$root\redis"
$zip = "$root\setup\Redis-x64-5.0.14.1.zip"

if (-not (Test-Path "$dir\redis-server.exe")) {
    if (-not (Test-Path $zip)) {
        Invoke-WebRequest -UseBasicParsing 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip' -OutFile $zip
    }
    "SHA256 архива: " + (Get-FileHash $zip -Algorithm SHA256).Hash
    New-Item -ItemType Directory -Force $dir | Out-Null
    Expand-Archive -Force $zip $dir
}
"redis: " + (& "$dir\redis-server.exe" --version)

# пароль: новый, случайный; хранится в config\redis.env и settings\redisPassword.txt (его читает RedAge)
$envFile = "$root\config\redis.env"
if (Test-Path $envFile) {
    $pw = ((Get-Content $envFile | Where-Object { $_ -like 'REDIS_PASSWORD=*' }) -split '=', 2)[1]
} else {
    $pw = -join ((1..24) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
    [IO.File]::WriteAllText($envFile, "REDIS_PASSWORD=$pw`r`n", (New-Object Text.UTF8Encoding $false))
    icacls $envFile /inheritance:r /grant:r "maksi:F" "*S-1-5-18:F" "*S-1-5-32-544:F" | Out-Null
}
$u = New-Object Text.UTF8Encoding $false
foreach ($s in "$root\work\redage\settings", "$root\server\settings") {
    if (Test-Path $s) { [IO.File]::WriteAllText("$s\redisPassword.txt", $pw, $u) }
}

# конфиг и запуск (при входе в систему, скрыто)
$conf = "$dir\masson.conf"
[IO.File]::WriteAllText($conf, "bind 127.0.0.1`r`nport 6379`r`nprotected-mode yes`r`nrequirepass $pw`r`nsave `"`"`r`nappendonly no`r`nmaxmemory 256mb`r`nloglevel warning`r`n", $u)
icacls $conf /inheritance:r /grant:r "maksi:F" "*S-1-5-18:F" "*S-1-5-32-544:F" | Out-Null
$run = "$dir\run-redis.ps1"
[IO.File]::WriteAllText($run, "& '$dir\redis-server.exe' '$conf'`r`n", $u)
schtasks /Create /F /SC ONLOGON /TN "MassonRP-Redis" /RU maksi /IT /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $run" | Out-Null
if (-not (Get-Process redis-server -ErrorAction SilentlyContinue)) {
    schtasks /Run /TN "MassonRP-Redis" | Out-Null
    Start-Sleep 3
}
$p = Get-Process redis-server -ErrorAction SilentlyContinue
"redis-server: " + $(if ($p) { "запущен (pid $($p.Id))" } else { 'НЕ запущен' })
$ping = & "$dir\redis-cli.exe" -a $pw --no-auth-warning -h 127.0.0.1 ping 2>&1
"redis ping: $ping"
Get-NetTCPConnection -LocalPort 6379 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { "listening " + $_.LocalAddress + ":6379" }
