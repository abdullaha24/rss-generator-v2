import { fetchHTML } from './utils/http-client.js';

async function test() {
  try {
    console.log('Testing ECA website fetch...');
    const html = await fetchHTML('https://www.eca.europa.eu/en/all-news');
    
    if (\!html) {
      console.log('❌ No HTML received');
      return;
    }
    
    console.log('✅ HTML received, length:', html.length);
    console.log('Contains news-list?', html.includes('news-list'));
    console.log('Contains card-news?', html.includes('card-news'));
    
    // Quick test of parsing
    import('cheerio').then(cheerio => {
      const $ = cheerio.load(html);
      const items = $('ul.news-list li .card.card-news');
      console.log('News items found in live HTML:', items.length);
      
      if (items.length === 0) {
        console.log('⚠️ No items found - checking for dynamic content indicators');
        console.log('Contains React?', html.includes('react'));
        console.log('Contains SharePoint?', html.includes('SharePoint'));
        console.log('Contains JavaScript loading?', html.includes('Loading...'));
      }
    });
    
  } catch (error) {
    console.error('❌ Fetch failed:', error.message);
  }
}

test();
