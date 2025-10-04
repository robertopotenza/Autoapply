# Railway CI/CD Deployment Setup Guide

This guide provides step-by-step instructions to set up automated Railway deployments via GitHub Actions to resolve deployment consistency issues.

## 🚨 **Why This Setup is Needed**

We've experienced persistent Railway infrastructure routing issues where:
- Manual deployments succeed but routing fails
- "Cannot GET" errors for all endpoints despite successful server startup
- Railway's proxy layer not forwarding requests to our Express.js application

**GitHub Actions deployment may resolve these issues by:**
- Ensuring consistent deployment process
- Bypassing potential Railway dashboard deployment bugs
- Providing better deployment logging and verification

## 🔑 **Step 1: Generate Railway Token**

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Navigate to Project**: Select "Autoapply" project
3. **Access Settings**: Click on "Settings" tab
4. **Generate Token**:
   - Click "Tokens" in the sidebar
   - Click "Generate New Token"
   - Name: `github-ci-autoapply`
   - Scope: **This project only** (not entire workspace)
   - Click "Generate"
5. **Copy Token**: Save the token immediately (you won't see it again)

## 🔒 **Step 2: Add Token to GitHub Secrets**

1. **Open GitHub Repository**: https://github.com/robertopotenza/Autoapply
2. **Navigate to Settings**: Click "Settings" tab in repository
3. **Access Secrets**: Go to "Secrets and variables" → "Actions"
4. **Create New Secret**:
   - Click "New repository secret"
   - Name: `RAILWAY_TOKEN`
   - Value: Paste the token from Step 1
   - Click "Add secret"

## ⚙️ **Step 3: GitHub Actions Workflow (Already Created)**

The workflow file `.github/workflows/deploy.yml` has been created with:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [ main ]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests (if available)
        run: npm test --if-present

      - name: Deploy to Railway
        run: npx -y railway up --yes
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

      - name: Verify deployment
        run: |
          echo "Deployment completed successfully!"
          echo "Service URL: https://autoapply-production.up.railway.app"
          echo "Check Railway dashboard for deployment status and logs"
```

## ✅ **Step 4: Test the Deployment**

### **Option A: Push to Main Branch**
1. Commit and push any changes to the `main` branch
2. GitHub Actions will automatically trigger deployment
3. Monitor progress in GitHub Actions tab

### **Option B: Create Pull Request**
1. Create a new branch: `git checkout -b test-railway-ci`
2. Make a small change (e.g., update README)
3. Push branch and create Pull Request
4. GitHub Actions will deploy the PR version

### **Monitoring Deployment**
1. **GitHub Actions**: Go to "Actions" tab in GitHub repository
2. **Watch Workflow**: Click on the running workflow to see progress
3. **Railway Dashboard**: Check Railway → Deployments → Logs for deployment confirmation
4. **Test Application**: Visit https://autoapply-production.up.railway.app after deployment

## 🔍 **Expected Benefits**

### **Deployment Consistency**
- Standardized deployment process via GitHub Actions
- Consistent environment setup and dependency installation
- Automated testing before deployment (if tests are available)

### **Better Debugging**
- Detailed GitHub Actions logs for troubleshooting
- Clear deployment success/failure indicators
- Integration with Railway's deployment API

### **Potential Issue Resolution**
- May bypass Railway dashboard deployment bugs
- Could resolve routing/proxy issues through different deployment path
- Provides alternative deployment method if manual deployments fail

## 🚨 **Troubleshooting**

### **If GitHub Actions Deployment Fails**
1. Check GitHub Actions logs for specific error messages
2. Verify `RAILWAY_TOKEN` is correctly set in repository secrets
3. Ensure Railway token has correct project scope permissions
4. Check Railway dashboard for any service configuration issues

### **If Deployment Succeeds but Routing Still Fails**
1. This confirms the issue is Railway infrastructure-related
2. Use the Railway support ticket we created for escalation
3. Consider alternative deployment platforms (Vercel, Netlify)

### **Token Security**
- Never commit Railway tokens to code
- Regenerate tokens if compromised
- Use project-scoped tokens (not workspace-wide)

## 📋 **Next Steps After Setup**

1. **Complete Steps 1-2** to configure Railway token and GitHub secrets
2. **Push this commit** to trigger the first automated deployment
3. **Monitor deployment** in both GitHub Actions and Railway dashboard
4. **Test application** to verify routing issues are resolved
5. **Document results** for Railway support if issues persist

---

**Note**: This CI/CD setup provides a more reliable deployment method and may resolve the persistent Railway routing issues we've been experiencing. If routing problems continue even with GitHub Actions deployment, it will provide additional evidence for Railway support that the issue is infrastructure-related.
