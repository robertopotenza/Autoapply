# Developer Onboarding Guide

Welcome to the AutoApply development team! This guide will help you get up to speed with the platform architecture, development workflow, and key systems.

## Table of Contents

- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Real-Time Step 2 Alerts](#real-time-step-2-alerts)
- [Testing](#testing)
- [Deployment](#deployment)

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL database
- Git

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/robertopotenza/Autoapply.git
   cd Autoapply
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your configuration
   ```

4. **Initialize database:**
   ```bash
   npm run db:init
   npm run db:migrate
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## Architecture Overview

AutoApply is built with a modern Node.js stack:

- **Backend:** Express.js REST API
- **Database:** PostgreSQL with custom query layer
- **Frontend:** Vanilla JavaScript with modern ES6+
- **Authentication:** JWT-based auth
- **Logging:** Winston with daily log rotation
- **Monitoring:** Performance logging and alerting

### Key Directories

```
├── src/
│   ├── routes/          # API route handlers
│   ├── database/        # Database models and migrations
│   ├── middleware/      # Express middleware
│   └── utils/           # Utility functions
├── public/              # Frontend assets
├── scripts/             # Utility and monitoring scripts
├── tests/               # Test suites
└── config/              # Configuration files
```

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature development
- `bugfix/*` - Bug fixes

### Code Style

- Use ES6+ features
- Follow existing code patterns
- Run linter before committing: `npm run lint` (if available)

### Testing

Run the test suite:
```bash
npm test                    # Run all tests
npm test -- wizard-step2    # Run specific test suite
npm test -- --watch         # Watch mode
```

## Real-Time Step 2 Alerts

### Overview

The platform includes an automated alert system that monitors Step 2 (Profile) submissions and sends Slack notifications when validation issues are detected.

### How It Works

1. **Automatic Detection:** The system monitors application logs for Step 2 validation warnings:
   - Incomplete submissions (missing critical fields)
   - Empty payload submissions (all fields empty)

2. **Real-Time Alerting:** When a warning is detected:
   - Alert is logged to `alerts/step2-alerts.log`
   - Slack notification is sent (if webhook configured)
   - Alert appears in Admin Dashboard

3. **CI Integration:** GitHub Actions workflow runs daily and on every push:
   - Executes Step 2 validation tests
   - Sends alerts if tests fail
   - Uploads test results as artifacts

### Setting Up Step 2 Alerts

**1. Configure Slack Webhook:**

Get a webhook URL from Slack:
- Go to https://api.slack.com/apps
- Create an app or select existing one
- Enable "Incoming Webhooks"
- Create webhook for your channel
- Copy the webhook URL

**2. Add to Environment:**

Local development (`.env.development`):
```bash
SLACK_STEP2_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK
```

Production (Railway/Heroku):
```bash
# Add as environment variable in hosting platform
SLACK_STEP2_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK
```

GitHub Actions (repository secrets):
- Go to Settings > Secrets and variables > Actions
- Add `SLACK_STEP2_ALERT_WEBHOOK` secret

**3. Enable Alerts:**

Via Admin Dashboard:
1. Navigate to `/admin/dashboard`
2. Find "Step 2 Submission Alerts" panel
3. Toggle "Enable Step 2 Slack Alerts"

Via `config/runtime.json`:
```json
{
  "alerts": {
    "step2Slack": true,
    "threshold": "critical"
  }
}
```

### Running the Monitor Script

```bash
# Monitor logs for Step 2 warnings
node scripts/monitor-step2-alerts.js

# Run in CI mode (check test failures)
node scripts/monitor-step2-alerts.js --ci
```

### Viewing Alerts

**Admin Dashboard:**
- Visit `/admin/dashboard`
- View "Step 2 Submission Alerts" panel
- See last 10 alerts with details
- Auto-refreshes every 60 seconds

**Log File:**
```bash
# View raw alerts log
cat alerts/step2-alerts.log

# Watch for new alerts
tail -f alerts/step2-alerts.log
```

### Alert Message Structure

Alerts contain:
- **User ID:** The user who submitted incomplete data
- **Missing Fields:** List of empty critical fields
- **Environment:** development, production, or ci
- **Timestamp:** When the issue was detected
- **Severity:** warning (🟡) or critical (🔴)

### Troubleshooting Alerts

**Alerts not sending?**
```bash
# Test webhook
curl -X POST $SLACK_STEP2_ALERT_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert"}'

# Check runtime config
cat config/runtime.json | grep step2Slack

# Check logs
grep "STEP 2" logs/combined.log
```

**Dashboard not showing alerts?**
- Verify admin token is correct
- Check `alerts/step2-alerts.log` exists
- Check browser console for errors

### Writing Step 2 Tests

When adding new Step 2 validation logic:

1. **Update validation in backend** (`src/routes/wizard.js`)
2. **Add test case** (`tests/wizard-step2-validation.test.js`)
3. **Run tests** to ensure they pass
4. **Monitor alerts** after deployment

Example test:
```javascript
test('should warn when critical fields are empty', async () => {
    const response = await request(app)
        .post('/api/wizard/step2')
        .set('Authorization', `Bearer ${token}`)
        .send({
            fullName: '',  // Empty critical field
            email: 'test@example.com'
        });
    
    expect(response.status).toBe(200);
    // Alert should be triggered in logs
});
```

### Best Practices

1. **Don't disable alerts in production** - They help catch issues early
2. **Review alerts regularly** - Check admin dashboard daily
3. **Investigate patterns** - Multiple alerts for same field? Fix the root cause
4. **Test locally first** - Trigger alerts in development before pushing
5. **Keep webhook secure** - Never commit webhook URLs to git

### Related Documentation

- [Step 2 Slack Alerts Documentation](./STEP2_SLACK_ALERTS.md) - Complete alert system reference
- [Admin Dashboard Manual](./ADMIN_DASHBOARD_MANUAL.md) - Dashboard features and usage
- [Step 2 Validation Guide](./QUICKSTART_STEP2_VALIDATION.md) - Validation logic details

## Testing

### Test Structure

```
tests/
├── wizard-step2.test.js              # Basic Step 2 tests
├── wizard-step2-validation.test.js   # Validation tests
├── wizard-step2-scenarios.test.js    # Edge case scenarios
└── step2-alerts.test.js              # Alert system tests
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- step2-alerts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Writing Tests

Follow existing patterns:
- Use descriptive test names
- Mock external dependencies
- Test both success and error cases
- Clean up after tests

## Deployment

### Railway Deployment

1. **Set environment variables** in Railway dashboard
2. **Push to main branch** to trigger deployment
3. **Monitor deployment logs**
4. **Verify health** via `/api/admin/status`

### Manual Deployment

```bash
# Build (if needed)
npm run build

# Start production server
NODE_ENV=production npm start
```

### Post-Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Admin dashboard accessible
- [ ] Step 2 alerts working
- [ ] Logs being written
- [ ] Performance monitoring active

## Getting Help

- **Documentation:** Check `/docs` and root-level `*.md` files
- **Admin Dashboard:** `/admin/dashboard` for system health
- **Diagnostics:** Run `node scripts/diagnose-step2-flow.js`
- **Logs:** Check `logs/combined.log` and `logs/error.log`

## Next Steps

1. **Explore the codebase** - Start with `src/routes/wizard.js`
2. **Run tests** - Get familiar with test patterns
3. **Set up alerts** - Configure Step 2 Slack alerts
4. **Make a change** - Pick a small issue and submit a PR
5. **Review documentation** - Read related guides in `/docs`

Welcome aboard! 🚀
