/**
 * EEAS Press Material Scraper
 * Scrapes https://www.eeas.europa.eu/eeas/press-material_en
 */

import * as cheerio from 'cheerio';
import { fetchHTML, cache } from './http-client.js';
import { resolveUrl, cleanDescription } from './rss-builder.js';

/**
 * Scrape EEAS press material listings
 */
async function scrapeEEAS() {
  const baseUrl = 'https://www.eeas.europa.eu';
  const listingUrl = 'https://www.eeas.europa.eu/eeas/press-material_en';
  
  try {
    // Check cache first
    const cacheKey = 'eeas-feed';
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached EEAS data');
      return cached;
    }
    
    console.log('Scraping EEAS press material...');
    const html = await fetchHTML(listingUrl);
    const $ = cheerio.load(html);
    
    const items = [];
    
    // Extract press release cards
    $('.related-grid .card').each((index, element) => {
      try {
        const $card = $(element);
        
        // Extract title and link
        const $titleLink = $card.find('.card-title a');
        const title = $titleLink.text().trim();
        const relativeUrl = $titleLink.attr('href');
        
        if (!title || !relativeUrl) return;
        
        // Resolve URL
        const link = resolveUrl(relativeUrl, baseUrl);
        
        // Extract category
        const category = $card.find('.card-subtitle .field__item').text().trim();
        
        // Extract date
        const dateText = $card.find('.card-footer.node__meta').text().trim();
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{4})/);
        const pubDate = dateMatch ? dateMatch[1] : null;
        
        // Skip if we don't have essential data
        if (!title || !link) return;
        
        items.push({
          title,
          link,
          category: category || 'Press Material',
          pubDate,
          description: '', // Will be filled by individual page scraping
          guid: link
        });
        
        // Limit to 50 items
        if (items.length >= 50) return false;
        
      } catch (error) {
        console.error('Error processing EEAS card:', error.message);
      }
    });
    
    console.log(`Found ${items.length} EEAS press items`);
    
    // Fetch content for each item (limit to first 20 for performance)
    const itemsWithContent = await Promise.allSettled(
      items.slice(0, 20).map(item => enrichItemContent(item))
    );
    
    // Add remaining items without full content
    const enrichedItems = itemsWithContent
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .concat(items.slice(20).map(item => ({
        ...item,
        description: item.title // Fallback to title as description
      })));
    
    // Cache results
    cache.set(cacheKey, enrichedItems);
    
    return enrichedItems;
    
  } catch (error) {
    console.error('EEAS scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get('eeas-feed');
    if (cached) {
      console.log('Returning stale cached data due to error');
      return cached;
    }
    
    throw error;
  }
}

/**
 * Enrich item with full content from individual page
 */
async function enrichItemContent(item) {
  try {
    // Skip external URLs
    if (!item.link.includes('eeas.europa.eu')) {
      return {
        ...item,
        description: item.title
      };
    }
    
    console.log(`Fetching content for: ${item.title.substring(0, 50)}...`);
    
    const html = await fetchHTML(item.link);
    const $ = cheerio.load(html);
    
    // Extract main content
    let content = '';
    
    // Try different content selectors
    const contentSelectors = [
      '.node__content',
      '#block-eeas-website-content',
      '.content-wrapper',
      '.field--name-body .field__item',
      '.node__content .field--name-body',
      '.content .field__item',
      'main .content',
      '.node-content',
      'main'
    ];
    
    for (const selector of contentSelectors) {
      const $content = $(selector).first();
      if ($content.length) {
        content = $content.text().trim();
        console.log(`Found content using selector: ${selector} (${content.length} chars)`);
        break;
      }
    }
    
    if (!content) {
      console.log(`No content found for ${item.link} - available selectors:`, 
        contentSelectors.map(sel => `${sel}:${$(sel).length}`).join(', '));
    }
    
    // Clean and limit content
    const description = cleanDescription(content, 500) || item.title;
    
    return {
      ...item,
      description
    };
    
  } catch (error) {
    console.error(`Error enriching content for ${item.link}:`, error.message);
    return {
      ...item,
      description: item.title
    };
  }
}

/**
 * Get EEAS channel info
 */
function getEEASChannelInfo() {
  return {
    title: 'EEAS Press Material',
    description: 'European External Action Service Press Releases and Statements',
    link: 'https://www.eeas.europa.eu/eeas/press-material_en',
    language: 'en',
    generator: 'EU RSS Generator'
  };
}

export {
  scrapeEEAS,
  getEEASChannelInfo
};