# .gitignore Setup & Security Guide

## Overview

This repository has a comprehensive `.gitignore` configured to prevent accidental commits of:
- Credentials and API keys
- Sensitive environment variables
- Database files with user data
- Build artifacts and cache
- IDE configuration

## What's Ignored

### 🔒 CRITICAL - Never Commit
```
# Environment variables with credentials
.env
.env.production
BOOTSTRAP_SECRET

# Firebase & GCP credentials
*-firebase-key.json
firebase-*.json
google-*.json
service-account*.json
*.pem
```

### 📦 Dependencies & Build
```
node_modules/
dist/
out/
build/
*.tsbuildinfo
```

### 💾 Database & Data
```
*.db           # SQLite databases
*.db-shm       # SQLite write-ahead log
*.db-wal       # SQLite shared memory
backups/       # User data backups
```

### 📝 Logs & Diagnostics
```
logs/
*.log
npm-debug.log*
coverage/
```

## Security Features

### 1. Pre-commit Hook
Located: `.githooks/pre-commit`

**What it does:**
- Blocks commits of files matching sensitive patterns
- Prevents accidental credential leaks
- Runs automatically before each commit

**If hook blocks your commit:**
```bash
# Review the file and remove sensitive data
# Then stage and commit again
git add .
git commit -m "your message"
```

**To bypass (NOT recommended):**
```bash
git commit --no-verify  # Skip ALL hooks - use only if you know what you're doing
```

### 2. Git Hooks Directory
Located: `.githooks/`

**Configuration:**
```bash
git config core.hooksPath .githooks  # Already configured
```

**Why this matters:**
- Team members automatically use the same hooks
- Hooks are versioned in git
- Prevents security mistakes across the team

### 3. Pattern-Based Ignoring
The `.gitignore` uses multiple approaches:
- **Filename patterns**: `*.env`, `*.pem`
- **Path patterns**: `backups/`, `logs/`
- **Wildcard patterns**: `*-firebase-key.json`

## What To Do

### ✅ DO Commit
- Source code (`.ts`, `.js`, `.tsx`)
- Configuration files (package.json, tsconfig.json, .env.example)
- Documentation (README.md, FIREBASE_MIGRATION.md)
- Build scripts and tools

### ❌ DON'T Commit
- Environment files with real values (`.env`, `.env.production`)
- Credential files (JSON keys from Firebase/GCP/AWS)
- Database files (`.db`, `.backup`)
- Build outputs (dist/, out/, node_modules/)
- IDE settings that are personal (`.vscode/settings.json`)

## Examples

### ✅ This will be committed:
```bash
echo "FIREBASE_PROJECT_ID=your-project-id" >> .env.example
git add .env.example
git commit -m "docs: update env example"
```

### ❌ This will be BLOCKED:
```bash
echo "BOOTSTRAP_SECRET=super-secret-key" >> .env
git add .env
git commit -m "chore: add env"
# ❌ PRE-COMMIT HOOK BLOCKS THIS
```

### ✅ Fix & retry:
```bash
# Remove the secret
rm .env  # Don't commit this file

# Create .env.example with placeholders instead
echo "BOOTSTRAP_SECRET=your-secret-here" >> .env.example
git add .env.example
git commit -m "docs: add env template"
```

## Team Setup Instructions

When a new team member clones the repo:

```bash
git clone https://github.com/yourusername/Luz_Diaria_Backend.git
cd Luz_Diaria_Backend

# Hooks are automatically used (configured in git config)
# Verify:
git config core.hooksPath
# Output: .githooks
```

## If You Accidentally Commit a Secret

### Immediate Actions:
1. **Rotate the secret immediately** in Firebase/GCP/AWS
2. **Remove from git history**:
   ```bash
   git rm --cached path/to/sensitive/file
   git commit -m "Remove sensitive file from git history"
   git push
   ```

3. **Force push if already pushed** (only if no one has pulled):
   ```bash
   git push --force
   ```

4. **If already widely distributed**:
   - Use git filter-branch or BFG repo cleaner
   - Notify team members to re-clone
   - Consider security audit

### Prevention:
- These hooks prevent this, but if `--no-verify` was used:
  - Stop committing with `--no-verify`
  - Run the hook manually: `./.githooks/pre-commit`

## Customizing .gitignore

To add more patterns:

```bash
# Edit .gitignore
echo "*.custom-ignore-pattern" >> .gitignore

# Verify it works (dry run)
git check-ignore -v -n *  # Shows what would be ignored

# Commit the change
git add .gitignore
git commit -m "chore: update gitignore patterns"
```

## Useful Commands

```bash
# See what files are currently ignored
git status --ignored

# Dry-run: see what would be ignored
git check-ignore -v *

# Check specific file
git check-ignore -v .env

# Force-add an ignored file (if needed, use carefully)
git add -f filename

# See what's staged
git diff --cached --name-only

# Verify pre-commit hook runs
git commit --dry-run
```

## Reference: Files in This Repo

```
.gitignore               # Main ignore patterns (you are reading this setup guide)
.gitignore-credentials  # Reference for sensitive files (not ignored, just docs)
.githooks/
  pre-commit            # Security hook to block credential commits
```

## Support

If you have questions about what should/shouldn't be committed:
1. Check `.gitignore` patterns
2. Ask in team chat before committing unfamiliar files
3. When in doubt, don't commit it

**Remember: It's better to ask "should I commit this?" than to leak credentials.**
