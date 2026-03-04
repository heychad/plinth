#!/usr/bin/env bash
# Kessel Run — autonomous loop for Claude Code.
# Fresh context every parsec. Stream everything. Never capture into variables.
#
# Usage:
#   ./scripts/kessel-run/loop.sh              # run max parsecs (default 12)
#   ./scripts/kessel-run/loop.sh 5            # run 5 parsecs
#   ./scripts/kessel-run/loop.sh 0            # unlimited parsecs
#   ./scripts/kessel-run/loop.sh watch        # single parsec in TUI mode
set -euo pipefail

KESSEL_MODEL="${KESSEL_MODEL:-claude-opus-4-6}"
KESSEL_DIR="${KESSEL_DIR:-scripts/kessel-run}"

# ── ANSI Colors (Star Wars palette) ─────────────────────────────
YELLOW='\033[38;5;220m'
WHITE='\033[1;37m'
DIM='\033[38;5;240m'
GREEN='\033[38;5;114m'
RED='\033[38;5;203m'
RESET='\033[0m'
BOLD='\033[1m'

# ── Cleanup ──────────────────────────────────────────────────────
cleanup() {
    [ -n "${TIMER_PID:-}" ] && kill "$TIMER_PID" 2>/dev/null
    printf '\033]0;\007'
}
trap cleanup EXIT

# ── Helpers ──────────────────────────────────────────────────────
format_duration() {
    local secs=$1
    if [ "$secs" -lt 60 ]; then
        echo "${secs}s"
    elif [ "$secs" -lt 3600 ]; then
        echo "$((secs / 60))m $((secs % 60))s"
    else
        echo "$((secs / 3600))h $((secs % 3600 / 60))m"
    fi
}

count_prd_progress() {
    python3 -c "
import json, sys
with open('docs/specs/PRD.json') as f:
    data = json.load(f)
items = data.get('items', [])
total = len(items)
passing = sum(1 for i in items if i.get('passes'))
print(f'{passing} {total}')
" 2>/dev/null || echo "0 0"
}

# Extract failing items from PRD.json as compact summary for the prompt
prd_status() {
    python3 -c "
import json, sys
with open('docs/specs/PRD.json') as f:
    data = json.load(f)
items = data.get('items', [])
total = len(items)
passing = [i for i in items if i.get('passes')]
failing = [i for i in items if not i.get('passes')]
print(f'## PRD STATUS — {len(passing)}/{total} passing\n')
if not failing:
    print('ALL ITEMS PASSING.')
    sys.exit(0)
# Show passing item IDs as compact summary
if passing:
    ids = ', '.join(str(i['id']) for i in passing)
    print(f'Passing: [{ids}]\n')
# Show failing items with enough detail to pick one
print('Failing items:')
for i in failing:
    deps = ', '.join(str(d) for d in i.get('depends_on', []))
    spec = i.get('spec', '?')
    desc = i.get('description', '?')
    checks = ' | '.join(i.get('verification', [])[:2])
    blocked = ''
    if deps:
        # Check if any dependency is still failing
        passing_ids = {p['id'] for p in passing}
        dep_ids = set(i.get('depends_on', []))
        unmet = dep_ids - passing_ids
        if unmet:
            blocked = f' ⛔ BLOCKED by [{", ".join(str(d) for d in sorted(unmet))}]'
    print(f'  #{i[\"id\"]}: {desc} [spec: {spec}] [depends: {deps or \"none\"}]{blocked}')
    if checks:
        print(f'       verify: {checks}')
" 2>/dev/null || echo "## PRD STATUS — error reading PRD.json"
}

# Compose the full prompt: static PROMPT.md + dynamic PRD status
build_prompt() {
    cat "${KESSEL_DIR}/PROMPT.md"
    echo ""
    prd_status
}

show_progress() {
    local progress passing total pct filled empty i filled_str empty_str
    progress=$(count_prd_progress)
    passing=$(echo "$progress" | cut -d' ' -f1)
    total=$(echo "$progress" | cut -d' ' -f2)

    if [ "$total" -eq 0 ]; then
        printf "  ${DIM}No PRD items found${RESET}\n"
        return
    fi

    pct=$(( passing * 100 / total ))
    local bar_width=30
    filled=$(( passing * bar_width / total ))
    empty=$(( bar_width - filled ))

    filled_str="" ; empty_str=""
    for ((i=0; i<filled; i++)); do filled_str+="█"; done
    for ((i=0; i<empty; i++)); do empty_str+="░"; done

    printf "  ${YELLOW}%s${WHITE}▸${DIM}%s${RESET}  ${WHITE}%d${DIM}/${WHITE}%d${RESET} items  ${YELLOW}%d%%${RESET}\n" \
        "$filled_str" "$empty_str" "$passing" "$total" "$pct"
}

show_parsec_header() {
    local parsec=$1 prev_dur=$2 total_dur=$3
    local time_now
    time_now=$(date '+%H:%M:%S')

    echo ""
    if [ "$parsec" -gt 1 ]; then
        printf "  ${YELLOW}━━━ ${WHITE}${BOLD}PARSEC %d${RESET} ${YELLOW}━━━${RESET}  ${DIM}%s  last ${WHITE}%s${RESET}  ${DIM}total ${WHITE}%s${RESET}\n" \
            "$parsec" "$time_now" "$(format_duration $prev_dur)" "$(format_duration $total_dur)"
    else
        printf "  ${YELLOW}━━━ ${WHITE}${BOLD}PARSEC %d${RESET} ${YELLOW}━━━${RESET}  ${DIM}%s${RESET}\n" "$parsec" "$time_now"
    fi
    show_progress
    echo ""
}

start_timer() {
    local parsec=$1 start=$2
    while true; do
        local now=$(date +%s)
        local elapsed=$((now - start))
        printf '\033]0;Kessel Run — Parsec %d — %s\007' "$parsec" "$(format_duration $elapsed)"
        sleep 1
    done
}

# ── Hero banner (Falcon + figlet starwars) ────────────────────────
print_hero() {
    echo ""
    while IFS= read -r line; do
        printf "  ${YELLOW}${BOLD}%s${RESET}\n" "$line"
    done << 'BANNER'
             _     _
            /_|   |_\
           //||   ||\\
          // ||   || \\
         //  ||___||  \\                 __  ___  _______     _______.     _______. _______  __
        /     |   |     \    _          |  |/  / |   ____|   /       |    /       ||   ____||  |
       /    __|   |__    \  /_\         |  '  /  |  |__     |   (----`   |   (----`|  |__   |  |
      / .--~  |   |  ~--. \|   |        |    <   |   __|     \   \        \   \    |   __|  |  |
     /.~ __\  |   |  /   ~.|   |        |  .  \  |  |____.----)   |   .----)   |   |  |____ |  `----.
    .~  `=='\ |   | /   _.-'.  |        |__|\__\ |_______|_______/    |_______/    |_______||_______|
   /  /      \|   |/ .-~    _.-'
  |           +---+  \  _.-~  |         .______       __    __  .__   __.
  `=----.____/  #  \____.----='         |   _  \     |  |  |  | |  \ |  |
   [::::::::|  (_)  |::::::::]          |  |_)  |    |  |  |  | |   \|  |
  .=----~~~~~\     /~~~~~----=.         |      /     |  |  |  | |  . `  |
  |          /`---'\          |         |  |\  \----.|  `--'  | |  |\   |
   \  \     /       \     /  /          | _| `._____| \______/  |__| \__|
    `.     /         \     .'
      `.  /._________.\  .'
        `--._________.--'
BANNER
    printf "  ${DIM}Autonomous loop for Claude Code${RESET}\n"
    echo ""
}

print_hero

# ── Pre-flight checks ───────────────────────────────────────────
PREFLIGHT_OK=true

for f in "${KESSEL_DIR}/PROMPT.md" docs/specs/PRD.json "${KESSEL_DIR}/backpressure.sh" docs/PROGRESS.md; do
    if [ ! -f "$f" ]; then
        printf "  ${RED}✗${RESET} Missing: ${WHITE}%s${RESET}\n" "$f"
        PREFLIGHT_OK=false
    fi
done

if [ "$PREFLIGHT_OK" = false ]; then
    echo ""
    printf "  ${RED}Pre-flight failed.${RESET} Run ${WHITE}init.sh${RESET} first.\n"
    exit 1
fi

printf "  ${GREEN}✓${RESET} ${DIM}Prompt${RESET}       ${WHITE}${KESSEL_DIR}/PROMPT.md${RESET}\n"
printf "  ${GREEN}✓${RESET} ${DIM}PRD${RESET}          ${WHITE}docs/specs/PRD.json${RESET}\n"
printf "  ${GREEN}✓${RESET} ${DIM}Backpressure${RESET} ${WHITE}${KESSEL_DIR}/backpressure.sh${RESET}\n"
printf "  ${GREEN}✓${RESET} ${DIM}Progress${RESET}     ${WHITE}docs/PROGRESS.md${RESET}\n"
printf "  ${GREEN}✓${RESET} ${DIM}Model${RESET}        ${WHITE}${KESSEL_MODEL}${RESET}\n"
echo ""

# ── Watch mode ───────────────────────────────────────────────────
if [ "${1:-}" = "watch" ]; then
    printf "  ${YELLOW}━━━ WATCH MODE ━━━${RESET} ${DIM}single parsec in TUI${RESET}\n\n"
    build_prompt | claude \
        --model "$KESSEL_MODEL" \
        --dangerously-skip-permissions \
        --verbose
    echo ""
    printf "  ${YELLOW}━━━ WATCH COMPLETE ━━━${RESET}\n"
    exit 0
fi

# ── Timing ───────────────────────────────────────────────────────
MAX_PARSECS="${1:-${KESSEL_MAX_PARSECS:-12}}"
PARSEC=0
TOTAL_START=$(date +%s)
PREV_DURATION=0

printf "  ${DIM}Max parsecs:${RESET} ${WHITE}%s${RESET} ${DIM}(0 = unlimited)${RESET}\n" "$MAX_PARSECS"
show_progress
echo ""

# ── Completion check ─────────────────────────────────────────────
check_all_complete() {
    python3 -c "
import json, sys
with open('docs/specs/PRD.json') as f:
    data = json.load(f)
items = data.get('items', [])
if not items:
    sys.exit(1)
sys.exit(0 if all(i.get('passes') for i in items) else 1)
" 2>/dev/null
}

# ── Main loop ────────────────────────────────────────────────────
while true; do
    PARSEC=$((PARSEC + 1))
    CYCLE_START=$(date +%s)

    if [ "$MAX_PARSECS" -gt 0 ] && [ "$PARSEC" -gt "$MAX_PARSECS" ]; then
        TOTAL_END=$(date +%s)
        echo ""
        printf "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
        printf "  ${WHITE}${BOLD}MAX PARSECS (%d) REACHED${RESET}  ${DIM}total ${WHITE}%s${RESET}\n" "$MAX_PARSECS" "$(format_duration $((TOTAL_END - TOTAL_START)))"
        show_progress
        printf "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
        break
    fi

    TOTAL_NOW=$(date +%s)
    show_parsec_header "$PARSEC" "$PREV_DURATION" "$((TOTAL_NOW - TOTAL_START))"

    # Clean git staging area — prevent committing stale staged files
    git reset --quiet HEAD -- . 2>/dev/null || true

    # Live timer in terminal title bar
    start_timer "$PARSEC" "$CYCLE_START" &
    TIMER_PID=$!

    # Stream output directly — never capture into variables
    # build_prompt injects PROMPT.md + dynamic PRD status
    build_prompt | claude -p \
        --model "$KESSEL_MODEL" \
        --dangerously-skip-permissions \
        --verbose 2>&1 || true

    # Stop timer
    kill "$TIMER_PID" 2>/dev/null || true
    wait "$TIMER_PID" 2>/dev/null || true
    TIMER_PID=""

    CYCLE_END=$(date +%s)
    PREV_DURATION=$((CYCLE_END - CYCLE_START))

    echo ""
    printf "  ${DIM}── parsec %d done ── %s ──${RESET}\n" "$PARSEC" "$(format_duration $PREV_DURATION)"

    # Check if all PRD items pass
    if check_all_complete; then
        TOTAL_END=$(date +%s)
        echo ""
        printf "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
        printf "  ${WHITE}${BOLD}  ✦  A L L   I T E M S   P A S S I N G  ✦${RESET}\n"
        printf "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
        echo ""
        printf "  ${WHITE}Parsecs:${RESET} %d    ${WHITE}Time:${RESET} %s\n" "$PARSEC" "$(format_duration $((TOTAL_END - TOTAL_START)))"
        show_progress
        echo ""
        printf "  ${DIM}\"Great shot kid, that was one in a million!\"${RESET}\n"
        echo ""

        # macOS notification
        if command -v osascript &>/dev/null; then
            osascript -e "display notification \"All PRD items passing after ${PARSEC} parsecs.\" with title \"Kessel Run Complete\" sound name \"Glass\""
        fi
        break
    fi
done
