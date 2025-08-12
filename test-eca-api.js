/**
 * Test Script for ECA API-based RSS Scraper (Strategy 1)
 * Tests direct SharePoint API access with authentication tokens
 */

import { scrapeECANewsAPI, getECAChannelInfoAPI } from './utils/eca-scraper-api.js';
import { generateRSSFeed } from './utils/rss-builder.js';

async function testECAAPI() {
  console.log('🧪 TESTING ECA API-BASED RSS SCRAPER (Strategy 1)');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  let success = false;
  
  try {
    console.log('⏱️  Starting ECA API scraper test...');
    
    // Test the API-based scraper
    const items = await scrapeECANewsAPI();
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    console.log(`\n📊 SCRAPING RESULTS:`);
    console.log(`   Total time: ${totalTime.toFixed(2)}s`);
    console.log(`   Items found: ${items.length}`);
    
    if (items.length === 0) {
      console.log('❌ No items found - test failed');
      return;
    }

    // Analyze the results
    console.log(`\n🔍 CONTENT ANALYSIS:`);
    
    // Show first 3 items
    console.log(`\n📰 First 3 News Items:`);
    items.slice(0, 3).forEach((item, i) => {
      console.log(`\n   ${i + 1}. ${item.title}`);
      console.log(`      Link: ${item.link}`);
      console.log(`      Date: ${item.pubDate}`);
      console.log(`      Category: ${item.category}`);
      console.log(`      Description: ${item.description.substring(0, 100)}...`);
      if (item.enclosure) {
        console.log(`      Image: ${item.enclosure}`);
      }
    });
    
    // Quality metrics
    const validLinks = items.filter(item => 
      item.link && item.link.includes('eca.europa.eu')
    ).length;
    
    const withDescriptions = items.filter(item => 
      item.description && item.description.length > 50
    ).length;
    
    const recentDates = items.filter(item => {
      const itemDate = new Date(item.pubDate);
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 6);
      return itemDate > monthsAgo;
    }).length;

    const categories = [...new Set(items.map(item => item.category))];
    
    console.log(`\n📈 QUALITY METRICS:`);
    console.log(`   Valid ECA links: ${validLinks}/${items.length} (${(validLinks/items.length*100).toFixed(1)}%)`);
    console.log(`   Rich descriptions: ${withDescriptions}/${items.length} (${(withDescriptions/items.length*100).toFixed(1)}%)`);
    console.log(`   Recent items (6 months): ${recentDates}/${items.length} (${(recentDates/items.length*100).toFixed(1)}%)`);
    console.log(`   Categories found: ${categories.length} (${categories.join(', ')})`);
    
    // Test RSS generation
    console.log(`\n🏗️  Testing RSS generation...`);
    const channelInfo = getECAChannelInfoAPI();
    const rssXML = generateRSSFeed(channelInfo, items);
    
    const xmlSize = Buffer.byteLength(rssXML, 'utf8');
    console.log(`   RSS XML size: ${(xmlSize / 1024).toFixed(1)} KB`);
    console.log(`   RSS validation: ${rssXML.includes('<rss version="2.0"') ? '✅ Valid' : '❌ Invalid'}`);
    
    // Performance assessment
    console.log(`\n⚡ PERFORMANCE ASSESSMENT:`);
    if (totalTime <= 10 && items.length >= 10) {
      console.log('   ✅ EXCELLENT - Fast and comprehensive');
      success = true;
    } else if (totalTime <= 15 && items.length >= 5) {
      console.log('   ✅ GOOD - Acceptable performance');
      success = true;
    } else {
      console.log('   ⚠️  NEEDS IMPROVEMENT');
      if (totalTime > 15) console.log(`      - Too slow: ${totalTime.toFixed(2)}s`);
      if (items.length < 5) console.log(`      - Too few items: ${items.length}`);
    }
    
    // Vercel compatibility check
    console.log(`\n🚀 VERCEL COMPATIBILITY:`);
    if (totalTime <= 10) {
      console.log('   ✅ Compatible with Vercel Hobby tier (10s limit)');
    } else {
      console.log('   ❌ May timeout on Vercel Hobby tier');
    }
    
    // Write sample RSS to file for inspection
    const fs = await import('fs');
    await fs.promises.writeFile('./eca-api-sample.xml', rssXML, 'utf8');
    console.log(`\n📁 Sample RSS saved to: eca-api-sample.xml`);
    
    console.log(`\n🎉 TEST COMPLETED ${success ? 'SUCCESSFULLY' : 'WITH ISSUES'}`);
    
  } catch (error) {
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    console.error(`\n❌ TEST FAILED after ${totalTime.toFixed(2)}s:`);
    console.error(`   Error: ${error.message}`);
    
    if (error.stack) {
      console.error(`\n🔍 STACK TRACE:`);
      console.error(error.stack.split('\n').slice(0, 10).join('\n'));
    }
  }
}

// Run the test
testECAAPI();