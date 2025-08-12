/**
 * Refined test for ECJ scraper - target actual press release content
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';

async function testECJScrapingRefined() {
  let scraper = null;
  
  try {
    console.log('=== Testing ECJ Press Release Extraction ===\n');
    
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

    console.log('2. Analyzing page structure for press releases...');
    
    const analysis = await scraper.page.evaluate(() => {
      // Look for text patterns that indicate press releases
      const bodyText = document.body.textContent || '';
      
      // Find all "No XXX/2025" patterns (press release numbers)
      const pressNumbers = bodyText.match(/No\s+\d+\/\d{4}/g) || [];
      
      // Find all case references
      const caseRefs = bodyText.match(/Case C-\d+\/\d+/g) || [];
      
      // Find all judgment patterns
      const judgmentPatterns = bodyText.match(/Judgment[s]?\s+of\s+the\s+Court[^.]{0,100}/gi) || [];
      
      // Look for date patterns
      const datePatterns = bodyText.match(/\d{1,2}\s+\w+\s+\d{4}/g) || [];
      
      // Get all text content in a more structured way
      const allElements = document.querySelectorAll('*');
      const pressReleaseItems = [];
      
      // Look for elements that contain press release numbers
      allElements.forEach(element => {
        const text = element.textContent || '';
        const pressMatch = text.match(/No\s+(\d+)\/(\d{4})/);
        
        if (pressMatch && text.length > 50 && text.length < 1000) {
          // This might be a press release item
          
          // Look for associated links
          const links = element.querySelectorAll('a[href*="p1_"]');
          
          // Look for dates in this element
          const dateMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
          
          // Look for case references
          const caseMatch = text.match(/Case\s+(C-\d+\/\d+)/);
          
          // Look for judgment text
          const judgmentMatch = text.match(/(Judgment[s]?\s+of\s+the\s+Court[^.]{0,200})/i);
          
          pressReleaseItems.push({
            pressNumber: pressMatch[0],
            text: text.substring(0, 300),
            links: Array.from(links).map(l => ({
              text: l.textContent?.trim(),
              href: l.href
            })),
            date: dateMatch ? dateMatch[0] : '',
            caseRef: caseMatch ? caseMatch[1] : '',
            judgment: judgmentMatch ? judgmentMatch[1] : '',
            elementTag: element.tagName
          });
        }
      });
      
      return {
        pressNumbers: pressNumbers.slice(0, 10),
        caseRefs: caseRefs.slice(0, 10),
        judgmentPatterns: judgmentPatterns.slice(0, 5),
        datePatterns: datePatterns.slice(0, 10),
        pressReleaseItems: pressReleaseItems.slice(0, 7)
      };
    });

    console.log(`\n✅ Structural Analysis:`);
    console.log(`- Press numbers found: ${analysis.pressNumbers.join(', ')}`);
    console.log(`- Case references: ${analysis.caseRefs.join(', ')}`);
    console.log(`- Judgment patterns: ${analysis.judgmentPatterns.length}`);
    console.log(`- Date patterns: ${analysis.datePatterns.slice(0, 5).join(', ')}`);
    console.log(`- Structured items found: ${analysis.pressReleaseItems.length}\n`);
    
    // Show structured press release items
    console.log('=== Structured Press Release Items ===');
    analysis.pressReleaseItems.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`- Press#: ${item.pressNumber}`);
      console.log(`- Date: ${item.date}`);
      console.log(`- Case: ${item.caseRef}`);
      console.log(`- Judgment: ${item.judgment.substring(0, 100)}...`);
      console.log(`- Links: ${item.links.length} found`);
      if (item.links.length > 0) {
        item.links.forEach(link => {
          console.log(`  * "${link.text}" -> ${link.href}`);
        });
      }
      console.log(`- Element: ${item.elementTag}`);
      console.log(`- Text preview: "${item.text.substring(0, 150)}..."`);
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
testECJScrapingRefined();