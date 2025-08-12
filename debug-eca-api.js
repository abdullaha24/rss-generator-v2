/**
 * Debug script to inspect ECA API response structure
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';

async function debugECAAPI() {
  console.log('🔍 DEBUGGING ECA API RESPONSE STRUCTURE');
  console.log('='.repeat(50));
  
  let scraper = null;

  try {
    scraper = new AdvancedScraperFixed();
    await scraper.initBrowser();

    // Load page and extract authentication
    await scraper.navigateWithStealth('https://www.eca.europa.eu/en/all-news', {
      timeout: 10000,
      waitForNetworkIdle: false
    });

    const authContext = await scraper.page.evaluate(() => {
      const digestInput = document.querySelector('#__REQUESTDIGEST');
      const digestValue = digestInput ? digestInput.value : null;
      const spDigest = window._spPageContextInfo?.formDigestValue;
      const siteUrl = window._spPageContextInfo?.siteAbsoluteUrl;
      
      return {
        digestValue: digestValue || spDigest,
        siteUrl: siteUrl,
      };
    });

    console.log('✅ Authentication extracted successfully');

    // Make API call and inspect first few items
    const apiResult = await scraper.page.evaluate(async (authCtx) => {
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
              RowLimit: 3, // Only get 3 items for debugging
              WebsiteTopics: [],
              StartDate: null,
              EndDate: null
            }
          })
        });

        const data = await response.json();
        
        return {
          success: true,
          status: response.status,
          dataType: typeof data,
          isArray: Array.isArray(data),
          length: data?.length || 0,
          sampleItems: data?.slice(0, 2) || [],
          keys: data?.length > 0 ? Object.keys(data[0] || {}) : []
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, authContext);

    if (!apiResult.success) {
      throw new Error(`API call failed: ${apiResult.error}`);
    }

    console.log(`\n📊 API RESPONSE ANALYSIS:`);
    console.log(`   Status: ${apiResult.status}`);
    console.log(`   Data type: ${apiResult.dataType}`);
    console.log(`   Is array: ${apiResult.isArray}`);
    console.log(`   Length: ${apiResult.length}`);
    
    if (apiResult.keys.length > 0) {
      console.log(`\n🔑 Available fields in items:`);
      console.log(`   ${apiResult.keys.join(', ')}`);
    }

    if (apiResult.sampleItems.length > 0) {
      console.log(`\n📝 SAMPLE ITEMS:`);
      apiResult.sampleItems.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`   ${JSON.stringify(item, null, 4)}`);
      });
    }

  } catch (error) {
    console.error(`❌ Debug failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

debugECAAPI();