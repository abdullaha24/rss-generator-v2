#!/usr/bin/env node

/**
 * ECA Website Structure Explorer
 * Analyze https://www.eca.europa.eu/en/all-news for RSS scraping
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function exploreECAStructure() {
  console.log('🔍 Exploring ECA News Structure...');
  console.log('🌐 URL: https://www.eca.europa.eu/en/all-news');
  console.log('');
  
  let scraper = null;
  
  try {
    scraper = new AdvancedScraperFixed();
    
    console.log('🚀 Initializing browser...');
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }
    
    console.log('📄 Loading ECA news page...');
    await scraper.navigateWithStealth('https://www.eca.europa.eu/en/all-news', {
      waitForSelector: '.news-item, .ms-webpart-zone, [data-automation-id], .sp-webpart',
      timeout: 45000,
      waitForNetworkIdle: true
    });
    
    // Wait extra time for SharePoint dynamic content
    console.log('⏳ Waiting for SharePoint content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get the full rendered HTML
    const html = await scraper.page.content();
    
    // Save HTML for inspection
    fs.writeFileSync('eca-full-html.html', html, 'utf8');
    console.log('💾 Saved full HTML to: eca-full-html.html');
    
    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    console.log('');
    console.log('🔍 STRUCTURE ANALYSIS:');
    console.log('');
    
    // Look for common news item patterns
    const newsSelectors = [
      '.news-item',
      '.article-item', 
      '.post-item',
      '.content-item',
      '[data-automation-id*="news"]',
      '[data-automation-id*="article"]',
      '[data-automation-id*="item"]',
      '.ms-ListItem',
      '.ms-DetailsRow',
      '.sp-listItem',
      '[role="gridcell"]',
      '.news-list-item',
      '.webpart-news-item'
    ];
    
    for (const selector of newsSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        
        // Analyze first few elements
        elements.slice(0, 3).each((i, el) => {
          const $el = $(el);
          const text = $el.text().trim().substring(0, 100);
          const html = $el.html()?.substring(0, 200);
          console.log(`   ${i + 1}. Text: "${text}..."`);
          console.log(`   ${i + 1}. HTML: ${html}...`);
          console.log('');
        });
        break;
      }
    }
    
    // Look for titles specifically
    console.log('🏷️ TITLE ANALYSIS:');
    const titleSelectors = ['h1', 'h2', 'h3', '.title', '[data-automation-id*="title"]', '.ms-Link'];
    for (const selector of titleSelectors) {
      const titles = $(selector);
      if (titles.length > 3) {
        console.log(`Found ${titles.length} potential titles with: ${selector}`);
        titles.slice(0, 5).each((i, el) => {
          const title = $(el).text().trim();
          if (title.length > 20) {
            console.log(`   "${title}"`);
          }
        });
        console.log('');
      }
    }
    
    // Look for links
    console.log('🔗 LINK ANALYSIS:');
    const links = $('a[href]');
    console.log(`Found ${links.length} total links`);
    
    const newsLinks = links.filter((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      return href && text.length > 20 && 
             (href.includes('/news/') || href.includes('/publications/') || 
              href.includes('/press-releases/') || href.includes('europa.eu'));
    });
    
    console.log(`Found ${newsLinks.length} potential news links`);
    newsLinks.slice(0, 5).each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const title = $el.text().trim();
      console.log(`   "${title}" -> ${href}`);
    });
    
    // Look for dates
    console.log('');
    console.log('📅 DATE ANALYSIS:');
    const dateSelectors = ['time', '.date', '[data-automation-id*="date"]', '.published', '.created'];
    for (const selector of dateSelectors) {
      const dates = $(selector);
      if (dates.length > 0) {
        console.log(`Found ${dates.length} dates with: ${selector}`);
        dates.slice(0, 5).each((i, el) => {
          const $el = $(el);
          const datetime = $el.attr('datetime');
          const text = $el.text().trim();
          console.log(`   "${text}" ${datetime ? `(${datetime})` : ''}`);
        });
        console.log('');
      }
    }
    
    // Check page content
    const pageText = $('body').text();
    const hasNewsContent = pageText.includes('news') || pageText.includes('press') || 
                          pageText.includes('publication') || pageText.includes('report');
    
    console.log('📊 CONTENT VALIDATION:');
    console.log(`Page contains news-related content: ${hasNewsContent}`);
    console.log(`Page text length: ${pageText.length} characters`);
    
    console.log('');
    console.log('✅ Exploration completed successfully!');
    
  } catch (error) {
    console.error('❌ Exploration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

// Run exploration
exploreECAStructure();