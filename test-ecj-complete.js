/**
 * Complete ECJ scraper test - get full press release data
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';

async function testECJComplete() {
  let scraper = null;
  
  try {
    console.log('=== Testing Complete ECJ Press Release Extraction ===\n');
    
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

    console.log('2. Extracting complete press release data...');
    
    const pressReleases = await scraper.page.evaluate(() => {
      const items = [];
      
      // Strategy: Find press release numbers and then find associated content
      const allElements = [...document.querySelectorAll('*')];
      
      // Find elements containing press release numbers
      const pressElements = allElements.filter(el => {
        const text = el.textContent || '';
        return text.match(/No\s+\d+\/\d{4}/) && text.length > 20 && text.length < 2000;
      });
      
      console.log(`Found ${pressElements.length} elements with press release numbers`);
      
      pressElements.forEach((element, index) => {
        if (index >= 7) return; // Limit to 7 items
        
        const text = element.textContent || '';
        const pressMatch = text.match(/No\s+(\d+)\/(\d{4})/);
        const dateMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        
        if (!pressMatch) return;
        
        // Look for links within this element and nearby
        let links = [];
        
        // Check the element itself
        const elementLinks = element.querySelectorAll('a[href*="p1_"]');
        links.push(...elementLinks);
        
        // Check parent and sibling elements
        let parent = element.parentElement;
        if (parent) {
          const parentLinks = parent.querySelectorAll('a[href*="p1_"]');
          links.push(...parentLinks);
        }
        
        // Check next sibling elements
        let nextSibling = element.nextElementSibling;
        for (let i = 0; i < 3 && nextSibling; i++) {
          const siblingLinks = nextSibling.querySelectorAll('a[href*="p1_"]');
          links.push(...siblingLinks);
          nextSibling = nextSibling.nextElementSibling;
        }
        
        // Find the most relevant link (longest text that might be a title)
        let bestLink = null;
        let bestScore = 0;
        
        links.forEach(link => {
          const linkText = (link.textContent || '').trim();
          const score = linkText.length;
          
          // Prefer links with meaningful text
          if (score > bestScore && linkText.length > 10 && !linkText.match(/^\d+$|^page|^link|^click|^here$/i)) {
            bestLink = link;
            bestScore = score;
          }
        });
        
        // Look for case references and judgment text near this press release
        const caseMatch = text.match(/Case\s+(C-\d+\/\d+)/);
        const judgmentMatch = text.match(/(Judgment[s]?\s+of\s+the\s+Court[^.]*)/i);
        
        // Try to extract a meaningful title from the surrounding content
        let title = '';
        if (bestLink) {
          title = bestLink.textContent.trim();
        } else if (judgmentMatch) {
          title = judgmentMatch[1];
        } else if (caseMatch) {
          title = `Judgment in ${caseMatch[1]}`;
        } else {
          title = `Press Release ${pressMatch[0]}`;
        }
        
        // Get a summary from the surrounding text
        const cleanText = text.replace(/\s+/g, ' ').trim();
        let summary = '';
        
        // Try to find descriptive text
        const sentences = cleanText.split(/[.!?]+/);
        const meaningfulSentences = sentences.filter(s => 
          s.length > 20 && 
          !s.match(/^\s*(No\s+\d+|page|link|click)/i)
        );
        
        if (meaningfulSentences.length > 0) {
          summary = meaningfulSentences.slice(0, 2).join('. ').trim();
          if (summary && !summary.endsWith('.')) summary += '.';
        }
        
        items.push({
          pressNumber: pressMatch[0],
          title: title,
          link: bestLink ? bestLink.href : '',
          date: dateMatch ? dateMatch[0] : '',
          caseRef: caseMatch ? caseMatch[1] : '',
          summary: summary,
          allLinks: links.map(l => ({
            text: (l.textContent || '').trim(),
            href: l.href
          })),
          rawText: cleanText.substring(0, 200)
        });
      });
      
      return items;
    });

    console.log(`\n✅ Extracted ${pressReleases.length} complete press release items\n`);
    
    // Show detailed results
    console.log('=== Complete Press Release Data ===');
    pressReleases.forEach((item, index) => {
      console.log(`\nPress Release ${index + 1}:`);
      console.log(`- Press#: ${item.pressNumber}`);
      console.log(`- Title: "${item.title}"`);
      console.log(`- Link: ${item.link}`);
      console.log(`- Date: ${item.date}`);
      console.log(`- Case: ${item.caseRef}`);
      console.log(`- Summary: "${item.summary}"`);
      console.log(`- Available links: ${item.allLinks.length}`);
      
      // Show first few links for context
      item.allLinks.slice(0, 3).forEach((link, i) => {
        console.log(`  ${i+1}. "${link.text}" -> ${link.href}`);
      });
      
      console.log(`- Raw text: "${item.rawText}..."`);
    });
    
    // Test one PDF link if available
    if (pressReleases.length > 0 && pressReleases[0].link) {
      console.log(`\n3. Testing PDF link: ${pressReleases[0].link}`);
      
      try {
        await scraper.navigateWithStealth(pressReleases[0].link, {
          timeout: 8000,
          waitForNetworkIdle: false
        });
        
        // Check if it's a PDF
        const currentUrl = scraper.page.url();
        console.log(`✅ Successfully navigated to: ${currentUrl}`);
        
        // Check content type
        const response = await scraper.page.goto(pressReleases[0].link, {
          timeout: 8000
        });
        
        const contentType = response.headers()['content-type'];
        console.log(`Content-Type: ${contentType}`);
        
        if (contentType && contentType.includes('pdf')) {
          console.log('✅ Confirmed: Link leads to PDF document');
        }
        
      } catch (pdfError) {
        console.log(`⚠️  PDF test failed: ${pdfError.message}`);
      }
    }
    
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
testECJComplete();