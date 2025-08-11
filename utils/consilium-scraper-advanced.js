/**
 * Advanced EU Council Press Releases Scraper
 * Uses browser automation with stealth techniques to extract real content
 * from https://www.consilium.europa.eu/en/press/press-releases/
 */

import * as cheerio from 'cheerio';
import AdvancedScraperFixed from './advanced-scraper-fixed.js';
import { cache } from './http-client.js';
import { cleanDescription, formatRSSDate } from './rss-builder.js';

/**
 * Advanced EU Council scraper with browser automation
 */
async function scrapeConsiliumAdvanced() {
  const cacheKey = 'consilium-advanced-feed';
  let scraper = null;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached EU Council advanced data');
      return cached;
    }

    console.log('Starting advanced EU Council scraping with browser automation...');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }

    // Navigate to press releases page with stealth
    await scraper.navigateWithStealth(
      'https://www.consilium.europa.eu/en/press/press-releases/',
      {
        waitForSelector: '.gsc-u-list-unstyled, .gsc-excerpt-item',
        timeout: 45000,
        waitForNetworkIdle: true
      }
    );

    // Extract content using the exact DOM structure provided
    const contentSelectors = [
      '.gsc-u-list-unstyled .gsc-excerpt-item', // Primary target from user's DOM
      '.gsc-excerpt-item', // Fallback if container changes
      '[data-theme="ceu"]', // Alternative selector based on theme
      '.excerpt-item', // Generic excerpt items
      'article[data-type*="press"]', // Article elements
      '.press-release-item', // Generic press release items
    ];

    const result = await scraper.extractContent(contentSelectors, {
      waitForContent: true,
      maxRetries: 3,
      retryDelay: 3000
    });

    console.log(`EU Council: Successfully extracted content with selector: ${result.selector}`);
    console.log(`EU Council: Found ${result.elements} press release items`);

    // Parse the extracted HTML
    const items = parseConsiliumAdvancedHTML(result.html);
    
    if (items.length === 0) {
      throw new Error('No press release items found in extracted content');
    }

    console.log(`EU Council: Successfully parsed ${items.length} press release items`);

    // Enrich items with full content from individual pages
    const enrichedItems = await enrichConsiliumItems(items.slice(0, 15), scraper);
    
    // Cache successful results
    cache.set(cacheKey, enrichedItems);
    
    return enrichedItems;

  } catch (error) {
    console.error('Advanced EU Council scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning stale cached data due to error');
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
 * Parse EU Council HTML content using the exact DOM structure provided
 */
function parseConsiliumAdvancedHTML(html) {
  const $ = cheerio.load(html);
  const items = [];
  const baseUrl = 'https://www.consilium.europa.eu';

  console.log('EU Council: Parsing HTML content...');
  
  // Use the exact selectors from the user's DOM structure
  const pressItems = $('.gsc-excerpt-item, .gsc-excerpt-item[data-theme="ceu"]');
  
  console.log(`EU Council: Found ${pressItems.length} press release items in DOM`);

  pressItems.each((index, element) => {
    try {
      const $item = $(element);
      
      // Extract link and title from the main link element
      const $link = $item.find('.gsc-excerpt-item__link, a').first();
      const href = $link.attr('href');
      
      if (!href) {
        console.warn(`EU Council: Item ${index + 1} missing href`);
        return;
      }
      
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Extract title from the specific span with class
      const title = $item.find('.gsc-excerpt-item__title, .gsc-heading--xsm').text().trim();
      
      if (!title) {
        console.warn(`EU Council: Item ${index + 1} missing title`);
        return;
      }
      
      // Extract publication time/date
      const $timeElement = $item.find('time[datetime], .gsc-time-badge');
      const datetime = $timeElement.attr('datetime');
      const timeText = $timeElement.text().trim();
      
      // Extract description from excerpt text
      const description = $item.find('#excerpt-text, .gsc-excerpt-text, p').first().text().trim();
      
      // Extract category/tag
      const category = $item.find('.gsc-tag, .gsc-excerpt-item__footer span').text().trim() || 'Press Release';
      
      // Parse date - handle EU Council's datetime format (e.g., "8/11/2025 10:05:00 AM")
      let pubDate = null;
      if (datetime) {
        try {
          // Convert from "8/11/2025 10:05:00 AM" format to proper date
          const parsedDate = new Date(datetime);
          if (!isNaN(parsedDate.getTime())) {
            pubDate = parsedDate.toUTCString();
          }
        } catch (e) {
          console.warn(`EU Council: Failed to parse datetime "${datetime}":`, e.message);
        }
      }
      
      // Fallback to current date if parsing failed
      if (!pubDate) {
        const today = new Date();
        // Try to extract time from timeText (e.g., "10:05")
        if (timeText && timeText.match(/^\d{1,2}:\d{2}$/)) {
          const [hours, minutes] = timeText.split(':').map(Number);
          today.setHours(hours, minutes, 0, 0);
        }
        pubDate = today.toUTCString();
      }

      const item = {
        title: title,
        link: link,
        description: cleanDescription(description || title, 500),
        pubDate: pubDate,
        guid: link,
        category: category
      };

      console.log(`EU Council: Parsed item ${index + 1}: "${title.substring(0, 60)}..."`);
      items.push(item);
      
    } catch (error) {
      console.error(`EU Council: Error parsing item ${index + 1}:`, error.message);
    }
  });

  console.log(`EU Council: Successfully parsed ${items.length} items from DOM`);
  return items;
}

/**
 * Enrich EU Council items with full content from individual pages
 */
async function enrichConsiliumItems(items, scraper) {
  console.log(`EU Council: Enriching ${items.length} items with full content...`);
  const enrichedItems = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      console.log(`EU Council: Enriching item ${i + 1}/${items.length}: ${item.title.substring(0, 50)}...`);
      
      // Navigate to individual press release page
      await scraper.navigateWithStealth(item.link, {
        timeout: 20000,
        waitForNetworkIdle: false // Faster for individual pages
      });
      
      // Random delay to avoid rate limiting
      await scraper.randomDelay(1000, 2500);
      
      // Extract full content
      const pageHtml = await scraper.page.content();
      const $ = cheerio.load(pageHtml);
      
      // Look for main content using various selectors
      const contentSelectors = [
        '.press-release-content',
        '.main-content',
        '.article-content', 
        '.news-content',
        '.content-body',
        'main .content',
        '.article-body',
        '.text-content',
        '.field--name-body',
        '.node__content',
        'article .content'
      ];
      
      let fullContent = '';
      for (const selector of contentSelectors) {
        const $content = $(selector);
        if ($content.length && $content.text().trim().length > 100) {
          fullContent = $content.text().trim();
          break;
        }
      }
      
      // Use enriched content if found, otherwise keep original
      const finalDescription = fullContent ? 
        cleanDescription(fullContent, 800) : 
        item.description;
      
      enrichedItems.push({
        ...item,
        description: finalDescription
      });
      
      console.log(`EU Council: Successfully enriched item ${i + 1} (${finalDescription.length} chars)`);
      
    } catch (error) {
      console.warn(`EU Council: Failed to enrich item ${i + 1}:`, error.message);
      // Keep original item if enrichment fails
      enrichedItems.push(item);
    }
  }
  
  console.log(`EU Council: Content enrichment completed for ${enrichedItems.length} items`);
  return enrichedItems;
}

/**
 * Get EU Council channel info for RSS feed
 */
function getConsiliumAdvancedChannelInfo() {
  return {
    title: 'EU Council Press Releases',
    description: 'Latest press releases from the Council of the European Union (Real-time extraction)',
    link: 'https://www.consilium.europa.eu/en/press/press-releases/',
    language: 'en',
    generator: 'EU RSS Generator - Advanced Scraper'
  };
}

export {
  scrapeConsiliumAdvanced,
  getConsiliumAdvancedChannelInfo
};