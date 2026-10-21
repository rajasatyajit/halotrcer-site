#!/bin/sh
# Checks that a self-hosted Linux runner has the host tools a job uses.
#
#   sh scripts/ci/runner-tools.sh TOOL...
#
# GitHub's ubuntu-24.04 image has all of them; a self-hosted runner may not.
# The workflow runs this only when runner.environment is self-hosted, right
# after checkout, and it fails naming every missing tool. docs/development.md
# lists each job's tools and the Ubuntu packages that provide them.
#
# One name is a check rather than a program: sudo-nopasswd (`sudo -n true`
# succeeds: Playwright's --with-deps installs Chromium's libraries with apt-get).
set -eu

[ "$#" -gt 0 ] || { echo "usage: runner-tools.sh TOOL..." >&2; exit 2; }
missing=""
for tool in "$@"; do
	case "$tool" in
	sudo-nopasswd) sudo -n true >/dev/null 2>&1 || missing="$missing $tool" ;;
	*) command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool" ;;
	esac
done
if [ -n "$missing" ]; then
	echo "runner-tools: this runner lacks:$missing" >&2
	echo "runner-tools: install them (docs/development.md lists the packages), or unset the LINUX_RUNNER variable to run on GitHub-hosted runners" >&2
	exit 1
fi
echo "runner-tools: all $# present"
