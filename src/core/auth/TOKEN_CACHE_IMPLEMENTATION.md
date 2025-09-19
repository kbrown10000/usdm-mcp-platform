# Token Cache Implementation

## Overview

This document describes the disk-based token caching module implemented for the MSAL authentication system. The cache provides persistent storage of authentication tokens to improve user experience and reduce authentication frequency.

## Key Features

### 1. Disk-Based Caching
- **Location**: `.cache/msal/` relative to `process.cwd()`
- **Format**: JSON files with structured token data
- **TTL**: 1 hour from creation (configurable)
- **Auto-cleanup**: Expired entries removed on access

### 2. Cache Key Generation
- **Format**: `msal_<tenant>_<client>_<sha256(scopes).substring(0,8)>.json`
- **Hashing**: SHA-256 for scope uniqueness
- **Consistency**: Sorted scopes ensure consistent keys

### 3. Retry Logic with Exponential Backoff
- **Max Retries**: 3 attempts
- **Base Delay**: 1000ms
- **Backoff Pattern**: 1s → 2s → 4s
- **Applied to**: All token acquisition operations

### 4. Increased Device Code Timeout
- **Old Timeout**: 5 seconds (50 × 100ms)
- **New Timeout**: 20 seconds (200 × 100ms)
- **Purpose**: Provides more time for MSAL to return device code

## File Structure

```
C:\DevOpps\MCP-PLATFORM\src\core\auth\
├── msal-auth.mjs           # Updated MSAL authentication with cache integration
├── token-cache.mjs         # Token cache module
├── test-token-cache.mjs    # Test suite for cache functionality
└── TOKEN_CACHE_IMPLEMENTATION.md  # This documentation
```

## Cache Entry Structure

```json
{
  "tokens": {
    "powerbi": "eyJ0eXAi...",
    "graph": "eyJ0eXAi...",
    "usdm": "eyJ0eXAi..."
  },
  "account": {
    "username": "user@domain.com",
    "tenantId": "18c250cf-2ef7-4eeb-b6fb-94660f7867e0",
    "homeAccountId": "...",
    "environment": "...",
    "localAccountId": "...",
    "name": "User Name"
  },
  "timestamp": 1735252800000,
  "expiry": 1735256400000,
  "metadata": {
    "tenant": "18c250cf-2ef7-4eeb-b6fb-94660f7867e0",
    "client": "8b84dc3b-a9ff-43ed-9d35-571f757e9c19",
    "scopes": ["User.Read", "offline_access", "..."],
    "cacheVersion": "1.0"
  }
}
```

## API Reference

### token-cache.mjs

#### `getCacheKey(tenant, client, scopes)`
Generates a deterministic cache key based on tenant, client, and scopes.

#### `save(tokens, account, tenant, client, scopes)`
Saves tokens and account information to disk cache.

#### `load(tenant, client, scopes)`
Loads tokens from cache. Returns null if expired or missing.

#### `clear(tenant, client, scopes)`
Removes a specific cache entry.

#### `clearAll()`
Removes all cache entries.

#### `getCacheStats()`
Returns statistics about cached entries.

### msal-auth.mjs Updates

#### Cache Integration
- `startLogin()` - Checks cache before initiating device flow
- `logout()` - Clears cache for current account
- `refreshTokens()` - Updates cache with refreshed tokens

#### New Functions
- `getCacheStats()` - Returns cache statistics
- `clearAllCaches()` - Clears all caches and in-memory tokens

#### Retry Logic
- Applied to `acquireTokenSilent()` calls
- Automatic retry with exponential backoff
- Improves resilience against transient failures

## Usage Examples

### Basic Authentication with Cache

```javascript
import * as auth from './msal-auth.mjs';

// Start login (will use cache if available)
const result = await auth.startLogin();

if (result.cached) {
  console.log('Using cached authentication');
  console.log('User:', result.username);
} else if (result.success) {
  console.log('Device code:', result.deviceCode);
  // User completes device flow
  // Tokens are automatically cached
}
```

### Check Cache Statistics

```javascript
const stats = await auth.getCacheStats();
console.log('Total cached entries:', stats.totalEntries);

stats.entries.forEach(entry => {
  console.log(`User: ${entry.username}`);
  console.log(`Expires in: ${entry.remainingMinutes} minutes`);
});
```

### Clear Cache

```javascript
// Clear specific account cache (done automatically on logout)
await auth.logout();

// Clear all caches
await auth.clearAllCaches();
```

## Testing

Run the test suite to verify functionality:

```bash
node test-token-cache.mjs
```

The test suite covers:
1. Cache statistics retrieval
2. Cache key generation
3. Authentication with cache
4. User profile retrieval
5. Cache persistence after authentication
6. Logout and cache clearing

## Security Considerations

1. **File Permissions**: Cache files are created with default OS permissions
2. **Token Storage**: Tokens stored in plaintext JSON (consider encryption for production)
3. **Cache Location**: `.cache/msal/` should be added to `.gitignore`
4. **TTL Management**: 1-hour expiry prevents stale tokens
5. **Scope Isolation**: Different scope combinations use different cache keys

## Design Decisions

### Why SHA-256 for Cache Keys?
- Provides unique, fixed-length identifiers
- Handles variable-length scope arrays
- Prevents filesystem issues with special characters

### Why 1-Hour TTL?
- Balances user convenience with security
- Aligns with typical token lifetimes
- Prevents accumulation of stale data

### Why Exponential Backoff?
- Reduces load on authentication servers
- Handles transient network issues gracefully
- Improves overall reliability

### Why 20-Second Timeout?
- MSAL sometimes takes >5 seconds to return device code
- Provides buffer for slow network conditions
- Prevents premature timeout failures

## Future Enhancements

1. **Encryption**: Encrypt cached tokens at rest
2. **Compression**: Compress large token payloads
3. **Multi-User Support**: Handle multiple accounts per tenant/client
4. **Cache Rotation**: Implement LRU eviction for cache size management
5. **Metrics**: Add performance metrics and monitoring

## Troubleshooting

### Cache Not Working
- Check if `.cache/msal/` directory exists and is writable
- Verify correct tenant and client IDs
- Check console errors for file system issues

### Tokens Not Persisting
- Ensure `save()` is called after successful authentication
- Check that tokens are not null before saving
- Verify cache TTL hasn't expired

### Authentication Still Required
- Cache may have expired (>1 hour old)
- Scopes may have changed
- Account may have been logged out

## Migration Guide

For existing implementations:
1. Install the new token-cache.mjs module
2. Update msal-auth.mjs with cache integration
3. Test with test-token-cache.mjs
4. Add `.cache/` to .gitignore
5. Deploy and monitor

## Conclusion

The token cache implementation provides a robust, disk-based caching solution for MSAL authentication tokens. It improves user experience by reducing authentication frequency while maintaining security through TTL management and proper error handling.