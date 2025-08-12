/**
 * Scrape what's actually visible on the ECA webpage
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';
import { promises as fs } from 'fs';

async function scrapeWebpageContent() {
  console.log('🔍 SCRAPING ACTUAL WEBPAGE CONTENT');
  console.log('='.repeat(50));

  let scraper = null;

  try {
    scraper = new AdvancedScraperFixed();
    await scraper.initBrowser();

    console.log('📡 Loading ECA page...');
    
    await scraper.navigateWithStealth('https://www.eca.europa.eu/en/all-news', {
      timeout: 15000,
      waitForNetworkIdle: true
    });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ Page loaded, extracting visible content...');

    const pageContent = await scraper.page.evaluate(() => {
      // Try different selectors to find news items
      const selectors = [
        '.card-news',
        '.news-item',
        '.card',
        '[data-news]',
        '.ms-listviewtable tr',
        '.news-list li',
        '.news-container .item',
        '.content-news-item'
      ];
      
      let items = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          Array.from(elements).slice(0, 10).forEach((el, index) => {
            const titleEl = el.querySelector('h1, h2, h3, h4, .title, .news-title, a[href*="/en/"]');
            const linkEl = el.querySelector('a[href*="/en/"]') || titleEl;
            const dateEl = el.querySelector('.date, .published, time, .news-date');
            
            items.push({
              selector: selector,
              index: index,
              title: titleEl?.textContent?.trim() || 'No title found',
              link: linkEl?.href || 'No link found',
              date: dateEl?.textContent?.trim() || 'No date found',
              innerHTML: el.innerHTML.substring(0, 200) + '...'
            });
          });
          break; // Stop after finding the first working selector
        }
      }
      
      // Also check what's in the main content area
      const mainContent = document.querySelector('#content, .main-content, .page-content, .news-content, #main');
      const newsElements = mainContent ? mainContent.querySelectorAll('a[href*="/en/news"], a[href*="/en/journal"], a[href*="/en/newsletter"]') : [];
      
      const newsLinks = Array.from(newsElements).slice(0, 15).map((link, index) => ({
        index: index,
        title: link.textContent?.trim() || link.title || 'No title',
        href: link.href,
        parent: link.parentElement?.tagName + (link.parentElement?.className ? '.' + link.parentElement.className : '')
      }));
      
      return {
        itemsFound: items,
        newsLinks: newsLinks,
        pageTitle: document.title,
        hasReactComponents: !!document.querySelector('[data-reactroot], .react-component, [data-react]'),
        loadingIndicators: document.querySelectorAll('.loading, .spinner, .loader').length,
        totalLinks: document.querySelectorAll('a[href*="/en/"]').length
      };
    });

    console.log(`\n📊 WEBPAGE CONTENT SUMMARY:`);
    console.log(`   Page title: ${pageContent.pageTitle}`);
    console.log(`   Items found: ${pageContent.itemsFound.length}`);
    console.log(`   News links found: ${pageContent.newsLinks.length}`);
    console.log(`   Has React components: ${pageContent.hasReactComponents}`);
    console.log(`   Loading indicators: ${pageContent.loadingIndicators}`);
    console.log(`   Total ECA links: ${pageContent.totalLinks}`);

    // Save webpage content
    const filename = 'eca-webpage-content.json';
    await fs.writeFile(filename, JSON.stringify(pageContent, null, 2), 'utf8');
    
    console.log(`\n✅ Webpage content saved to: ${filename}`);
    
    // Show first few items
    if (pageContent.itemsFound.length > 0) {
      console.log(`\n📰 VISIBLE NEWS ITEMS:`);
      console.log('='.repeat(40));
      
      pageContent.itemsFound.slice(0, 5).forEach((item, i) => {
        console.log(`\nItem ${i + 1} (${item.selector}):`);
        console.log(`   Title: ${item.title}`);
        console.log(`   Link: ${item.link}`);
        console.log(`   Date: ${item.date}`);
      });
    }
    
    if (pageContent.newsLinks.length > 0) {
      console.log(`\n🔗 NEWS LINKS FOUND:`);
      console.log('='.repeat(30));
      
      pageContent.newsLinks.slice(0, 8).forEach((link, i) => {
        console.log(`${i + 1}. ${link.title}`);
        console.log(`   ${link.href}`);
      });
    }

    console.log(`\n🎉 Webpage scraping completed!`);
    
  } catch (error) {
    console.error(`\n❌ Scraping failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

scrapeWebpageContent();