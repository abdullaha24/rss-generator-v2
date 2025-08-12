import { scrapeECANews } from './utils/eca-scraper-final.js';

async function testECA() {
  console.log('Testing ECA scraper...');
  const startTime = Date.now();

  try {
    const items = await scrapeECANews();
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    console.log(`Total time: ${totalTime}s`);
    console.log(`Items found: ${items.length}`);
    
    if (items.length > 0) {
      console.log('\nFirst 3 items:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`${i+1}. ${item.title}`);
        console.log(`   Link: ${item.link}`);
        console.log(`   Date: ${item.pubDate}`);
        console.log(`   Category: ${item.category}`);
      });
      
      // Analysis
      const validLinks = items.filter(item => item.link.includes('eca.europa.eu')).length;
      console.log(`\nValid ECA links: ${validLinks}/${items.length}`);
      
      if (totalTime <= 10 && items.length >= 5) {
        console.log('✅ TEST PASSED - Ready for Vercel!');
      } else {
        console.log('⚠️ TEST CONCERNS:');
        if (totalTime > 10) console.log(`  - Too slow: ${totalTime}s`);
        if (items.length < 5) console.log(`  - Too few items: ${items.length}`);
      }
    } else {
      console.log('❌ No items found');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testECA();