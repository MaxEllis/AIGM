# Vercel Auto-Deploy Setup

## Option 1: Vercel Native GitHub Integration (Recommended - Easiest)

This is the simplest way to get automatic deployments from GitHub to Vercel.

### Steps:

1. **Go to Vercel:**
   - Visit: https://vercel.com
   - Sign in with your GitHub account (if not already)

2. **Import Your Project:**
   - Click "Add New..." → "Project"
   - Select your GitHub account
   - Find and import: `MaxEllis/AIGM`

3. **Configure Project:**
   - Framework Preset: **Vite** (should auto-detect)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (should auto-detect)
   - Output Directory: `dist` (should auto-detect)
   - Install Command: `npm install` (should auto-detect)

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically:
     - Build your project
     - Deploy it
     - Set up automatic deployments on every push to `main`

### That's it! 

Now every time you push to GitHub, Vercel will automatically:
- Detect the new commit
- Build your project
- Deploy it to production

You'll get a URL like: `https://aigm.vercel.app`

---

## Option 2: GitHub Actions (More Control)

If you prefer using GitHub Actions, you'll need to:

1. Get Vercel tokens from: https://vercel.com/account/tokens
2. Add secrets to GitHub:
   - Go to: https://github.com/MaxEllis/AIGM/settings/secrets/actions
   - Add: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
3. The workflow file is already set up at `.github/workflows/deploy-vercel.yml`

---

**Recommendation:** Use Option 1 (Native Integration) - it's simpler and handles everything automatically!

