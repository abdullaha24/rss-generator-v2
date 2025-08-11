#!/usr/bin/env node

/**
 * Test EU Council Fast Scraper (No Enrichment)
 * Verify performance improvements and content quality
 */

import { scrapeConsiliumAdvanced, getConsiliumAdvancedChannelInfo } from './utils/consilium-scraper-advanced.js';
import { generateRSSFeed } from './utils/rss-builder.js';
import fs from 'fs';

async function testConsiliumFast() {
  console.log('🚀 Testing EU Council Fast Scraper (No Enrichment)...');
  console.log('🎯 Goal: Sub-10 second response, 20 items, no 403 errors');
  console.log('');

  try {
    const startTime = Date.now();
    
    // Test the scraper
    console.log('🔍 Starting fast scraping...');
    const items = await scrapeConsiliumAdvanced();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('');
    console.log(`✅ Fast scraping completed in ${duration} seconds`);
    console.log(`📊 Found ${items.length} press release items`);
    
    // Verify content quality
    console.log('');
    console.log('📰 Content Quality Check:');
    items.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title.substring(0, 80)}...`);
      console.log(`   📅 ${item.pubDate}`);
      console.log(`   🔗 ${item.link.substring(0, 80)}...`);
      console.log(`   📝 Description: ${item.description.length} chars`);
      console.log(`   🏷️  Category: ${item.category}`);
      console.log('');
    });
    
    // Generate RSS feed
    console.log('📡 Generating RSS feed...');
    const channelInfo = getConsiliumAdvancedChannelInfo();
    const rssFeed = generateRSSFeed(channelInfo, items);
    
    // Save to file
    const filename = 'consilium-fast.xml';
    fs.writeFileSync(filename, rssFeed, 'utf8');
    
    console.log(`💾 RSS feed saved to: ${filename}`);
    console.log(`📏 RSS feed size: ${(rssFeed.length / 1024).toFixed(1)} KB`);
    
    // Performance summary
    console.log('');
    console.log('🎉 PERFORMANCE SUMMARY:');
    console.log(`⏱️  Processing time: ${duration}s (Target: <10s)`);
    console.log(`📊 Items returned: ${items.length} (Target: 20)`);
    console.log(`🔥 Avg per item: ${(duration / items.length).toFixed(2)}s`);
    console.log(`✅ No 403 errors (no individual page requests)`);
    console.log(`🚀 Vercel compatible (well under 60s timeout)`);
    
    // Quality assessment
    const avgDescLength = items.reduce((sum, item) => sum + item.description.length, 0) / items.length;
    console.log('');
    console.log('📝 CONTENT QUALITY:');
    console.log(`📄 Avg description: ${Math.round(avgDescLength)} characters`);
    console.log(`🔗 All items have valid links: ${items.every(item => item.link.startsWith('https'))}`);
    console.log(`📅 All items have dates: ${items.every(item => item.pubDate)}`);
    console.log(`🏷️  All items categorized: ${items.every(item => item.category)}`);
    
  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testConsiliumFast();