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

## Getting Help

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the `/docs` folder for detailed guides

---

**Welcome to the team! Happy coding! 🚀**
