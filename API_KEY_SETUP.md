# OpenAI API Key Setup

Your API key has been saved locally. Here's how to configure it for different environments:

## ✅ Local Development

The API key is saved in `.env.local` (git-ignored for security).

**For local testing with Vite:**
- The `.env.local` file is already created
- Restart your dev server: `npm run dev`
- The serverless function will read from `process.env.OPENAI_API_KEY`

**Note:** For local development, you may need to use Vercel CLI:
```bash
npm install -g vercel
vercel dev
```
This will run both the frontend and API functions locally with environment variables.

## 🌐 Vercel Production

**You MUST add the API key to Vercel for production:**

1. Go to your Vercel project dashboard
2. Navigate to: **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** (paste your API key here - it's saved in your `.env.local` file)
   - **Environment:** Select all (Production, Preview, Development)
4. Click **Save**
5. Redeploy your project (or it will auto-deploy on next push)

## 🔒 Security Notes

- ✅ `.env.local` is in `.gitignore` - your key won't be committed
- ✅ Never commit API keys to git
- ✅ The key is only used server-side in the API function
- ⚠️ If you ever need to rotate the key, do it in both places

## 🧪 Testing

After setup, test by:
1. Starting the dev server
2. Going to the Session screen
3. Asking a question via voice input
4. Check the browser console for any errors

If you see "rules engine unavailable" errors, check that the API key is properly set.

