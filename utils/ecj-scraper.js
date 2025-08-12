/**
 * ECJ (European Court of Justice) RSS Scraper - Professional Grade
 * Scrapes press releases from Curia Europa with webpage summaries
 * 
 * Strategy:
 * 1. Scrape HTML listing page for titles, summaries and PDF links
 * 2. Extract real descriptions from webpage content (no PDF parsing)
 * 3. Generate professional RSS feed matching EEAS quality standards
 */

import AdvancedScraperFixed from './advanced-scraper-fixed.js';
import { cache } from './http-client.js';
import { cleanDescription } from './rss-builder.js';

/**
 * Scrape ECJ press releases and generate professional RSS items
 */
async function scrapeECJNews() {
  const cacheKey = 'ecj-news-professional-v1';
  let scraper = null;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('ECJ: Returning cached professional news data');
      return cached;
    }

    console.log('ECJ: Starting professional press release scraping...');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser for ECJ scraping');
    }

    // Step 1: Load main press releases page
    console.log('ECJ: Loading press releases page...');
    
    await scraper.navigateWithStealth(
      'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
      {
        timeout: 12000, // Vercel compatible timeout
        waitForNetworkIdle: true
      }
    );

    // Step 2: Extract press release items and summaries separately (they are in different DOM sections)
    console.log('ECJ: Extracting press releases and summaries separately...');
    
    const pressReleases = await scraper.page.evaluate(() => {
      // Step 2A: Extract all press release items (cp_item divs)
      const pressItems = [];
      const itemElements = document.querySelectorAll('.cp_item');
      
      console.log(`Found ${itemElements.length} cp_item elements`);
      
      itemElements.forEach((element, index) => {
        if (index >= 7) return; // Limit to 7 items as requested
        
        const dateElement = element.querySelector('.cp_date');
        const titleElement = element.querySelector('.cp_title a');
        
        if (!dateElement || !titleElement) return;
        
        const text = dateElement.textContent || '';
        const pressMatch = text.match(/No\s+(\d+)\/(\d{4})/);
        const dateMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        
        if (!pressMatch) return;
        
        const title = titleElement.textContent.trim();
        const link = titleElement.href;
        
        pressItems.push({
          title: title,
          link: link,
          date: dateMatch ? dateMatch[0] : '',
          pressNumber: pressMatch[0],
          index: index
        });
      });
      
      // Step 2B: Extract all summaries (cp_domain + cp_summary pairs)
      const summaries = [];
      const domainElements = document.querySelectorAll('.cp_domain');
      
      console.log(`Found ${domainElements.length} cp_domain elements`);
      
      // Process each domain and check if it has a direct cp_summary sibling
      for (let i = 0; i < domainElements.length; i++) {
        const domainElement = domainElements[i];
        const domainText = domainElement.textContent?.trim() || '';
        
        if (!domainText) continue;
        
        // Check if the next sibling is a cp_summary
        const nextSibling = domainElement.nextElementSibling;
        
        if (nextSibling && nextSibling.classList.contains('cp_summary')) {
          // This domain has a direct summary following it
          const summaryText = nextSibling.textContent?.trim() || '';
          if (summaryText) {
            summaries.push(`${domainText}: ${summaryText}`);
          } else {
            summaries.push(domainText);
          }
        } else {
          // This domain stands alone (it contains the full description)
          summaries.push(domainText);
        }
      }
      
      console.log(`Created ${summaries.length} professional summaries`);
      
      // Step 2C: Match press releases with summaries by order
      const items = [];
      for (let i = 0; i < pressItems.length && i < summaries.length; i++) {
        const pressItem = pressItems[i];
        const summary = summaries[i];
        
        items.push({
          title: pressItem.title,
          link: pressItem.link,
          date: pressItem.date,
          summary: summary,
          pressNumber: pressItem.pressNumber
        });
      }
      
      // Handle any remaining press items without summaries
      for (let i = summaries.length; i < pressItems.length; i++) {
        const pressItem = pressItems[i];
        items.push({
          title: pressItem.title,
          link: pressItem.link,
          date: pressItem.date,
          summary: 'European Court of Justice judgment - full press release available.',
          pressNumber: pressItem.pressNumber
        });
      }
      
      console.log(`Matched ${items.length} press releases with their summaries`);
      return items;
    });

    console.log(`ECJ: Found ${pressReleases.length} press release items`);
    
    if (pressReleases.length === 0) {
      throw new Error('No press releases found on the page');
    }

    // Step 3: Convert to professional RSS items (no PDF processing needed)
    const rssItems = [];
    const maxItems = Math.min(pressReleases.length, 7);
    
    for (let i = 0; i < maxItems; i++) {
      const release = pressReleases[i];
      console.log(`ECJ: Processing item ${i + 1}/${maxItems}: ${release.title.substring(0, 50)}...`);
      
      // Create professional RSS item
      const rssItem = {
        title: release.title,
        link: release.link,
        description: cleanDescription(release.summary, 500), // Clean and format description
        pubDate: parseDateString(release.date),
        guid: release.link,
        enclosure: {
          url: release.link,
          type: 'application/pdf'
        }
      };

      rssItems.push(rssItem);
    }

    console.log(`ECJ: Successfully processed ${rssItems.length} professional RSS items`);
    
    // Cache results for 30 minutes
    cache.set(cacheKey, rssItems);
    
    return rssItems;

  } catch (error) {
    console.error('ECJ scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('ECJ: Returning stale cached data due to error');
      return cached;
    }
    
    throw error;
    
  } finally {
    // Always cleanup browser resources for Vercel compatibility
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

/**
 * Parse date string from various formats
 */
function parseDateString(dateStr) {
  if (!dateStr) {
    return new Date().toUTCString();
  }
  
  // Handle formats like "31 July 2025"
  const dateMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const monthMap = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3,
      'May': 4, 'June': 5, 'July': 6, 'August': 7,
      'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    
    const monthIndex = monthMap[month];
    if (monthIndex !== undefined) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      return date.toUTCString();
    }
  }
  
  // Fallback to current date
  return new Date().toUTCString();
}

/**
 * Get ECJ channel info for RSS feed - Professional grade matching EEAS
 */
function getECJChannelInfo() {
  return {
    title: 'European Court of Justice - Press Releases',
    description: 'Latest press releases and judgments from the European Court of Justice',
    link: 'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
    language: 'en',
    generator: 'EU RSS Generator - ECJ Professional'
  };
}

export {
  scrapeECJNews,
  getECJChannelInfo
};