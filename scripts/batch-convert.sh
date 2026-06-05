#!/usr/bin/env bash
#
# batch-convert.sh - Batch conversion script for ELP/ELPX files
#
# Converts multiple .elp and .elpx files to different export formats
#

set -euo pipefail

# Debug: show line number on error
trap 'echo "Error on line $LINENO. Exit code: $?" >&2' ERR

# ═══════════════════════════════════════════════════════════════════════════════
# 1. COLORS AND CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly BLUE=$'\033[0;34m'
readonly CYAN=$'\033[0;36m'
readonly BOLD=$'\033[1m'
readonly NC=$'\033[0m' # No Color

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ═══════════════════════════════════════════════════════════════════════════════
# 1.5. PREREQUISITE CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

check_prerequisites() {
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        echo -e "${RED}Error:${NC} bun is not installed or not in PATH." >&2
        echo "" >&2
        echo "Please install bun first:" >&2
        echo "  curl -fsSL https://bun.sh/install | bash" >&2
        echo "" >&2
        echo "Or visit: https://bun.sh" >&2
        exit 1
    fi

    # Check if node_modules exist (bun install was run)
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        echo -e "${RED}Error:${NC} Dependencies not installed." >&2
        echo "" >&2
        echo "Please run the following command first:" >&2
        echo "  cd $PROJECT_ROOT && bun install" >&2
        exit 1
    fi

    # Check if CLI entry point exists
    if [[ ! -f "$PROJECT_ROOT/src/cli/index.ts" ]]; then
        echo -e "${RED}Error:${NC} CLI not found at $PROJECT_ROOT/src/cli/index.ts" >&2
        echo "Make sure you're running this script from the exelearning repository." >&2
        exit 1
    fi
}

# Run prerequisite checks immediately
check_prerequisites

# Supported formats
readonly -a FORMATS=("elpx" "html5" "html5-sp" "scorm12" "scorm2004" "ims" "epub3")
readonly -a FORMAT_DESCRIPTIONS=(
    "Convert to ELPX v4.0"
    "Multi-page HTML5"
    "Single-page HTML5"
    "SCORM 1.2"
    "SCORM 2004"
    "IMS Content Package"
    "EPUB3"
)

# Available themes
readonly -a THEMES=("base" "flux" "nova" "neo" "zen")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

print_error() {
    echo -e "${RED}Error:${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_info() {
    echo -e "${BLUE}$1${NC}"
}

print_header() {
    echo -e "${BOLD}${CYAN}$1${NC}"
}

DEBUG_MODE="${DEBUG_MODE:-false}"

print_debug() {
    if [[ "$DEBUG_MODE" == "true" ]]; then
        echo -e "${YELLOW}[DEBUG]${NC} $1"
    fi
}

# Progress bar function
# Usage: progress_bar current total filename status
progress_bar() {
    local current=$1
    local total=$2
    local filename=$3
    local status="${4:-done}"
    local width=30
    local percentage=$((current * 100 / total))
    local filled=$((width * current / total))

    # Build the bar
    local bar=""
    for ((i = 0; i < filled; i++)); do bar+="="; done
    if [[ $filled -lt $width ]]; then
        bar+=">"
        for ((i = filled + 1; i < width; i++)); do bar+=" "; done
    fi

    # Truncate filename if too long
    local max_name_len=30
    local display_name="$filename"
    if [[ ${#filename} -gt $max_name_len ]]; then
        display_name="...${filename: -$((max_name_len - 3))}"
    fi

    # Color the status
    local status_colored="$status"
    if [[ "$status" == "done" ]]; then
        status_colored="${GREEN}✓${NC}"
    elif [[ "$status" == "ERROR" ]]; then
        status_colored="${RED}✗${NC}"
    fi

    # Simple single-line output (works on all terminals including MINGW)
    printf "${CYAN}[%-${width}s]${NC} %3d%% (%2d/%d) %-30s %s\n" "$bar" "$percentage" "$current" "$total" "$display_name" "$status_colored"
}

# Format seconds to human readable time
format_time() {
    local seconds=$1
    if [[ $seconds -lt 60 ]]; then
        echo "${seconds}s"
    else
        local minutes=$((seconds / 60))
        local secs=$((seconds % 60))
        echo "${minutes}m ${secs}s"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. VALIDATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

validate_input_dir() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        print_error "Input directory does not exist: $dir"
        return 1
    fi
    return 0
}

validate_format() {
    local format="$1"
    for f in "${FORMATS[@]}"; do
        if [[ "$f" == "$format" ]]; then
            return 0
        fi
    done
    print_error "Invalid format: $format"
    print_info "Valid formats: ${FORMATS[*]}"
    return 1
}

validate_theme() {
    local theme="$1"
    for t in "${THEMES[@]}"; do
        if [[ "$t" == "$theme" ]]; then
            return 0
        fi
    done
    print_error "Invalid theme: $theme"
    print_info "Valid themes: ${THEMES[*]}"
    return 1
}

count_files() {
    local dir="$1"
    local elp_count=0
    local elpx_count=0

    while IFS= read -r -d '' file; do
        if [[ "$file" == *.elp ]]; then
            ((elp_count++))
        elif [[ "$file" == *.elpx ]]; then
            ((elpx_count++))
        fi
    done < <(find "$dir" -type f \( -name "*.elp" -o -name "*.elpx" \) -print0 2>/dev/null)

    echo "$elp_count $elpx_count"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 4. SHOW HELP FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    cat << EOF
${BOLD}batch-convert.sh${NC} - Batch conversion script for ELP/ELPX files

${BOLD}USAGE:${NC}
    batch-convert.sh [options]

${BOLD}OPTIONS:${NC}
    -i, --input DIR      Input folder with ELP/ELPX files
    -o, --output DIR     Output folder (default: input/output)
    -f, --format FORMAT  Export format
    -t, --theme THEME    Theme to use (default: base)
    -h, --help           Show this help message
    -q, --quiet          Quiet mode (no interaction, requires -i and -f)
    -d, --debug          Debug mode (verbose output)

${BOLD}SUPPORTED FORMATS:${NC}
EOF
    for i in "${!FORMATS[@]}"; do
        printf "    %-12s %s\n" "${FORMATS[$i]}" "${FORMAT_DESCRIPTIONS[$i]}"
    done

    cat << EOF

${BOLD}AVAILABLE THEMES:${NC}
    ${THEMES[*]}

${BOLD}EXAMPLES:${NC}
    # Interactive mode
    batch-convert.sh

    # Convert all files in a folder to HTML5
    batch-convert.sh -i ./my-projects -f html5

    # Convert with specific theme and output folder
    batch-convert.sh -i ./projects -o ./exports -f scorm12 -t nova

    # Quiet mode (no prompts)
    batch-convert.sh -i ./projects -f epub3 -q
EOF
}

# ═══════════════════════════════════════════════════════════════════════════════
# 5. CONVERT FILE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

convert_file() {
    local input_file="$1"
    local output_dir="$2"
    local format="$3"
    local theme="$4"
    local log_file="$5"
    local debug_mode="${6:-false}"

    local filename
    filename=$(basename "$input_file")
    local basename_no_ext="${filename%.*}"
    local output_file

    # Determine output filename based on format
    case "$format" in
        elpx)
            output_file="$output_dir/${basename_no_ext}.elpx"
            ;;
        html5|html5-sp)
            output_file="$output_dir/${basename_no_ext}.zip"
            ;;
        scorm12|scorm2004)
            output_file="$output_dir/${basename_no_ext}.zip"
            ;;
        ims)
            output_file="$output_dir/${basename_no_ext}.zip"
            ;;
        epub3)
            output_file="$output_dir/${basename_no_ext}.epub"
            ;;
    esac

    local debug_flag=""
    if [[ "$debug_mode" == "true" ]]; then
        debug_flag="--debug"
        echo ""
        print_debug "Input: $input_file"
        print_debug "Output: $output_file"
        print_debug "Format: $format, Theme: $theme"
    fi

    local cmd_output
    local exit_code=0
    local temp_output_file
    temp_output_file=$(mktemp)

    print_debug "Running CLI command..."

    if [[ "$format" == "elpx" ]]; then
        # Use elp:convert for ELPX conversion
        if [[ "$debug_mode" == "true" ]]; then
            print_debug "Command: bun run src/cli/index.ts elp:convert \"$input_file\" \"$output_file\" $debug_flag"
            (cd "$PROJECT_ROOT" && bun run src/cli/index.ts elp:convert "$input_file" "$output_file" $debug_flag 2>&1) | tee "$temp_output_file" || exit_code=$?
        else
            (cd "$PROJECT_ROOT" && bun run src/cli/index.ts elp:convert "$input_file" "$output_file" 2>&1) > "$temp_output_file" || exit_code=$?
        fi
    else
        # Use elp:export for other formats
        if [[ "$debug_mode" == "true" ]]; then
            print_debug "Command: bun run src/cli/index.ts elp:export \"$input_file\" \"$output_file\" --format=\"$format\" --theme=\"$theme\" $debug_flag"
            (cd "$PROJECT_ROOT" && bun run src/cli/index.ts elp:export "$input_file" "$output_file" --format="$format" --theme="$theme" $debug_flag 2>&1) | tee "$temp_output_file" || exit_code=$?
        else
            (cd "$PROJECT_ROOT" && bun run src/cli/index.ts elp:export "$input_file" "$output_file" --format="$format" --theme="$theme" 2>&1) > "$temp_output_file" || exit_code=$?
        fi
    fi

    cmd_output=$(cat "$temp_output_file")
    rm -f "$temp_output_file"

    print_debug "CLI exit code: $exit_code"

    if [[ $exit_code -ne 0 ]]; then
        # Log the error
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $filename: $cmd_output" >> "$log_file"
        return 1
    fi

    # Also check if output contains "failed" or "error" (some commands don't exit with error code)
    if echo "$cmd_output" | grep -qi "failed\|error:"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $filename: $cmd_output" >> "$log_file"
        return 1
    fi

    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# 6.5 ASK MISSING PARAMETERS FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

ask_missing_params() {
    # Ask for input directory if missing
    if [[ -z "$INPUT_DIR" ]]; then
        while true; do
            read -r -p "$(echo -e "${BLUE}Input folder with ELP/ELPX files:${NC} ")" INPUT_DIR
            if [[ -z "$INPUT_DIR" ]]; then
                print_warning "Please enter a folder path"
                continue
            fi
            # Expand ~ to home directory
            INPUT_DIR="${INPUT_DIR/#\~/$HOME}"
            if validate_input_dir "$INPUT_DIR"; then
                break
            fi
        done
    fi

    # Ask for output directory if missing (suggest default)
    if [[ -z "$OUTPUT_DIR" ]]; then
        # Remove trailing slash from INPUT_DIR for clean path construction
        local input_normalized="${INPUT_DIR%/}"
        local default_output="${input_normalized}/output"
        read -r -p "$(echo -e "${BLUE}Output folder${NC} [${default_output}]: ")" OUTPUT_DIR
        if [[ -z "$OUTPUT_DIR" ]]; then
            OUTPUT_DIR="$default_output"
        fi
        OUTPUT_DIR="${OUTPUT_DIR/#\~/$HOME}"
    fi

    # Ask for format if missing (default: html5)
    if [[ -z "$FORMAT" ]]; then
        echo ""
        print_info "Select export format:"
        for i in "${!FORMATS[@]}"; do
            local marker=""
            if [[ "${FORMATS[$i]}" == "html5" ]]; then
                marker=" ${YELLOW}(default)${NC}"
            fi
            printf "  ${CYAN}%d)${NC} %-12s - %s%b\n" "$((i + 1))" "${FORMATS[$i]}" "${FORMAT_DESCRIPTIONS[$i]}" "$marker"
        done
        echo ""
        while true; do
            read -r -p "$(echo -e "${BLUE}Format (1-${#FORMATS[@]})${NC} [2]: ")" format_choice
            if [[ -z "$format_choice" ]]; then
                format_choice=2  # Default to html5
            fi
            if [[ "$format_choice" =~ ^[1-7]$ ]] && [[ $format_choice -ge 1 ]] && [[ $format_choice -le ${#FORMATS[@]} ]]; then
                FORMAT="${FORMATS[$((format_choice - 1))]}"
                break
            fi
            print_warning "Please enter a number between 1 and ${#FORMATS[@]}"
        done
    fi

    # Theme defaults to base, no need to ask unless user wants to change it
    THEME="${THEME:-base}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 7. MAIN FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    # Set defaults
    OUTPUT_DIR="${OUTPUT_DIR:-${INPUT_DIR%/}/output}"
    THEME="${THEME:-base}"

    # Validate inputs
    validate_input_dir "$INPUT_DIR" || exit 1
    validate_format "$FORMAT" || exit 1
    if [[ "$FORMAT" != "elpx" ]]; then
        validate_theme "$THEME" || exit 1
    fi

    # Count files
    local counts
    counts=$(count_files "$INPUT_DIR")
    local elp_count elpx_count total_count
    elp_count=$(echo "$counts" | cut -d' ' -f1)
    elpx_count=$(echo "$counts" | cut -d' ' -f2)
    total_count=$((elp_count + elpx_count))

    if [[ $total_count -eq 0 ]]; then
        print_error "No .elp or .elpx files found in $INPUT_DIR"
        exit 1
    fi

    # Show summary before starting
    echo ""
    print_header "═══════════════════════════════════════"
    print_header "        CONVERSION SUMMARY"
    print_header "═══════════════════════════════════════"
    echo ""
    echo -e " Input folder:     ${CYAN}$INPUT_DIR${NC}"
    echo -e " Output folder:    ${CYAN}$OUTPUT_DIR${NC}"
    echo -e " Export format:    ${CYAN}$FORMAT${NC}"
    if [[ "$FORMAT" != "elpx" ]]; then
        echo -e " Theme:            ${CYAN}$THEME${NC}"
    fi
    echo ""
    echo -e " Total files:      ${BOLD}$total_count${NC}"
    if [[ $elp_count -gt 0 ]]; then
        echo -e "   - Legacy .elp:  ${YELLOW}$elp_count${NC}"
    fi
    if [[ $elpx_count -gt 0 ]]; then
        echo -e "   - Modern .elpx: ${GREEN}$elpx_count${NC}"
    fi
    echo ""
    print_header "═══════════════════════════════════════"
    echo ""

    # Ask for confirmation unless in quiet mode
    if [[ "${QUIET_MODE:-false}" != "true" ]]; then
        read -r -p "$(echo -e "${BLUE}Continue with conversion? (y/N):${NC} ")" confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            print_warning "Conversion cancelled"
            exit 0
        fi
    fi

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Initialize log file
    local log_file="$OUTPUT_DIR/conversion.log"
    echo "Conversion started at $(date '+%Y-%m-%d %H:%M:%S')" > "$log_file"
    echo "Format: $FORMAT, Theme: $THEME" >> "$log_file"
    echo "----------------------------------------" >> "$log_file"

    # Process files
    local current=0
    local success_count=0
    local error_count=0
    local start_time
    start_time=$(date +%s)

    echo ""
    print_info "Starting conversion..."
    echo ""

    # Build file list - use simple method that works on all platforms including MINGW
    local -a files=()

    # Method 1: Try globbing first (most portable)
    shopt -s nullglob globstar 2>/dev/null || true
    for f in "$INPUT_DIR"/*.elp "$INPUT_DIR"/*.elpx "$INPUT_DIR"/**/*.elp "$INPUT_DIR"/**/*.elpx; do
        [[ -f "$f" ]] && files+=("$f")
    done
    shopt -u nullglob globstar 2>/dev/null || true

    # Method 2: Fallback to find with simple read (if glob found nothing)
    if [[ ${#files[@]} -eq 0 ]]; then
        print_info "Using find for file discovery..."
        while IFS= read -r file; do
            [[ -n "$file" && -f "$file" ]] && files+=("$file")
        done <<< "$(find "$INPUT_DIR" -type f \( -name "*.elp" -o -name "*.elpx" \) 2>/dev/null)"
    fi

    # Debug: show what we found
    print_debug "Raw file count: ${#files[@]}"

    # Remove duplicates using sort -u (works on all bash versions)
    local -a unique_files=()
    local seen_list=""
    for f in "${files[@]}"; do
        local abs_path
        abs_path=$(cd "$(dirname "$f")" 2>/dev/null && pwd)/$(basename "$f")
        # Check if already seen using grep
        if ! echo "$seen_list" | grep -qxF "$abs_path"; then
            seen_list="${seen_list}${abs_path}"$'\n'
            unique_files+=("$f")
        fi
    done
    files=("${unique_files[@]}")

    # Update total_count to match actual files found
    total_count=${#files[@]}
    print_info "Found $total_count file(s) to process"

    if [[ $total_count -eq 0 ]]; then
        print_error "Could not find files to process"
        print_info "Checking directory contents..."
        ls -la "$INPUT_DIR" 2>/dev/null || echo "Cannot list directory"
        exit 1
    fi

    # List files to process (in debug mode show full paths)
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_debug "Files to convert:"
        for f in "${files[@]}"; do
            print_debug "  - $f"
        done
    fi
    echo ""

    # Process files from array
    print_debug "Starting processing loop with $total_count files..."
    for file in "${files[@]}"; do
        ((current++)) || true  # Prevent exit on arithmetic returning 0
        local filename
        filename=$(basename "$file")

        print_debug ">>> Processing $current/$total_count: $filename"

        # Convert the file and show result
        if convert_file "$file" "$OUTPUT_DIR" "$FORMAT" "$THEME" "$log_file" "$DEBUG_MODE"; then
            ((success_count++)) || true
            progress_bar "$current" "$total_count" "$filename" "done"
            print_debug "File completed successfully"
        else
            ((error_count++)) || true
            progress_bar "$current" "$total_count" "$filename" "ERROR"
            print_debug "File conversion failed"
        fi
    done

    # Add spacing before summary
    echo ""

    # Calculate elapsed time
    local end_time
    end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    # Show final summary
    print_header "═══════════════════════════════════════"
    print_header "        CONVERSION COMPLETE"
    print_header "═══════════════════════════════════════"
    echo ""
    echo -e " Files processed:  ${BOLD}$total_count${NC}"
    echo -e " Successful:       ${GREEN}$success_count${NC}  ${GREEN}✓${NC}"
    if [[ $error_count -gt 0 ]]; then
        echo -e " With errors:      ${RED}$error_count${NC}  ${RED}✗${NC}"
    else
        echo -e " With errors:      ${GREEN}0${NC}"
    fi
    echo -e " Total time:       ${CYAN}$(format_time $elapsed)${NC}"
    echo ""
    print_header "═══════════════════════════════════════"

    # Show error log if there were errors
    if [[ $error_count -gt 0 ]]; then
        echo ""
        print_warning "Errors occurred during conversion. See log file:"
        echo -e "${CYAN}$log_file${NC}"
        echo ""
        print_info "Error details:"
        echo "----------------------------------------"
        # Skip the header lines and show actual errors
        tail -n +4 "$log_file"
        echo "----------------------------------------"
    fi

    echo ""
    print_success "Output files saved to: $OUTPUT_DIR"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# 8. ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════════

INPUT_DIR=""
OUTPUT_DIR=""
FORMAT=""
THEME="base"
QUIET_MODE="false"
# DEBUG_MODE is declared earlier for print_debug

while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT_DIR="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        -t|--theme)
            THEME="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET_MODE="true"
            shift
            ;;
        -d|--debug)
            DEBUG_MODE="true"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# 9. EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

# Validate quiet mode requirements
if [[ "$QUIET_MODE" == "true" ]]; then
    if [[ -z "$INPUT_DIR" ]] || [[ -z "$FORMAT" ]]; then
        print_error "Quiet mode requires -i (input) and -f (format) options"
        exit 1
    fi
else
    # If not quiet mode, ask for any missing parameters
    if [[ -z "$INPUT_DIR" ]] || [[ -z "$FORMAT" ]]; then
        # Show header when asking for parameters
        echo ""
        print_header "═══════════════════════════════════════"
        print_header "    ELP/ELPX Batch Converter"
        print_header "═══════════════════════════════════════"
        echo ""
        ask_missing_params
    fi
fi

# Run main function
main
