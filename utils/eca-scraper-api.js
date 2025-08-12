/**
 * ECA (European Court of Auditors) RSS Scraper - Strategy 1: Direct API Access
 * Uses SharePoint authentication tokens to directly access NewsService.svc/Search API
 * 
 * This approach:
 * 1. Loads page with Puppeteer to extract SharePoint authentication tokens
 * 2. Makes direct API calls using extracted X-RequestDigest 
 * 3. Parses JSON response instead of DOM scraping
 * 4. Generates professional-grade RSS from structured data
 */

import * as cheerio from 'cheerio';
import AdvancedScraperFixed from './advanced-scraper-fixed.js';
import { cache } from './http-client.js';
import { cleanDescription, formatRSSDate } from './rss-builder.js';

/**
 * Strategy 1: Direct API access with SharePoint authentication
 */
async function scrapeECANewsAPI() {
  const cacheKey = 'eca-news-api-v5'; // Enriched content - force fresh data
  let scraper = null;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('ECA API: Returning cached news data');
      return cached;
    }

    console.log('ECA API: Starting SharePoint authentication + direct API access...');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser for ECA API scraping');
    }

    // Step 1: Load page and extract SharePoint authentication tokens
    console.log('ECA API: Loading page to extract SharePoint tokens...');
    
    await scraper.navigateWithStealth(
      'https://www.eca.europa.eu/en/all-news',
      {
        timeout: 8000, // Faster timeout for Vercel
        waitForNetworkIdle: false // Speed optimization
      }
    );

    // Step 2: Extract SharePoint authentication context
    console.log('ECA API: Extracting SharePoint authentication tokens...');
    
    const authContext = await scraper.page.evaluate(() => {
      // Extract form digest value
      const digestInput = document.querySelector('#__REQUESTDIGEST');
      const digestValue = digestInput ? digestInput.value : null;
      
      // Extract from SharePoint context as fallback
      const spDigest = window._spPageContextInfo?.formDigestValue;
      const siteUrl = window._spPageContextInfo?.siteAbsoluteUrl;
      
      // Get correlation ID for debugging
      const correlationId = window._spPageContextInfo?.CorrelationId;
      
      return {
        digestValue: digestValue || spDigest,
        siteUrl: siteUrl,
        correlationId: correlationId,
        hasSharePointContext: !!window._spPageContextInfo
      };
    });

    console.log(`ECA API: Authentication context extracted:`, {
      hasDigest: !!authContext.digestValue,
      hasSiteUrl: !!authContext.siteUrl,
      hasSharePointContext: authContext.hasSharePointContext,
      correlationId: authContext.correlationId?.substring(0, 8) + '...'
    });

    if (!authContext.digestValue || !authContext.siteUrl) {
      throw new Error('Failed to extract SharePoint authentication tokens');
    }

    // Step 3: Make direct authenticated API call to NewsService.svc/Search
    console.log('ECA API: Making authenticated API call to NewsService...');
    
    const newsData = await scraper.page.evaluate(async (authCtx) => {
      try {
        const response = await fetch(authCtx.siteUrl + "/_vti_bin/ECA.Internet/NewsService.svc/Search", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-RequestDigest": authCtx.digestValue,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: JSON.stringify({
            searchInput: {
              RowLimit: 30, // Optimized for speed - fewer items
              WebsiteTopics: [], // No topic filters
              StartDate: null,   // No date filters  
              EndDate: null
            }
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('ECA API: Received response with', data?.length || 0, 'items');
        
        return {
          success: true,
          data: data,
          status: response.status
        };
        
      } catch (error) {
        console.error('ECA API: API call error:', error);
        return {
          success: false,
          error: error.message,
          data: null
        };
      }
    }, authContext);

    if (!newsData.success || !newsData.data) {
      throw new Error(`API call failed: ${newsData.error || 'Unknown error'}`);
    }

    console.log(`ECA API: Successfully received ${newsData.data.length} news items from API`);

    // Step 4: Process API response into RSS items
    const items = await processECAApiResponse(newsData.data, authContext.siteUrl, scraper);
    
    if (items.length === 0) {
      throw new Error('No news items found in API response');
    }

    console.log(`ECA API: Successfully processed ${items.length} news items`);

    // Step 5: Enrich items with real content from article pages
    // For now, skip enrichment to avoid regression - return working RSS with proper URLs
    console.log('ECA API: Skipping content enrichment for now to ensure stable RSS delivery');
    
    // Add basic descriptions to avoid empty content
    items.forEach(item => {
      if (!item.description) {
        // Use category-based descriptions as fallback (no regression)
        if (item.category === 'ECA Journal') {
          item.description = 'Latest issue of the ECA Journal featuring audit reports, methodological articles, and insights from the European Court of Auditors.';
        } else if (item.category === 'Newsletter') {
          item.description = 'ECA Newsletter containing updates on recent audit work, court activities, and important developments in European Union oversight.';
        } else {
          item.description = 'News and updates from the European Court of Auditors, including press releases, audit reports, and official statements.';
        }
      }
    });
    
    // Return final items (limit to 20 for performance)
    const finalItems = items.slice(0, 20);
    
    // Cache successful results for 30 minutes
    cache.set(cacheKey, finalItems);
    
    return finalItems;

  } catch (error) {
    console.error('ECA API scraping error:', error.message);
    
    // Return cached data if available
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('ECA API: Returning stale cached data due to error');
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
 * Process API response from NewsService.svc/Search into RSS items
 */
async function processECAApiResponse(apiData, siteUrl, scraper) {
  const items = [];
  const baseUrl = 'https://www.eca.europa.eu';
  
  console.log('ECA API: Processing API response data...');
  
  // API returns array of news objects from SharePoint
  for (const [index, newsItem] of apiData.entries()) {
    try {
      console.log(`ECA API: Processing item ${index + 1}/${apiData.length}...`);
      
      // Extract basic information from API response
      const title = extractTitle(newsItem);
      const link = extractLink(newsItem, baseUrl);
      const pubDate = extractPubDate(newsItem);
      const category = extractCategory(newsItem);
      const imageUrl = extractImageUrl(newsItem, baseUrl);
      
      if (!title || !link) {
        console.warn(`ECA API: Skipping item ${index + 1} - missing title or link`);
        continue;
      }

      // Get description (will be enriched later with real content)
      const description = extractDescription(newsItem);

      const rssItem = {
        title: title,
        link: link,
        description: description, // Will be populated during enrichment
        pubDate: pubDate,
        guid: link,
        category: category,
        ...(imageUrl && { enclosure: imageUrl })
      };

      items.push(rssItem);
      
    } catch (error) {
      console.warn(`ECA API: Error processing item ${index + 1}:`, error.message);
    }
  }

  // Sort by publication date (newest first)
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  console.log(`ECA API: Successfully processed ${items.length} items`);
  return items;
}

/**
 * Extract title from API response
 */
function extractTitle(newsItem) {
  // Based on actual API structure: {Id, ImageUrl, IsHtml, StartDate, Title}
  let title = newsItem.Title || '';
  
  // SIMPLIFIED: Keep titles closer to original for now, just basic cleanup
  if (title) {
    // Convert underscores to spaces and basic capitalization
    title = title.replace(/_/g, ' ');
    title = title.replace(/NEWS-?/gi, '');
    
    // Basic title case conversion
    title = title.split(' ')
                 .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                 .join(' ');
    
    // Clean up extra spaces
    title = title.replace(/\s+/g, ' ').trim();
  }
  
  return title;
}

/**
 * Extract and construct full URL from API response
 */
function extractLink(newsItem, baseUrl) {
  // Based on API structure, construct URL from Title
  const title = newsItem.Title;
  
  if (!title) {
    return '';
  }

  // FIXED: All items go to /en/news/[EXACT-TITLE] as shown in webpage
  // The webpage shows ALL items use /en/news/ regardless of type
  return `${baseUrl}/en/news/${title}`;
}

/**
 * Extract publication date from API response
 */
function extractPubDate(newsItem) {
  // Parse StartDate which is in format: "/Date(1751270400000+0200)/"
  const startDate = newsItem.StartDate;
  
  if (startDate && typeof startDate === 'string') {
    // Extract timestamp from the .NET JSON date format
    const match = startDate.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
    if (match) {
      const timestamp = parseInt(match[1]);
      const date = new Date(timestamp);
      
      if (!isNaN(date.getTime()) && date.getFullYear() > 2020 && date.getFullYear() < 2030) {
        return date.toUTCString();
      }
    }
  }

  // Fallback to current date
  return new Date().toUTCString();
}

/**
 * Extract description from actual article content (placeholder - will be enriched)
 */
function extractDescription(newsItem) {
  // This will be replaced with real content during enrichment
  // Return empty string as fallback - enrichment will populate real content
  return '';
}

/**
 * Extract category from API response
 */
function extractCategory(newsItem) {
  // Determine category based on content type or URL
  const url = (newsItem.Url || '').toLowerCase();
  const title = (newsItem.Title || '').toLowerCase();
  
  if (url.includes('journal') || title.includes('journal')) {
    return 'ECA Journal';
  } else if (url.includes('newsletter') || title.includes('newsletter')) {
    return 'Newsletter';  
  } else if (url.includes('sr-') || title.includes('special report')) {
    return 'Special Report';
  } else if (url.includes('rv-') || title.includes('review')) {
    return 'Review';
  } else if (url.includes('opinion') || title.includes('opinion')) {
    return 'Opinion';
  } else if (title.includes('press release') || title.includes('press statement')) {
    return 'Press Release';
  }
  
  return 'ECA News';
}

/**
 * Extract image URL from API response  
 */
function extractImageUrl(newsItem, baseUrl) {
  let imageUrl = newsItem.ImageUrl || '';

  // Handle relative image URLs  
  if (imageUrl && !imageUrl.startsWith('http')) {
    if (imageUrl.startsWith('/')) {
      imageUrl = baseUrl + imageUrl;
    } else {
      imageUrl = baseUrl + '/' + imageUrl;
    }
  }

  return imageUrl;
}

/**
 * Enrich news item with real title and content from article page
 */
async function enrichNewsItem(item, scraper) {
  try {
    console.log(`ECA API: Enriching content for ${item.link}`);
    
    // Navigate to the actual news article
    await scraper.navigateWithStealth(item.link, {
      timeout: 3000, // Fast timeout for enrichment
      waitForNetworkIdle: false
    });

    // Extract real title and content from the page
    const enrichedData = await scraper.page.evaluate(() => {
      // Extract real user-facing title
      const titleSelectors = [
        'h1',
        '.page-title',
        '.article-title', 
        '.news-title',
        '.content-title'
      ];
      
      let realTitle = '';
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          realTitle = element.textContent.trim();
          break;
        }
      }
      
      // Fallback to page title without site name
      if (!realTitle) {
        realTitle = document.title?.replace(' | European Court of Auditors', '').trim() || '';
      }

      // Extract article content
      const contentSelectors = [
        '.content-main',
        '.article-body',
        '.news-content',
        '.publication-content',
        'main .content',
        '.page-content',
        '[data-content]',
        '.body-content'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Remove unwanted elements
          const clonedElement = element.cloneNode(true);
          clonedElement.querySelectorAll('.share-buttons, .metadata, .footer, .sidebar, nav, .breadcrumb, .tags, .date, .author, script, style').forEach(el => el.remove());
          
          content = clonedElement.textContent.trim();
          if (content.length > 100) {
            break;
          }
        }
      }

      return {
        title: realTitle,
        content: content
      };
    });

    // Update item with enriched data
    if (enrichedData.title) {
      item.title = enrichedData.title;
    }
    
    if (enrichedData.content) {
      // Clean and truncate content (reuse EEAS cleaning logic)
      item.description = cleanDescription(enrichedData.content, 500);
    }

    console.log(`ECA API: Successfully enriched ${item.title.substring(0, 50)}...`);
    return item;

  } catch (error) {
    console.warn(`ECA API: Failed to enrich ${item.link}: ${error.message}`);
    // Return original item if enrichment fails (no regression)
    return item;
  }
}

/**
 * Enrich multiple items with content sequentially for stability
 */
async function enrichItemsBatch(items, scraper) {
  console.log(`ECA API: Starting content enrichment for ${items.length} items`);
  
  const enrichedItems = [];
  const maxItems = Math.min(items.length, 5); // Limit to 5 items for performance
  
  for (let i = 0; i < maxItems; i++) {
    const item = items[i];
    console.log(`ECA API: Enriching item ${i + 1}/${maxItems}: ${item.title}`);
    
    try {
      // Process items sequentially to avoid browser session conflicts
      const enrichedItem = await Promise.race([
        enrichNewsItem(item, scraper),
        new Promise(resolve => setTimeout(() => resolve(item), 3000)) // 3s timeout per item
      ]);
      
      enrichedItems.push(enrichedItem);
      
      // Small delay between items to prevent session conflicts
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.warn(`ECA API: Enrichment failed for item ${i + 1}: ${error.message}`);
      enrichedItems.push(item); // Use original item on failure
    }
  }
  
  // Add remaining items without enrichment if we hit the limit
  if (items.length > maxItems) {
    enrichedItems.push(...items.slice(maxItems));
  }
  
  console.log(`ECA API: Content enrichment completed (${maxItems} enriched, ${items.length - maxItems} remaining)`);
  return enrichedItems;
}

/**
 * Get ECA channel info for RSS feed
 */
function getECAChannelInfoAPI() {
  return {
    title: 'ECA News - European Court of Auditors',
    description: 'Latest news, reports, and publications from the European Court of Auditors via SharePoint API',
    link: 'https://www.eca.europa.eu/en/all-news',
    language: 'en',
    generator: 'EU RSS Generator - ECA SharePoint API'
  };
}

export {
  scrapeECANewsAPI,
  getECAChannelInfoAPI
};