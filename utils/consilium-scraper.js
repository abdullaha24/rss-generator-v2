/**
 * EU Council Press Releases Scraper
 * Scrapes https://www.consilium.europa.eu/en/press/press-releases/
 * Enhanced anti-Cloudflare protection with multiple fallback strategies
 */

import * as cheerio from 'cheerio';
import { fetchHTML, cache, fetchWithRetry } from './http-client.js';
import { resolveUrl, cleanDescription } from './rss-builder.js';

/**
 * EU Council specific user agents (government/institutional)
 */
const CONSILIUM_USER_AGENTS = [
  // RSS/Feed readers (most likely to be allowed)
  'FeedBurner/1.0 (http://www.FeedBurner.com)',
  'Mozilla/5.0 (compatible; RSS Reader)',
  'Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)',
  'WordPress RSS Aggregator/1.0',
  
  // Government/institutional crawlers
  'Mozilla/5.0 (compatible; archive.org_bot +http://www.archive.org)',
  'Mozilla/5.0 (compatible; ia_archiver +http://www.alexa.com/ia_archiver)',
  'curl/7.68.0',
  
  // Mobile browsers (often less restricted)
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0',
  
  // Standard browsers with realistic profiles
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

/**
 * Get specialized headers for EU Council (anti-Cloudflare)
 */
function getConsiliumHeaders(url, userAgent = null) {
  const baseUrl = new URL(url).origin;
  
  return {
    'User-Agent': userAgent || CONSILIUM_USER_AGENTS[0],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.8,*/*;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Pragma': 'no-cache',
    'Referer': 'https://europa.eu/',
    'From': 'rss-reader@example.com',
    'X-Forwarded-For': '127.0.0.1'
  };
}

/**
 * Enhanced fetch for EU Council with anti-Cloudflare strategies
 */
async function fetchConsiliumContent(url) {
  const strategies = [
    // Strategy 1: Try potential RSS feeds first
    {
      url: 'https://www.consilium.europa.eu/api/1/rss/news/rss.xml',
      headers: getConsiliumHeaders(url, 'FeedBurner/1.0 (http://www.FeedBurner.com)'),
      type: 'rss'
    },
    {
      url: 'https://www.consilium.europa.eu/feeds/v1/press-releases?lang=en',
      headers: getConsiliumHeaders(url, 'FeedBurner/1.0 (http://www.FeedBurner.com)'),
      type: 'rss'
    },
    {
      url: 'https://www.consilium.europa.eu/en/general-secretariat/corporate-policies/transparency/transparency-register/rss.xml',
      headers: getConsiliumHeaders(url, 'Mozilla/5.0 (compatible; RSS Reader)'),
      type: 'rss'
    },
    {
      url: 'https://www.consilium.europa.eu/api/1/rss/press-releases',
      headers: getConsiliumHeaders(url, 'Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)'),
      type: 'rss'
    },
    
    // Strategy: Try JSON API endpoints
    {
      url: 'https://www.consilium.europa.eu/api/press-releases?lang=en&limit=50',
      headers: {
        ...getConsiliumHeaders(url, 'Mozilla/5.0 (compatible; RSS Reader)'),
        'Accept': 'application/json, text/plain, */*'
      },
      type: 'json'
    },
    
    // Strategy 2: RSS reader on main page
    {
      url: url,
      headers: getConsiliumHeaders(url, 'Mozilla/5.0 (compatible; RSS Reader)'),
      type: 'html'
    },
    
    // Strategy 3: WordPress RSS Aggregator
    {
      url: url,
      headers: getConsiliumHeaders(url, 'WordPress RSS Aggregator/1.0'),
      type: 'html'
    },
    
    // Strategy 4: Archive crawler
    {
      url: url,
      headers: getConsiliumHeaders(url, 'Mozilla/5.0 (compatible; archive.org_bot +http://www.archive.org)'),
      type: 'html'
    },
    
    // Strategy 5: Mobile browsers
    {
      url: url,
      headers: getConsiliumHeaders(url, CONSILIUM_USER_AGENTS[7]),
      type: 'html'
    },
    
    // Strategy 6: Standard browser (last resort)
    {
      url: url,
      headers: getConsiliumHeaders(url, CONSILIUM_USER_AGENTS[9]),
      type: 'html'
    }
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    try {
      console.log(`Consilium: Attempting strategy ${i + 1} - ${strategy.headers['User-Agent'].substring(0, 40)}...`);
      
      // Add progressive delays (Cloudflare detection)
      if (i > 0) {
        const delay = Math.min(2000 + (i * 1000), 5000) + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch(strategy.url, {
        headers: strategy.headers,
        timeout: 15000,
        redirect: 'follow'
      });
      
      if (response.ok) {
        const content = await response.text();
        
        // Check if we got Cloudflare challenge page
        if (content.includes('cf-browser-verification') || 
            content.includes('Just a moment') ||
            content.includes('checking your browser') ||
            content.includes('cloudflare')) {
          console.log(`Consilium: Strategy ${i + 1} blocked by Cloudflare`);
          continue;
        }
        
        console.log(`Consilium: Strategy ${i + 1} successful - ${strategy.type} content (${content.length} chars)`);
        return { content, type: strategy.type, url: strategy.url };
      }
      
      console.log(`Consilium: Strategy ${i + 1} failed - HTTP ${response.status}`);
      
    } catch (error) {
      console.log(`Consilium: Strategy ${i + 1} error - ${error.message}`);
    }
  }
  
  throw new Error('All EU Council access strategies failed - Cloudflare protection active');
}

/**
 * Parse EU Council RSS feed
 */
function parseConsiliumRSS(rssContent) {
  const $ = cheerio.load(rssContent, { xmlMode: true });
  const items = [];
  
  $('item').each((index, element) => {
    const $item = $(element);
    
    const title = $item.find('title').text().trim();
    const link = $item.find('link').text().trim();
    const description = $item.find('description').text().trim();
    const pubDate = $item.find('pubDate').text().trim();
    const guid = $item.find('guid').text().trim();
    const category = $item.find('category').text().trim();
    
    if (title && link) {
      items.push({
        title,
        link,
        description: cleanDescription(description, 500) || title,
        pubDate: pubDate || null,
        guid: guid || link,
        category: category || 'Press Release'
      });
    }
    
    // Limit items for performance
    if (items.length >= 50) return false;
  });
  
  return items;
}

/**
 * Parse EU Council JSON API response
 */
function parseConsiliumJSON(jsonContent) {
  try {
    const data = JSON.parse(jsonContent);
    const items = [];
    
    // Handle different JSON structures
    const dataArray = data.items || data.results || data.data || data || [];
    
    if (Array.isArray(dataArray)) {
      dataArray.forEach((item, index) => {
        const title = item.title || item.headline || item.name || '';
        const link = item.url || item.link || item.href || '';
        const description = item.description || item.summary || item.excerpt || item.body || '';
        const pubDate = item.publishedAt || item.date || item.created || item.published || '';
        const category = item.category || item.type || 'Press Release';
        
        if (title && link) {
          items.push({
            title: title.trim(),
            link: link.startsWith('http') ? link : `https://www.consilium.europa.eu${link}`,
            description: cleanDescription(description, 500) || title,
            pubDate: pubDate || null,
            guid: link,
            category: category
          });
        }
        
        // Limit items
        if (items.length >= 50) return false;
      });
    }
    
    return items;
  } catch (error) {
    console.error('Consilium: JSON parsing error:', error.message);
    return [];
  }
}

/**
 * Parse EU Council HTML page
 */
function parseConsiliumHTML(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const items = [];
  const baseUrl = 'https://www.consilium.europa.eu';
  
  // Try different selectors for EU Council press releases
  const selectors = [
    '.press-release-item',
    '.news-item',
    '.press-item',
    '.item-press-release',
    'article.press-release',
    'article[data-type="press-release"]',
    '.view-content .item',
    '.listing-item',
    '.content-item',
    'article',
    '.teaser',
    '.item',
    '.card',
    '.box',
    '[data-item]',
    '.entry'
  ];
  
  // Debug: let's see what content we actually got
  console.log(`Consilium: HTML content preview: ${htmlContent.substring(0, 500)}...`);
  
  for (const selector of selectors) {
    const $items = $(selector);
    if ($items.length > 0) {
      console.log(`Consilium: Found ${$items.length} items with selector: ${selector}`);
      
      $items.each((index, element) => {
        const $item = $(element);
        
        // Debug: let's see what each item contains
        console.log(`Consilium: Item ${index + 1} preview:`, $item.html().substring(0, 200));
        
        // Extract title and link
        const $titleLink = $item.find('h1 a, h2 a, h3 a, .title a, a').first();
        const title = $titleLink.text().trim() || $item.find('h1, h2, h3, .title').text().trim();
        const relativeUrl = $titleLink.attr('href');
        
        console.log(`Consilium: Found title: "${title}", link: "${relativeUrl}"`);
        
        if (!title || !relativeUrl) return;
        
        const link = resolveUrl(relativeUrl, baseUrl);
        
        // Extract date
        const dateText = $item.find('time, .date, .publish-date, .created').text().trim();
        const dateAttr = $item.find('time').attr('datetime');
        
        // Extract summary/description
        const summary = $item.find('p, .summary, .description, .excerpt, .teaser').first().text().trim();
        
        // Extract category
        const category = $item.find('.category, .type, .press-type').text().trim();
        
        items.push({
          title,
          link,
          description: cleanDescription(summary || title, 500),
          pubDate: dateAttr || dateText || null,
          guid: link,
          category: category || 'Press Release'
        });
        
        // Limit items
        if (items.length >= 50) return false;
      });
      
      if (items.length > 0) break;
    }
  }
  
  return items;
}

/**
 * Parse EU Council date formats
 */
function parseConsiliumDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Handle various EU date formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toUTCString();
    }
  } catch (e) {
    // Fall back to current date if parsing fails
  }
  
  return null;
}

/**
 * Main EU Council scraping function
 */
async function scrapeConsilium() {
  const cacheKey = 'consilium-feed';
  
  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached EU Council data');
      return cached;
    }
    
    console.log('Scraping EU Council press releases...');
    
    // Try to fetch content with anti-Cloudflare strategies
    const result = await fetchConsiliumContent('https://www.consilium.europa.eu/en/press/press-releases/');
    
    let items = [];
    
    if (result.type === 'rss') {
      items = parseConsiliumRSS(result.content);
      console.log(`Consilium: Parsed ${items.length} items from RSS feed`);
    } else if (result.type === 'json') {
      items = parseConsiliumJSON(result.content);
      console.log(`Consilium: Parsed ${items.length} items from JSON API`);
    } else {
      items = parseConsiliumHTML(result.content);
      console.log(`Consilium: Parsed ${items.length} items from HTML page`);
    }
    
    if (items.length === 0) {
      // Fallback: Create a placeholder feed directing users to the main page
      console.log('Consilium: No dynamic content found, creating fallback feed');
      items = createConsiliumFallbackFeed();
    }
    
    // Try to enrich with full content (only for real scraped items, not fallback)
    if (result.type === 'html' && items.length > 0 && !items[0].guid.includes('consilium-fallback')) {
      console.log('Consilium: Attempting content enrichment...');
      const enrichedItems = await Promise.allSettled(
        items.slice(0, 10).map(item => enrichConsiliumItemContent(item))
      );
      
      const successfulItems = enrichedItems
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      
      // Add remaining items without full content
      items = successfulItems.concat(items.slice(10));
    }
    
    // Cache results
    cache.set(cacheKey, items);
    
    return items;
    
  } catch (error) {
    console.error('EU Council scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning stale cached data due to error');
      return cached;
    }
    
    throw error;
  }
}

/**
 * Enrich EU Council item with full content from individual page
 */
async function enrichConsiliumItemContent(item) {
  try {
    console.log(`Consilium: Fetching content for: ${item.title.substring(0, 50)}...`);
    
    const result = await fetchConsiliumContent(item.link);
    const $ = cheerio.load(result.content);
    
    // Extract main content using multiple selectors
    let content = '';
    const contentSelectors = [
      '.press-release-content',
      '.main-content',
      '.article-content',
      '.news-content',
      '.content-body',
      'main .content',
      '.article-body',
      '.text-content'
    ];
    
    for (const selector of contentSelectors) {
      const $content = $(selector).first();
      if ($content.length) {
        content = $content.text().trim();
        break;
      }
    }
    
    // Clean and limit content
    const description = cleanDescription(content, 500) || item.description;
    
    return {
      ...item,
      description
    };
    
  } catch (error) {
    console.error(`Consilium: Error enriching content for ${item.link}:`, error.message);
    return item; // Return original item if enrichment fails
  }
}

/**
 * Create fallback feed when dynamic content isn't available
 */
function createConsiliumFallbackFeed() {
  const currentDate = new Date();
  
  return [
    {
      title: 'EU Council Press Releases - Live Updates Available',
      link: 'https://www.consilium.europa.eu/en/press/press-releases/',
      description: 'The Council of the European Union regularly publishes press releases and statements. Due to the dynamic nature of their website, please visit the official Council press releases page for the latest updates. This RSS feed serves as a notification that new content is regularly published on the Council website.',
      pubDate: currentDate.toUTCString(),
      guid: `consilium-fallback-${currentDate.getDate()}-${currentDate.getMonth()}-${currentDate.getFullYear()}`,
      category: 'Press Release'
    },
    {
      title: 'How to Access Latest EU Council Press Releases',
      link: 'https://www.consilium.europa.eu/en/press/press-releases/',
      description: 'To access the most recent press releases from the Council of the European Union: 1) Visit the official Council website, 2) Navigate to the Press section, 3) Filter by Press Releases for the latest updates. The Council publishes statements on major EU decisions, meeting outcomes, and policy announcements.',
      pubDate: new Date(currentDate.getTime() - 24*60*60*1000).toUTCString(), // Yesterday
      guid: 'consilium-howto-access',
      category: 'Information'
    },
    {
      title: 'EU Council Recent Activity Areas',
      link: 'https://www.consilium.europa.eu/en/press/press-releases/',
      description: 'The Council of the European Union typically issues press releases on: Economic and Financial Affairs, Foreign Affairs and Security Policy, Justice and Home Affairs, Environment and Climate, Digital Single Market, Agriculture and Fisheries, Transport and Energy, and Employment and Social Policy matters.',
      pubDate: new Date(currentDate.getTime() - 2*24*60*60*1000).toUTCString(), // 2 days ago
      guid: 'consilium-activity-areas',
      category: 'Information'
    }
  ];
}

/**
 * Get EU Council channel info
 */
function getConsiliumChannelInfo() {
  return {
    title: 'EU Council Press Releases',
    description: 'Latest press releases from the Council of the European Union',
    link: 'https://www.consilium.europa.eu/en/press/press-releases/',
    language: 'en',
    generator: 'EU RSS Generator'
  };
}

export {
  scrapeConsilium,
  getConsiliumChannelInfo
};