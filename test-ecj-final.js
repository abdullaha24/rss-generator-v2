/**
 * Final ECJ scraper test - generate complete RSS XML
 */

import { scrapeECJNews, getECJChannelInfo } from './utils/ecj-scraper.js';
import { generateRSSFeed } from './utils/rss-builder.js';
import { writeFile } from 'fs/promises';

async function testECJFinal() {
  try {
    console.log('=== Final ECJ Scraper Test - RSS Generation ===\n');
    
    // Test scraping with limited PDF processing for speed
    console.log('1. Scraping ECJ press releases...');
    const items = await scrapeECJNews();
    
    console.log(`\n✅ Successfully scraped ${items.length} press release items\n`);
    
    // Show sample data
    if (items.length > 0) {
      console.log('=== Sample RSS Items ===');
      items.slice(0, 3).forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`- Title: "${item.title}"`);
        console.log(`- Link: ${item.link}`);
        console.log(`- Date: ${item.pubDate}`);
        console.log(`- Description: "${item.description.substring(0, 150)}..."`);
        console.log(`- GUID: ${item.guid}`);
        console.log(`- Enclosure: ${item.enclosure ? 'PDF attached' : 'No enclosure'}`);
      });
    }
    
    // Generate RSS XML
    console.log('\n2. Generating RSS feed...');
    const channelInfo = getECJChannelInfo();
    const rssXml = generateRSSFeed(channelInfo, items);
    
    console.log(`\n✅ Generated RSS XML (${rssXml.length} characters)\n`);
    
    // Save complete RSS to file
    await writeFile('./ecj-feed-sample.xml', rssXml, 'utf8');
    console.log('✅ Complete RSS saved to: ./ecj-feed-sample.xml\n');
    
    // Show RSS structure
    console.log('=== RSS XML Structure ===');
    const lines = rssXml.split('\n');
    console.log(lines.slice(0, 15).join('\n')); // First 15 lines
    console.log('...');
    
    // Find first item
    const firstItemStart = lines.findIndex(line => line.includes('<item>'));
    const firstItemEnd = lines.findIndex(line => line.includes('</item>'), firstItemStart);
    
    if (firstItemStart > -1 && firstItemEnd > -1) {
      console.log('\n=== First Item XML ===');
      console.log(lines.slice(firstItemStart, firstItemEnd + 1).join('\n'));
    }
    
    console.log('\n=== Final RSS Statistics ===');
    console.log(`- Total items: ${items.length}`);
    console.log(`- XML size: ${rssXml.length} characters`);
    console.log(`- Items with descriptions: ${items.filter(i => i.description && i.description.length > 50).length}`);
    console.log(`- Items with PDF links: ${items.filter(i => i.enclosure).length}`);
    console.log(`- Items with proper dates: ${items.filter(i => i.pubDate && i.pubDate !== 'Invalid Date').length}`);
    
  } catch (error) {
    console.error('❌ Final test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testECJFinal();