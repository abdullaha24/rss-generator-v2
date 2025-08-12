/**
 * Debug script to capture raw ECA API JSON response
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';
import { promises as fs } from 'fs';

async function captureAPIResponse() {
  console.log('🔍 CAPTURING RAW ECA API RESPONSE');
  console.log('='.repeat(50));

  let scraper = null;

  try {
    scraper = new AdvancedScraperFixed();
    await scraper.initBrowser();

    console.log('📡 Loading ECA page and extracting API response...');
    
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

    console.log('✅ Authentication extracted');

    // Make API call and capture raw response
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
              RowLimit: 10, // Get fewer items for detailed inspection
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
          data: data,
          dataType: typeof data,
          isArray: Array.isArray(data),
          length: data?.length || 0
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

    console.log(`\n📊 API RESPONSE SUMMARY:`);
    console.log(`   Status: ${apiResult.status}`);
    console.log(`   Data type: ${apiResult.dataType}`);
    console.log(`   Is array: ${apiResult.isArray}`);
    console.log(`   Length: ${apiResult.length}`);

    // Save raw JSON response
    const filename = 'eca-api-raw-response.json';
    await fs.writeFile(filename, JSON.stringify(apiResult.data, null, 2), 'utf8');
    
    console.log(`\n✅ Raw API response saved to: ${filename}`);
    
    // Show first few items in detail
    if (apiResult.data && apiResult.data.length > 0) {
      console.log(`\n📝 FIRST 3 ITEMS FROM API:`);
      console.log('='.repeat(40));
      
      apiResult.data.slice(0, 3).forEach((item, i) => {
        console.log(`\nItem ${i + 1}:`);
        console.log(JSON.stringify(item, null, 2));
        console.log('-'.repeat(30));
      });
    }

    console.log(`\n🎉 API inspection completed!`);
    
  } catch (error) {
    console.error(`\n❌ Inspection failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

captureAPIResponse();