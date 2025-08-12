/**
 * COE (Council of Europe) RSS Scraper - Advanced Version
 * Handles dynamic content and anti-bot protection
 */

import * as cheerio from 'cheerio';
import AdvancedScraperFixed from './advanced-scraper-fixed.js';
import { cache } from './http-client.js';
import { cleanDescription, formatRSSDate } from './rss-builder.js';

/**
 * Advanced COE scraper with Puppeteer for anti-bot protection
 */
async function scrapeCOENews() {
  const cacheKey = 'coe-news-advanced';
  let scraper = null;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached COE news data');
      return cached;
    }

    console.log('Starting COE news scraping with advanced browser...');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser for COE scraping');
    }

    // Enhanced navigation for heavily protected COE site
    await scraper.navigateWithStealth(
      'https://www.coe.int/en/web/portal/newsroom',
      {
        waitForSelector: '.news-item, .article, .publication, h2, h3, .container, .content',
        timeout: 45000,
        waitForNetworkIdle: true,
        useAlternativeUA: true,  // Force mobile user agent
        addReferer: 'https://www.google.com/search?q=council+of+europe+newsroom'
      }
    );

    console.log('COE: Successfully navigated to newsroom');

    // Wait for content to load
    await scraper.waitForDynamicContent();

    // Try multiple content extraction strategies
    const contentSelectors = [
      '.news-item',           // Primary news items
      '.article',             // Article containers
      '.publication',         // Publication items
      '[class*="news"]',      // Any news-related class
      '[class*="article"]',   // Any article-related class
      'h2 a, h3 a',           // Header links
      'a[href*="/news/"]',    // News URL links
      'a[href*="/article/"]', // Article URL links
    ];

    const result = await scraper.extractContent(contentSelectors, {
      waitForContent: true,
      maxRetries: 3,
      retryDelay: 2000
    });

    console.log(`COE: Successfully extracted content with selector: ${result.selector}`);
    console.log(`COE: Found ${result.elements} content items`);

    // Parse the extracted HTML
    const items = parseCOEHTML(result.html);
    
    if (items.length === 0) {
      throw new Error('No news items found in COE content');
    }

    console.log(`COE: Successfully parsed ${items.length} news items`);

    // Return first 25 items
    const finalItems = items.slice(0, 25);
    console.log(`COE: Returning ${finalItems.length} items`);
    
    // Cache successful results for 30 minutes
    cache.set(cacheKey, finalItems);
    
    return finalItems;

  } catch (error) {
    console.error('COE advanced scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning stale cached COE data due to error');
      return cached;
    }
    
    // For now, return placeholder content if site is inaccessible
    console.log('COE: Site is heavily protected, returning placeholder content');
    return getPlaceholderCOEContent();
    
  } finally {
    // Always cleanup browser resources
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

/**
 * Parse COE HTML content using multiple strategies
 */
function parseCOEHTML(html) {
  const $ = cheerio.load(html);
  const items = [];
  const baseUrl = 'https://www.coe.int';

  console.log('COE: Starting HTML parsing with multiple strategies...');

  // Strategy 1: Look for structured news items
  let newsItems = $('.news-item, .article, .publication');
  
  // Strategy 2: Look for any container with news-related content
  if (newsItems.length === 0) {
    newsItems = $('[class*="news"], [class*="article"], [class*="publication"]');
  }

  // Strategy 3: Look for headings with links
  if (newsItems.length === 0) {
    newsItems = $('h2, h3, h4').filter((i, el) => $(el).find('a').length > 0);
  }

  // Strategy 4: Look for any links that might be news
  if (newsItems.length === 0) {
    newsItems = $('a[href*="/news/"], a[href*="/article/"], a[href*="/publication/"]').parent();
  }

  // Strategy 5: Look for any structured content containers
  if (newsItems.length === 0) {
    newsItems = $('.container, .content, .main').find('a').filter((i, el) => {
      const href = $(el).attr('href');
      return href && (href.includes('/news/') || href.includes('/article/') || href.includes('/publication/'));
    }).parent().parent();
  }

  console.log(`COE: Found ${newsItems.length} potential items using strategy`);

  newsItems.each((index, element) => {
    try {
      const $item = $(element);
      
      // Extract link and title
      let $link = $item.find('a').first();
      let title = '';
      
      // Try different title extraction methods
      title = $link.find('h1, h2, h3, h4, h5').first().text().trim();
      if (!title) {
        title = $link.text().trim();
      }
      if (!title) {
        title = $item.find('h1, h2, h3, h4, h5').first().text().trim();
      }
      if (!title) {
        // Get any meaningful text
        const texts = $item.find('*').contents().filter(function() {
          return this.nodeType === 3 && $(this).text().trim().length > 10;
        }).map(function() {
          return $(this).text().trim();
        }).get();
        title = texts[0] || '';
      }

      if (!title || title.length < 5) {
        console.warn(`COE: Item ${index + 1} has no usable title, skipping`);
        return;
      }

      // Extract link URL
      const href = $link.attr('href');
      if (!href) {
        console.warn(`COE: Item ${index + 1} has no link, skipping`);
        return;
      }

      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Skip non-relevant links
      if (link.includes('#') || link.includes('javascript:') || link.includes('mailto:')) {
        return;
      }

      // Extract date - try multiple formats
      let pubDate = null;
      const dateSelectors = [
        '.date', '.published', '.created', '.time', 
        '[class*="date"]', '[class*="time"]', 
        'time', '.meta-date'
      ];
      
      for (const dateSelector of dateSelectors) {
        const dateText = $item.find(dateSelector).first().text().trim();
        if (dateText) {
          pubDate = parseCOEDate(dateText);
          if (pubDate) break;
        }
      }

      // If no date found, try to extract from surrounding text
      if (!pubDate) {
        const itemText = $item.text();
        const datePatterns = [
          /(\d{1,2}\s+\w+\s+\d{4})/g,  // "15 March 2024"
          /(\w+\s+\d{1,2},\s+\d{4})/g, // "March 15, 2024"
          /(\d{1,2}\/\d{1,2}\/\d{4})/g, // "15/03/2024"
          /(\d{4}-\d{2}-\d{2})/g        // "2024-03-15"
        ];

        for (const pattern of datePatterns) {
          const match = itemText.match(pattern);
          if (match) {
            pubDate = parseCOEDate(match[0]);
            if (pubDate) break;
          }
        }
      }

      // Fallback to current date
      if (!pubDate) {
        pubDate = new Date().toUTCString();
      }

      // Extract description
      let description = '';
      const descSelectors = [
        '.description', '.excerpt', '.summary', '.abstract',
        'p', '.content', '.text', '.body'
      ];

      for (const descSelector of descSelectors) {
        description = $item.find(descSelector).first().text().trim();
        if (description && description.length > 20) break;
      }

      // If no description, use title or surrounding text
      if (!description) {
        description = $item.text().replace(title, '').trim();
        if (description.length > 500) {
          description = description.substring(0, 500) + '...';
        }
      }

      if (!description) {
        description = title; // Last resort
      }

      // Extract image
      const image = $item.find('img').first().attr('src');
      const imageUrl = image && image.startsWith('/') ? baseUrl + image : image;

      // Determine category based on URL or title
      let category = 'COE News';
      const urlLower = link.toLowerCase();
      const titleLower = title.toLowerCase();
      
      if (urlLower.includes('press') || titleLower.includes('press')) {
        category = 'Press Release';
      } else if (urlLower.includes('publication') || titleLower.includes('publication')) {
        category = 'Publication';
      } else if (urlLower.includes('statement') || titleLower.includes('statement')) {
        category = 'Statement';
      } else if (urlLower.includes('report') || titleLower.includes('report')) {
        category = 'Report';
      } else if (urlLower.includes('event') || titleLower.includes('event')) {
        category = 'Event';
      }

      const item = {
        title: title,
        link: link,
        description: cleanDescription(description, 600),
        pubDate: pubDate,
        guid: link,
        category: category,
        ...(imageUrl && { enclosure: imageUrl })
      };

      items.push(item);
      
    } catch (error) {
      console.warn(`COE: Error parsing item ${index + 1}:`, error.message);
    }
  });

  // If still no items, try alternative parsing
  if (items.length === 0) {
    console.log('COE: Trying alternative link-based parsing...');
    return parseCOEAlternative($);
  }

  // Sort by date (newest first)
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  // Remove duplicates by link
  const uniqueItems = items.reduce((acc, item) => {
    if (!acc.find(existing => existing.link === item.link)) {
      acc.push(item);
    }
    return acc;
  }, []);

  console.log(`COE: Parsed ${uniqueItems.length} unique items`);
  return uniqueItems;
}

/**
 * Alternative parsing strategy focusing on links
 */
function parseCOEAlternative($) {
  const items = [];
  const baseUrl = 'https://www.coe.int';

  // Look for any links that could be news/articles
  const potentialLinks = $('a').filter((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    
    if (!href || !text || text.length < 10) return false;
    
    // Check if link looks like news/article content
    return href.includes('/news/') || 
           href.includes('/article/') || 
           href.includes('/publication/') ||
           href.includes('/press/') ||
           href.includes('/statement/') ||
           href.includes('/report/');
  });

  console.log(`COE Alternative: Found ${potentialLinks.length} potential news links`);

  potentialLinks.each((index, element) => {
    try {
      const $link = $(element);
      const href = $link.attr('href');
      const title = $link.text().trim();
      
      if (!title || title.length < 10) return;
      
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Skip duplicates and invalid links
      if (items.find(item => item.link === link)) return;
      if (link.includes('#') || link.includes('javascript:')) return;

      // Try to find date in surrounding context
      let pubDate = new Date().toUTCString();
      const $parent = $link.closest('div, article, section, li');
      const contextText = $parent.text();
      
      const dateMatch = contextText.match(/(\d{1,2}\s+\w+\s+\d{4})|(\w+\s+\d{1,2},\s+\d{4})|(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const parsedDate = parseCOEDate(dateMatch[0]);
        if (parsedDate) pubDate = parsedDate;
      }

      // Extract description from context
      let description = $parent.find('p').first().text().trim();
      if (!description || description.length < 20) {
        description = title;
      }

      // Determine category
      let category = 'COE News';
      const urlLower = link.toLowerCase();
      if (urlLower.includes('press')) category = 'Press Release';
      else if (urlLower.includes('publication')) category = 'Publication';
      else if (urlLower.includes('statement')) category = 'Statement';
      else if (urlLower.includes('report')) category = 'Report';
      else if (urlLower.includes('event')) category = 'Event';

      items.push({
        title: title,
        link: link,
        description: cleanDescription(description, 600),
        pubDate: pubDate,
        guid: link,
        category: category
      });

    } catch (error) {
      console.warn(`COE Alternative: Error parsing link ${index + 1}:`, error.message);
    }
  });

  return items.slice(0, 25);
}

/**
 * Parse COE date formats
 */
function parseCOEDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Try multiple date formats
    const formats = [
      // European formats
      /(\d{1,2})\s+(\w+)\s+(\d{4})/,     // "15 March 2024"
      /(\w+)\s+(\d{1,2}),\s+(\d{4})/,    // "March 15, 2024"  
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,   // "15/03/2024"
      /(\d{4})-(\d{2})-(\d{2})/          // "2024-03-15"
    ];

    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime()) && date.getFullYear() > 2020 && date.getFullYear() < 2030) {
          return date.toUTCString();
        }
      }
    }

    // Direct parsing attempt
    const date = new Date(dateString);
    if (!isNaN(date.getTime()) && date.getFullYear() > 2020 && date.getFullYear() < 2030) {
      return date.toUTCString();
    }

  } catch (error) {
    console.warn('COE: Date parsing failed:', error.message);
  }
  
  return null;
}

/**
 * Get placeholder content when site is inaccessible
 */
function getPlaceholderCOEContent() {
  const baseDate = new Date();
  
  return [
    {
      title: 'COE RSS Feed - Site Access Restricted',
      link: 'https://www.coe.int/en/web/portal/newsroom',
      description: 'The Council of Europe website is currently restricting access to automated requests. This RSS feed will be restored once access is available. Please check the official COE newsroom for the latest updates.',
      pubDate: baseDate.toUTCString(),
      guid: 'https://www.coe.int/en/web/portal/newsroom#access-restricted',
      category: 'System Notice'
    },
    {
      title: 'Council of Europe Official Newsroom',
      link: 'https://www.coe.int/en/web/portal/newsroom',
      description: 'Visit the official Council of Europe newsroom for the latest news, press releases, and updates from the organization dedicated to protecting human rights, democracy, and the rule of law.',
      pubDate: new Date(baseDate.getTime() - 3600000).toUTCString(), // 1 hour ago
      guid: 'https://www.coe.int/en/web/portal/newsroom#official-link',
      category: 'Information'
    }
  ];
}

/**
 * Get COE channel info for RSS feed
 */
function getCOEChannelInfo() {
  return {
    title: 'Council of Europe Newsroom',
    description: 'Latest news, press releases, and updates from the Council of Europe',
    link: 'https://www.coe.int/en/web/portal/newsroom',
    language: 'en',
    generator: 'EU RSS Generator - COE Advanced Scraper'
  };
}

export {
  scrapeCOENews,
  getCOEChannelInfo
};