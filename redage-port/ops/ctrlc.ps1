# Посылает Ctrl+C консоли FloVMP-Server.exe (как нажатие в его окне) — штатная остановка сервера и базы.
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class ConsoleSig {
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll")] public static extern bool SetConsoleCtrlHandler(IntPtr h, bool add);
  [DllImport("kernel32.dll")] public static extern bool GenerateConsoleCtrlEvent(uint evt, uint grp);
}
"@
$p = Get-Process FloVMP-Server -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) { 'no wrapper process'; exit 1 }
[void][ConsoleSig]::FreeConsole()
if (-not [ConsoleSig]::AttachConsole([uint32]$p.Id)) { "attach failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"; exit 2 }
[void][ConsoleSig]::SetConsoleCtrlHandler([IntPtr]::Zero, $true)
[void][ConsoleSig]::GenerateConsoleCtrlEvent(0, 0)
Start-Sleep 2
[void][ConsoleSig]::FreeConsole()
'ctrl-c sent'
