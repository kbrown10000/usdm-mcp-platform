// 🔒 Token Disk Cache Module for MSAL Authentication
// Implements secure disk-based caching with SHA-256 hashing for cache keys
// Cache lifetime: 1 hour from creation
// Location: .cache/msal/ relative to process.cwd()

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), '.cache', 'msal');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Generate a cache key based on tenant, client, and scopes
 * Format: msal_<tenant>_<client>_<sha256(scopes).substring(0,8)>.json
 * @param {string} tenant - Azure tenant ID
 * @param {string} client - Azure client ID
 * @param {string[]} scopes - Authentication scopes
 * @returns {string} Cache key filename
 */
export function getCacheKey(tenant, client, scopes) {
  // Sort scopes for consistency
  const sortedScopes = Array.isArray(scopes) ? scopes.sort().join(',') : String(scopes);

  // Generate SHA-256 hash of scopes
  const scopeHash = createHash('sha256')
    .update(sortedScopes)
    .digest('hex')
    .substring(0, 8); // Use first 8 chars of hash

  // Format: msal_<tenant>_<client>_<scopeHash>.json
  return `msal_${tenant}_${client}_${scopeHash}.json`;
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create cache directory:', error.message);
  }
}

/**
 * Save tokens and account information to disk cache
 * @param {Object} tokens - Object containing powerbi, graph, and usdm tokens
 * @param {Object} account - MSAL account object
 * @param {string} tenant - Azure tenant ID
 * @param {string} client - Azure client ID
 * @param {string[]} scopes - Authentication scopes
 * @returns {Promise<boolean>} Success status
 */
export async function save(tokens, account, tenant, client, scopes) {
  try {
    await ensureCacheDir();

    const cacheKey = getCacheKey(tenant, client, scopes);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    const cacheEntry = {
      tokens: {
        powerbi: tokens.powerbi || null,
        graph: tokens.graph || null,
        usdm: tokens.usdm || null
      },
      account: account ? {
        username: account.username,
        tenantId: account.tenantId,
        homeAccountId: account.homeAccountId,
        environment: account.environment,
        localAccountId: account.localAccountId,
        name: account.name
      } : null,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_TTL,
      metadata: {
        tenant,
        client,
        scopes: Array.isArray(scopes) ? scopes : [scopes],
        cacheVersion: '1.0'
      }
    };

    await fs.writeFile(
      cachePath,
      JSON.stringify(cacheEntry, null, 2),
      'utf8'
    );

    console.error(`✅ Token cache saved: ${cacheKey}`);
    return true;
  } catch (error) {
    console.error('Failed to save token cache:', error.message);
    return false;
  }
}

/**
 * Load tokens and account information from disk cache
 * @param {string} tenant - Azure tenant ID
 * @param {string} client - Azure client ID
 * @param {string[]} scopes - Authentication scopes
 * @returns {Promise<Object|null>} Cache entry or null if expired/missing
 */
export async function load(tenant, client, scopes) {
  try {
    const cacheKey = getCacheKey(tenant, client, scopes);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    // Check if cache file exists
    await fs.access(cachePath);

    // Read and parse cache entry
    const cacheContent = await fs.readFile(cachePath, 'utf8');
    const cacheEntry = JSON.parse(cacheContent);

    // Check if cache is expired
    if (Date.now() > cacheEntry.expiry) {
      console.error(`⏰ Token cache expired: ${cacheKey}`);
      // Clean up expired cache
      await clear(tenant, client, scopes);
      return null;
    }

    // Calculate remaining time
    const remainingMinutes = Math.round((cacheEntry.expiry - Date.now()) / (60 * 1000));
    console.error(`✅ Token cache loaded: ${cacheKey} (${remainingMinutes} min remaining)`);

    return {
      tokens: cacheEntry.tokens,
      account: cacheEntry.account,
      timestamp: cacheEntry.timestamp,
      expiry: cacheEntry.expiry,
      metadata: cacheEntry.metadata
    };
  } catch (error) {
    // Cache miss or error - return null
    if (error.code !== 'ENOENT') {
      console.error('Failed to load token cache:', error.message);
    }
    return null;
  }
}

/**
 * Clear specific cache entry
 * @param {string} tenant - Azure tenant ID
 * @param {string} client - Azure client ID
 * @param {string[]} scopes - Authentication scopes
 * @returns {Promise<boolean>} Success status
 */
export async function clear(tenant, client, scopes) {
  try {
    const cacheKey = getCacheKey(tenant, client, scopes);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    await fs.unlink(cachePath);
    console.error(`🗑️ Token cache cleared: ${cacheKey}`);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to clear token cache:', error.message);
    }
    return false;
  }
}

/**
 * Clear all cache entries
 * @returns {Promise<boolean>} Success status
 */
export async function clearAll() {
  try {
    // Check if cache directory exists
    await fs.access(CACHE_DIR);

    // Read all files in cache directory
    const files = await fs.readdir(CACHE_DIR);

    // Delete all .json cache files
    const deletePromises = files
      .filter(file => file.startsWith('msal_') && file.endsWith('.json'))
      .map(file => fs.unlink(path.join(CACHE_DIR, file)));

    await Promise.all(deletePromises);

    console.error(`🗑️ All token caches cleared (${deletePromises.length} files)`);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to clear all token caches:', error.message);
    }
    return false;
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats() {
  try {
    // Check if cache directory exists
    await fs.access(CACHE_DIR);

    // Read all files in cache directory
    const files = await fs.readdir(CACHE_DIR);
    const cacheFiles = files.filter(file => file.startsWith('msal_') && file.endsWith('.json'));

    const stats = {
      totalEntries: cacheFiles.length,
      cacheDir: CACHE_DIR,
      entries: []
    };

    // Read each cache file to get details
    for (const file of cacheFiles) {
      try {
        const content = await fs.readFile(path.join(CACHE_DIR, file), 'utf8');
        const entry = JSON.parse(content);

        stats.entries.push({
          filename: file,
          tenant: entry.metadata?.tenant,
          client: entry.metadata?.client,
          username: entry.account?.username,
          expired: Date.now() > entry.expiry,
          remainingMinutes: Math.max(0, Math.round((entry.expiry - Date.now()) / (60 * 1000))),
          hasTokens: {
            powerbi: !!entry.tokens?.powerbi,
            graph: !!entry.tokens?.graph,
            usdm: !!entry.tokens?.usdm
          }
        });
      } catch (e) {
        // Skip invalid cache entries
        console.error(`Skipping invalid cache entry: ${file}`);
      }
    }

    return stats;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        totalEntries: 0,
        cacheDir: CACHE_DIR,
        entries: [],
        error: 'Cache directory does not exist'
      };
    }

    return {
      totalEntries: 0,
      cacheDir: CACHE_DIR,
      entries: [],
      error: error.message
    };
  }
}

// Export all functions
export default {
  getCacheKey,
  save,
  load,
  clear,
  clearAll,
  getCacheStats
};