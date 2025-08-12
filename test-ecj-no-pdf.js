/**
 * ECJ scraper test without PDF processing - show RSS structure with HTML fallback
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';
import { generateRSSFeed } from './utils/rss-builder.js';
import { writeFile } from 'fs/promises';

async function testECJNoPDF() {
  let scraper = null;
  
  try {
    console.log('=== ECJ RSS Test (HTML only, no PDF processing) ===\n');
    
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }

    console.log('1. Scraping ECJ press releases...');
    await scraper.navigateWithStealth(
      'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
      {
        timeout: 15000,
        waitForNetworkIdle: true
      }
    );

    // Extract press release data
    const pressReleases = await scraper.page.evaluate(() => {
      const items = [];
      
      // Find elements with press release numbers
      const allElements = [...document.querySelectorAll('*')];
      const pressElements = allElements.filter(el => {
        const text = el.textContent || '';
        return text.match(/No\s+\d+\/\d{4}/) && text.length > 20 && text.length < 2000;
      });
      
      pressElements.forEach((element, index) => {
        if (index >= 7) return; // First 7 items only
        
        const text = element.textContent || '';
        const pressMatch = text.match(/No\s+(\d+)\/(\d{4})/);
        const dateMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        
        if (!pressMatch) return;
        
        // Find links
        let links = [];
        const elementLinks = element.querySelectorAll('a[href*="p1_"]');
        links.push(...elementLinks);
        
        let parent = element.parentElement;
        if (parent) {
          const parentLinks = parent.querySelectorAll('a[href*="p1_"]');
          links.push(...parentLinks);
        }
        
        // Get best link (judgment titles)
        let bestLink = null;
        let bestScore = 0;
        
        links.forEach(link => {
          const linkText = (link.textContent || '').trim();
          const score = linkText.length;
          
          if (linkText.includes('Judgment') && score > bestScore) {
            bestLink = link;
            bestScore = score;
          } else if (!bestLink && score > 10 && !linkText.match(/^bg|^es|^de|^fr|^it$/i)) {
            bestLink = link;
            bestScore = score;
          }
        });
        
        // Extract meaningful summary
        const cleanText = text.replace(/\s+/g, ' ').trim();
        let summary = 'European Court of Justice press release - full document available in PDF.';
        
        // Look for descriptive text
        const sentences = cleanText.split(/[.!?]+/);
        const meaningfulSentences = sentences.filter(s => 
          s.length > 30 && 
          !s.match(/^\s*(No\s+\d+|page|link|click|\d{1,2}\s+\w+\s+\d{4})/i) &&
          !s.includes('bg es cs da de et el en fr ga hr it lv lt hu mt nl pl pt ro sk sl fi sv')
        );
        
        if (meaningfulSentences.length > 0) {
          const sentence = meaningfulSentences[0].trim();
          const words = sentence.split(/\s+/).slice(0, 50).join(' '); // First 50 words max
          summary = words + (meaningfulSentences[0].split(/\s+/).length > 50 ? '...' : '') + ' Read full document in PDF.';
        }
        
        items.push({
          title: bestLink ? bestLink.textContent.trim() : `Press Release ${pressMatch[0]}`,
          link: bestLink ? bestLink.href : '',
          date: dateMatch ? dateMatch[0] : '',
          summary: summary,
          pressNumber: pressMatch[0]
        });
      });
      
      return items;
    });

    console.log(`\n✅ Extracted ${pressReleases.length} press releases\n`);

    // Convert to RSS format
    const rssItems = pressReleases.map(item => {
      // Parse date
      let pubDate = new Date().toUTCString();
      if (item.date) {
        const dateMatch = item.date.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const monthMap = {
            'January': 0, 'February': 1, 'March': 2, 'April': 3,
            'May': 4, 'June': 5, 'July': 6, 'August': 7,
            'September': 8, 'October': 9, 'November': 10, 'December': 11
          };
          const monthIndex = monthMap[month];
          if (monthIndex !== undefined) {
            const date = new Date(parseInt(year), monthIndex, parseInt(day));
            pubDate = date.toUTCString();
          }
        }
      }
      
      return {
        title: item.title,
        link: item.link,
        description: item.summary,
        pubDate: pubDate,
        guid: item.link,
        enclosure: {
          url: item.link,
          type: 'application/pdf'
        }
      };
    });

    // Show sample items
    console.log('=== Sample RSS Items ===');
    rssItems.slice(0, 3).forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`- Title: "${item.title}"`);
      console.log(`- Link: ${item.link}`);
      console.log(`- Date: ${item.pubDate}`);
      console.log(`- Description: "${item.description}"`);
    });

    // Generate RSS XML
    console.log('\n2. Generating RSS XML...');
    const channelInfo = {
      title: 'European Court of Justice - Press Releases',
      description: 'Latest press releases and judgments from the European Court of Justice',
      link: 'https://curia.europa.eu/jcms/jcms/Jo2_7052/en/',
      language: 'en',
      generator: 'EU RSS Generator - ECJ'
    };
    
    const rssXml = generateRSSFeed(channelInfo, rssItems);
    
    console.log(`\n✅ Generated RSS XML (${rssXml.length} characters)\n`);
    
    // Save RSS to file
    await writeFile('./ecj-feed-sample.xml', rssXml, 'utf8');
    console.log('✅ Complete RSS saved to: ./ecj-feed-sample.xml\n');
    
    // Show RSS structure
    console.log('=== RSS XML Preview ===');
    const lines = rssXml.split('\n');
    const previewLines = 30;
    console.log(lines.slice(0, previewLines).join('\n'));
    if (lines.length > previewLines) {
      console.log('...\n(truncated for display - see full file)');
    }
    
    console.log('\n=== RSS Statistics ===');
    console.log(`- Total items: ${rssItems.length}`);
    console.log(`- XML size: ${rssXml.length} characters`);
    console.log(`- Valid links: ${rssItems.filter(i => i.link && i.link.length > 0).length}`);
    console.log(`- Items with titles: ${rssItems.filter(i => i.title && i.title.length > 10).length}`);
    
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
testECJNoPDF();