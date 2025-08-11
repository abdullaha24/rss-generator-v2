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

    // Navigate to ECA news page with React component loading support
    await scraper.navigateWithStealth(
      'https://www.eca.europa.eu/en/all-news',
      {
        waitForSelector: 'section.news[data-reactroot], ul.news-list',
        timeout: 45000,
        waitForNetworkIdle: true
      }
    );

    // Wait specifically for React component to load news content
    await scraper.waitForECAReactContent();

    // Extract content using the React-rendered structure
    const contentSelectors = [
      'ul.news-list li .card.card-news', // Primary target - React rendered news cards
      'section.news ul.news-list .card-news', // Alternative with section context
      '.card.card-news', // Fallback if structure changes
      '[data-reactroot] .news-list .card', // Generic React content
      '.news-list li', // Most generic selector
    ];

    const result = await scraper.extractContent(contentSelectors, {
      waitForContent: true,
      maxRetries: 3,
      retryDelay: 3000
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

  // Multiple selector strategies based on HTML analysis
  let newsItems = $('ul.news-list li .card.card-news');
  if (newsItems.length === 0) {
    newsItems = $('.card.card-news');
  }
  if (newsItems.length === 0) {
    newsItems = $('ul.row.news-list li');
  }
  
  console.log(`ECA: Found ${newsItems.length} news cards in HTML`);

  newsItems.each((index, element) => {
    try {
      const $item = $(element);
      
      // Extract title from <h5 class="card-title"> inside <a class="stretched-link">
      const $link = $item.find('a.stretched-link').first();
      const title = $link.find('h5.card-title').text().trim() || $item.find('h5.card-title').text().trim();
      
      if (!title || title.length < 5) {
        return; // Skip items without meaningful titles
      }
      
      // Extract link from <a class="stretched-link">
      const href = $link.attr('href');
      
      if (!href) {
        return; // Skip items without links
      }
      
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Extract date from <time class="card-date">DD/MM/YYYY</time>
      const dateText = $item.find('time.card-date').text().trim();
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
      
      // Extract description from <p> tag in card-body
      const description = $item.find('.card-body p').first().text().trim() || $item.find('p').first().text().trim();
      
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