import * as cheerio from 'cheerio';
import * as fs from 'fs';

const html = fs.readFileSync('eca.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== ECA HTML Analysis ===');

// Test main strategy
let newsItems = $('ul.news-list li .card.card-news');
console.log('Main selector found:', newsItems.length, 'items');

if (newsItems.length > 0) {
    const $first = $(newsItems[0]);
    
    console.log('\nFirst item analysis:');
    console.log('- Title element exists:', $first.find('h5.card-title').length > 0);
    console.log('- Link element exists:', $first.find('a.stretched-link').length > 0);
    console.log('- Date element exists:', $first.find('time.card-date').length > 0);
    console.log('- Description exists:', $first.find('.card-body p').length > 0);
    
    console.log('\nActual values:');
    console.log('- Title:', $first.find('h5.card-title').text().trim());
    console.log('- Link:', $first.find('a.stretched-link').attr('href'));
    console.log('- Date:', $first.find('time.card-date').text().trim());
    console.log('- Description (first 100 chars):', $first.find('.card-body p').first().text().trim().substring(0, 100));
}

// Test all items extraction
const allItems = [];
newsItems.each((index, element) => {
    const $item = $(element);
    const title = $item.find('h5.card-title').text().trim();
    const link = $item.find('a.stretched-link').attr('href');
    const date = $item.find('time.card-date').text().trim();
    
    if (title && link) {
        allItems.push({ title, link, date });
    }
});

console.log('\nSuccessfully parsed items:', allItems.length);
if (allItems.length > 0) {
    console.log('Sample titles:');
    allItems.slice(0, 3).forEach((item, i) => {
        console.log(`${i+1}. ${item.title} (${item.date})`);
    });
}
