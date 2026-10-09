#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ ${PREFIX:-} != /data/data/com.termux/files/usr ]]; then
  echo 'Run this script in native Termux, outside Ubuntu.' >&2
  exit 1
fi
case "$ROOT" in /storage/*|/sdcard/*) echo 'Clone the repository in Termux home, not shared storage.' >&2; exit 1;; esac
if [[ $(uname -m) != aarch64 ]]; then
  echo 'This installer currently supports 64-bit ARM (aarch64) phones only.' >&2
  exit 1
fi
ubuntu() {
  proot-distro login --bind "$ROOT:/opt/openreply" ubuntu -- bash /opt/openreply/scripts/termux/ubuntu.sh "$@"
}
case ${1:-install} in
  install)
    if [[ ! -f "$ROOT/.env" ]]; then
      cp "$ROOT/scripts/termux/env.example" "$ROOT/.env"
      chmod 600 "$ROOT/.env"
      echo 'Created .env. Fill its account-specific values, then rerun: bash scripts/termux.sh install'
      exit 0
    fi
    pkg update -y
    pkg install -y proot-distro tmux
    if ! proot-distro login ubuntu -- /bin/true >/dev/null 2>&1; then
      proot-distro install ubuntu
    fi
    ubuntu install
    echo 'Installed. Run: bash scripts/termux.sh start'
    ;;
  start)
    if tmux has-session -t openreply 2>/dev/null; then
      echo 'Already running. View with: bash scripts/termux.sh logs'
      exit 0
    fi
    ubuntu services
    termux-wake-lock
    # Quote the repository path for tmux's shell command; never interpolate .env values.
    printf -v runner '%q ' bash "$ROOT/scripts/termux.sh" run
    tmux new-session -d -s openreply -n web "${runner}web; exec bash"
    for mode in worker cron tunnel; do
      tmux new-window -t openreply -n "$mode" "${runner}${mode}; exec bash"
    done
    echo 'Started four process windows. View errors/logs with: bash scripts/termux.sh logs'
    echo 'Check http://localhost:3000/api/health and your public ngrok URL.'
    ;;
  run) ubuntu "${2:?Expected process name}" ;;
  logs) exec tmux attach-session -t openreply ;;
  stop)
    if tmux has-session -t openreply 2>/dev/null; then tmux kill-session -t openreply; fi
    termux-wake-unlock
    echo 'Stopped application sessions. PostgreSQL and Redis remain running.'
    ;;
  *) echo 'Usage: bash scripts/termux.sh {install|start|logs|stop}' >&2; exit 1 ;;
esac
