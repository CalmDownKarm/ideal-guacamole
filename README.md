# Coffee Brew Tracker

A simple, mobile-friendly web app for tracking your coffee brews using Airtable as the backend.

## Features

- 📱 Mobile-optimized interface
- ☕ Track brews with detailed information:
  - Coffee from your stash (linked to Airtable)
  - Date and time (automatically recorded)
  - Method (Filter/Espresso)
  - Grinder and grind size
  - Brewer
  - Extraction time
  - Dose and water weight
  - Enjoyment rating (1-10)
  - Taste notes
  - Recipe (optional)
- 📊 View all your brews in a clean list
- 🎨 Beautiful, modern UI

## Setup Instructions

### 1. Airtable Setup

You'll need to create two tables in your Airtable base:

#### Table 1: Coffee Stash
This table should contain your coffee inventory. It needs at least:
- **Name** (Single line text) - The name of the coffee

#### Table 2: Brews
This table will store all your brew records. Create the following fields:

- **Coffee** (Link to another record) - Links to your Coffee Stash table
- **Date & Time** (Date with time) - Automatically set when you create a brew
- **Method** (Single select) - Options: "filter", "espresso"
- **Grinder** (Single line text)
- **Grind Size** (Single line text)
- **Brewer** (Single line text)
- **Extraction Time** (Number) - In seconds
- **Dose** (Number) - In grams
- **Water Weight** (Number) - In grams
- **Enjoyment Rating** (Number) - 1-10
- **Taste** (Long text)
- **Recipe** (Long text) - Optional

### 2. Get Your Airtable Credentials

1. Go to [Airtable API Documentation](https://airtable.com/api)
2. Select your base
3. Copy your **Base ID** (starts with `app...`)
4. Go to [Airtable Account Settings](https://airtable.com/account) → Developer options
5. Create a Personal Access Token (API Key)
6. Copy your **API Key**

### 3. Configure the App

**Important**: This app uses a backend proxy to keep your API key secure. You only need to configure table names in the frontend, and set environment variables on your hosting platform.

1. Open `app.js`
2. Update the `CONFIG` object at the top (only table names needed):
   ```javascript
   const CONFIG = {
       coffeeTable: 'Coffee Stash', // Name of your coffee stash table
       brewTable: 'Brews' // Name of your brews table
   };
   ```
3. If your table names are different, update `coffeeTable` and `brewTable` accordingly
4. **Set environment variables** on your hosting platform (see Hosting Guide below)

### 4. Field Name Adjustments

If your Airtable field names differ from the defaults, you may need to update the field names in `app.js`. The app uses these field names:
- Coffee stash: `Name` or `Coffee Name`
- Brews: `Coffee`, `Date & Time`, `Method`, `Grinder`, `Grind Size`, `Brewer`, `Extraction Time`, `Dose`, `Water Weight`, `Enjoyment Rating`, `Taste`, `Recipe`

### 5. Run the App

You can run this app in several ways:

#### Option 1: Local File (Simple)
1. Open `index.html` directly in your browser
2. Note: Some browsers may block CORS requests. If you see errors, use Option 2 or 3.

#### Option 2: Local Server with Netlify Dev (Recommended for Testing)

For local development with the backend proxy:

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Create a `.env` file in the project root:
   ```
   AIRTABLE_BASE_ID=your_base_id_here
   AIRTABLE_API_KEY=your_api_key_here
   ```

3. Run Netlify Dev:
   ```bash
   cd coffee-brew-tracker
   netlify dev
   ```

4. Open `http://localhost:8888` in your browser

**Alternative - Simple Static Server** (for testing frontend only, won't work with Airtable):
```bash
cd coffee-brew-tracker
python3 -m http.server 8000
# or
npx http-server
```
Note: This won't work with Airtable since the backend proxy won't be available.

#### Option 3: Deploy to Web Hosting

See the [Hosting Guide](#hosting-guide) section below for detailed instructions.

## Usage

1. **New Brew Tab**: Fill out the form with your brew details and click "Save Brew"
2. **My Brews Tab**: View all your saved brews, sorted by date (newest first)

## Mobile Usage

The app is optimized for mobile devices. You can:
- Add it to your home screen on iOS (Safari → Share → Add to Home Screen)
- Add it to your home screen on Android (Chrome → Menu → Add to Home Screen)

This creates a full-screen app-like experience.

## Troubleshooting

### "Error loading coffees" or "Error loading brews"
- Check that your Base ID and API Key are correct
- Verify your table names match exactly (case-sensitive)
- Ensure your API key has read/write access to your base

### "Error saving brew"
- Check that all required fields are filled
- Verify field names match your Airtable schema
- Check browser console for detailed error messages

### CORS Errors
- Use a local server (Option 2) instead of opening the file directly
- Or deploy to a web hosting service

## Security Note

⚠️ **Important**: This app stores your API key in the JavaScript file. For production use, consider:
- Using environment variables
- Setting up a backend proxy
- Using Airtable's authentication best practices

For personal use, this setup is fine, but don't commit your API key to public repositories.

## Hosting Guide

This app requires a backend to securely store your Airtable API key. Choose one of the options below:

### Option 1: Netlify (Recommended - Easiest)

#### Initial Setup

1. Go to [netlify.com](https://netlify.com) and sign up (free)
2. On the dashboard, drag and drop your `coffee-brew-tracker` folder (or connect a GitHub repo)
3. **Set Environment Variables**:
   - Go to Site settings → Environment variables
   - Add `AIRTABLE_BASE_ID` = your Airtable base ID (starts with `app...`)
   - Add `AIRTABLE_API_KEY` = your Airtable API key
   - Click "Save"
4. Your site will be live instantly at a URL like `random-name-123.netlify.app`
5. Optional: Add a custom domain in Site settings → Domain management

#### Automatic Deployment with GitHub Actions

If you want to use GitHub Actions for automatic deployments (instead of Netlify's built-in Git integration):

1. **Get your Netlify credentials**:
   - Go to [Netlify User Settings](https://app.netlify.com/user/applications) → Applications → New access token
   - Create a new access token and copy it
   - Go to your site → Site settings → General → Site details
   - Copy your **Site ID** (starts with something like `abc123...`)

2. **Add GitHub Secrets**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add `NETLIFY_AUTH_TOKEN` with your access token
   - Add `NETLIFY_SITE_ID` with your site ID

3. **Push to GitHub**:
   - The workflow file (`.github/workflows/deploy-netlify.yml`) is already included
   - Push your code to the `main` branch (or `master` if that's your default)
   - GitHub Actions will automatically deploy to Netlify on every push

**Note**: If your default branch is `master` instead of `main`, update the branch name in `.github/workflows/deploy-netlify.yml`.

**Pros**: Easiest deployment, free HTTPS, custom domains, serverless functions included, automatic deployments with GitHub Actions

### Option 2: Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New Project"
3. Either:
   - Drag and drop your folder, OR
   - Connect a GitHub repository for automatic deployments
4. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add `AIRTABLE_BASE_ID` = your Airtable base ID (starts with `app...`)
   - Add `AIRTABLE_API_KEY` = your Airtable API key
   - Select "Production", "Preview", and "Development" environments
   - Click "Save"
5. Your site will be live at `your-project.vercel.app`

**Pros**: Great performance, automatic deployments with Git, free HTTPS, serverless functions included

### Option 3: GitHub Pages (Not Recommended)

⚠️ **Note**: GitHub Pages only hosts static files and doesn't support serverless functions. You would need to expose your API key in the frontend code, which is not secure.

**Better alternatives**: Use Netlify or Vercel (both free) which support serverless functions.

### Option 3: Cloudflare Pages (Advanced)

Cloudflare Pages supports serverless functions (Workers), but requires additional setup:

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign up/login
3. Connect your GitHub repository or upload files
4. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add `AIRTABLE_BASE_ID` and `AIRTABLE_API_KEY`
5. You'll need to adapt the serverless function for Cloudflare Workers format

**Note**: The included functions are for Netlify/Vercel. Cloudflare requires different syntax.

**Pros**: Fast CDN, free, great performance

**Recommendation**: Use Netlify or Vercel for easier setup.

### Security

✅ **This app uses a backend proxy** - your API key is stored securely as an environment variable on the server side and never exposed to the browser.

**How it works**:
- Your frontend calls your serverless function (Netlify/Vercel)
- The serverless function has access to environment variables (your API key)
- The serverless function makes authenticated requests to Airtable
- Your API key never appears in the browser or client-side code

**Best practices**:
- Never commit environment variables to Git
- Use different API keys for development and production if needed
- Regularly rotate your API keys in Airtable settings
- Restrict your Airtable API key permissions if possible

## Customization

Feel free to customize:
- Colors in `styles.css` (CSS variables at the top)
- Field names in `app.js`
- Table names in the config

Enjoy tracking your coffee brews! ☕

