#!/bin/zsh
# =============================================================================
# GALLERY MANAGER LAUNCHER  (Gallery Manager.command)
# =============================================================================
#
# Double-click this file in Finder to start the gallery manager. A Terminal
# window opens, and the manager opens in the browser. Close the Terminal window
# to stop it. (Tip: drag this file into the Dock for a one-click start.)
#
# What it does:
#   1. goes to the project folder (where this file is)
#   2. fetches the newest version from GitHub, if that can be done safely
#   3. installs or updates the libraries when needed (npm install)
#   4. starts the manager (npm run manage)
# =============================================================================

cd "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# On an error: show it and keep the window open until a key is pressed
fail() {
  echo
  echo "  $1"
  echo
  read -k 1 "?  Press any key to close this window."
  exit 1
}

echo
echo "  Starting the Gallery Manager ..."
echo

command -v node >/dev/null || fail "Node.js is not installed. Please ask Simon (brew install node)."

# Newest version from GitHub (only fast-forward on master: never overwrites
# anything; skipped without internet or when it can't be done cleanly)
if [[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" == "master" ]]; then
  echo "  Fetching the newest version ..."
  GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15" \
    git pull --ff-only --quiet origin master 2>/dev/null || echo "  (Skipped: no internet, or changes on this computer that are not published yet.)"
fi

# Libraries: install when missing or when package-lock.json changed
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  echo "  Installing libraries (only needed once, takes a minute) ..."
  npm install --no-audit --no-fund || fail "Installing the libraries failed. Please ask Simon."
fi

npm run manage || fail "The Gallery Manager stopped with an error (see above). Please ask Simon."
