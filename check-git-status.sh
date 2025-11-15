#!/bin/bash

# Script to check if local and remote are in sync

echo "📊 Git Status Check"
echo "==================="
echo ""

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not a git repository"
    exit 1
fi

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $BRANCH"
echo ""

# Check local status
echo "📝 Local changes:"
git status --short
echo ""

# Check if local is ahead/behind remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH 2>/dev/null)

if [ -z "$REMOTE" ]; then
    echo "⚠️  Remote branch 'origin/$BRANCH' not found"
    exit 1
fi

# Compare commits
AHEAD=$(git rev-list --count origin/$BRANCH..HEAD 2>/dev/null || echo "0")
BEHIND=$(git rev-list --count HEAD..origin/$BRANCH 2>/dev/null || echo "0")

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Local and remote are in sync!"
    echo "   Latest commit: $(git log -1 --format='%h - %s')"
elif [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -eq 0 ]; then
    echo "⬆️  Local is $AHEAD commit(s) ahead of remote"
    echo "   Run 'git push' to sync"
elif [ "$BEHIND" -gt 0 ] && [ "$AHEAD" -eq 0 ]; then
    echo "⬇️  Local is $BEHIND commit(s) behind remote"
    echo "   Run 'git pull' to sync"
else
    echo "⚠️  Local and remote have diverged"
    echo "   Ahead: $AHEAD, Behind: $BEHIND"
fi

echo ""
echo "🔗 GitHub: https://github.com/MaxEllis/AIGM"

