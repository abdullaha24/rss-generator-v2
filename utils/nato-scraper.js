/**
 * NATO News Scraper
 * Scrapes https://www.nato.int/cps/en/natohq/news.htm
 * Includes enhanced anti-bot protection due to stricter 403 blocking
 */

import * as cheerio from 'cheerio';
import { fetchHTML, cache, fetchWithRetry } from './http-client.js';
import { resolveUrl, cleanDescription } from './rss-builder.js';

/**
 * NATO-specific user agents (defense/government sites often allow these)
 */
const NATO_USER_AGENTS = [
  // RSS Reader user agents
  'FeedBurner/1.0 (http://www.FeedBurner.com)',
  'Mozilla/5.0 (compatible; RSS Reader)',
  'Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)',
  
  // Government/institutional crawlers
  'Mozilla/5.0 (compatible; archive.org_bot +http://www.archive.org)',
  'Mozilla/5.0 (compatible; ia_archiver +http://www.alexa.com/ia_archiver)',
  
  // Standard browsers (as fallback)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

/**
 * Get specialized headers for NATO
 */
function getNATOHeaders(url, userAgent = null) {
  const baseUrl = new URL(url).origin;
  
  return {
    'User-Agent': userAgent || NATO_USER_AGENTS[0],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.8,*/*;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/',
    'From': 'rss-aggregator@example.com'
  };
}

/**
 * Enhanced fetch for NATO with multiple strategies
 */
async function fetchNATOContent(url) {
  const strategies = [
    // Strategy 1: Try official RSS feed first
    {
      url: 'https://www.nato.int/cps/rss/en/natolive/rssFeed.xsl/rssFeed.xml',
      headers: getNATOHeaders(url, 'FeedBurner/1.0 (http://www.FeedBurner.com)'),
      type: 'rss'
    },
    
    // Strategy 2: RSS reader user agent on main page
    {
      url: url,
      headers: getNATOHeaders(url, 'Mozilla/5.0 (compatible; RSS Reader)'),
      type: 'html'
    },
    
    // Strategy 3: Archive crawler
    {
      url: url,
      headers: getNATOHeaders(url, 'Mozilla/5.0 (compatible; archive.org_bot +http://www.archive.org)'),
      type: 'html'
    },
    
    // Strategy 4: Google Feedfetcher
    {
      url: url,
      headers: getNATOHeaders(url, 'Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)'),
      type: 'html'
    },
    
    // Strategy 5: Standard browser
    {
      url: url,
      headers: getNATOHeaders(url, NATO_USER_AGENTS[6]),
      type: 'html'
    }
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    try {
      console.log(`NATO: Attempting strategy ${i + 1} - ${strategy.headers['User-Agent'].substring(0, 30)}...`);
      
      // Add delay between attempts
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      }
      
      const response = await fetch(strategy.url, {
        headers: strategy.headers,
        timeout: 30000
      });
      
      if (response.ok) {
        const content = await response.text();
        console.log(`NATO: Strategy ${i + 1} successful - ${strategy.type} content (${content.length} chars)`);
        return { content, type: strategy.type, url: strategy.url };
      }
      
      console.log(`NATO: Strategy ${i + 1} failed - HTTP ${response.status}`);
      
    } catch (error) {
      console.log(`NATO: Strategy ${i + 1} error - ${error.message}`);
    }
  }
  
  throw new Error('All NATO access strategies failed');
}

/**
 * Parse NATO RSS feed
 */
function parseNATORSS(rssContent) {
  const $ = cheerio.load(rssContent, { xmlMode: true });
  const items = [];
  
  $('item').each((index, element) => {
    const $item = $(element);
    
    const title = $item.find('title').text().trim();
    const link = $item.find('link').text().trim();
    const description = $item.find('description').text().trim();
    const pubDate = $item.find('pubDate').text().trim();
    const guid = $item.find('guid').text().trim();
    
    if (title && link) {
      items.push({
        title,
        link,
        description: cleanDescription(description, 500) || title,
        pubDate: parseNATODate(pubDate),
        guid: guid || link,
        category: 'NATO News'
      });
    }
  });
  
  return items;
}

/**
 * Parse NATO HTML page
 */
function parseNATOHTML(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const items = [];
  const baseUrl = 'https://www.nato.int';
  
  // Try different selectors for NATO news items
  const selectors = [
    '.news-item',
    '.newsitem',
    '.news-list .item',
    '.news-box',
    'article',
    '.content-item'
  ];
  
  for (const selector of selectors) {
    const $items = $(selector);
    if ($items.length > 0) {
      console.log(`NATO: Found ${$items.length} items with selector: ${selector}`);
      
      $items.each((index, element) => {
        const $item = $(element);
        
        // Extract title and link
        const $titleLink = $item.find('a').first();
        const title = $titleLink.text().trim() || $item.find('h1, h2, h3, h4').text().trim();
        const relativeUrl = $titleLink.attr('href');
        
        if (!title || !relativeUrl) return;
        
        const link = resolveUrl(relativeUrl, baseUrl);
        
        // Extract date
        const dateText = $item.find('.date, .news-date, time, .publish-date').text().trim();
        
        // Extract summary/description
        const summary = $item.find('p, .summary, .description, .excerpt').first().text().trim();
        
        items.push({
          title,
          link,
          description: cleanDescription(summary || title, 500),
          pubDate: dateText || null,
          guid: link,
          category: 'NATO News'
        });
        
        // Limit items
        if (items.length >= 30) return false;
      });
      
      if (items.length > 0) break;
    }
  }
  
  return items;
}

/**
 * Parse NATO date formats
 */
function parseNATODate(dateString) {
  if (!dateString) return null;
  
  // NATO RSS format: "07 Aug. 2025 12:00:00 GMT"
  if (dateString.includes('GMT')) {
    return dateString;
  }
  
  // Try other common formats
  const datePatterns = [
    /(\d{1,2})[\s\-\/]([A-Za-z]{3,})[\s\-\/](\d{4})/,  // 07 Aug 2025
    /(\d{4})-(\d{2})-(\d{2})/,  // 2025-08-07
    /(\d{2})\/(\d{2})\/(\d{4})/  // 07/08/2025
  ];
  
  for (const pattern of datePatterns) {
    const match = dateString.match(pattern);
    if (match) {
      try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date.toUTCString();
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  
  return null;
}

/**
 * Main NATO scraping function
 */
async function scrapeNATO() {
  const cacheKey = 'nato-feed';
  
  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached NATO data');
      return cached;
    }
    
    console.log('Scraping NATO news...');
    
    // Try to fetch content with multiple strategies
    const result = await fetchNATOContent('https://www.nato.int/cps/en/natohq/news.htm');
    
    let items = [];
    
    if (result.type === 'rss') {
      items = parseNATORSS(result.content);
      console.log(`NATO: Parsed ${items.length} items from RSS feed`);
    } else {
      items = parseNATOHTML(result.content);
      console.log(`NATO: Parsed ${items.length} items from HTML page`);
    }
    
    if (items.length === 0) {
      throw new Error('No NATO news items found');
    }
    
    // For HTML parsing, try to enrich with full content (limit to first 10 for performance)
    if (result.type === 'html' && items.length > 0) {
      const enrichedItems = await Promise.allSettled(
        items.slice(0, 10).map(item => enrichNATOItemContent(item))
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
    console.error('NATO scraping error:', error.message);
    
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
 * Enrich NATO item with full content from individual page
 */
async function enrichNATOItemContent(item) {
  try {
    console.log(`NATO: Fetching content for: ${item.title.substring(0, 50)}...`);
    
    const result = await fetchNATOContent(item.link);
    const $ = cheerio.load(result.content);
    
    // Extract main content using multiple selectors
    let content = '';
    const contentSelectors = [
      'section.content',
      '.main-content',
      '.article-content',
      '.news-content',
      'main .content',
      '.article-body'
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
    console.error(`NATO: Error enriching content for ${item.link}:`, error.message);
    return item; // Return original item if enrichment fails
  }
}

/**
 * Get NATO channel info
 */
function getNATOChannelInfo() {
  return {
    title: 'NATO News',
    description: 'Latest news and updates from NATO Headquarters',
    link: 'https://www.nato.int/cps/en/natohq/news.htm',
    language: 'en',
    generator: 'EU RSS Generator'
  };
}

export {
  scrapeNATO,
  getNATOChannelInfo
};