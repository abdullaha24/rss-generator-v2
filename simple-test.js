import { scrapeECANews } from './utils/eca-scraper-final.js';

async function test() {
  try {
    const items = await scrapeECANews();
    console.log('Items found:', items.length);
    if (items.length > 0) {
      console.log('First item title:', items[0].title.substring(0, 50));
      const isFallback = items[0].title.includes('Latest News Available');
      console.log('Is fallback content?', isFallback);
      if (\!isFallback) {
        console.log('SUCCESS: Real content found\!');
        console.log('Categories found:', [...new Set(items.map(i => i.category))]);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
