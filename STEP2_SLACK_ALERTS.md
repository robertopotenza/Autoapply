# Step 2 Slack Alerts Documentation

## Overview

The Step 2 Slack Alert system provides real-time notifications when incomplete Step 2 (Profile) submissions or validation failures are detected in the AutoApply platform. This system helps administrators quickly identify and respond to data validation issues.

## Architecture

The alert system consists of four main components:

1. **Log Monitoring Script** (`scripts/monitor-step2-alerts.js`)
   - Parses application logs for Step 2 warnings
   - Extracts relevant alert data (user ID, missing fields, environment)
   - Sends formatted Slack notifications
   - Stores alerts in a local log file

2. **CI/CD Integration** (`.github/workflows/step2-alerts.yml`)
   - Runs Step 2 tests on every push to main
   - Monitors test failures and sends alerts
   - Scheduled daily checks at 2 AM UTC

3. **Admin Dashboard** (`/admin/dashboard`)
   - Displays last 10 Step 2 alerts
   - Provides toggle to enable/disable alerts at runtime
   - Auto-refreshes alerts every 60 seconds

4. **Runtime Configuration** (`config/runtime.json`)
   - Stores alert preferences
   - Controls whether alerts are sent
   - Configurable threshold levels

## Environment Variables

### Required

```bash
SLACK_STEP2_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

This webhook URL is required for Slack notifications to work. Get your webhook URL from:
1. Go to https://api.slack.com/apps
2. Select your app or create a new one
3. Navigate to "Incoming Webhooks"
4. Create a webhook for your desired channel
5. Copy the webhook URL

### Optional

```bash
NODE_ENV=production|development|test
```

Controls the environment label in alert messages and affects log file paths.

## Configuration

### Runtime Configuration (`config/runtime.json`)

```json
{
  "alerts": {
    "step2Slack": true,
    "threshold": "critical"
  }
}
```

**Fields:**
- `step2Slack` (boolean): Enable or disable Step 2 Slack alerts
- `threshold` (string): Alert threshold level ("warning" or "critical")

## Alert Patterns Detected

The system monitors logs for the following warning patterns:

### Pattern 1: Incomplete Step 2 Submission
```
⚠️ INCOMPLETE STEP 2 SUBMISSION - User {userId} submitted with empty critical fields
```

**When triggered:**
- One or more critical fields are empty in Step 2 submission
- Critical fields: fullName, email, phone, country, city, resumePath

**Alert severity:** Warning (🟡)

### Pattern 2: All Fields Empty
```
❌ CRITICAL: All Step 2 fields are empty for user {userId}!
```

**When triggered:**
- All Step 2 fields are completely empty
- Indicates a potential frontend bug or API issue

**Alert severity:** Critical (🔴)

## Slack Message Format

### Warning Alert Example

```json
{
  "text": "⚠️ *Incomplete Step 2 Submission Detected*",
  "attachments": [
    {
      "color": "#FFA500",
      "fields": [
        {
          "title": "User ID",
          "value": "123",
          "short": true
        },
        {
          "title": "Missing Fields",
          "value": "fullName, country",
          "short": true
        },
        {
          "title": "Environment",
          "value": "production",
          "short": true
        },
        {
          "title": "Detected At",
          "value": "2025-10-09T13:17:01Z"
        }
      ],
      "footer": "AutoApply Platform Step 2 Monitor",
      "ts": 1733800000
    }
  ]
}
```

### Critical Alert Example

```json
{
  "text": "🚨 *Critical Step 2 Submission Detected*",
  "attachments": [
    {
      "color": "#FF0000",
      "fields": [
        {
          "title": "User ID",
          "value": "456",
          "short": true
        },
        {
          "title": "Missing Fields",
          "value": "All fields empty",
          "short": true
        },
        {
          "title": "Environment",
          "value": "production",
          "short": true
        },
        {
          "title": "Detected At",
          "value": "2025-10-09T14:30:00Z"
        }
      ],
      "footer": "AutoApply Platform Step 2 Monitor",
      "ts": 1733803800
    }
  ]
}
```

## Usage

### Running the Monitor Script Locally

```bash
# Run in normal mode (monitors logs)
node scripts/monitor-step2-alerts.js

# Run in CI mode (checks test failures)
node scripts/monitor-step2-alerts.js --ci
```

### Viewing Alerts in Admin Dashboard

1. Navigate to `/admin/dashboard`
2. Enter your admin token
3. Scroll to "Step 2 Submission Alerts" panel
4. View recent alerts with timestamp, user ID, and missing fields
5. Use the toggle to enable/disable alerts at runtime

### CI/CD Workflow

The workflow runs automatically:
- On every push to `main` branch
- On manual trigger via GitHub Actions UI
- Daily at 2 AM UTC via cron schedule

To trigger manually:
1. Go to GitHub Actions tab
2. Select "Step 2 Slack Alerts" workflow
3. Click "Run workflow"

## Alert Storage

Alerts are stored in `alerts/step2-alerts.log` in JSON format:

```json
{"userId":"123","emptyFields":["fullName","country"],"severity":"warning","message":"...","timestamp":"2025-10-09T13:17:01Z","environment":"production","savedAt":"2025-10-09T13:17:02Z"}
```

**Note:** This file is gitignored and local only. For production, consider integrating with a log aggregation service.

## Troubleshooting

### Alerts Not Sending

**Check 1: Webhook Configuration**
```bash
# Verify webhook is set
echo $SLACK_STEP2_ALERT_WEBHOOK

# Test webhook manually
curl -X POST $SLACK_STEP2_ALERT_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert from AutoApply"}'
```

**Check 2: Runtime Configuration**
```bash
# Check if alerts are enabled
cat config/runtime.json | grep step2Slack
```

**Check 3: Log Files**
```bash
# Verify log files exist and contain Step 2 warnings
cat logs/combined.log | grep "STEP 2"
```

### Dashboard Not Loading Alerts

**Check 1: Admin Token**
- Ensure you're using a valid admin token
- Token must match `ADMIN_TOKEN` environment variable

**Check 2: API Endpoint**
```bash
# Test API endpoint
curl -H "X-Admin-Token: YOUR_TOKEN" \
  http://localhost:3000/api/admin/alerts/step2
```

**Check 3: Alerts Log File**
```bash
# Verify alerts log exists and is readable
ls -la alerts/step2-alerts.log
```

### CI Workflow Failing

**Check 1: GitHub Secret**
- Ensure `SLACK_STEP2_ALERT_WEBHOOK` secret is set in GitHub repository settings
- Go to Settings > Secrets and variables > Actions

**Check 2: Test Failures**
- Review test results in workflow run
- Check if Step 2 tests are actually failing

## Performance Considerations

- **Log Parsing:** Monitor script reads entire log file. For very large logs (>100MB), consider using streaming or log rotation.
- **Slack Rate Limits:** Slack webhooks have rate limits. The system doesn't implement rate limiting or deduplication.
- **Dashboard Refresh:** Auto-refresh every 60 seconds. Adjust if needed in `admin-dashboard.html`.
- **Alert Storage:** Log file grows indefinitely. Consider implementing log rotation or cleanup.

## Testing

Run the test suite:

```bash
# Run all Step 2 alert tests
npm test -- step2-alerts

# Run in watch mode
npm test -- step2-alerts --watch
```

## Integration with Existing Systems

### Railway Deployment

Add the webhook to Railway environment variables:
1. Go to Railway project dashboard
2. Navigate to Variables
3. Add `SLACK_STEP2_ALERT_WEBHOOK` with your webhook URL
4. Redeploy the service

### Docker Deployment

Add to your `docker-compose.yml`:
```yaml
environment:
  - SLACK_STEP2_ALERT_WEBHOOK=https://hooks.slack.com/services/...
```

Or pass via command line:
```bash
docker run -e SLACK_STEP2_ALERT_WEBHOOK=https://hooks.slack.com/... your-image
```

## Security Considerations

1. **Webhook Security:** Never commit webhook URLs to version control
2. **Admin Token:** Use strong tokens and rotate periodically
3. **Data Privacy:** Alert messages contain user IDs. Ensure Slack channel access is restricted
4. **HTTPS Only:** Always use HTTPS for webhook URLs

## Future Enhancements

Potential improvements to consider:

- **Alert Deduplication:** Prevent duplicate alerts for the same user/issue
- **Rate Limiting:** Implement smart rate limiting for high-volume scenarios
- **Alert Aggregation:** Batch multiple alerts into a single message
- **Trend Analysis:** Track alert frequency and identify patterns
- **Integration with PagerDuty/Opsgenie:** Support for on-call alerting
- **Custom Alert Channels:** Support for email, SMS, or other notification methods

## Support

For issues or questions:
1. Check logs: `logs/combined.log` and `logs/error.log`
2. Review admin dashboard for system health
3. Run diagnostics: `node scripts/diagnose-step2-flow.js`
4. Open an issue on GitHub with relevant logs and configuration

## Related Documentation

- [Admin Dashboard Manual](./ADMIN_DASHBOARD_MANUAL.md)
- [Developer Onboarding](./DEVELOPER_ONBOARDING.md)
- [Step 2 Validation Guide](./QUICKSTART_STEP2_VALIDATION.md)
- [Logging Implementation](./LOGGING_IMPLEMENTATION.md)
