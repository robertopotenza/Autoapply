# Logging and Error Tracking Configuration

This document describes the logging and error tracking features added to the Apply Autonomously platform.

## Log Persistence

### Overview
The application now persists logs to the `/logs` directory with automatic rotation to prevent disk space issues.

### Configuration

#### Environment Variables
- `NODE_ENV`: Set to `production` to enable rotating file logs
- `LOG_LEVEL`: Set the logging level (default: `info`). Options: `error`, `warn`, `info`, `debug`

#### Production Logging
When `NODE_ENV=production`, the logger automatically:
- Creates rotating log files in `/logs` directory
- Rotates logs daily (keeping 30 days for combined logs, 14 days for error logs)
- Compresses old log files to save space
- Limits log file size to 20MB before rotation

#### Log Files
- **error-YYYY-MM-DD.log**: Contains only error-level logs
- **combined-YYYY-MM-DD.log**: Contains all log levels (info, warn, error, debug)

#### Development Logging
In non-production environments:
- Logs are written to simple files (`error.log` and `combined.log`)
- Console output is enabled for immediate feedback
- No rotation is applied

### Usage Example

```javascript
const { Logger } = require('./utils/logger');

const logger = new Logger('MyComponent');

logger.info('Application started');
logger.warn('Configuration not optimal');
logger.error('Failed to connect to service');
logger.debug('Debug information', { details: 'some data' });
```

## Sentry Integration (Optional)

### Overview
Sentry is integrated for advanced error tracking and monitoring in production. It captures:
- Unhandled exceptions
- Unhandled promise rejections
- HTTP request traces (optional)
- Custom error reports

### Configuration

#### Environment Variables
- `SENTRY_DSN`: Your Sentry project DSN (required to enable Sentry)
- `SENTRY_TRACES_SAMPLE_RATE`: Percentage of requests to trace (default: `1.0` = 100%)

#### Setup Steps

1. **Create a Sentry account** (if you don't have one):
   - Go to https://sentry.io/
   - Create a new project
   - Select "Node.js" as the platform

2. **Get your DSN**:
   - In your Sentry project settings, find the "Client Keys (DSN)" section
   - Copy the DSN URL

3. **Configure the application**:
   ```bash
   # Add to your .env file
   SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
   SENTRY_TRACES_SAMPLE_RATE=1.0
   ```

4. **Restart the application**:
   - Sentry will automatically initialize on startup
   - You'll see a confirmation message: "✅ Sentry initialized for error tracking"

### What Gets Reported to Sentry

- **Unhandled Exceptions**: Any uncaught errors in the application
- **Unhandled Rejections**: Promise rejections that aren't caught
- **HTTP Errors**: Errors in API endpoints and middleware
- **Custom Errors**: Errors manually reported via logger

### Disabling Sentry

To disable Sentry, simply remove or comment out the `SENTRY_DSN` environment variable. The application will run normally without Sentry integration.

## Directory Structure

```
/logs/
  ├── .gitkeep                    # Ensures directory is preserved in git
  ├── error-2025-10-06.log       # Daily error logs (production)
  ├── combined-2025-10-06.log    # Daily combined logs (production)
  ├── error.log                  # Simple error log (development)
  └── combined.log               # Simple combined log (development)
```

## Audit and Compliance

### Log Retention
- **Error logs**: Retained for 14 days
- **Combined logs**: Retained for 30 days
- **Compressed archives**: Older logs are automatically compressed

### Accessing Logs
Logs are available in the `/logs` directory and can be:
- Viewed directly on the server
- Downloaded for offline analysis
- Integrated with log aggregation tools (e.g., Datadog, Splunk)

### Log Format
All logs are written in JSON format for easy parsing:

```json
{
  "level": "error",
  "message": "Failed to connect to database",
  "service": "apply-autonomously",
  "context": "Server",
  "timestamp": "2025-10-06T00:34:15.466Z",
  "args": []
}
```

## Troubleshooting

### Logs directory not created
The application automatically creates the `/logs` directory on startup. If it doesn't exist:
1. Check file system permissions
2. Ensure the application has write access to its working directory

### Sentry not working
1. Verify `SENTRY_DSN` is set correctly
2. Check that `@sentry/node` package is installed
3. Ensure network connectivity to Sentry servers
4. Check application logs for Sentry initialization messages

### Large log files
If log files grow too large:
1. Reduce `LOG_LEVEL` (e.g., from `debug` to `info`)
2. Check for excessive logging in application code
3. Verify rotation is working (production mode only)

## Best Practices

1. **Production**: Always set `NODE_ENV=production` for automatic log rotation
2. **Monitoring**: Regularly check logs for errors and warnings
3. **Sentry**: Use Sentry for production environments to catch errors early
4. **Log Levels**: Use appropriate log levels:
   - `error`: Critical failures that need immediate attention
   - `warn`: Issues that should be investigated but don't stop operation
   - `info`: Important events in the application lifecycle
   - `debug`: Detailed information for troubleshooting (avoid in production)

## Security Considerations

- Log files may contain sensitive information - ensure proper access controls
- Never log passwords, tokens, or API keys
- Use `.gitignore` to prevent committing log files to version control
- Regularly review and purge old logs as per your data retention policy
