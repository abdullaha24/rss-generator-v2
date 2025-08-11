/**
 * HTTP Client with Anti-Bot Protection
 * Handles 403 errors and implements fallback strategies
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

/**
 * Get random user agent
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get standard browser headers
 */
function getBrowserHeaders(url, userAgent = null) {
  const baseUrl = new URL(url).origin;
  
  return {
    'User-Agent': userAgent || getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': baseUrl
  };
}

/**
 * Fetch with anti-bot protection and retry logic
 */
async function fetchWithRetry(url, options = {}) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add delay between requests (except first attempt)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      }
      
      const headers = getBrowserHeaders(url);
      
      // Use different user agent on retry
      if (attempt > 0) {
        headers['User-Agent'] = getRandomUserAgent();
      }
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        },
        timeout: 30000
      });
      
      if (response.ok) {
        return response;
      }
      
      if (response.status === 403) {
        console.log(`403 error on attempt ${attempt + 1} for ${url}`);
        // Try mobile user agent on 403
        if (attempt === 1) {
          const mobileUrl = url.replace('www.', 'm.');
          if (mobileUrl !== url) {
            try {
              const mobileHeaders = {
                ...getBrowserHeaders(mobileUrl),
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
              };
              
              const mobileResponse = await fetch(mobileUrl, {
                ...options,
                headers: {
                  ...mobileHeaders,
                  ...options.headers
                }
              });
              
              if (mobileResponse.ok) {
                return mobileResponse;
              }
            } catch (e) {
              console.log('Mobile fallback failed:', e.message);
            }
          }
        }
        
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      // For other HTTP errors, throw immediately
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      lastError = error;
      console.log(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      // Don't retry on timeout or network errors after 2 attempts
      if (attempt >= 1 && (error.code === 'ENOTFOUND' || error.message.includes('timeout'))) {
        break;
      }
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
}

/**
 * Fetch HTML content with error handling
 */
async function fetchHTML(url) {
  try {
    const response = await fetchWithRetry(url);
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    throw error;
  }
}

/**
 * Simple in-memory cache
 */
class SimpleCache {
  constructor(ttl = 1800000) { // 30 minutes default
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }
  
  clear() {
    this.cache.clear();
  }
}

// Global cache instance
const cache = new SimpleCache();

export {
  fetchWithRetry,
  fetchHTML,
  getBrowserHeaders,
  getRandomUserAgent,
  cache
};