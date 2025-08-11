#!/usr/bin/env node

/**
 * Debug ECA with User Interactions
 * Try different approaches to trigger content loading
 */

import AdvancedScraperFixed from './utils/advanced-scraper-fixed.js';
import fs from 'fs';
import * as cheerio from 'cheerio';

async function debugWithInteractions() {
  console.log('🔍 Debugging ECA with User Interactions...');
  
  let scraper = null;
  
  try {
    scraper = new AdvancedScraperFixed();
    const initialized = await scraper.initBrowser();
    
    if (!initialized) {
      throw new Error('Failed to initialize browser');
    }

    // Navigate to the page
    console.log('📄 Loading ECA news page...');
    await scraper.navigateWithStealth('https://www.eca.europa.eu/en/all-news', {
      waitForSelector: 'body',
      timeout: 45000,
      waitForNetworkIdle: true
    });
    
    // Wait initial time
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🖱️ Trying different interactions...');
    
    // Try scrolling to bottom
    console.log('⬇️ Scrolling to bottom...');
    await scraper.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try scrolling up and down
    console.log('⬆️⬇️ Scrolling up and down...');
    await scraper.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await scraper.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try clicking on potential triggers
    console.log('🖱️ Looking for clickable elements...');
    const clickableElements = await scraper.page.$$eval('[class*="webpart"], [id*="WebPart"], button', 
      elements => elements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        text: el.textContent.trim().substring(0, 50)
      }))
    );
    
    console.log(`Found ${clickableElements.length} potential clickable elements`);
    clickableElements.slice(0, 5).forEach((el, i) => {
      console.log(`  ${i+1}. ${el.tagName} id="${el.id}" class="${el.className}" text="${el.text}"`);
    });
    
    // Try executing JavaScript to manually trigger content loading
    console.log('🔧 Executing JavaScript to trigger content...');
    await scraper.page.evaluate(() => {
      // Trigger various events that might load content
      window.dispatchEvent(new Event('load'));
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Try to find and execute any SharePoint initialization functions
      if (typeof window.ECA !== 'undefined') {
        console.log('Found ECA object');
      }
      if (typeof window.SP !== 'undefined') {
        console.log('Found SharePoint object');
      }
      
      // Try to trigger any React rendering
      if (typeof window.React !== 'undefined') {
        console.log('Found React');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try different viewport sizes
    console.log('📱 Trying mobile viewport...');
    await scraper.page.setViewport({ width: 375, height: 812 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('💻 Back to desktop viewport...');
    await scraper.page.setViewport({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Final check
    const html = await scraper.page.content();
    fs.writeFileSync('eca-debug-interactions.html', html, 'utf8');
    
    const $ = cheerio.load(html);
    const cards = $('.card');
    const newsLists = $('[class*="news"]');
    const ecaContent = $('*:contains("ECA Journal"), *:contains("European Court")');
    
    console.log('📊 Final analysis:');
    console.log(`   Cards: ${cards.length}`);
    console.log(`   News elements: ${newsLists.length}`);
    console.log(`   ECA content: ${ecaContent.length}`);
    
    if (ecaContent.length > 0) {
      console.log('📰 ECA content found:');
      ecaContent.slice(0, 3).each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
          console.log(`   "${text.substring(0, 80)}..."`);
        }
      });
    }
    
    // Try to see if there are any iframes or embedded content
    const iframes = $('iframe');
    console.log(`🖼️  iframes found: ${iframes.length}`);
    
    // Check for any error messages or loading indicators
    const errors = $('[class*="error"], [class*="loading"], .spinner');
    console.log(`⚠️  Error/loading elements: ${errors.length}`);
    
    console.log('✅ Interaction testing completed');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    if (scraper) {
      await scraper.cleanup();
    }
  }
}

debugWithInteractions();