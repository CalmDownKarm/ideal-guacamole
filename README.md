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

You'll need to create three tables in your Airtable base:

#### Table 1: Coffee Freezer (Coffee Stash)

This table contains your coffee inventory. Create the following fields:

| Field Name | Field Type | Required | Description |
|-----------|------------|----------|-------------|
| **Name/Producer** | Single line text | Yes | The name/producer of the coffee |
| **Roast** | Single line text | No | Roast level (e.g., Light, Medium, Dark, Ultralight, Filter) |
| **Roast Date** | Date | No | Date the coffee was roasted |
| **Roaster** | Single line text | No | Name of the roaster |
| **Process** | Single line text | No | Processing method (e.g., Washed, Natural, Honey, Thermal Shock) |
| **Varietal** | Single line text | No | Coffee varietal (e.g., Geisha, Pink Bourbon, Sidra) |
| **Origin** | Single line text | No | Country/region of origin |
| **Notes** | Long text | No | Tasting notes or description |
| **Opened** | Checkbox | No | Whether the coffee has been opened (used for filtering) |
| **Days From Roast** | Number | No | Calculated field: days since roast date |
| **Frozen** | Checkbox | No | Whether the coffee is frozen |
| **Killed** | Checkbox | No | Whether the coffee is finished/consumed |
| **Espresso Rating (0-10)** | Number | No | Rating for espresso preparation (0-10) |
| **Filter Rating (0-10)** | Number | No | Rating for filter preparation (0-10) |
| **Weight(g)** | Number | No | Current weight in grams |
| **Price (USD without shipping)** | Number | No | Purchase price in USD |
| **Price per kg** | Number | No | Price per kilogram (calculated) |
| **Price per 18g** | Number | No | Price per 18g dose (calculated) |
| **Frozen Date** | Date | No | Date the coffee was frozen |
| **Thaw Date** | Date | No | Date the coffee was thawed |

**Note**: Only the **Name/Producer** field is required. The app filters coffees by the **Opened** checkbox field.

#### Table 2: Allowed Users

This table controls who can create brews. Create this table with:

| Field Name | Field Type | Required | Description |
|-----------|------------|----------|-------------|
| **Email** | Single line text | Yes | The email address of authorized users (case-insensitive) |

**Setup**:
- Create a table named "Allowed Users" (or set `ALLOWED_USERS_TABLE` environment variable to use a different name)
- Add rows with email addresses of users who should be able to create brews
- Email matching is case-insensitive

#### Table 3: Coffee Brews

This table stores all your brew records. Create the following fields:

| Field Name | Field Type | Required | Description |
|-----------|------------|----------|-------------|
| **Brew** | Auto number | Auto | Auto-incrementing brew number |
| **Coffee** | Link to another record | Yes | Links to Coffee Freezer table |
| **Brew Date** | Date with time | Yes | Date and time of the brew (automatically set) |
| **Grinder Used** | Single line text | Yes | Grinder used (e.g., P80, 078, 064S, ZP6, K6) |
| **Grind Size** | Number | Yes | Grind size setting (0-10, 0.1 increments) |
| **Brew Method** | Single line text | No | Brew method (e.g., Filter, Espresso) |
| **Brewer** | Single line text | Yes | Brewer used (e.g., V60, Neo, Pulsar, Orea V4, ORB Soup, Espresso) |
| **Number of Pours** | Number | No | Number of water pours during brewing |
| **Water Temperature (°C)** | Number | No | Water temperature in Celsius |
| **Dose** | Number | Yes | Coffee dose in grams |
| **Drink Weight** | Number | Yes | Final drink weight in grams |
| **Ratio** | Number | No | Coffee to water ratio (calculated: Drink Weight / Dose) |
| **Total Brew Time** | Single line text | No | Total brew time in mm:ss format (e.g., "2:30") |
| **Enjoyment Rating** | Number | Yes | Enjoyment rating (1-10) |
| **Notes & Tasting** | Long text | No | Tasting notes and observations |

**Linked Fields** (automatically populated from Coffee Freezer):
- **Origin (from Coffee)** - Linked field showing origin
- **Name/Producer (from Coffee)** - Linked field showing coffee name
- **Roast Date (from Coffee)** - Linked field showing roast date
- **Roaster (from Coffee)** - Linked field showing roaster
- **Process (from Coffee)** - Linked field showing process
- **Varietal (from Coffee)** - Linked field showing varietal

**Note**: The **Coffee** field must link to the Coffee Freezer table. The app will only show coffees where **Opened** is checked in the Coffee Freezer table.

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

#### Method A: Netlify GitHub Integration (Recommended - Simplest)

This is the easiest way to set up automatic deployments. Netlify will automatically deploy whenever you push to GitHub.

1. **Push your code to GitHub**:
   - Create a new repository on GitHub (if you haven't already)
   - Push your `coffee-brew-tracker` code to GitHub

2. **Connect to Netlify**:
   - Go to [netlify.com](https://netlify.com) and sign up/login (free)
   - Click "Add new site" → "Import an existing project"
   - Click "Deploy with GitHub"
   - Authorize Netlify to access your GitHub account
   - Select your `coffee-brew-tracker` repository
   - Click "Next"

3. **Configure Build Settings**:
   - **Branch to deploy**: Select `main` (or `master` if that's your default branch)
   - **Base directory**: Leave empty (or set to `.` if needed)
   - **Build command**: Leave empty (this is a static site, no build needed)
   - **Publish directory**: Leave empty (or set to `.` if needed)
   - **Functions directory**: Set to `netlify/functions` (this should already be filled in)
   - Click "Deploy site"

4. **Set Environment Variables**:
   - After the initial deployment, go to Site settings → Environment variables
   - Click "Add a variable"
   - Add `AIRTABLE_BASE_ID` = your Airtable base ID (starts with `app...`)
   - Add `AIRTABLE_API_KEY` = your Airtable API key
   - Add `AUTH0_DOMAIN` = your Auth0 domain (e.g., `your-tenant.auth0.com`)
   - Add `AUTH0_CLIENT_ID` = your Auth0 application client ID
   - Add `AUTH0_AUDIENCE` = your Auth0 API identifier (optional, defaults to Auth0 Management API)
   - Add `ALLOWED_USERS_TABLE` = name of your allowed users table (optional, defaults to "Allowed Users")
   - Click "Save"
   - Go to Deploys → Trigger deploy → Deploy site (to redeploy with the new environment variables)

5. **Configure Auth0** (see detailed instructions in "Auth0 Setup" section below)

6. **Done!** Your site is now live and will automatically redeploy whenever you push to GitHub.

**Pros**: Simplest setup, automatic deployments on every push, free HTTPS, custom domains, serverless functions included

#### Method B: GitHub Actions (Alternative)

If you prefer using GitHub Actions instead of Netlify's built-in integration:

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

**Recommendation**: Use Method A (Netlify GitHub Integration) - it's simpler and doesn't require managing GitHub secrets.

### Option 2: GitHub Pages (Not Recommended)

⚠️ **Note**: GitHub Pages only hosts static files and doesn't support serverless functions. You would need to expose your API key in the frontend code, which is not secure.

**Better alternative**: Use Netlify (free) which supports serverless functions.

### Option 3: Cloudflare Pages (Advanced)

Cloudflare Pages supports serverless functions (Workers), but requires additional setup:

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign up/login
3. Connect your GitHub repository or upload files
4. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add `AIRTABLE_BASE_ID` and `AIRTABLE_API_KEY`
5. You'll need to adapt the serverless function for Cloudflare Workers format

**Note**: The included functions are for Netlify. Cloudflare requires different syntax.

**Pros**: Fast CDN, free, great performance

**Recommendation**: Use Netlify for easier setup.

### Authentication

🔐 **This app uses Auth0 for authentication** - only authenticated users with whitelisted email addresses can create new brews, but anyone can view existing brews.

**How it works**:
- Users must login with Auth0 to create new brews
- Email addresses must be in the "Allowed Users" Airtable table
- Viewing brews is public (no authentication required)
- Auth0 handles all authentication securely
- JWT tokens are verified on the backend before allowing brew creation
- Email addresses are extracted from the JWT token and checked against the Airtable whitelist

**Email Whitelist**:
- Create an "Allowed Users" table in Airtable (or set `ALLOWED_USERS_TABLE` environment variable to use a different table name)
- Add an "Email" field (Single line text)
- Add rows with email addresses of users who should be able to create brews
- Email matching is case-insensitive
- If the table doesn't exist, access will be denied for security

**Setup**: See the detailed "Auth0 Setup" section below for step-by-step instructions.

## Auth0 Setup (Detailed Guide)

Auth0 provides secure authentication for your app. Follow these steps to set up Auth0 from scratch:

### Step 1: Create Auth0 Account

1. Go to [auth0.com](https://auth0.com) and click **"Sign Up"** (free tier available)
2. Choose **"Sign up with Email"** or use a social login (Google, GitHub, etc.)
3. Complete the signup process
4. Verify your email if prompted
5. You'll be taken to your Auth0 Dashboard

### Step 2: Create an Application

1. In the Auth0 Dashboard, go to **Applications** → **Applications** (left sidebar)
2. Click the **"+ Create Application"** button (top right)
3. Enter a name for your application (e.g., "Coffee Brew Tracker")
4. Select **"Single Page Web Applications"** as the application type
5. Click **"Create"**

### Step 3: Configure Application Settings

After creating the application, you'll see the application settings page. Configure the following:

#### Allowed Callback URLs
These are the URLs Auth0 can redirect to after authentication:
- Add your Netlify site URL: `https://your-site.netlify.app`
- For local development with Netlify Dev, also add: `http://localhost:8888`
- **Format**: One URL per line, or comma-separated
- **Example**: 
  ```
  https://your-site.netlify.app
  http://localhost:8888
  ```

#### Allowed Logout URLs
These are the URLs Auth0 can redirect to after logout:
- Add your Netlify site URL: `https://your-site.netlify.app`
- For local development: `http://localhost:8888`
- **Format**: Same as callback URLs

#### Allowed Web Origins
These enable CORS for API calls from your frontend:
- Add your Netlify site URL: `https://your-site.netlify.app`
- For local development: `http://localhost:8888`
- **Format**: Same as callback URLs

#### Allowed Origins (CORS)
- Same as Allowed Web Origins

**Important**: 
- Make sure to click **"Save Changes"** at the bottom of the page after making changes
- URLs are case-sensitive - use exact URLs
- Don't include trailing slashes

### Step 4: Get Your Auth0 Credentials

1. On the application settings page, find the **"Basic Information"** section at the top
2. Copy the following values (you'll need these for Netlify environment variables):
   - **Domain**: Looks like `your-tenant.auth0.com` or `your-tenant.us.auth0.com`
     - Example: `dev-abc123.us.auth0.com`
   - **Client ID**: A long alphanumeric string
     - Example: `xYz123AbC456DeF789`

**Keep these values secure** - you'll need them in the next step.

### Step 5: Configure Auth0 API (Optional but Recommended)

If you want to use a custom API identifier (instead of the default Auth0 Management API):

1. Go to **Applications** → **APIs** (left sidebar)
2. Click **"+ Create API"**
3. Fill in the form:
   - **Name**: `Coffee Brew Tracker API` (or any name you prefer)
   - **Identifier**: `https://your-site.netlify.app/api` (must be a valid URL format, but doesn't need to be a real URL)
   - **Signing Algorithm**: `RS256` (default - keep this)
4. Click **"Create"**
5. Copy the **Identifier** value (this will be your `AUTH0_AUDIENCE`)

**Note**: If you skip this step, the app will use the default Auth0 Management API identifier. The custom API is recommended for better security and clearer token scopes.

### Step 6: Configure Auth0 Application to Include Email

1. Go back to **Applications** → **Applications** → Your Application
2. Scroll down to **"Advanced Settings"** (below the main settings)
3. Click the **"OAuth"** tab
4. Under **"OAuth Settings"**, make sure **"Include email in id_token"** is checked (usually enabled by default)
5. Click **"Save Changes"**

**Why this matters**: The app needs the user's email address from the token to check against the whitelist in Airtable.

### Step 7: Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **"Add a variable"** and add the following:

   | Variable Name | Value | Description |
   |--------------|-------|-------------|
   | `AUTH0_DOMAIN` | `your-tenant.auth0.com` | Your Auth0 domain from Step 4 (e.g., `dev-abc123.us.auth0.com`) |
   | `AUTH0_CLIENT_ID` | `your-client-id` | Your Auth0 Client ID from Step 4 (the long alphanumeric string) |
   | `AUTH0_AUDIENCE` | `https://your-site.netlify.app/api` | Your API identifier from Step 5 (optional, but recommended) |

4. Click **"Save"** after adding each variable

**Note**: 
- Don't include quotes around the values
- Make sure there are no extra spaces
- The `AUTH0_AUDIENCE` is optional - if you didn't create a custom API, you can skip it

### Step 8: Redeploy Your Site

After setting environment variables, you need to redeploy:

1. Go to **Deploys** → **Trigger deploy** → **Deploy site**
2. Or push a new commit to trigger automatic deployment
3. Wait for deployment to complete (usually 1-2 minutes)

### Step 9: Test Authentication

1. Visit your deployed site: `https://your-site.netlify.app`
2. You should see a **"Login"** button in the header
3. Click **"Login"** - you should be redirected to Auth0's hosted login page
4. Sign in with:
   - Your Auth0 account credentials, OR
   - A social provider (if you enabled them), OR
   - Create a new account using "Sign Up"
5. After successful login, you should be redirected back to your site
6. The brew form should now be visible (if your email is in the Allowed Users table)

### Troubleshooting Auth0

#### Issue: "Auth0 not configured" error message
**Solution**:
- Check that `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` are set in Netlify environment variables
- Verify the values match exactly what's in your Auth0 dashboard (no extra spaces)
- Redeploy after setting environment variables
- Check browser console for detailed error messages

#### Issue: "Invalid redirect URI" error
**Solution**:
- Check that your exact site URL is in **Allowed Callback URLs** in Auth0
- Make sure there are no trailing slashes (`/`)
- URLs are case-sensitive - verify exact match
- For local dev, make sure `http://localhost:8888` is also added

#### Issue: CORS errors in browser console
**Solution**:
- Verify your site URL is in **Allowed Web Origins** in Auth0
- Check that **Allowed Origins (CORS)** matches
- Make sure you clicked "Save Changes" in Auth0
- Clear browser cache and try again

#### Issue: "Email not found in token" error
**Solution**:
- Go to Auth0 Dashboard → Applications → Your App → Advanced Settings → OAuth
- Ensure **"Include email in id_token"** is enabled
- Make sure users have email addresses in their Auth0 profiles
- Try logging out and logging back in

#### Issue: Can login but can't create brews
**Solution**:
- Check that your email is in the "Allowed Users" Airtable table
- Verify the email matches exactly (matching is case-insensitive)
- Check browser console for 403 Forbidden errors
- Verify the "Allowed Users" table has an "Email" field
- Make sure the table name matches (default is "Allowed Users")

#### Issue: Login button doesn't appear
**Solution**:
- Check browser console for errors loading Auth0 config
- Verify the `auth0-config` function is deployed and accessible
- Test the function directly: `https://your-site.netlify.app/.netlify/functions/auth0-config`
- Should return JSON with `domain` and `clientId` fields

### Auth0 Free Tier Limits

The Auth0 free tier (Hobby plan) includes:
- **Up to 7,000 active users** per month
- **Unlimited logins**
- **Social identity providers** (Google, Facebook, GitHub, etc.)
- **Email/password authentication**
- **Basic user management**
- **Standard support**

This is more than sufficient for personal use or small teams. If you need more, paid plans start at $35/month.

### Security

✅ **This app uses a backend proxy** - your API key is stored securely as an environment variable on the server side and never exposed to the browser.

✅ **Auth0 authentication** - JWT tokens are verified on the backend using Auth0's public keys.

**How it works**:
- Your frontend calls your Netlify serverless function
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

