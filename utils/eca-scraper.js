/**
 * ECA (European Court of Auditors) News Scraper
 * Scrapes from https://www.eca.europa.eu/en/all-news
 * Uses browser automation to handle dynamic SharePoint content
 */

import * as cheerio from 'cheerio';
import AdvancedScraperFixed from './advanced-scraper-fixed.js';
import { cache } from './http-client.js';
import { cleanDescription, formatRSSDate } from './rss-builder.js';

/**
 * Main ECA scraper function
 */
async function scrapeECANews() {
  const cacheKey = 'eca-news-feed';
  let scraper = null;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached ECA news data');
      return cached;
    }

    console.log('Starting ECA news scraping with browser automation...');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }

    // Navigate to news page with stealth techniques
    await scraper.navigateWithStealth(
      'https://www.eca.europa.eu/en/all-news',
      {
        waitForSelector: 'ul, .card, .news-list, .row',
        timeout: 45000,
        waitForNetworkIdle: true
      }
    );

    // Wait longer for SharePoint React components to fully render
    console.log('⏳ Waiting for SharePoint React content to load (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Extract content using flexible selectors based on provided HTML
    const result = await scraper.extractContent([
      'ul.row.news-list',           // Primary target from provided DOM
      '.row.news-list',             // Alternative selector
      'ul.news-list',               // Generic news list  
      'ul[class*="news"]',          // Any ul with news in class
      '.card-news',                 // Individual cards as fallback
      '[class*="news-list"]',       // Any element with news-list in class
      'ul.row',                     // Bootstrap row ul
      'body'                        // Ultimate fallback to get page content
    ], {
      waitForContent: true,
      maxRetries: 4,
      retryDelay: 4000
    });

    console.log(`ECA: Successfully extracted content with selector: ${result.selector}`);
    console.log(`ECA: Found ${result.elements} news items`);

    // Parse the extracted HTML
    const items = parseECAHTML(result.html);
    
    if (items.length === 0) {
      throw new Error('No news items found in extracted content');
    }

    console.log(`ECA: Successfully parsed ${items.length} news items`);

    // Fast extraction without individual page enrichment to prevent timeouts
    const finalItems = items.slice(0, 20);
    console.log(`ECA: Returning ${finalItems.length} items for optimal performance`);
    
    // Cache successful results
    cache.set(cacheKey, finalItems);
    
    return finalItems;

  } catch (error) {
    console.error('ECA news scraping error:', error.message);
    
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
 * Parse ECA HTML content using the exact DOM structure provided by user
 */
function parseECAHTML(html) {
  const $ = cheerio.load(html);
  const items = [];
  const baseUrl = 'https://www.eca.europa.eu';

  console.log('ECA: Parsing HTML content...');
  
  // Use flexible selectors to find news cards based on provided HTML structure:
  // <ul class="row news-list"><li class="col-6 col-lg-4 col-xl-3"><div class="card card-news">
  const newsItems = $(
    '.row.news-list li .card.card-news, ' +      // Exact structure
    'ul.news-list li .card.card-news, ' +        // Alternative ul
    '.card.card-news, ' +                        // Direct card selector
    'li .card-news, ' +                          // Li with card-news
    '[class*="card-news"], ' +                   // Any element with card-news in class
    '.card:has(.card-title), ' +                 // Cards that have titles
    '.card:has(time.card-date)'                  // Cards that have date elements
  );
  
  console.log(`ECA: Found ${newsItems.length} news card items in DOM`);
  
  // Debug: Show what we actually found
  if (newsItems.length === 0) {
    console.log('ECA: No news cards found, checking for any cards or list items...');
    const allCards = $('.card');
    const allLis = $('li');
    const allUls = $('ul');
    console.log(`ECA: Found ${allCards.length} .card elements, ${allLis.length} li elements, ${allUls.length} ul elements`);
    
    // Try to find content with news-related text
    const anyNewsContent = $('*:contains("ECA"), *:contains("European"), *:contains("Court"), *:contains("Auditor")').filter((i, el) => {
      const text = $(el).text().trim();
      return text.length > 50 && text.length < 500;
    });
    console.log(`ECA: Found ${anyNewsContent.length} elements with ECA-related text`);
  }

  newsItems.each((index, element) => {
    try {
      const $item = $(element);
      
      // Extract title from: <h5 class="card-title">ECA Journal 1/2025: 'What's next for EU finances?'</h5>
      const title = $item.find('h5.card-title').text().trim();
      
      if (!title) {
        console.warn(`ECA: Item ${index + 1} missing title`);
        return;
      }
      
      // Extract link from: <a href="https://www.eca.europa.eu/en/news/NEWS-JOURNAL-2025-01" class="stretched-link">
      const $link = $item.find('a.stretched-link').first();
      const href = $link.attr('href');
      
      if (!href) {
        console.warn(`ECA: Item ${index + 1} missing href`);
        return;
      }
      
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Extract date from: <time class="card-date">30/06/2025</time>
      const dateText = $item.find('time.card-date').text().trim();
      let pubDate = null;
      
      if (dateText) {
        try {
          // Convert from "DD/MM/YYYY" format to proper date
          const [day, month, year] = dateText.split('/').map(Number);
          if (day && month && year) {
            const date = new Date(year, month - 1, day); // month is 0-indexed
            if (!isNaN(date.getTime())) {
              pubDate = date.toUTCString();
            }
          }
        } catch (e) {
          console.warn(`ECA: Failed to parse date "${dateText}":`, e.message);
        }
      }
      
      // Fallback to current date if parsing failed
      if (!pubDate) {
        pubDate = new Date().toUTCString();
      }
      
      // Extract description from the <p> tag content
      const description = $item.find('p').first().text().trim();
      
      // Extract image (optional)
      const image = $item.find('img.card-img-top').attr('src');
      const imageUrl = image && image.startsWith('/') ? baseUrl + image : image;

      const item = {
        title: title,
        link: link,
        description: cleanDescription(description || title, 600),
        pubDate: pubDate,
        guid: link,
        category: 'ECA News',
        ...(imageUrl && { enclosure: imageUrl })
      };

      console.log(`ECA: Parsed item ${index + 1}: "${title.substring(0, 50)}..." (${dateText})`);
      items.push(item);
      
    } catch (error) {
      console.error(`ECA: Error parsing item ${index + 1}:`, error.message);
    }
  });

  console.log(`ECA: Successfully parsed ${items.length} items from DOM`);
  
  // Sort by date (newest first)
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  return items;
}

/**
 * Get ECA channel info for RSS feed
 */
function getECAChannelInfo() {
  return {
    title: 'ECA News - European Court of Auditors',
    description: 'Latest news, reports, and publications from the European Court of Auditors',
    link: 'https://www.eca.europa.eu/en/all-news',
    language: 'en',
    generator: 'EU RSS Generator - ECA Scraper'
  };
}

export {
  scrapeECANews,
  getECAChannelInfo
};