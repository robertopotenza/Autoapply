# Admin Dashboard Access Manual

## Overview

The Admin Dashboard (`/admin/dashboard`) is a secure, real-time system monitoring and configuration interface for the AutoApply platform. It provides comprehensive insights into system health, runtime configuration management, live log viewing, and error monitoring.

**Dashboard URL:**
- Local Development: `http://localhost:3000/admin/dashboard`
- Production: `https://your-domain.com/admin/dashboard`

---

## Quick Start

**For users who want to get started immediately:**

1. **Generate an admin token:**
   ```bash
   openssl rand -hex 32
   ```

2. **Add to environment variables:**
   ```bash
   # Add to .env file
   ADMIN_TOKEN=your-generated-token
   ```

3. **Restart the server:**
   ```bash
   npm run dev  # or your production restart command
   ```

4. **Access the dashboard:**
   - Navigate to `http://localhost:3000/admin/dashboard`
   - Enter your admin token when prompted
   - Start monitoring your system!

**Read the full guide below for detailed setup, features, and troubleshooting.**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Accessing the Dashboard](#accessing-the-dashboard)
4. [Dashboard Layout](#dashboard-layout)
5. [Dashboard Features](#dashboard-features)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

---

## Prerequisites

Before accessing the Admin Dashboard, ensure you have:

1. **Admin Token**: A secure token configured in your environment
2. **Administrator Privileges**: Authorization to access sensitive system information
3. **Network Access**: Ability to reach the application server
4. **Modern Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)

---

## Initial Setup

### Step 1: Configure the Admin Token

The Admin Dashboard requires an `ADMIN_TOKEN` environment variable to be set for authentication.

#### Generate a Secure Token

```bash
# Generate a random secure token (recommended)
openssl rand -hex 32
```

#### Set the Environment Variable

**For Local Development:**

Add to your `.env.development` or `.env` file:

```bash
ADMIN_TOKEN=your-generated-token-here
```

**For Production (Railway):**

1. Go to your Railway project dashboard
2. Navigate to **Variables** section
3. Add a new variable:
   - **Name**: `ADMIN_TOKEN`
   - **Value**: Your generated token
4. Click **Add** and redeploy if necessary

**For Other Platforms:**

Set the environment variable according to your hosting platform's documentation:
- **Heroku**: `heroku config:set ADMIN_TOKEN=your-token`
- **AWS**: Add to Lambda environment or ECS task definition
- **Docker**: Use `-e ADMIN_TOKEN=your-token` or docker-compose environment section

#### Verify Configuration

```bash
# Check if ADMIN_TOKEN is set
echo $ADMIN_TOKEN

# Or test with the health endpoint
curl -H "X-Admin-Token: your-token" http://localhost:3000/api/admin/status
```

### Step 2: Restart the Server

After setting the `ADMIN_TOKEN`, restart your application server:

```bash
# Local development
npm run dev

# Production (depends on your deployment method)
# Railway: Will auto-restart after environment variable change
```

---

## Accessing the Dashboard

### Method 1: Direct Browser Access (Recommended)

1. **Navigate to the Admin Dashboard URL:**
   ```
   http://localhost:3000/admin/dashboard
   ```
   or
   ```
   https://your-production-domain.com/admin/dashboard
   ```

2. **Enter Your Admin Token:**
   - On first visit, you'll be prompted to enter your admin token
   - The token will be stored in browser's localStorage for convenience
   - Enter the same token you configured in the environment variables

3. **Access Granted:**
   - The dashboard will load and display system information
   - The token is sent with every API request via the `X-Admin-Token` header

### Method 2: Pre-configure Token in Browser Console

If you want to avoid the prompt, you can set the token directly:

1. Open browser Developer Tools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Run:
   ```javascript
   localStorage.setItem('ADMIN_TOKEN', 'your-admin-token-here');
   ```
4. Refresh the page

### Method 3: API Access

You can also access dashboard data programmatically:

```bash
# Get system status
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/admin/status

# Get current configuration
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/admin/config

# View logs
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/admin/logs?type=combined&lines=100
```

---

## Dashboard Layout

When you first access the Admin Dashboard, you'll see a clean, modern interface with the following sections:

### Header
- **Title**: "AutoApply - Admin Dashboard"
- **System Status Badge**: Shows overall system health (✅ Healthy, ⚠️ Issues Detected, ❌ Error)
- **Refresh Button**: Manually reload all dashboard data

### Main Dashboard Cards

The dashboard is organized into several cards displaying different information:

1. **System Health** (Top Left)
   - Uptime counter
   - Node.js version
   - Memory usage metrics
   - CPU information

2. **Database Status** (Top Center)
   - Connection status indicator
   - Schema validation status
   - Recent database errors (if any)

3. **Configuration** (Top Right)
   - Toggle switches for runtime settings
   - Save button to apply changes
   - Current configuration values

4. **Recent Errors** (Middle)
   - List of recent error messages
   - Timestamps and correlation IDs
   - Error severity indicators

5. **Logs Viewer** (Bottom - Full Width)
   - Log type selector (Combined/Error)
   - Line count control
   - Refresh and auto-refresh controls
   - Scrollable log display with syntax highlighting

### Color Coding

- **Green/Blue**: Healthy status, informational messages
- **Yellow/Orange**: Warnings, items requiring attention
- **Red**: Errors, critical issues
- **Purple**: Interactive elements, links

---

## Dashboard Features

### 1. System Health Monitoring

The dashboard displays real-time system health metrics:

#### **Uptime Tracking**
- Shows how long the server has been running
- Format: `Xd Xh Xm Xs` (days, hours, minutes, seconds)
- Useful for monitoring stability and detecting unexpected restarts

#### **Memory Usage**
- **Heap Used**: Current JavaScript heap memory usage
- **Heap Total**: Total allocated heap memory
- **RSS (Resident Set Size)**: Total memory allocated by the process
- **Total System Memory**: Available system memory
- **Free Memory**: Remaining available system memory

#### **CPU Information**
- Number of CPU cores
- Helps assess system capacity and performance

#### **Database Status**
- **Connection Status**: `connected`, `disconnected`, or `error`
- **Schema Status**: `valid`, `incomplete`, or `unknown`
- Verifies database connectivity and schema integrity

#### **Recent Errors**
- Displays last 5 errors from error logs
- Shows timestamp, level, message, and correlation ID
- Helps quickly identify system issues

### 2. Runtime Configuration

Toggle system settings without restarting the server:

#### **Available Toggles:**

**PERF_LOG_ENABLED**
- Enables/disables performance logging
- When enabled, logs request duration, database timings, and performance metrics
- Useful for debugging performance issues
- Default: `false`

**DEBUG_MODE**
- Enables/disables verbose debug logging
- Shows detailed SQL queries, request/response data, and internal state
- Default: `false`
- ⚠️ **Warning**: May expose sensitive data in logs

**ALERTS_ENABLED**
- Enables/disables performance alert notifications
- When enabled, sends alerts for anomalies (slow requests, database issues)
- Requires `ALERTS_SLACK_WEBHOOK` to be configured
- Default: `false`

#### **How to Use:**

1. Locate the **Configuration** card on the dashboard
2. Toggle the switches for the desired settings
3. Click **Save Configuration**
4. Changes take effect immediately without restart
5. Monitor the success/error message for confirmation

#### **Current Values:**
The dashboard shows both:
- **Runtime Configuration**: Values from `config/runtime.json`
- **Environment Variables**: Current environment values

### 3. Live Log Viewer

View and monitor system logs in real-time:

#### **Features:**

**Log Type Selection**
- **Combined Logs**: All application logs (info, warn, error)
- **Error Logs**: Only error-level logs

**Line Count Control**
- Choose between 50 to 500 lines
- Default: 50 lines
- Shows most recent logs (tail behavior)

**Auto-Refresh**
- Toggle automatic log refresh
- Refreshes every 5 seconds when enabled
- Useful for monitoring live system activity

**Syntax Highlighting**
- Color-coded log levels:
  - 🔵 **INFO**: Blue
  - 🟡 **WARN**: Yellow  
  - 🔴 **ERROR**: Red

#### **How to Use:**

1. Locate the **Logs** section at the bottom of the dashboard
2. Select log type from dropdown (Combined or Error)
3. Adjust line count if needed
4. Click **Refresh** to manually update logs
5. Enable **Auto-Refresh** for live monitoring
6. Scroll through logs to investigate issues

### 4. Error Monitoring

Track recent system errors:

#### **Recent Errors Card:**
- Shows the last 10 errors from error.log
- Displays:
  - Error message
  - Timestamp
  - Log level
  - Correlation ID (for request tracking)

#### **Use Cases:**
- Quick error diagnosis
- Identifying recurring issues
- Correlating errors with specific requests
- Monitoring error frequency

---

## Security Best Practices

### Token Management

1. **Use Strong Tokens**
   - Generate tokens with at least 32 characters
   - Use cryptographically secure random generators
   - Never use predictable values

2. **Keep Tokens Secret**
   - Never commit tokens to version control
   - Don't share tokens in chat, email, or documentation
   - Use environment variables, never hardcode

3. **Rotate Tokens Regularly**
   - Change tokens periodically (e.g., every 90 days)
   - Rotate immediately if compromised
   - Update all systems using the token

4. **Limit Access**
   - Only share with authorized administrators
   - Use separate tokens for different environments (dev, staging, prod)
   - Revoke access when team members leave

### Network Security

1. **Use HTTPS in Production**
   - Never access admin dashboard over HTTP in production
   - Ensure SSL/TLS certificates are valid
   - Consider using VPN for additional security

2. **IP Whitelisting** (Optional)
   - Configure firewall rules to restrict access
   - Allow only known IP addresses
   - Use VPN or bastion hosts for remote access

3. **Monitor Access Logs**
   - Review admin dashboard access regularly
   - Look for unauthorized access attempts
   - Set up alerts for suspicious activity

### Browser Security

1. **Clear Token When Done**
   ```javascript
   localStorage.removeItem('ADMIN_TOKEN');
   ```

2. **Use Incognito/Private Mode**
   - Prevents token persistence
   - Clears session data automatically

3. **Secure Your Workstation**
   - Lock screen when away
   - Use strong passwords
   - Keep software updated

---

## Troubleshooting

### Cannot Access Dashboard (403 Forbidden)

**Symptom:** Dashboard shows "Forbidden" or "Invalid admin token" error

**Possible Causes & Solutions:**

1. **ADMIN_TOKEN not configured**
   - Verify token is set: `echo $ADMIN_TOKEN`
   - Add token to environment variables
   - Restart server after adding token

2. **Token mismatch**
   - Token in browser doesn't match server token
   - Clear browser token: `localStorage.removeItem('ADMIN_TOKEN')`
   - Re-enter correct token from environment

3. **Token not loaded in environment**
   - Check `.env` file location
   - Ensure no extra spaces: `ADMIN_TOKEN=token` not `ADMIN_TOKEN = token`
   - Check if `.env` is loaded (use `dotenv` package)

### Dashboard Shows "Admin dashboard is disabled"

**Symptom:** Error message: "ADMIN_TOKEN not configured"

**Solution:**
- Set `ADMIN_TOKEN` in environment variables
- Restart the application server
- Verify with: `curl http://localhost:3000/api/admin/status` (should return 403 with message)

### Dashboard Loads but Shows No Data

**Possible Causes & Solutions:**

1. **API calls failing**
   - Check browser console (F12) for errors
   - Look for CORS issues or network errors
   - Verify API endpoints are accessible

2. **Token not sent in requests**
   - Ensure token is in localStorage
   - Check Network tab in browser DevTools
   - Look for `X-Admin-Token` header in requests

3. **Server errors**
   - Check server logs for errors
   - Verify database connectivity
   - Ensure all dependencies are running

### Configuration Changes Not Taking Effect

**Possible Causes & Solutions:**

1. **Save not confirmed**
   - Look for success/error message after clicking "Save"
   - Check browser console for errors

2. **Permission issues**
   - Verify `config/runtime.json` is writable
   - Check file permissions: `ls -la config/runtime.json`
   - Ensure application has write access

3. **Cache issues**
   - Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear browser cache
   - Check if configuration file was updated

### Logs Not Showing

**Possible Causes & Solutions:**

1. **Log files don't exist**
   - Create logs directory: `mkdir -p logs`
   - Ensure application has write permissions
   - Check logging configuration

2. **Empty log files**
   - Generate activity by using the application
   - Verify logging is enabled
   - Check `PERF_LOG_ENABLED` and log level settings

3. **Wrong log path**
   - Verify log file location: `logs/combined.log` or `logs/error.log`
   - Check if custom log path is configured

### Performance Issues

**Symptom:** Dashboard is slow or unresponsive

**Solutions:**

1. **Reduce log line count**
   - Use 50-100 lines instead of 500
   - Disable auto-refresh when not needed

2. **Check system resources**
   - Monitor CPU and memory usage
   - Ensure server has adequate resources
   - Check for other processes consuming resources

3. **Database performance**
   - Verify database connection is healthy
   - Check for slow queries
   - Optimize database if needed

---

## API Reference

### Authentication

All admin API endpoints require authentication via the `X-Admin-Token` header:

```bash
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/admin/{endpoint}
```

### GET /api/admin/status

Returns comprehensive system health and status information.

**Request:**
```bash
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/admin/status
```

**Response:**
```json
{
  "uptime": 86400,
  "uptimeFormatted": "1d 0h 0m 0s",
  "memory": {
    "heapUsed": 45,
    "heapTotal": 60,
    "rss": 120,
    "totalMemory": 8192,
    "freeMemory": 4096
  },
  "system": {
    "cpus": 4,
    "totalMemory": 8192,
    "freeMemory": 4096
  },
  "database": {
    "status": "connected",
    "schemaStatus": "valid"
  },
  "recentErrors": [
    {
      "timestamp": "2025-10-09T12:00:00Z",
      "level": "error",
      "message": "Database query timeout",
      "correlationId": "abc-123"
    }
  ],
  "timestamp": "2025-10-09T12:00:00Z"
}
```

### GET /api/admin/config

Returns current runtime configuration and environment values.

**Request:**
```bash
curl -H "X-Admin-Token: your-token" \
  http://localhost:3000/api/admin/config
```

**Response:**
```json
{
  "runtimeConfig": {
    "PERF_LOG_ENABLED": true,
    "DEBUG_MODE": false,
    "ALERTS_ENABLED": false
  },
  "currentEnv": {
    "PERF_LOG_ENABLED": true,
    "DEBUG_MODE": false,
    "ALERTS_ENABLED": false
  },
  "timestamp": "2025-10-09T12:00:00Z"
}
```

### PUT /api/admin/config

Updates runtime configuration settings.

**Request:**
```bash
curl -X PUT \
  -H "X-Admin-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"PERF_LOG_ENABLED": true, "DEBUG_MODE": false, "ALERTS_ENABLED": true}' \
  http://localhost:3000/api/admin/config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "PERF_LOG_ENABLED": true,
    "DEBUG_MODE": false,
    "ALERTS_ENABLED": true
  },
  "message": "Configuration updated successfully"
}
```

### GET /api/admin/logs

Returns recent log entries with filtering options.

**Query Parameters:**
- `type`: Log type - `combined` (default) or `error`
- `lines`: Number of lines to return (default: 50, max: 500)

**Request:**
```bash
curl -H "X-Admin-Token: your-token" \
  "http://localhost:3000/api/admin/logs?type=error&lines=100"
```

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-10-09T12:00:00Z",
      "level": "error",
      "message": "Failed to connect to database",
      "correlationId": "xyz-789",
      "metadata": {}
    }
  ],
  "count": 100,
  "type": "error",
  "timestamp": "2025-10-09T12:00:00Z"
}
```

---

## Related Documentation

- **[Phase 4 Summary](PHASE_4_SUMMARY.md)** - Complete Phase 4 implementation details
- **[Developer Onboarding](docs/DEVELOPER_ONBOARDING.md)** - Developer setup guide
- **[Observability Guide](docs/OBSERVABILITY.md)** - Monitoring and debugging features
- **[README](README.md)** - Main project documentation

---

## Support

If you encounter issues not covered in this manual:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review server logs for detailed error messages
3. Consult the [Developer Onboarding Guide](docs/DEVELOPER_ONBOARDING.md)
4. Open an issue on GitHub with:
   - Steps to reproduce
   - Error messages
   - Environment details (OS, Node version, etc.)
   - Relevant log excerpts

---

**Last Updated:** 2025-10-09  
**Version:** 1.0.0
