import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';
import * as cheerio from 'cheerio';

async function investigateECA() {
  let scraper = null;
  
  try {
    console.log('🔍 DEEP INVESTIGATION: ECA Site Loading Analysis');
    console.log('================================================\n');
    
    scraper = new AdvancedScraperFixed();
    await scraper.initBrowser();
    
    console.log('⏱️  Starting timer...');
    const startTime = Date.now();
    
    // Navigate to the site
    console.log('🌐 Navigating to ECA site...');
    await scraper.navigateWithStealth('https://www.eca.europa.eu/en/all-news', {
      timeout: 30000,
      waitForNetworkIdle: false
    });
    
    const navTime = Date.now();
    console.log(`✅ Navigation completed in ${(navTime - startTime) / 1000}s\n`);
    
    // Function to analyze DOM state
    async function analyzeDOMState(label, timestamp) {
      const html = await scraper.page.content();
      const $ = cheerio.load(html);
      
      const analysis = {
        timestamp: timestamp - startTime,
        label,
        stats: {
          totalElements: $('*').length,
          scripts: $('script').length,
          reactRoot: $('section[data-reactroot]').length,
          newsSection: $('section.news').length,
          newsList: $('ul.news-list').length,
          newsListItems: $('ul.news-list li').length,
          cardNews: $('.card-news').length,
          cardNewsWithTitle: $('.card.card-news h5.card-title').length,
          anyCards: $('.card').length,
          newsLinks: $('a[href*="/news/"]').length,
          reportLinks: $('a[href*="/report/"]').length,
          journalLinks: $('a[href*="/journal/"]').length,
          textContent: $.text().includes('Journal') || $.text().includes('Newsletter') || $.text().includes('Report')
        }
      };
      
      console.log(`📊 DOM Analysis [${label}] at +${(analysis.timestamp / 1000).toFixed(1)}s:`);
      console.log(`   Total elements: ${analysis.stats.totalElements}`);
      console.log(`   Scripts loaded: ${analysis.stats.scripts}`);
      console.log(`   React root: ${analysis.stats.reactRoot}`);
      console.log(`   News section: ${analysis.stats.newsSection}`);
      console.log(`   News list (ul.news-list): ${analysis.stats.newsList}`);
      console.log(`   News list items: ${analysis.stats.newsListItems}`);
      console.log(`   Card-news: ${analysis.stats.cardNews}`);
      console.log(`   Card-news with titles: ${analysis.stats.cardNewsWithTitle}`);
      console.log(`   Any cards: ${analysis.stats.anyCards}`);
      console.log(`   News links: ${analysis.stats.newsLinks}`);
      console.log(`   Report links: ${analysis.stats.reportLinks}`);
      console.log(`   Journal links: ${analysis.stats.journalLinks}`);
      console.log(`   Has ECA text content: ${analysis.stats.textContent}`);
      console.log('');
      
      return analysis;
    }
    
    // Initial DOM state (right after navigation)
    const initial = await analyzeDOMState('INITIAL', Date.now());
    
    // Wait and check DOM state at intervals
    const snapshots = [initial];
    const intervals = [1000, 2000, 3000, 5000, 8000, 12000, 15000]; // Various intervals
    
    for (const interval of intervals) {
      await new Promise(resolve => setTimeout(resolve, interval - (snapshots.length > 1 ? intervals[snapshots.length - 2] : 0)));
      const snapshot = await analyzeDOMState(`T+${interval/1000}s`, Date.now());
      snapshots.push(snapshot);
      
      // Check if we have meaningful content
      if (snapshot.stats.newsListItems > 5 || snapshot.stats.cardNewsWithTitle > 3) {
        console.log(`🎯 CONTENT LOADED at +${(snapshot.timestamp / 1000).toFixed(1)}s!`);
        break;
      }
    }
    
    // Final analysis - look for any available selectors
    console.log('🔍 FINAL SELECTOR ANALYSIS:');
    console.log('========================');
    
    const selectorTests = [
      'ul.news-list li',
      '.card.card-news',
      '.card-news', 
      '.card',
      'section.news[data-reactroot]',
      'section.news',
      'ul.news-list',
      'h5.card-title',
      'a[href*="/news/"]',
      'a[href*="/report/"]',
      'a[href*="/journal/"]',
      '[class*="card"]',
      '[class*="news"]',
      'article',
      'li',
      'h1, h2, h3, h4, h5',
      'a[href*="eca.europa.eu"]'
    ];
    
    for (const selector of selectorTests) {
      const count = await scraper.page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      console.log(`   ${selector}: ${count} elements`);
    }
    
    // Check for dynamic loading indicators
    console.log('\n🔄 LOADING INDICATORS:');
    console.log('=====================');
    
    const loadingChecks = await scraper.page.evaluate(() => {
      return {
        readyState: document.readyState,
        scriptsLoading: Array.from(document.querySelectorAll('script')).some(s => !s.src || s.src.includes('news-page-web-part')),
        hasSpinner: document.querySelectorAll('[class*="loading"], [class*="spinner"]').length,
        networkRequests: performance.getEntriesByType('navigation').length,
        reactComponents: window.React ? 'React detected' : 'No React',
        customElements: document.querySelectorAll('[data-reactroot]').length
      };
    });
    
    console.log(`   Document ready state: ${loadingChecks.readyState}`);
    console.log(`   Scripts loading: ${loadingChecks.scriptsLoading}`);
    console.log(`   Loading spinners: ${loadingChecks.hasSpinner}`);
    console.log(`   Network requests: ${loadingChecks.networkRequests}`);
    console.log(`   React status: ${loadingChecks.reactComponents}`);
    console.log(`   React root elements: ${loadingChecks.customElements}`);
    
    // Get actual page source to compare with eca.html
    const finalHTML = await scraper.page.content();
    
    console.log('\n📝 CONTENT COMPARISON:');
    console.log('=====================');
    console.log(`   Live page size: ${finalHTML.length} characters`);
    
    // Check if we can find the specific structure from eca.html
    const $ = cheerio.load(finalHTML);
    const foundStructures = {
      newsPageWebPart: $.html().includes('news-page-web-part'),
      sharePointStructure: $.html().includes('SharePoint'),
      reactBundle: $.html().includes('react'),
      newsListClass: $('.news-list').length,
      cardNewsClass: $('.card-news').length,
      dataReactRoot: $('[data-reactroot]').length
    };
    
    console.log('   Found structures:');
    Object.entries(foundStructures).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`);
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total investigation time: ${totalTime / 1000}s`);
    
    // Summary and recommendations
    console.log('\n📋 INVESTIGATION SUMMARY:');
    console.log('========================');
    
    const finalSnapshot = snapshots[snapshots.length - 1];
    if (finalSnapshot.stats.newsListItems > 5) {
      console.log(`✅ Content successfully loaded with ${finalSnapshot.stats.newsListItems} items`);
      console.log(`⏱️  Content loaded at: +${(finalSnapshot.timestamp / 1000).toFixed(1)}s`);
    } else if (finalSnapshot.stats.newsLinks > 0) {
      console.log(`⚠️  Partial content loaded: ${finalSnapshot.stats.newsLinks} news links found`);
    } else {
      console.log(`❌ No significant content loaded`);
    }
    
    // Find when content actually becomes available
    let contentLoadTime = null;
    for (const snapshot of snapshots) {
      if (snapshot.stats.newsListItems > 0 || snapshot.stats.cardNewsWithTitle > 0) {
        contentLoadTime = snapshot.timestamp / 1000;
        break;
      }
    }
    
    if (contentLoadTime) {
      console.log(`🎯 Optimal wait time: ${contentLoadTime.toFixed(1)}s`);
      if (contentLoadTime <= 10) {
        console.log('✅ Content loads within Vercel timeout limits');
      } else {
        console.log('❌ Content loads too slowly for Vercel Hobby tier');
      }
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
    console.error(error.stack);
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

investigateECA();