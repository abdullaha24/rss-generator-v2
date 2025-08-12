/**
 * Simple test script for ECJ scraper - HTML scraping only
 * Test without PDF processing first
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';

async function testECJScrapingSimple() {
  let scraper = null;
  
  try {
    console.log('=== Testing ECJ HTML Scraping Only ===\n');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }

    console.log('1. Loading ECJ press releases page...');
    await scraper.navigateWithStealth(
      'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
      {
        timeout: 15000,
        waitForNetworkIdle: true
      }
    );

    console.log('2. Extracting press release data...');
    
    const pressReleases = await scraper.page.evaluate(() => {
      const items = [];
      
      // Get the page title for context
      const pageTitle = document.title;
      console.log('Page title:', pageTitle);
      
      // Look for all links that might be press releases
      const allLinks = document.querySelectorAll('a[href*="p1_"]');
      console.log(`Found ${allLinks.length} potential press release links`);
      
      // Also look for any text that mentions case numbers
      const bodyText = document.body.textContent || '';
      const caseMatches = bodyText.match(/Case C-\d+\/\d+/g) || [];
      console.log(`Found ${caseMatches.length} case references in text`);
      
      // Extract information from links
      allLinks.forEach((link, index) => {
        if (index >= 10) return; // Limit for testing
        
        const linkText = link.textContent?.trim() || '';
        const href = link.href;
        
        // Get parent element text for more context
        let parentText = '';
        let currentElement = link.parentElement;
        for (let i = 0; i < 2 && currentElement; i++) {
          const text = currentElement.textContent || '';
          if (text.length > parentText.length) {
            parentText = text;
          }
          currentElement = currentElement.parentElement;
        }
        
        // Look for dates in the vicinity
        const datePattern = /(\d{1,2}\s+\w+\s+\d{4})/;
        const dateMatch = parentText.match(datePattern);
        
        // Look for press release numbers
        const pressPattern = /(No\s+\d+\/\d{4})/;
        const pressMatch = parentText.match(pressPattern);
        
        items.push({
          title: linkText,
          link: href,
          parentText: parentText.substring(0, 200),
          date: dateMatch ? dateMatch[1] : '',
          pressNumber: pressMatch ? pressMatch[1] : '',
          index: index
        });
      });
      
      return {
        items: items,
        pageTitle: pageTitle,
        totalLinks: allLinks.length,
        caseReferences: caseMatches.slice(0, 5) // First 5 case refs for context
      };
    });

    console.log(`\n✅ Page Analysis Results:`);
    console.log(`- Page title: ${pressReleases.pageTitle}`);
    console.log(`- Total p1_ links found: ${pressReleases.totalLinks}`);
    console.log(`- Case references found: ${pressReleases.caseReferences.join(', ')}`);
    console.log(`- Extracted ${pressReleases.items.length} items for analysis\n`);
    
    // Show details of first few items
    console.log('=== First 3 Items Analysis ===');
    pressReleases.items.slice(0, 3).forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`- Title: "${item.title}"`);
      console.log(`- Link: ${item.link}`);
      console.log(`- Date: "${item.date}"`);
      console.log(`- Press#: "${item.pressNumber}"`);
      console.log(`- Context: "${item.parentText}"`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

// Run the test
testECJScrapingSimple();