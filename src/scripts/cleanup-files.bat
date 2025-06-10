@echo off
REM Windows batch script for manual file cleanup
REM Usage: cleanup-files.bat [options]
REM 
REM Options:
REM   --days=N          Clean files older than N days (default: 7)
REM   --user-id=UUID    Clean files for specific user only
REM   --failed-only     Clean only files from failed processing
REM   --dry-run         Show what would be deleted without actually deleting
REM   --force           Skip confirmation prompts
REM   --help            Show this help message

setlocal enabledelayedexpansion

REM Default values
set DAYS=7
set USER_ID=
set FAILED_ONLY=
set DRY_RUN=
set FORCE=
set HELP=

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :args_done
if "%~1"=="--help" (
    set HELP=1
    goto :args_done
)
if "%~1"=="--dry-run" (
    set DRY_RUN=--dry-run
    shift
    goto :parse_args
)
if "%~1"=="--force" (
    set FORCE=--force
    shift
    goto :parse_args
)
if "%~1"=="--failed-only" (
    set FAILED_ONLY=--failed-only
    shift
    goto :parse_args
)
REM Handle --days=N format
echo %~1 | findstr /r "^--days=" >nul
if !errorlevel! equ 0 (
    for /f "tokens=2 delims==" %%a in ("%~1") do set DAYS=%%a
    shift
    goto :parse_args
)
REM Handle --user-id=UUID format
echo %~1 | findstr /r "^--user-id=" >nul
if !errorlevel! equ 0 (
    for /f "tokens=2 delims==" %%a in ("%~1") do set USER_ID=--user-id=%%a
    shift
    goto :parse_args
)
REM Unknown argument
echo Unknown argument: %~1
echo Use --help for usage information
exit /b 1

:args_done

REM Show help if requested
if defined HELP (
    echo.
    echo 🗑️  Windows File Cleanup Script
    echo.
    echo Usage: cleanup-files.bat [options]
    echo.
    echo Options:
    echo   --days=N          Clean files older than N days ^(default: 7^)
    echo   --user-id=UUID    Clean files for specific user only
    echo   --failed-only     Clean only files from failed processing
    echo   --dry-run         Show what would be deleted without actually deleting
    echo   --force           Skip confirmation prompts
    echo   --help            Show this help message
    echo.
    echo Examples:
    echo   cleanup-files.bat --dry-run
    echo   cleanup-files.bat --days=30 --force
    echo   cleanup-files.bat --failed-only --force
    echo   cleanup-files.bat --user-id=12345678-1234-1234-1234-123456789012 --force
    echo.
    echo Cross-platform compatible: Works on Windows, Linux, and macOS.
    echo.
    exit /b 0
)

REM Check if Node.js is available
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Check if we're in the correct directory (should have package.json)
if not exist "package.json" (
    echo ❌ Error: This script must be run from the project root directory
    echo Current directory: %CD%
    echo Please navigate to the project root and try again
    exit /b 1
)

REM Check if the cleanup script exists
if not exist "src\scripts\cleanup-processed-files.js" (
    echo ❌ Error: Cleanup script not found at src\scripts\cleanup-processed-files.js
    echo Please ensure you're in the correct project directory
    exit /b 1
)

REM Build the command
set COMMAND=node src\scripts\cleanup-processed-files.js --days=%DAYS%
if defined USER_ID set COMMAND=!COMMAND! %USER_ID%
if defined FAILED_ONLY set COMMAND=!COMMAND! %FAILED_ONLY%
if defined DRY_RUN set COMMAND=!COMMAND! %DRY_RUN%
if defined FORCE set COMMAND=!COMMAND! %FORCE%

REM Show what we're about to run
echo.
echo 🔧 Running file cleanup with the following options:
echo   Days: %DAYS%
if defined USER_ID echo   User ID filter: %USER_ID:~10%
if defined FAILED_ONLY echo   Failed files only: Yes
if defined DRY_RUN echo   Dry run: Yes
if defined FORCE echo   Force mode: Yes
echo.
echo Command: %COMMAND%
echo.

REM Run the cleanup script
%COMMAND%

REM Check the exit code
if !errorlevel! equ 0 (
    echo.
    echo ✅ Cleanup completed successfully
) else (
    echo.
    echo ❌ Cleanup failed with exit code !errorlevel!
    exit /b !errorlevel!
)

endlocal
