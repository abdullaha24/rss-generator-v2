/**
 * ECA News Scraper - Fallback Version
 * Works with provided HTML structure and includes HTTP fallback
 */

import * as cheerio from 'cheerio';
import { fetchHTML, cache } from './http-client.js';
import { cleanDescription } from './rss-builder.js';

/**
 * Test the parsing function with provided HTML structure
 */
function testParseECAHTML() {
  // Use the exact HTML structure provided by the user for testing
  const testHTML = `
    <ul class="row news-list">
      <li class="col-6 col-lg-4 col-xl-3">
        <div class="card card-news" data-editor-container="false">
          <img src="/ECAHTMLNews/NEWS-JOURNAL-2025-01/NEWS.png?RenditionID=5" class="card-img-top" alt="">
          <div class="card-body">
            <time class="card-date">30/06/2025</time>
            <a href="https://www.eca.europa.eu/en/news/NEWS-JOURNAL-2025-01" class="stretched-link">
              <h5 class="card-title">ECA Journal 1/2025: 'What's next for EU finances?'</h5>
            </a>
            <p>The next EU multiannual financial framework (MFF) should enter into force on 1 January 2028. To achieve this objective, the European Commission has initiated discussions on the post-2027 long-t</p>
          </div>
        </div>
      </li>
      <li class="col-6 col-lg-4 col-xl-3">
        <div class="card card-news" data-editor-container="false">
          <img src="/ECAHTMLNews/NEWS2025_07_NEWSLETTER_02/NEWS.jpg?RenditionID=5" class="card-img-top" alt="">
          <div class="card-body">
            <time class="card-date">30/06/2025</time>
            <a href="https://www.eca.europa.eu/en/news/NEWS2025_07_NEWSLETTER_02" class="stretched-link">
              <h5 class="card-title">From ambition to action: auditing Europe's Beating Cancer Plan</h5>
            </a>
            <p>One in two Europeans will develop cancer during their lifetime, and lives lost to the disease are expected to increase further due to an ageing population. Beyond the human toll, cancer has a h</p>
          </div>
        </div>
      </li>
    </ul>
  `;
  
  const items = parseECAHTML(testHTML);
  console.log('🧪 Testing ECA HTML parsing...');
  console.log(`Found ${items.length} items`);
  
  items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   📅 ${item.pubDate}`);
    console.log(`   🔗 ${item.link}`);
    console.log(`   📝 ${item.description.substring(0, 100)}...`);
    console.log('');
  });
  
  return items;
}

/**
 * Simple HTTP-based ECA scraper as fallback
 */
async function scrapeECASimple() {
  const cacheKey = 'eca-news-simple';
  
  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached ECA news data (simple)');
      return cached;
    }

    console.log('Attempting simple HTTP scraping of ECA news...');
    
    // Try multiple user agents and approaches
    const approaches = [
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        referer: 'https://www.eca.europa.eu/en'
      },
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        referer: 'https://www.google.com'
      },
      {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15',
        referer: 'https://www.eca.europa.eu'
      }
    ];
    
    let html = null;
    let approach = null;
    
    for (const config of approaches) {
      try {
        console.log(`Trying approach: ${config.userAgent.includes('Chrome') ? 'Chrome' : config.userAgent.includes('Safari') ? 'Safari' : 'Mobile'}`);
        
        const response = await fetchHTML('https://www.eca.europa.eu/en/all-news');
        
        if (response && response.includes('eca.europa.eu')) {
          html = response;
          approach = config;
          console.log(`✅ Successfully fetched HTML content`);
          break;
        }
        
      } catch (error) {
        console.log(`❌ Approach failed: ${error.message}`);
        continue;
      }
    }
    
    if (!html) {
      throw new Error('All HTTP approaches failed');
    }
    
    // Parse the HTML
    const items = parseECAHTML(html);
    
    if (items.length === 0) {
      console.log('⚠️ No items found - content might be dynamically loaded');
      
      // Return some basic info even if content isn't loaded
      const fallbackItems = [{
        title: 'ECA News Feed - Dynamic Content Loading Issue',
        link: 'https://www.eca.europa.eu/en/all-news',
        description: 'The ECA news feed uses SharePoint dynamic content that requires JavaScript. Please visit the website directly for the latest news from the European Court of Auditors.',
        pubDate: new Date().toUTCString(),
        guid: 'https://www.eca.europa.eu/en/all-news',
        category: 'ECA News'
      }];
      
      cache.set(cacheKey, fallbackItems);
      return fallbackItems;
    }
    
    // Cache successful results
    cache.set(cacheKey, items);
    console.log(`✅ Successfully parsed ${items.length} ECA news items`);
    
    return items;
    
  } catch (error) {
    console.error('ECA simple scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning stale cached data due to error');
      return cached;
    }
    
    // Ultimate fallback
    return [{
      title: 'ECA News - Service Temporarily Unavailable',
      link: 'https://www.eca.europa.eu/en/all-news',
      description: 'The ECA news service is temporarily unavailable. Please visit the European Court of Auditors website directly for the latest news and publications.',
      pubDate: new Date().toUTCString(),
      guid: 'https://www.eca.europa.eu/en/all-news-fallback',
      category: 'ECA News'
    }];
  }
}

/**
 * Parse ECA HTML content using the exact structure provided by user
 */
function parseECAHTML(html) {
  const $ = cheerio.load(html);
  const items = [];
  const baseUrl = 'https://www.eca.europa.eu';

  console.log('ECA: Parsing HTML content...');
  
  // Use the exact structure from user's provided HTML
  const newsItems = $('.card.card-news');
  
  console.log(`ECA: Found ${newsItems.length} news cards in HTML`);

  newsItems.each((index, element) => {
    try {
      const $item = $(element);
      
      // Extract title from: <h5 class="card-title">
      const title = $item.find('h5.card-title').text().trim();
      
      if (!title) {
        console.warn(`ECA: Item ${index + 1} missing title`);
        return;
      }
      
      // Extract link from: <a href="..." class="stretched-link">
      const $link = $item.find('a.stretched-link').first();
      const href = $link.attr('href');
      
      if (!href) {
        console.warn(`ECA: Item ${index + 1} missing href`);
        return;
      }
      
      const link = href.startsWith('http') ? href : baseUrl + href;
      
      // Extract date from: <time class="card-date">DD/MM/YYYY</time>
      const dateText = $item.find('time.card-date').text().trim();
      let pubDate = null;
      
      if (dateText) {
        try {
          // Convert from "DD/MM/YYYY" format
          const [day, month, year] = dateText.split('/').map(Number);
          if (day && month && year) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
              pubDate = date.toUTCString();
            }
          }
        } catch (e) {
          console.warn(`ECA: Failed to parse date "${dateText}":`, e.message);
        }
      }
      
      // Fallback to current date
      if (!pubDate) {
        pubDate = new Date().toUTCString();
      }
      
      // Extract description from <p> tag
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
  scrapeECASimple,
  getECAChannelInfo,
  testParseECAHTML
};