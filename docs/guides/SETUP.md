# Auto-Apply Setup Guide

## Quick Start for Railway Deployment

### Step 1: Get PostgreSQL Credentials

1. Go to your Railway project dashboard
2. Find your **PostgreSQL** service
3. Click on the **Variables** tab
4. Copy the following values:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

### Step 2: Configure Auto-Apply Service

1. Go to your **Auto-Apply** service in Railway
2. Click on the **Variables** tab
3. Add these environment variables:

```bash
# PostgreSQL Database (copy from PostgreSQL service)
PGHOST=tramway.proxy.rlwy.net
PGPORT=5432
PGUSER=postgres
PGPASSWORD=<paste-your-password-here>
PGDATABASE=railway

# JWT Secret (generate a random string)
JWT_SECRET=<generate-random-32-char-string>

# OpenAI API Key (if using AI features)
OPENAI_API_KEY=<your-openai-key>

# Email Service (optional - defaults to console)
EMAIL_SERVICE=console

# Application Settings
NODE_ENV=production
BASE_URL=https://your-app.up.railway.app
```

### Step 3: Generate JWT Secret

Run this command locally to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET`.

### Step 4: Deploy

Once all variables are set, Railway will automatically redeploy your application.

### Step 5: Verify

1. Visit your Railway app URL
2. Go to `/login.html`
3. Enter your email and click "Send Magic Link"
4. In development mode, you'll see the magic link on the page
5. Click it to login!

---

## Email Configuration (Optional)

By default, magic links are logged to the console (development mode).

For production email sending, choose one of these providers:

### Option 1: Resend (Recommended)

```bash
EMAIL_SERVICE=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Auto-Apply <noreply@yourdomain.com>
```

Sign up at: https://resend.com

### Option 2: SendGrid

```bash
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

Sign up at: https://sendgrid.com

---

## Troubleshooting

### "Database not configured" error

**Cause:** PostgreSQL environment variables not set

**Solution:**
1. Add all PG* variables from Step 2
2. Redeploy the application

### "ECONNREFUSED" error

**Cause:** Can't connect to PostgreSQL

**Solution:**
1. Verify PGHOST and PGPORT are correct
2. Check PostgreSQL service is running
3. Verify password is correct

### Magic link not working

**Cause:** Email service not configured

**Solution:**
- In development: Check server logs/console for the magic link
- In production: Configure EMAIL_SERVICE (Resend or SendGrid)

### "Invalid or expired magic link"

**Cause:** Token expired (15 minutes) or already used

**Solution:**
- Request a new magic link
- Links expire after 15 minutes for security

---

## Features Checklist

Once database is configured, you'll have:

- ✅ Passwordless authentication (magic links)
- ✅ Password-based authentication (optional)
- ✅ User accounts and profiles
- ✅ Multi-step configuration wizard
- ✅ User dashboard with completion tracking
- ✅ Secure JWT token authentication
- ✅ AI-powered job application features

---

## Development Mode

When `NODE_ENV` is not set to "production":

- Magic links are shown directly on the page
- Links are logged to console
- Error messages include technical details
- Helpful for testing without email service

---

## Need Help?

Check the logs in Railway:
1. Go to your Auto-Apply service
2. Click "Deployments"
3. Click on the latest deployment
4. View the logs for any error messages

Common log messages:
- `✅ Database initialized successfully` - Everything is working!
- `⚠️ Database not configured` - Need to set PG* variables
- `📧 MAGIC LINK EMAIL (Development Mode)` - Magic link in logs

---

**Next Steps After Setup:**

1. Login with magic link
2. Complete the configuration wizard
3. Upload your resume
4. Set job preferences
5. Start auto-applying!

🚀 Happy job hunting!
