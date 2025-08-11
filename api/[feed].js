/**
 * EU RSS Generator - Single API Endpoint for All Feeds
 * Handles 9 European institutional website RSS feeds
 */

import { generateRSSFeed } from '../utils/rss-builder.js';
import { scrapeEEAS, getEEASChannelInfo } from '../utils/eeas-scraper.js';

/**
 * Main API handler
 */
export default async function handler(req, res) {
  const { feed } = req.query;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    // Handle different feed types
    switch (feed) {
      case 'eeas':
        return await handleEEAS(req, res);
      
      case 'curia':
        return await handleNotImplemented(req, res, 'European Court of Justice');
      
      case 'europarl':
        return await handleNotImplemented(req, res, 'European Parliament Q&A');
      
      case 'eca':
        return await handleNotImplemented(req, res, 'European Court of Auditors');
      
      case 'consilium':
        return await handleNotImplemented(req, res, 'EU Council Press Releases');
      
      case 'frontex':
        return await handleNotImplemented(req, res, 'Frontex News');
      
      case 'europol':
        return await handleNotImplemented(req, res, 'Europol News');
      
      case 'coe':
        return await handleNotImplemented(req, res, 'Council of Europe');
      
      case 'nato':
        return await handleNotImplemented(req, res, 'NATO News');
      
      default:
        return handleInvalidFeed(req, res);
    }
    
  } catch (error) {
    console.error(`Error processing ${feed} feed:`, error);
    return handleError(req, res, error, feed);
  }
}

/**
 * Handle EEAS Press Material feed
 */
async function handleEEAS(req, res) {
  try {
    console.log('Processing EEAS feed request');
    
    const items = await scrapeEEAS();
    const channelInfo = getEEASChannelInfo();
    const rssXml = generateRSSFeed(channelInfo, items);
    
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
    
    return res.status(200).send(rssXml);
    
  } catch (error) {
    console.error('EEAS feed error:', error);
    throw error;
  }
}

/**
 * Handle not yet implemented feeds
 */
async function handleNotImplemented(req, res, feedName) {
  const channelInfo = {
    title: `${feedName} - Coming Soon`,
    description: `RSS feed for ${feedName} is under development`,
    link: `https://eu-rss-generator.vercel.app/api/${req.query.feed}`,
    language: 'en'
  };
  
  const items = [{
    title: `${feedName} RSS Feed Under Development`,
    description: `This RSS feed is currently being developed. Please check back soon for updates.`,
    link: channelInfo.link,
    pubDate: new Date().toISOString(),
    guid: `${channelInfo.link}#development`
  }];
  
  const rssXml = generateRSSFeed(channelInfo, items);
  
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  return res.status(200).send(rssXml);
}

/**
 * Handle invalid feed requests
 */
function handleInvalidFeed(req, res) {
  const channelInfo = {
    title: 'EU RSS Generator - Invalid Feed',
    description: 'The requested RSS feed does not exist',
    link: 'https://eu-rss-generator.vercel.app',
    language: 'en'
  };
  
  const items = [{
    title: 'Invalid Feed Request',
    description: `Available feeds: eeas, curia, europarl, eca, consilium, frontex, europol, coe, nato`,
    link: channelInfo.link,
    pubDate: new Date().toISOString(),
    guid: `${channelInfo.link}#invalid`
  }];
  
  const rssXml = generateRSSFeed(channelInfo, items);
  
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  return res.status(400).send(rssXml);
}

/**
 * Handle errors with RSS format
 */
function handleError(req, res, error, feedName) {
  const channelInfo = {
    title: `${feedName?.toUpperCase() || 'EU'} RSS Feed - Error`,
    description: `Temporary error occurred while generating RSS feed`,
    link: `https://eu-rss-generator.vercel.app/api/${feedName || 'unknown'}`,
    language: 'en'
  };
  
  const items = [{
    title: 'RSS Feed Temporarily Unavailable',
    description: `Error: ${error.message || 'Unknown error occurred'}. Please try again in a few minutes.`,
    link: channelInfo.link,
    pubDate: new Date().toISOString(),
    guid: `${channelInfo.link}#error-${Date.now()}`
  }];
  
  const rssXml = generateRSSFeed(channelInfo, items);
  
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  return res.status(500).send(rssXml);
}