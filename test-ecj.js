/**
 * Test script for ECJ scraper
 * Run locally to test the implementation before deployment
 */

import { scrapeECJNews, getECJChannelInfo } from './utils/ecj-scraper.js';
import { generateRSSFeed } from './utils/rss-builder.js';

async function testECJScraper() {
  try {
    console.log('=== Testing ECJ Scraper ===\n');
    
    // Test scraping
    console.log('1. Scraping ECJ press releases...');
    const items = await scrapeECJNews();
    
    console.log(`\n✅ Successfully scraped ${items.length} items\n`);
    
    // Show first item details
    if (items.length > 0) {
      console.log('=== Sample Item ===');
      console.log('Title:', items[0].title);
      console.log('Link:', items[0].link);
      console.log('Description:', items[0].description.substring(0, 200) + '...');
      console.log('PubDate:', items[0].pubDate);
      console.log('GUID:', items[0].guid);
      console.log('Enclosure:', items[0].enclosure);
      console.log('');
    }
    
    // Generate RSS XML
    console.log('2. Generating RSS feed...');
    const channelInfo = getECJChannelInfo();
    const rssXml = generateRSSFeed(channelInfo, items);
    
    console.log(`\n✅ Generated RSS XML (${rssXml.length} characters)\n`);
    
    // Show RSS sample
    console.log('=== RSS XML Sample (first 1000 chars) ===');
    console.log(rssXml.substring(0, 1000) + '...\n');
    
    // Save complete RSS to file for inspection
    const fs = await import('fs/promises');
    await fs.writeFile('./ecj-test-feed.xml', rssXml, 'utf8');
    console.log('✅ Complete RSS saved to: ./ecj-test-feed.xml\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testECJScraper();