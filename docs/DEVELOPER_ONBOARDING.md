# Developer Onboarding Guide

Welcome to the AutoApply project! This guide will help you get up and running quickly.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup Checklist](#local-setup-checklist)
3. [Environment Configuration](#environment-configuration)
4. [Development Commands](#development-commands)
5. [Reading Performance Logs](#reading-performance-logs)
6. [Debugging Wizard Steps](#debugging-wizard-steps)
7. [Testing](#testing)
8. [AI Metadata Tags](#ai-metadata-tags)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: 13+ (local or Railway)
- **Git**: Latest version

## Local Setup Checklist

Follow these steps to set up your development environment:

- [ ] **1. Clone the repository**
  ```bash
  git clone https://github.com/robertopotenza/Autoapply.git
  cd Autoapply
  ```

- [ ] **2. Install dependencies**
  ```bash
  npm ci
  ```

- [ ] **3. Set up environment variables**
  ```bash
  cp .env.example .env.development
  # Edit .env.development with your settings (see below)
  ```

- [ ] **4. Initialize database**
  ```bash
  npm run db:migrate-all
  ```

- [ ] **5. Verify schema**
  ```bash
  node scripts/verify-screening-schema.js
  ```

- [ ] **6. Start development server**
  ```bash
  npm run dev
  ```

- [ ] **7. Open in browser**
  - Navigate to http://localhost:3000
  - Check API health: http://localhost:3000/health

## Environment Configuration

### Required Variables

Create a `.env.development` file with these settings:

```bash
# Database Configuration (PostgreSQL)
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=autoapply
PGPORT=5432

# JWT Secret (for authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Server Configuration
PORT=3000
NODE_ENV=development

# OpenAI API Key (for AI features)
OPENAI_API_KEY=your_openai_api_key_here
```

### Optional Observability & Performance Flags

These new flags control observability features (see [Observability Features](#observability-features)):

```bash
# Performance Logging (new in this release)
PERF_LOG_ENABLED=true           # Enable/disable performance logging
PERF_LOG_SAMPLE_RATE=1.0        # Sampling rate: 0.0 (none) to 1.0 (all requests)
PERF_LOG_INCLUDE_BODY=false     # Include request body in logs (use with caution)

# Debug Endpoint (new in this release)
ADMIN_TOKEN=your-secret-admin-token  # Required for debug endpoints in production

# Debug Mode (enhanced SQL logging)
DEBUG_MODE=true                 # Enable detailed debug logs and SQL queries

# Logging Level
LOG_LEVEL=info                  # Options: error, warn, info, debug
```

### Example Full `.env.development`

```bash
# Database
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=mysecretpassword
PGDATABASE=autoapply
PGPORT=5432

# Authentication
JWT_SECRET=dev-secret-key-change-in-production

# Server
PORT=3000
NODE_ENV=development

# AI
OPENAI_API_KEY=sk-...

# Observability (NEW)
PERF_LOG_ENABLED=true
PERF_LOG_SAMPLE_RATE=1.0
DEBUG_MODE=true
LOG_LEVEL=debug
```

## Development Commands

### Core Commands

```bash
# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run specific test file
npm test -- tests/performanceLogger.test.js
```

### Database Commands

```bash
# Check database connection
npm run db:check

# Run all migrations
npm run db:migrate-all

# Diagnose and fix database issues
npm run db:diagnose

# Initialize fresh database (caution: may drop data)
npm run db:init
```

### Documentation & Schema Commands

```bash
# Verify schema consistency
node scripts/verify-screening-schema.js

# Audit documentation for accuracy
npm run docs:audit

# Generate ER diagram
npm run docs:diagram
```

## Observability Features

### Performance Logging

When `PERF_LOG_ENABLED=true`, every HTTP request logs a structured JSON entry:

```json
{
  "timestamp": "2025-10-09T12:34:56.789Z",
  "correlationId": "abc-123-def-456",
  "method": "POST",
  "route": "/api/wizard/step1",
  "path": "/api/wizard/step1",
  "statusCode": 200,
  "durationMs": 45.32,
  "requestBytes": 512,
  "responseBytes": 1024,
  "userId": 123,
  "dbTimingsMs": [12.5, 8.3, 5.1],
  "dbTotalMs": 25.9
}
```

**Key Fields:**
- `correlationId`: Unique request identifier (from traceId middleware)
- `durationMs`: Total request processing time
- `dbTimingsMs`: Array of individual database query times
- `dbTotalMs`: Sum of all database query times
- `userId`: Authenticated user ID (if available)

### Reading Performance Logs

Performance logs are written to:
- **Console**: Structured JSON, one line per request
- **File**: `logs/combined.log` (if winston is configured)

**Example: Finding slow requests**

```bash
# Find requests taking > 100ms
grep "durationMs" logs/combined.log | jq 'select(.durationMs > 100)'

# Find database bottlenecks
grep "dbTotalMs" logs/combined.log | jq 'select(.dbTotalMs > 50)'
```

### Adding Database Timings to Routes

In your route handlers, inject database timings via `res.locals.dbTimings`:

```javascript
router.post('/api/wizard/step1', async (req, res) => {
    const dbTimings = [];
    
    // Track first query
    const start1 = Date.now();
    await JobPreferences.upsert(userId, data);
    dbTimings.push(Date.now() - start1);
    
    // Track second query
    const start2 = Date.now();
    await User.updateProfile(userId, profile);
    dbTimings.push(Date.now() - start2);
    
    // Inject timings for performance logger
    res.locals.dbTimings = dbTimings;
    
    res.json({ success: true });
});
```

The performance logger middleware will automatically include these timings in the log output.

### Debug Profile Endpoint

The debug profile endpoint provides profile completion diagnostics:

**Endpoint:** `GET /api/debug/profile/:userId`

**Access Control:**
- **Development/Test**: Open access
- **Production**: Requires `X-Admin-Token` header matching `ADMIN_TOKEN` env var

**Example Usage:**

```bash
# Development
curl http://localhost:3000/api/debug/profile/123

# Production
curl -H "X-Admin-Token: your-secret-token" \
  https://api.example.com/api/debug/profile/123
```

**Response:**

```json
{
  "user_id": 123,
  "completion": {
    "percentage": 67,
    "sections": {
      "jobPreferences": true,
      "profile": true,
      "eligibility": false,
      "screening": true
    }
  },
  "calculatedAt": "2025-10-09T12:34:56.789Z",
  "correlationId": "abc-123-def-456"
}
```

## Debugging Wizard Steps

The wizard consists of 4 steps that write to different database tables:

| Step | Route | Table | Model |
|------|-------|-------|-------|
| Step 1 | `POST /api/wizard/step1` | `job_preferences` | `JobPreferences` |
| Step 2 | `POST /api/wizard/step2` | `profile` | `Profile` |
| Step 3 | `POST /api/wizard/step3` | `eligibility` | `Eligibility` |
| Screening | `POST /api/wizard/screening` | `screening_answers` | `ScreeningAnswers` |

### Common Debugging Scenarios

**1. Check if wizard data was saved:**

```bash
# Use debug endpoint
curl http://localhost:3000/api/debug/profile/123

# Or query database directly
psql -d autoapply -c "SELECT * FROM job_preferences WHERE user_id = 123"
```

**2. Test wizard step submission:**

```bash
# Step 1: Job Preferences
curl -X POST http://localhost:3000/api/wizard/step1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "jobTypes": ["full-time", "contract"],
    "jobTitles": ["Software Engineer"],
    "seniorityLevels": ["mid", "senior"]
  }'
```

**3. View complete profile:**

```bash
# GET wizard data (reads from user_complete_profile VIEW)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/wizard/data
```

**4. Enable SQL logging:**

Set `DEBUG_MODE=true` in your `.env.development` to see all SQL queries in logs:

```bash
DEBUG_MODE=true npm run dev
```

You'll see detailed SQL logs like:

```json
{
  "level": "DEBUG",
  "message": "SQL Query",
  "query": "INSERT INTO job_preferences ...",
  "params": [123, "full-time"],
  "duration": "15.3ms"
}
```

### Testing Wizard Form Data Binding

**Problem:** Wizard forms may send empty payloads to the backend if data binding is not working correctly.

**How to Test:**

1. **Open browser console** with DevTools (F12)

2. **Enable detailed logging** by setting debug mode in console:
   ```javascript
   localStorage.setItem('DEBUG_MODE', 'true');
   ```

3. **Navigate to the wizard** at `http://localhost:3000/wizard.html`

4. **Fill in Step 3 (Profile):**
   - Full Name: "Test User"
   - Email: "test@example.com"
   - Phone: "5551234567"
   - Country: "US"
   - City: "New York"

5. **Click "Next"** to go to Step 4

6. **Fill in Step 4 (Eligibility):**
   - Current Job Title: "Software Engineer"
   - Availability: Click "Immediate" pill
   - Eligible Countries: Select "United States"
   - Visa Sponsorship: Click "No" pill

7. **Click "Complete Setup"**

8. **Check browser console** for these logs:
   ```
   🔍 saveAllStepsData() - Collecting data from all steps...
     Step 3: Found X inputs
       ✓ [full-name] = "Test User"
       ✓ [email] = "test@example.com"
       ✓ [phone] = "5551234567"
       ✓ [location-country] = "US"
     Step 4: Found Y inputs
       ✓ [current-job-title] = "Software Engineer"
       ✓ [availability] = "immediate"
   
   📊 Parsed form data:
     step2: { fullName: "Test User", email: "test@example.com", ... }
     step3: { currentJobTitle: "Software Engineer", availability: "immediate", ... }
   
   📤 Sending Step 2 (Profile) to /api/wizard/step2: { ... }
   📤 Sending Step 3 (Eligibility) to /api/wizard/step3: { ... }
   ```

9. **Check backend logs** for:
   ```
   Step 2 data received for user X:
     fullName: "Test User"
     phone: "+15551234567"
     country: "US"
   
   Step 3 data received for user X:
     availability: "immediate"
     currentJobTitle: "Software Engineer"
   ```

**Expected Result:**
- Browser console shows non-empty values being collected
- Backend logs show full payloads (not empty strings)
- Success message appears: "✅ Profile saved successfully!"

**If Data is Empty:**
- Check that all inputs have proper `id` attributes
- Verify `saveAllStepsData()` is being called before `parseFormData()`
- Ensure pill buttons are updating hidden inputs correctly
- Confirm multi-select components are setting hidden input values

**Common Issues:**
- **Empty phone field**: Check that country-code and phone inputs both have values
- **Empty eligibility fields**: Ensure pill buttons have `active` class when clicked
- **Empty multi-select fields**: Verify hidden inputs are being updated by multi-select components

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/wizard-screening.test.js

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

Tests are located in the `/tests` directory:

```
tests/
├── performanceLogger.test.js      # Performance middleware tests
├── debug-profile.test.js          # Debug endpoint tests
├── wizard-screening.test.js       # Wizard screening tests
├── wizard-screening-e2e.test.js   # End-to-end wizard tests
├── api.endpoints.test.js          # API endpoint tests
└── ...
```

### Writing Tests

Follow existing patterns in the test suite. Example test structure:

```javascript
// @ai-meta: endpoint-test
// @ai-meta: endpoint-test (POST /api/wizard/step1)

describe('Wizard Step 1', () => {
  test('should save job preferences', async () => {
    // Test implementation
  });
});
```

## AI Metadata Tags

**What are AI metadata tags?**

AI metadata tags are specially formatted comments that help AI tools understand test intent and coverage. They don't affect code execution or linting.

**Format:**

```javascript
// @ai-meta: <category>
// @ai-meta: <category> (<specific-detail>)
```

**Examples:**

```javascript
// @ai-meta: schema-test
// @ai-meta: endpoint-test (POST /api/wizard/screening)
// @ai-meta: middleware-test
// @ai-meta: performance-logging-test
```

**Common Categories:**

- `schema-test`: Database schema validation tests
- `endpoint-test`: HTTP endpoint tests
- `middleware-test`: Express middleware tests
- `integration-test`: End-to-end integration tests
- `unit-test`: Isolated unit tests

**Usage Guidelines:**

1. Add tags at the **top of test files** (before or after imports)
2. Use **descriptive categories** that match your test's purpose
3. For endpoint tests, **include the HTTP method and route**
4. Tags are **optional** but recommended for better AI assistance
5. Multiple tags are allowed per file

**Example Test File with Tags:**

```javascript
// @ai-meta: endpoint-test
// @ai-meta: endpoint-test (POST /api/wizard/screening)

const request = require('supertest');
const app = require('../src/server');

describe('Wizard Screening Endpoint', () => {
  test('should save screening answers', async () => {
    // Test implementation
  });
});
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Test database connection
npm run db:check

# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Verify environment variables
echo $PGHOST $PGUSER $PGDATABASE
```

### Migrations Not Running

```bash
# Check migration status
node scripts/verify-database.js

# Run migrations manually
npm run db:migrate-all

# If stuck, diagnose and fix
npm run db:diagnose
```

### Performance Logs Not Showing

1. Ensure `PERF_LOG_ENABLED=true` in your `.env` file
2. Restart the server after changing env vars
3. Check that requests are actually hitting your endpoints
4. Verify LOG_LEVEL is not set to ERROR (which filters out INFO logs)

### Debug Endpoint Returns 403

In production:
1. Set `ADMIN_TOKEN` in environment variables
2. Include `X-Admin-Token` header in your request
3. Token must match exactly (case-sensitive)

### Tests Failing

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --verbose

# Run specific failing test
npm test -- tests/your-test.test.js
```

## Additional Resources

- **Architecture**: See `SCHEMA_ARCHITECTURE.md` for database design
- **FAQ**: See `FAQ_SCREENING_DATA.md` for common questions
- **API Reference**: See `README.md` for API documentation
- **Observability**: See `docs/OBSERVABILITY.md` for monitoring features

## Phase 4 - Advanced Observability & Admin Tools

### AutoApply CLI Tool

The `autoapply` CLI provides unified access to common developer tasks:

```bash
# Install CLI globally (optional)
npm link

# Or run directly from project
./bin/autoapply.js <command>

# Or use npx
npx autoapply <command>
```

**Available Commands:**

```bash
# Run schema verification and tests
autoapply verify
autoapply verify --skip-tests

# Summarize performance logs
autoapply perf
autoapply perf --window=24h
autoapply perf --window=7d

# Fetch debug profile for a user
autoapply debug <userId>
autoapply debug 123 --host=myapp.railway.app

# Regenerate documentation
autoapply docs

# Trigger anomaly detection manually
autoapply alerts
```

### Admin Dashboard (`/admin/dashboard`)

The admin dashboard provides real-time system monitoring and configuration:

**Access:** `http://localhost:3000/admin/dashboard`

**Features:**
- **System Health**: Uptime, memory usage, CPU, database status
- **Runtime Configuration**: Toggle debug modes without restart
- **Live Logs**: View and auto-refresh system logs
- **Error Monitoring**: Recent errors and alerts

**Configuration Toggles:**
- `PERF_LOG_ENABLED` - Enable/disable performance logging
- `DEBUG_MODE` - Enable/disable verbose debug logs
- `ALERTS_ENABLED` - Enable/disable performance alerts

**Security:**
- Requires `ADMIN_TOKEN` in environment
- Token must be provided via localStorage or prompt
- All API calls authenticated

### Performance Metrics Dashboard (`/admin/metrics`)

Real-time performance monitoring with live graphs:

**Access:** `http://localhost:3000/admin/metrics`

**Features:**
- **Summary Metrics**: Average response time, DB time, success rate
- **Route Performance**: P95 latency by route
- **Live Streaming**: Server-Sent Events (SSE) for real-time updates
- **Historical Data**: Configurable time windows (15min to 24h)

**API Endpoints:**
```bash
# Get performance summary (requires ADMIN_TOKEN)
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/metrics/summary?window=1

# Stream live metrics
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/metrics/live
```

### Performance Alerting

Automatic anomaly detection runs daily via GitHub Actions:

**Configuration:**
```bash
# .env or GitHub Secrets
ALERTS_ENABLED=true
ALERTS_SLACK_WEBHOOK=https://hooks.slack.com/services/...
ALERTS_THRESHOLD_MS=500
```

**Anomaly Detection Rules:**
- Request duration > 500ms (configurable)
- Database time > 100ms
- Spikes > 3x rolling average

**Manual Trigger:**
```bash
node scripts/analyze-performance-logs.js
```

**Reports:** Saved to `reports/performance-anomalies-YYYY-MM-DD.json`

### Schema Drift Detection

Automatically detect and fix schema inconsistencies:

**Run Detection:**
```bash
node scripts/detect-schema-drift.js
```

**Output:**
- Console report of drift issues
- SQL patch file: `reports/schema-drift-YYYY-MM-DD.sql`

**Auto-Migration (Disabled by Default):**
```bash
AUTO_MIGRATION_ENABLED=false  # Set to true for PR generation
```

### AI-Assisted Trace Analysis

Weekly AI-powered performance optimization recommendations:

**Configuration:**
```bash
OPENAI_API_KEY=sk-...
TRACE_ANALYSIS_ENABLED=true
TRACE_ANALYSIS_PERIOD_HOURS=168  # Default: 7 days
```

**Manual Run:**
```bash
node scripts/analyze-traces-with-ai.js
node scripts/analyze-traces-with-ai.js --period=48
```

**Output:**
- Markdown report: `reports/ai-trace-report-YYYY-MM-DD.md`
- Performance statistics (mean, median, P95, P99)
- AI-generated optimization recommendations

**Workflow:** Runs automatically every Sunday at 2 AM UTC

### Environment Variables Reference

#### Phase 4 Variables

```bash
# Admin Access
ADMIN_TOKEN=your-secret-token           # Required for admin endpoints

# Performance Alerts
ALERTS_ENABLED=false                    # Enable automatic alerting
ALERTS_SLACK_WEBHOOK=                   # Slack webhook URL
ALERTS_THRESHOLD_MS=500                 # Anomaly threshold

# Schema Management
AUTO_MIGRATION_ENABLED=false            # Enable auto-PR for drift fixes

# AI Trace Analysis
TRACE_ANALYSIS_ENABLED=false            # Enable AI analysis
TRACE_ANALYSIS_PERIOD_HOURS=24          # Analysis time window

# OpenAI
OPENAI_API_KEY=                         # Required for AI features
```

### Debugging Workflows

#### Investigate Slow Endpoints

1. **Enable performance logging:**
   ```bash
   PERF_LOG_ENABLED=true
   ```

2. **Generate some traffic**

3. **Run anomaly detection:**
   ```bash
   autoapply alerts
   ```

4. **Review report:**
   ```bash
   cat reports/performance-anomalies-*.json
   ```

5. **Get AI recommendations:**
   ```bash
   TRACE_ANALYSIS_ENABLED=true node scripts/analyze-traces-with-ai.js
   ```

#### Monitor Production Issues

1. **Access admin dashboard:**
   ```
   https://yourapp.railway.app/admin/dashboard
   ```

2. **Check system health**

3. **Review error logs** (auto-refresh enabled)

4. **Toggle debug mode** if needed (temporary)

5. **Check metrics dashboard** for performance trends

#### Detect Schema Issues

1. **Run verification:**
   ```bash
   autoapply verify
   ```

2. **Check drift detection:**
   ```bash
   node scripts/detect-schema-drift.js
   ```

3. **Review SQL patch** in `reports/`

4. **Apply manually** after review

### GitHub Actions Workflows

#### Performance Alerts (Daily)
- **Schedule**: Daily at 4 AM UTC
- **Path**: `.github/workflows/performance-alerts.yml`
- **Output**: Artifact + GitHub issue (if critical)

#### AI Trace Analysis (Weekly)
- **Schedule**: Weekly on Sunday at 2 AM UTC
- **Path**: `.github/workflows/trace-analysis.yml`
- **Output**: Markdown report artifact

### Best Practices

1. **Enable performance logging in development** to catch issues early
2. **Use CLI for routine tasks** instead of manual commands
3. **Check admin dashboard before deploying** to production
4. **Review AI recommendations weekly** for optimization opportunities
5. **Set up Slack alerts** for production anomalies
6. **Keep ADMIN_TOKEN secure** and rotate regularly
7. **Monitor schema drift** before major migrations
8. **Use metrics dashboard** to validate performance improvements

## Getting Help

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the `/docs` folder for detailed guides

---

**Welcome to the team! Happy coding! 🚀**
