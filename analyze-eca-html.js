#!/usr/bin/env node

import * as cheerio from 'cheerio';
import fs from 'fs';

console.log('🔍 Analyzing ECA HTML Structure...');

const html = fs.readFileSync('eca-full-html.html', 'utf8');
const $ = cheerio.load(html);

console.log('\n📊 BASIC STATS:');
console.log('Total divs:', $('div').length);
console.log('Total links:', $('a').length);
console.log('Total spans:', $('span').length);

console.log('\n🔍 DIVs WITH IDs:');
const divsWithId = $('div[id]');
console.log('DIVs with ID count:', divsWithId.length);

divsWithId.each((i, el) => {
  if (i < 15) {
    const $el = $(el);
    const id = $el.attr('id');
    const text = $el.text().trim();
    const hasContent = text.length > 50;
    console.log(`${i+1}. ID: "${id}" | Length: ${text.length} | Content: ${hasContent ? 'YES' : 'NO'}`);
    if (hasContent && text.length < 200) {
      console.log(`   Text: "${text.substring(0, 100)}..."`);
    }
  }
});

console.log('\n🔍 LOOKING FOR SPECIFIC PATTERNS:');

// Look for web part containers
const webpartContainers = $('[id*="WebPart"], [id*="WPQ"], [class*="webpart"]');
console.log('Web part containers:', webpartContainers.length);
webpartContainers.each((i, el) => {
  const $el = $(el);
  const id = $el.attr('id');
  const className = $el.attr('class');
  console.log(`  WebPart ${i+1}: ID="${id}" Class="${className}"`);
});

// Look for SharePoint specific elements
const spElements = $('[id*="ctl00"], [class*="ms-"], [data-automation-id]');
console.log('\nSharePoint elements:', spElements.length);
spElements.slice(0, 10).each((i, el) => {
  const $el = $(el);
  const id = $el.attr('id');
  const automationId = $el.attr('data-automation-id');
  if (automationId || (id && id.includes('ctl00'))) {
    console.log(`  SP ${i+1}: ID="${id}" Automation="${automationId}"`);
  }
});

// Look for content that might be news items
const possibleNews = $('div, article, section').filter((i, el) => {
  const $el = $(el);
  const text = $el.text().trim();
  const hasDate = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/);
  const hasNewsWords = text.match(/\b(news|publication|report|press|release|announcement)\b/i);
  const hasTitle = text.length > 100 && text.length < 2000;
  return hasDate || hasNewsWords || hasTitle;
});

console.log('\n📰 POSSIBLE NEWS CONTENT:');
console.log('Elements with potential news content:', possibleNews.length);
possibleNews.slice(0, 5).each((i, el) => {
  const $el = $(el);
  const text = $el.text().trim().substring(0, 150);
  console.log(`  News ${i+1}: "${text}..."`);
});

console.log('\n✅ Analysis completed');