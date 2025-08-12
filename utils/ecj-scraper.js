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

    // Step 2: Extract press release items with professional summaries
    console.log('ECJ: Extracting press releases with webpage summaries...');
    
    const pressReleases = await scraper.page.evaluate(() => {
      const items = [];
      
      // Find all elements containing press release numbers
      const allElements = [...document.querySelectorAll('*')];
      const pressElements = allElements.filter(el => {
        const text = el.textContent || '';
        return text.match(/No\s+\d+\/\d{4}/) && text.length > 20 && text.length < 2000;
      });
      
      console.log(`Found ${pressElements.length} elements with press release numbers`);
      
      pressElements.forEach((element, index) => {
        if (index >= 7) return; // Limit to 7 items as requested
        
        const text = element.textContent || '';
        const pressMatch = text.match(/No\s+(\d+)\/(\d{4})/);
        const dateMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        
        if (!pressMatch) return;
        
        // Find all links within this element and nearby elements
        let links = [];
        
        // Check the element itself
        const elementLinks = element.querySelectorAll('a[href*="p1_"]');
        links.push(...elementLinks);
        
        // Check parent element
        let parent = element.parentElement;
        if (parent) {
          const parentLinks = parent.querySelectorAll('a[href*="p1_"]');
          links.push(...parentLinks);
        }
        
        // Find the best link (longest meaningful text, prefer "Judgment" titles)
        let bestLink = null;
        let bestScore = 0;
        
        links.forEach(link => {
          const linkText = (link.textContent || '').trim();
          const score = linkText.length;
          
          // Prefer links with "Judgment" in the text (these are the main titles)
          if (linkText.includes('Judgment') && score > bestScore) {
            bestLink = link;
            bestScore = score;
          } else if (!bestLink && score > 10 && !linkText.match(/^bg|^es|^de|^fr|^it$/i)) {
            // Fallback to any meaningful link text (exclude language codes)
            bestLink = link;
            bestScore = score;
          }
        });
        
        // Extract title from the best link
        let title = '';
        if (bestLink) {
          title = bestLink.textContent.trim();
        } else {
          title = `Press Release ${pressMatch[0]}`;
        }
        
        // Extract professional summary from specific CSS classes
        // Target: <div class="cp_domain"> and <div class="cp_summary">
        let summary = '';
        
        // Look for cp_domain and cp_summary classes within this element
        const domainElement = element.querySelector('.cp_domain');
        const summaryElement = element.querySelector('.cp_summary');
        
        if (domainElement && summaryElement) {
          const domainText = domainElement.textContent?.trim() || '';
          const summaryText = summaryElement.textContent?.trim() || '';
          
          if (domainText && summaryText) {
            // Combine with line break (will be properly encoded in CDATA)
            summary = `${domainText}
${summaryText}`;
          } else if (summaryText) {
            // Use just summary if domain is empty
            summary = summaryText;
          } else if (domainText) {
            // Use just domain if summary is empty  
            summary = domainText;
          }
        }
        
        // Fallback: Look in parent elements for cp_domain/cp_summary
        if (!summary && element.parentElement) {
          const parentDomain = element.parentElement.querySelector('.cp_domain');
          const parentSummary = element.parentElement.querySelector('.cp_summary');
          
          if (parentDomain && parentSummary) {
            const domainText = parentDomain.textContent?.trim() || '';
            const summaryText = parentSummary.textContent?.trim() || '';
            
            if (domainText && summaryText) {
              summary = `${domainText}
${summaryText}`;
            } else if (summaryText) {
              summary = summaryText;
            }
          }
        }
        
        // Ultimate fallback: Professional generic description (no regression)
        if (!summary) {
          summary = 'European Court of Justice judgment - full press release available.';
        }
        
        items.push({
          title: title,
          link: bestLink ? bestLink.href : '',
          date: dateMatch ? dateMatch[0] : '',
          summary: summary,
          pressNumber: pressMatch[0]
        });
      });
      
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