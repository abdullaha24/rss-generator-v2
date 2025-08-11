/**
 * ECA (European Court of Auditors) RSS Scraper - Puppeteer Version
 * Handles SharePoint React component dynamic loading
 * 
 * The ECA website uses:
 * - SharePoint with React components
 * - NewsPageWebPart that loads news-page-web-part_f0f9327d081a34d1601c6a153588ea06.js
 * - Dynamic rendering of <section data-reactroot="" class="news"> component
 * - News items loaded into <ul class="row news-list"> after JavaScript execution
 */

import * as cheerio from 'cheerio';
import AdvancedScraperFixed from './advanced-scraper-fixed.js';
import { cache } from './http-client.js';
import { cleanDescription, formatRSSDate } from './rss-builder.js';

/**
 * Advanced ECA scraper with Puppeteer for React component loading
 */
async function scrapeECANews() {
  const cacheKey = 'eca-news-puppeteer';
  let scraper = null;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached ECA news data');
      return cached;
    }

    console.log('Starting ECA news scraping with Puppeteer (React support)...');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser for ECA scraping');
    }

    // Navigate to ECA news page - optimized for Vercel speed
    await scraper.navigateWithStealth(
      'https://www.eca.europa.eu/en/all-news',
      {
        waitForSelector: '.card-news, ul.news-list, .card', // Broader selector for speed
        timeout: 8000, // 8s max for navigation
        waitForNetworkIdle: false // Skip network idle for speed
      }
    );

    // Wait specifically for React component - ultra-fast detection
    const reactSuccess = await scraper.waitForECAReactContent();
    console.log(`ECA: React detection result: ${reactSuccess}`);

    // Aggressive content extraction with multiple fallback selectors
    const contentSelectors = [
      '.card.card-news h5.card-title', // Direct title selector - fastest
      '.card-news', // Any news card
      'ul.news-list li', // List items
      '.card', // Any card
      '[class*="card"]', // Partial class match
      'h5.card-title', // Just titles
      'li', // Ultimate fallback - any list item
    ];

    const result = await scraper.extractContent(contentSelectors, {
      waitForContent: false, // Skip heavy waiting
      maxRetries: 1, // Single retry for speed
      retryDelay: 500 // Fast retry
    });

    console.log(`ECA: Successfully extracted React content with selector: ${result.selector}`);
    console.log(`ECA: Found ${result.elements} news items`);

    // Parse the extracted HTML
    const items = parseECAHTML(result.html);
    
    if (items.length === 0) {
      throw new Error('No news items found in React component content');
    }

    console.log(`ECA: Successfully parsed ${items.length} news items from React component`);

    // Return items without enrichment to avoid timeout issues
    const finalItems = items.slice(0, 20);
    console.log(`ECA: Returning ${finalItems.length} items`);
    
    // Cache successful results
    cache.set(cacheKey, finalItems);
    
    return finalItems;

  } catch (error) {
    console.error('ECA Puppeteer scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning stale cached ECA data due to error');
      return cached;
    }
    
    throw error;
    
  } finally {
    // Always cleanup browser resources
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

/**
 * Parse ECA HTML content using the analyzed structure
 * Structure: <ul class="row news-list"><li><div class="card card-news">
 */
function parseECAHTML(html) {
  const $ = cheerio.load(html);
  const items = [];
  const baseUrl = 'https://www.eca.europa.eu';

  // Aggressive selector strategies - try everything
  let newsItems = $('ul.news-list li .card.card-news');
  if (newsItems.length === 0) newsItems = $('.card.card-news');
  if (newsItems.length === 0) newsItems = $('.card-news');
  if (newsItems.length === 0) newsItems = $('ul.news-list li');
  if (newsItems.length === 0) newsItems = $('ul.row.news-list li');
  if (newsItems.length === 0) newsItems = $('.card');
  if (newsItems.length === 0) newsItems = $('li').filter((i, el) => $(el).find('a[href*="/news/"]').length > 0);
  if (newsItems.length === 0) newsItems = $('a[href*="/news/"]').parent().parent(); // Go up to container
  
  console.log(`ECA: Found ${newsItems.length} items using fallback selectors`);

  newsItems.each((index, element) => {
    try {
      const $item = $(element);
      
      // Flexible title extraction - try multiple approaches
      let title = '';
      let $link = $item.find('a.stretched-link').first();
      
      // Strategy 1: Standard structure
      if ($link.length > 0) {
        title = $link.find('h5.card-title').text().trim() || $link.text().trim();
      }
      
      // Strategy 2: Direct title search
      if (!title) {
        title = $item.find('h5.card-title, h4, h3, h2, .card-title').first().text().trim();
        $link = $item.find('a').first(); // Any link
      }
      
      // Strategy 3: Link with title
      if (!title) {
        $link = $item.find('a[href*="/news/"]').first();
        title = $link.text().trim();
      }
      
      // Strategy 4: Most desperate - any text in a link
      if (!title) {
        $link = $item.find('a').first();
        title = $link.text().trim();
      }
      
      if (!title || title.length < 3) {
        console.warn(`ECA: Item ${index + 1} has no usable title`);
        return; // Skip items without meaningful titles
      }
      
      // Extract link URL
      const href = $link.attr('href');
      
      if (!href) {
        return; // Skip items without links
      }
      
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Flexible date extraction from multiple sources
      let dateText = $item.find('time.card-date, time, .date, .card-date').first().text().trim();
      if (!dateText) {
        // Try to find date in surrounding text
        const itemText = $item.text();
        const dateMatch = itemText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        dateText = dateMatch ? dateMatch[1] : '';
      }
      
      let pubDate = null;
      
      if (dateText && dateText.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
        try {
          const [day, month, year] = dateText.split('/').map(Number);
          if (day && month && year && day <= 31 && month <= 12) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime()) && year > 2020 && year < 2030) {
              pubDate = date.toUTCString();
            }
          }
        } catch (e) {
          // Date parsing failed, use fallback
        }
      }
      
      // Fallback to current date if parsing failed
      if (!pubDate) {
        pubDate = new Date().toUTCString();
      }
      
      // Flexible description extraction
      let description = $item.find('.card-body p').first().text().trim();
      if (!description) description = $item.find('p').first().text().trim();
      if (!description) description = $item.find('.card-text, .excerpt, .summary').first().text().trim();
      if (!description) {
        // Use any text content that's not the title
        const allText = $item.text().replace(title, '').trim();
        description = allText.length > 20 ? allText.substring(0, 300) : title;
      }
      
      // Extract image from <img class="card-img-top">
      const image = $item.find('img.card-img-top').attr('src');
      const imageUrl = image && image.startsWith('/') ? baseUrl + image : image;

      // Determine category based on the URL pattern or title
      let category = 'ECA News';
      const urlLower = link.toLowerCase();
      if (urlLower.includes('journal')) {
        category = 'ECA Journal';
      } else if (urlLower.includes('newsletter')) {
        category = 'Newsletter';
      } else if (urlLower.includes('sr-') || title.toLowerCase().includes('special report')) {
        category = 'Special Report';
      } else if (urlLower.includes('rv-') || title.toLowerCase().includes('review')) {
        category = 'Review';
      }

      const item = {
        title: title,
        link: link,
        description: cleanDescription(description || title, 600),
        pubDate: pubDate,
        guid: link,
        category: category,
        ...(imageUrl && { enclosure: imageUrl })
      };

      items.push(item);
      
    } catch (error) {
      console.warn(`ECA: Error parsing item ${index + 1}:`, error.message);
    }
  });

  // If still no items found, try alternative parsing strategy
  if (items.length === 0) {
    console.log('ECA: Trying alternative parsing strategy...');
    return parseECAAlternative($);
  }

  // Sort by date (newest first)
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  return items;
}

/**
 * Alternative parsing strategy for ECA content
 */
function parseECAAlternative($) {
  const items = [];
  const baseUrl = 'https://www.eca.europa.eu';

  // Look for any links that match ECA news URL patterns
  $('a[href*="/en/news/"]').each((index, element) => {
    try {
      const $link = $(element);
      const href = $link.attr('href');
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Skip if not a proper news URL
      if (!link.includes('/en/news/') || link.includes('#')) return;
      
      const title = $link.text().trim() || $link.find('h1, h2, h3, h4, h5').first().text().trim();
      
      if (!title || title.length < 5) return;
      
      // Look for date in surrounding context
      let pubDate = new Date().toUTCString();
      const $parent = $link.closest('li, div, article');
      const dateText = $parent.find('time, .date').first().text().trim();
      
      if (dateText && dateText.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
        try {
          const [day, month, year] = dateText.split('/').map(Number);
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime()) && year > 2020 && year < 2030) {
            pubDate = date.toUTCString();
          }
        } catch (e) {
          // Keep default date
        }
      }
      
      const description = $parent.find('p').first().text().trim() || title;
      
      items.push({
        title: title,
        link: link,
        description: cleanDescription(description, 600),
        pubDate: pubDate,
        guid: link,
        category: 'ECA News'
      });
      
    } catch (error) {
      console.warn(`ECA Alternative: Error parsing item ${index + 1}:`, error.message);
    }
  });
  
  // Remove duplicates by link
  const uniqueItems = items.reduce((acc, item) => {
    if (!acc.find(existing => existing.link === item.link)) {
      acc.push(item);
    }
    return acc;
  }, []);
  
  return uniqueItems.slice(0, 20);
}


/**
 * Get ECA channel info for RSS feed
 */
function getECAChannelInfo() {
  return {
    title: 'ECA News - European Court of Auditors',
    description: 'Latest news, reports, and publications from the European Court of Auditors, extracted from SharePoint React components',
    link: 'https://www.eca.europa.eu/en/all-news',
    language: 'en',
    generator: 'EU RSS Generator - ECA Puppeteer Scraper'
  };
}

export {
  scrapeECANews,
  getECAChannelInfo
};