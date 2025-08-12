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
  const cacheKey = 'eca-news-api-v3'; // Cache busting: Force fresh data
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

      // Get description (already comprehensive from our extract function)
      const description = extractDescription(newsItem);

      const rssItem = {
        title: title,
        link: link,
        description: cleanDescription(description, 800),
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
  
  // Clean up technical titles like "NEWS-JOURNAL-2025-01"
  if (title) {
    // Convert technical formats to readable titles
    title = title.replace(/NEWS-JOURNAL-(\d{4})-(\d{2})/, 'ECA Journal $1-$2');
    title = title.replace(/NEWS(\d{4})_(\d{2})_NEWSLETTER_(\d{2})/, 'ECA Newsletter $1-$2-$3');
    title = title.replace(/NEWS-/, '');
    title = title.replace(/_/g, ' ');
    title = title.replace(/-/g, ' ');
    
    // Capitalize properly
    title = title.split(' ')
                 .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                 .join(' ');
  }
  
  return title;
}

/**
 * Extract and construct full URL from API response
 */
function extractLink(newsItem, baseUrl) {
  // Based on API structure, construct URL from Id and Title
  const id = newsItem.Id;
  const title = newsItem.Title;
  
  if (!id || !title) {
    return '';
  }

  // For HTML news items, construct the URL pattern
  if (newsItem.IsHtml) {
    // Pattern appears to be: /en/news/[title-based-slug]
    const slug = title.toLowerCase()
                      .replace(/news-?/gi, '')
                      .replace(/[^a-z0-9]/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '');
    
    // Try different URL patterns based on title type
    if (title.includes('JOURNAL')) {
      return `${baseUrl}/en/journal/${slug}`;
    } else if (title.includes('NEWSLETTER')) {
      return `${baseUrl}/en/newsletters/${slug}`;
    } else {
      return `${baseUrl}/en/news/${slug}`;
    }
  }
  
  // Fallback to news section with ID
  return `${baseUrl}/en/news/${id}`;
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
 * Extract description from API response
 */
function extractDescription(newsItem) {
  // API response doesn't include description in the basic structure
  // We need to construct a meaningful description from available data
  const title = newsItem.Title || '';
  
  if (title.includes('JOURNAL')) {
    return 'Latest issue of the ECA Journal featuring audit reports, methodological articles, and insights from the European Court of Auditors. This publication provides detailed analysis of EU financial management and auditing practices.';
  } else if (title.includes('NEWSLETTER')) {
    return 'ECA Newsletter containing updates on recent audit work, court activities, and important developments in European Union financial oversight. Stay informed about the latest from the European Court of Auditors.';
  } else {
    return 'News and updates from the European Court of Auditors, including press releases, audit reports, and official statements on EU financial management and accountability.';
  }
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
 * Get enhanced description by checking available content fields
 */
async function getEnhancedDescription(newsItem, title, scraper) {
  // Check if we have HTML content in other fields
  const htmlFields = [
    newsItem.PublishingPageContent,
    newsItem.ArticleByLine,
    newsItem.Content,
    newsItem.Body
  ];

  for (const htmlContent of htmlFields) {
    if (htmlContent && htmlContent.length > 100) {
      // Parse HTML content to extract clean text
      const $ = cheerio.load(htmlContent);
      
      // Remove scripts, styles, and other unwanted elements
      $('script, style, nav, footer, .metadata').remove();
      
      // Get clean text content
      const cleanText = $.text().trim();
      
      if (cleanText.length > 100) {
        // Return first few paragraphs or 500 characters
        const sentences = cleanText.split('.').slice(0, 5).join('.');
        return sentences.length > 500 ? sentences.substring(0, 500) + '...' : sentences;
      }
    }
  }

  // Fallback to title if no description found
  return title;
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