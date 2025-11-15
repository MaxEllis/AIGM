#!/bin/bash

# Setup script to make the git post-commit hook executable

echo "Setting up git post-commit hook for auto-push..."

# Make the hook executable
chmod +x .git/hooks/post-commit

echo "✓ Git post-commit hook is now active!"
echo "  Every commit will automatically push to GitHub."
echo ""
echo "Note: If you want to skip auto-push for a specific commit, use:"
echo "  git commit --no-verify -m 'your message'"

