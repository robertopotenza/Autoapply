# Admin Token Storage Documentation

## Overview

This document explains where and how the admin token is stored in the AutoApply application.

## Storage Locations

### Server-Side Storage

The admin token on the server is stored as an **environment variable**:

- **Variable Name**: `ADMIN_TOKEN`
- **Access Method**: `process.env.ADMIN_TOKEN`
- **Location**: Set in environment configuration files or hosting platform
  - Local Development: `.env`, `.env.development`
  - Production (Railway): Environment Variables in Railway dashboard
  - Other Platforms: Platform-specific environment variable configuration

**Code Reference**: `src/routes/admin-dashboard.js` (line 30)
```javascript
const expectedToken = process.env.ADMIN_TOKEN;
```

### Client-Side Storage

The admin token on the client (browser) is stored in **browser localStorage**:

- **Storage Key**: `'ADMIN_TOKEN'`
- **Storage API**: `localStorage.setItem('ADMIN_TOKEN', token)`
- **Retrieval**: `localStorage.getItem('ADMIN_TOKEN')`

**Code References**: `public/admin-dashboard.html`
- Line 415: Token from URL parameter is stored
- Line 420: Token retrieved from localStorage
- Line 422: Token stored to localStorage after prompt
- Line 585: Token retrieved for config update requests
- Line 626: Token retrieved for config polling requests

### Token Flow

1. **Initial Setup**: Administrator sets `ADMIN_TOKEN` environment variable on server
2. **First Access**: User navigates to `/admin/dashboard`
3. **Token Input**: User provides token via:
   - URL query parameter: `?token=your-admin-token`
   - Browser prompt (if not in localStorage)
   - Previously stored in localStorage
4. **Token Storage**: Token is saved to browser's localStorage with key `'ADMIN_TOKEN'`
5. **Authentication**: Token is sent with every API request via `X-Admin-Token` header
6. **Verification**: Server validates token against `process.env.ADMIN_TOKEN`

## Security Considerations

### Environment Variable Security (Server)

✅ **Best Practices:**
- Never commit tokens to version control
- Use strong, randomly generated tokens (32+ characters)
- Use platform-specific secret management
- Rotate tokens regularly
- Use different tokens for different environments

❌ **Avoid:**
- Hardcoding tokens in source code
- Sharing tokens in plain text
- Using predictable values
- Committing `.env` files to git

### localStorage Security (Client)

✅ **Best Practices:**
- Clear token when done: `localStorage.removeItem('ADMIN_TOKEN')`
- Use incognito/private browsing for sensitive operations
- Access dashboard only over HTTPS in production
- Lock workstation when away

❌ **Avoid:**
- Accessing dashboard over HTTP in production
- Leaving tokens in localStorage on shared computers
- Sharing browser sessions with unauthorized users

## Recent Fix: localStorage Key Consistency

**Issue**: The admin dashboard had an inconsistency where:
- Token was stored with key `'ADMIN_TOKEN'`
- Some functions retrieved token with key `'adminToken'` (incorrect)

This caused authentication failures when:
- Updating configuration settings
- Polling configuration state

**Fix**: All localStorage references now consistently use `'ADMIN_TOKEN'` key.

**Affected Functions**:
- `updateConfig()` - Fixed to use `'ADMIN_TOKEN'`
- `startConfigPolling()` - Fixed to use `'ADMIN_TOKEN'`

## Troubleshooting

### Token Not Working

1. **Verify environment variable is set:**
   ```bash
   echo $ADMIN_TOKEN
   ```

2. **Check browser localStorage:**
   ```javascript
   // Open browser console (F12)
   localStorage.getItem('ADMIN_TOKEN')
   ```

3. **Clear and re-enter token:**
   ```javascript
   localStorage.removeItem('ADMIN_TOKEN');
   // Refresh page and enter token again
   ```

4. **Verify token matches:**
   - Token in browser must exactly match server environment variable
   - Check for extra spaces or line breaks

### Config Updates Not Working

If configuration updates fail with 403 Forbidden:
- Ensure localStorage key is `'ADMIN_TOKEN'` (not `'adminToken'`)
- Verify token is present: `localStorage.getItem('ADMIN_TOKEN')`
- Check browser console for errors
- Verify token hasn't expired or been changed on server

## Related Documentation

- [Admin Dashboard Manual](ADMIN_DASHBOARD_MANUAL.md) - Complete admin dashboard guide
- [Security Best Practices](ADMIN_DASHBOARD_MANUAL.md#security-best-practices) - Token security guidelines
- [Troubleshooting Guide](ADMIN_DASHBOARD_MANUAL.md#troubleshooting) - Common issues and solutions

## API Reference

All admin API endpoints require the admin token in the request header:

```bash
curl -H "X-Admin-Token: your-token-here" \
  http://localhost:3000/api/admin/status
```

**Header Name**: `X-Admin-Token`  
**Header Value**: Token from `localStorage.getItem('ADMIN_TOKEN')` or environment variable

## Summary

| Location | Storage Type | Key/Variable Name | Access Method |
|----------|--------------|-------------------|---------------|
| Server | Environment Variable | `ADMIN_TOKEN` | `process.env.ADMIN_TOKEN` |
| Client | Browser localStorage | `'ADMIN_TOKEN'` | `localStorage.getItem('ADMIN_TOKEN')` |
| API Requests | HTTP Header | `X-Admin-Token` | Request header |

**Last Updated**: 2025-10-09  
**Version**: 1.0.0
