#!/usr/bin/env node

/**
 * Test script for EU Council Advanced Scraper
 * Tests the updated packages with latest @sparticuz/chromium
 */

import { scrapeConsiliumAdvanced, getConsiliumAdvancedChannelInfo } from './utils/consilium-scraper-advanced.js';
import { generateRSSFeed } from './utils/rss-builder.js';
import fs from 'fs';

async function testConsiliumScraper() {
  console.log('🧪 Testing EU Council Advanced Scraper with updated packages...');
  console.log('📦 Using @sparticuz/chromium: ^138.0.2');
  console.log('📦 Using puppeteer-core: ^24.9.0');
  console.log('');

  try {
    const startTime = Date.now();
    
    // Test the scraper
    console.log('🔍 Starting EU Council scraper test...');
    const items = await scrapeConsiliumAdvanced();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('');
    console.log(`✅ Scraping completed successfully in ${duration} seconds`);
    console.log(`📊 Found ${items.length} press release items`);
    
    // Display sample items
    console.log('');
    console.log('📰 Sample items:');
    items.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   📅 ${item.pubDate}`);
      console.log(`   🔗 ${item.link}`);
      console.log(`   📝 ${item.description.substring(0, 100)}...`);
      console.log('');
    });
    
    // Generate RSS feed
    console.log('📡 Generating RSS feed...');
    const channelInfo = getConsiliumAdvancedChannelInfo();
    const rssFeed = generateRSSFeed(channelInfo, items);
    
    // Save to file
    const filename = 'consilium-test-updated.xml';
    fs.writeFileSync(filename, rssFeed, 'utf8');
    
    console.log(`💾 RSS feed saved to: ${filename}`);
    console.log(`📏 RSS feed size: ${(rssFeed.length / 1024).toFixed(1)} KB`);
    
    console.log('');
    console.log('🎉 Test completed successfully!');
    console.log('✅ Updated packages are working correctly');
    console.log('🚀 Ready for Vercel deployment');
    
  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testConsiliumScraper();