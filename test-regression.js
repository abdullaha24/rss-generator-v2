#!/usr/bin/env node

/**
 * Regression Test - Verify All Working Feeds Still Function
 * Tests EEAS, NATO, Consilium, and new ECA feeds
 */

import { scrapeEEAS, getEEASChannelInfo } from './utils/eeas-scraper.js';
import { scrapeNATO, getNATOChannelInfo } from './utils/nato-scraper.js';
import { scrapeConsiliumAdvanced, getConsiliumAdvancedChannelInfo } from './utils/consilium-scraper-advanced.js';
import { scrapeECANews, getECAChannelInfo } from './utils/eca-scraper-final.js';
import { generateRSSFeed } from './utils/rss-builder.js';

/**
 * Test a single feed
 */
async function testFeed(name, scraper, channelInfoFn) {
  console.log(`\n🧪 Testing ${name} feed...`);
  const startTime = Date.now();
  
  try {
    const items = await scraper();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (!items || items.length === 0) {
      throw new Error('No items returned');
    }
    
    const channelInfo = channelInfoFn();
    const rssXml = generateRSSFeed(channelInfo, items);
    
    // Validate RSS structure
    const hasValidStructure = rssXml.includes('<?xml') && 
                              rssXml.includes('<rss version="2.0"') && 
                              rssXml.includes('<channel>');
    
    console.log(`✅ ${name}: ${items.length} items, ${duration}s, ${(rssXml.length / 1024).toFixed(1)}KB`);
    
    if (!hasValidStructure) {
      throw new Error('Invalid RSS structure');
    }
    
    return {
      name,
      success: true,
      itemCount: items.length,
      duration: parseFloat(duration),
      size: Math.round(rssXml.length / 1024),
      error: null
    };
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`❌ ${name}: Failed in ${duration}s - ${error.message}`);
    
    return {
      name,
      success: false,
      itemCount: 0,
      duration: parseFloat(duration),
      size: 0,
      error: error.message
    };
  }
}

/**
 * Main regression test
 */
async function runRegressionTest() {
  console.log('🔍 Running Regression Test for All EU RSS Feeds');
  console.log('====================================================');
  console.log('Testing: EEAS, NATO, Consilium, ECA');
  console.log('');
  
  const totalStartTime = Date.now();
  
  // Test all feeds
  const results = await Promise.all([
    testFeed('EEAS', scrapeEEAS, getEEASChannelInfo),
    testFeed('NATO', scrapeNATO, getNATOChannelInfo),
    testFeed('Consilium', scrapeConsiliumAdvanced, getConsiliumAdvancedChannelInfo),
    testFeed('ECA', scrapeECANews, getECAChannelInfo)
  ]);
  
  const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(1);
  
  // Analyze results
  console.log('\n📊 REGRESSION TEST RESULTS');
  console.log('============================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful feeds: ${successful.length}/${results.length}`);
  console.log(`❌ Failed feeds: ${failed.length}/${results.length}`);
  console.log(`⏱️  Total test time: ${totalDuration}s`);
  
  console.log('\n📈 Performance Summary:');
  successful.forEach(result => {
    console.log(`   ${result.name.padEnd(10)}: ${result.itemCount.toString().padStart(3)} items, ${result.duration.toString().padStart(5)}s, ${result.size.toString().padStart(3)}KB`);
  });
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Feeds:');
    failed.forEach(result => {
      console.log(`   ${result.name}: ${result.error}`);
    });
  }
  
  // Quality checks
  console.log('\n🔍 Quality Checks:');
  const avgItemsPerFeed = successful.reduce((sum, r) => sum + r.itemCount, 0) / successful.length;
  const maxDuration = Math.max(...successful.map(r => r.duration));
  const vercelCompatible = successful.every(r => r.duration < 50);
  
  console.log(`   Average items per feed: ${Math.round(avgItemsPerFeed)}`);
  console.log(`   Slowest feed: ${maxDuration}s`);
  console.log(`   Vercel compatible (all < 50s): ${vercelCompatible ? 'YES' : 'NO'}`);
  console.log(`   All feeds have content: ${successful.every(r => r.itemCount > 0) ? 'YES' : 'NO'}`);
  
  // Overall assessment
  console.log('\n🎯 OVERALL ASSESSMENT:');
  
  if (successful.length === results.length) {
    console.log('✅ ALL TESTS PASSED - No regression detected');
    console.log('🚀 All 4 feeds are working correctly');
    console.log('📦 Ready for production deployment');
  } else if (successful.length >= 3) {
    console.log('⚠️  MOSTLY SUCCESSFUL - Some feeds need attention');
    console.log(`   ${successful.length} out of ${results.length} feeds working`);
  } else {
    console.log('❌ REGRESSION DETECTED - Multiple feeds failing');
    console.log('🚨 Requires immediate attention before deployment');
  }
  
  console.log('\n====================================================');
  
  // Exit with appropriate code
  if (successful.length === results.length) {
    console.log('✅ Regression test completed successfully');
    process.exit(0);
  } else {
    console.log('❌ Regression test found issues');
    process.exit(1);
  }
}

// Run the regression test
runRegressionTest().catch(error => {
  console.error('💥 Regression test crashed:', error);
  process.exit(1);
});