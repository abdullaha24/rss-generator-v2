/**
 * Test ECJ professional scraper with webpage summaries
 */

import { scrapeECJNews, getECJChannelInfo } from './utils/ecj-scraper.js';
import { generateRSSFeed } from './utils/rss-builder.js';
import { writeFile } from 'fs/promises';

async function testECJProfessional() {
  try {
    console.log('=== ECJ Professional RSS Test ===\n');
    
    // Test professional scraping
    console.log('1. Scraping ECJ with professional webpage summaries...');
    const items = await scrapeECJNews();
    
    console.log(`\n✅ Successfully scraped ${items.length} professional RSS items\n`);
    
    // Show detailed results
    console.log('=== Professional RSS Items ===');
    items.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`- Title: "${item.title}"`);
      console.log(`- Link: ${item.link}`);
      console.log(`- Date: ${item.pubDate}`);
      console.log(`- Description: "${item.description}"`);
      console.log(`- GUID: ${item.guid}`);
      console.log(`- Enclosure: ${item.enclosure ? 'PDF attached' : 'No PDF'}`);
    });

    // Generate professional RSS XML
    console.log('\n2. Generating professional RSS feed...');
    const channelInfo = getECJChannelInfo();
    const rssXml = generateRSSFeed(channelInfo, items);
    
    console.log(`\n✅ Generated professional RSS XML (${rssXml.length} characters)\n`);
    
    // Save RSS to file
    await writeFile('./ecj-professional-feed.xml', rssXml, 'utf8');
    console.log('✅ Professional RSS saved to: ./ecj-professional-feed.xml\n');
    
    // Show RSS preview
    console.log('=== Professional RSS XML Preview ===');
    const lines = rssXml.split('\n');
    const previewLines = 35;
    console.log(lines.slice(0, previewLines).join('\n'));
    if (lines.length > previewLines) {
      console.log('...\n(see full file for complete RSS)');
    }
    
    // Quality metrics
    console.log('\n=== Professional RSS Quality Metrics ===');
    console.log(`- Total items: ${items.length}`);
    console.log(`- XML size: ${rssXml.length} characters`);
    console.log(`- Items with professional titles: ${items.filter(i => i.title.includes('Judgment')).length}`);
    console.log(`- Items with meaningful descriptions: ${items.filter(i => i.description && i.description.length > 50).length}`);
    console.log(`- Items with PDF enclosures: ${items.filter(i => i.enclosure).length}`);
    console.log(`- Items with proper dates: ${items.filter(i => i.pubDate && !i.pubDate.includes('Invalid')).length}`);
    
    // Check for professional summaries containing colons (like "Football: the Court affirms...")
    const professionalSummaries = items.filter(i => 
      i.description && (i.description.includes(':') || i.description.includes('Court'))
    );
    console.log(`- Items with professional summaries: ${professionalSummaries.length}`);
    
    if (professionalSummaries.length > 0) {
      console.log('\n=== Example Professional Summaries ===');
      professionalSummaries.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. "${item.description}"`);
      });
    }
    
    console.log('\n✅ Professional ECJ RSS implementation complete!');
    
  } catch (error) {
    console.error('❌ Professional test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the professional test
testECJProfessional();