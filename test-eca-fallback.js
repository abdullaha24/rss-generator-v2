#!/usr/bin/env node

/**
 * Test ECA Fallback Scraper
 * Test both the parsing function and the simple HTTP approach
 */

import { scrapeECASimple, getECAChannelInfo, testParseECAHTML } from './utils/eca-scraper-fallback.js';
import { generateRSSFeed } from './utils/rss-builder.js';
import fs from 'fs';

async function testECAFallback() {
  console.log('🧪 Testing ECA Fallback Scraper...');
  console.log('');
  
  try {
    // First test the parsing function with known HTML structure
    console.log('📝 Testing HTML parsing with provided structure...');
    const parsedItems = testParseECAHTML();
    
    if (parsedItems.length > 0) {
      console.log('✅ HTML parsing works correctly!');
    } else {
      console.log('❌ HTML parsing failed');
    }
    
    console.log('');
    console.log('🌐 Testing live HTTP scraping...');
    
    const startTime = Date.now();
    
    // Test the simple HTTP scraper
    const items = await scrapeECASimple();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log(`✅ Scraping completed in ${duration} seconds`);
    console.log(`📊 Found ${items.length} items`);
    
    // Show sample items
    console.log('');
    console.log('📰 Sample Items:');
    items.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   📅 ${item.pubDate}`);
      console.log(`   🔗 ${item.link}`);
      console.log(`   📝 ${item.description.substring(0, 80)}...`);
      console.log('');
    });
    
    // Generate RSS feed
    console.log('📡 Generating RSS feed...');
    const channelInfo = getECAChannelInfo();
    const rssFeed = generateRSSFeed(channelInfo, items);
    
    // Save to file
    const filename = 'eca-fallback-test.xml';
    fs.writeFileSync(filename, rssFeed, 'utf8');
    
    console.log(`💾 RSS feed saved to: ${filename}`);
    console.log(`📏 RSS feed size: ${(rssFeed.length / 1024).toFixed(1)} KB`);
    
    console.log('');
    console.log('✅ ECA fallback test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testECAFallback();