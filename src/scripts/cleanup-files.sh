#!/bin/bash

# Unix shell script for manual file cleanup
# Usage: ./cleanup-files.sh [options]
# 
# Options:
#   --days=N          Clean files older than N days (default: 7)
#   --user-id=UUID    Clean files for specific user only
#   --failed-only     Clean only files from failed processing
#   --dry-run         Show what would be deleted without actually deleting
#   --force           Skip confirmation prompts
#   --help            Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DAYS=7
USER_ID=""
FAILED_ONLY=""
DRY_RUN=""
FORCE=""
HELP=""

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to show help
show_help() {
    echo ""
    echo "🗑️  Unix File Cleanup Script"
    echo ""
    echo "Usage: ./cleanup-files.sh [options]"
    echo ""
    echo "Options:"
    echo "  --days=N          Clean files older than N days (default: 7)"
    echo "  --user-id=UUID    Clean files for specific user only"
    echo "  --failed-only     Clean only files from failed processing"
    echo "  --dry-run         Show what would be deleted without actually deleting"
    echo "  --force           Skip confirmation prompts"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./cleanup-files.sh --dry-run"
    echo "  ./cleanup-files.sh --days=30 --force"
    echo "  ./cleanup-files.sh --failed-only --force"
    echo "  ./cleanup-files.sh --user-id=12345678-1234-1234-1234-123456789012 --force"
    echo ""
    echo "Cross-platform compatible: Works on Windows, Linux, and macOS."
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            HELP="1"
            break
            ;;
        --days=*)
            DAYS="${1#*=}"
            shift
            ;;
        --user-id=*)
            USER_ID="--user-id=${1#*=}"
            shift
            ;;
        --failed-only)
            FAILED_ONLY="--failed-only"
            shift
            ;;
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        --force)
            FORCE="--force"
            shift
            ;;
        *)
            print_error "Unknown argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Show help if requested
if [[ -n "$HELP" ]]; then
    show_help
    exit 0
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if we're in the correct directory (should have package.json)
if [[ ! -f "package.json" ]]; then
    print_error "This script must be run from the project root directory"
    echo "Current directory: $(pwd)"
    echo "Please navigate to the project root and try again"
    exit 1
fi

# Check if the cleanup script exists
if [[ ! -f "src/scripts/cleanup-processed-files.js" ]]; then
    print_error "Cleanup script not found at src/scripts/cleanup-processed-files.js"
    echo "Please ensure you're in the correct project directory"
    exit 1
fi

# Validate days parameter
if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [[ "$DAYS" -lt 1 ]]; then
    print_error "Invalid days parameter: $DAYS"
    echo "Days must be a positive integer"
    exit 1
fi

# Build the command
COMMAND="node src/scripts/cleanup-processed-files.js --days=$DAYS"
if [[ -n "$USER_ID" ]]; then
    COMMAND="$COMMAND $USER_ID"
fi
if [[ -n "$FAILED_ONLY" ]]; then
    COMMAND="$COMMAND $FAILED_ONLY"
fi
if [[ -n "$DRY_RUN" ]]; then
    COMMAND="$COMMAND $DRY_RUN"
fi
if [[ -n "$FORCE" ]]; then
    COMMAND="$COMMAND $FORCE"
fi

# Show what we're about to run
echo ""
print_info "Running file cleanup with the following options:"
echo "   Days: $DAYS"
if [[ -n "$USER_ID" ]]; then
    echo "   User ID filter: ${USER_ID#--user-id=}"
fi
if [[ -n "$FAILED_ONLY" ]]; then
    echo "   Failed files only: Yes"
fi
if [[ -n "$DRY_RUN" ]]; then
    echo "   Dry run: Yes"
fi
if [[ -n "$FORCE" ]]; then
    echo "   Force mode: Yes"
fi
echo ""
echo "Command: $COMMAND"
echo ""

# Run the cleanup script
if eval "$COMMAND"; then
    echo ""
    print_status "Cleanup completed successfully"
else
    EXIT_CODE=$?
    echo ""
    print_error "Cleanup failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
fi
