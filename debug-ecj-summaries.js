/**
 * Debug ECJ webpage to find the actual summary text locations
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';

async function debugECJSummaries() {
  let scraper = null;
  
  try {
    console.log('=== Debugging ECJ Webpage for Summary Text ===\n');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }

    await scraper.navigateWithStealth(
      'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
      {
        timeout: 15000,
        waitForNetworkIdle: true
      }
    );

    // Debug: Find where the summaries like "Football: the Court affirms..." are located
    const summaryDebug = await scraper.page.evaluate(() => {
      // First, let's find any text that contains "Football" or similar descriptive text
      const bodyText = document.body.textContent || '';
      
      // Look for the "Football:" text specifically
      const footballMatch = bodyText.match(/Football[^.]*\.?/);
      
      // Look for any text with colons that might be summaries
      const colonTexts = bodyText.match(/[A-Z][^.]*:[^.]*\.?/g) || [];
      
      // Find all elements that contain the word "Football"
      const footballElements = [];
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(element => {
        const text = element.textContent || '';
        if (text.includes('Football') && text.length > 10 && text.length < 500) {
          footballElements.push({
            tag: element.tagName,
            className: element.className,
            id: element.id,
            text: text.substring(0, 200),
            innerHTML: element.innerHTML.substring(0, 300)
          });
        }
      });
      
      // Look for specific patterns around press releases
      const pressReleaseElements = [];
      allElements.forEach(element => {
        const text = element.textContent || '';
        if (text.includes('No 104/2025') && text.length > 50) {
          // This should be the first press release element
          pressReleaseElements.push({
            tag: element.tagName,
            className: element.className,
            text: text.substring(0, 500),
            children: element.children.length,
            hasLinks: element.querySelectorAll('a').length
          });
        }
      });
      
      return {
        footballMatch: footballMatch ? footballMatch[0] : null,
        colonTexts: colonTexts.slice(0, 10), // First 10 colon-separated texts
        footballElements: footballElements,
        pressReleaseElements: pressReleaseElements,
        bodyTextSample: bodyText.substring(0, 2000) // First 2000 chars of page
      };
    });

    console.log('=== Summary Debug Results ===');
    console.log(`Football match found: "${summaryDebug.footballMatch}"`);
    console.log(`Colon texts found: ${summaryDebug.colonTexts.length}`);
    summaryDebug.colonTexts.forEach((text, i) => {
      console.log(`  ${i + 1}. "${text}"`);
    });
    
    console.log(`\nFootball elements found: ${summaryDebug.footballElements.length}`);
    summaryDebug.footballElements.forEach((elem, i) => {
      console.log(`  ${i + 1}. <${elem.tag}> class="${elem.className}" id="${elem.id}"`);
      console.log(`      Text: "${elem.text}"`);
      console.log(`      HTML: "${elem.innerHTML}"`);
    });
    
    console.log(`\nPress release elements: ${summaryDebug.pressReleaseElements.length}`);
    summaryDebug.pressReleaseElements.forEach((elem, i) => {
      console.log(`  ${i + 1}. <${elem.tag}> class="${elem.className}"`);
      console.log(`      Children: ${elem.children}, Links: ${elem.hasLinks}`);
      console.log(`      Text: "${elem.text}"`);
    });
    
    console.log('\n=== Page Content Sample ===');
    console.log(summaryDebug.bodyTextSample.substring(0, 1000));
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

// Run the debug
debugECJSummaries();