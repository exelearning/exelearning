@echo off
setlocal
rem ----------------------------------------------------------------------------
rem This script ensures `make` runs inside Git Bash (or WSL fallback)
rem even if started from cmd.exe or PowerShell.
rem Usage:
rem   make.bat <targets and vars>    ← from cmd.exe
rem   .\make.bat <targets and vars>  ← from PowerShell
rem ----------------------------------------------------------------------------

set "PWD_WIN=%CD%"

rem Try Git Bash common paths
set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if exist "%GITBASH%" goto run_gitbash
set "GITBASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if exist "%GITBASH%" goto run_gitbash

rem Try registry
for /f "tokens=2,*" %%A in ('
  reg query "HKLM\SOFTWARE\GitForWindows" /v InstallPath 2^>nul ^| find "REG_SZ"
') do set "GITROOT=%%B"
if defined GITROOT set "GITBASH=%GITROOT%\bin\bash.exe"
if exist "%GITBASH%" goto run_gitbash

rem --- Fallback to WSL --------------------------------------------------------
where wsl.exe >nul 2>nul
if %ERRORLEVEL%==0 (
  wsl.exe --cd "%PWD_WIN%" bash -lc "export MSYS_NO_PATHCONV=1; make %*"
  endlocal
  goto :eof
)

echo [ERROR] Neither Git Bash nor WSL found. Install Git for Windows or enable WSL.
endlocal
goto :eof

:run_gitbash
rem Convert cwd to POSIX and run make under Git Bash
"%GITBASH%" -lc "cd \"$(/usr/bin/cygpath -u \"%PWD_WIN%\")\"; export MSYS_NO_PATHCONV=1; make %*"
endlocal
goto :eof
