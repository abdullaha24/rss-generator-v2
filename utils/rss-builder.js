/**
 * RSS 2.0 Feed Builder Utilities
 * Professional-grade RSS generation for WordPress RSS Aggregator compatibility
 */

/**
 * Generate RSS 2.0 XML feed
 */
function generateRSSFeed(channelInfo, items) {
  const { title, description, link, language = 'en', generator = 'EU RSS Generator' } = channelInfo;
  
  const rssHeader = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${escapeXml(title)}]]></title>
    <description><![CDATA[${escapeXml(description)}]]></description>
    <link>${escapeXml(link)}</link>
    <language>${language}</language>
    <generator>${generator}</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(link)}" rel="self" type="application/rss+xml" />`;

  const rssItems = items.map(item => generateRSSItem(item)).join('\n');
  
  const rssFooter = `
  </channel>
</rss>`;

  return rssHeader + '\n' + rssItems + rssFooter;
}

/**
 * Generate individual RSS item
 */
function generateRSSItem(item) {
  const { title, description, link, pubDate, category, guid, author } = item;
  
  return `    <item>
      <title><![CDATA[${escapeXml(title)}]]></title>
      <description><![CDATA[${escapeXml(description || title)}]]></description>
      <link>${escapeXml(link)}</link>
      <pubDate>${formatRSSDate(pubDate)}</pubDate>
      ${category ? `<category><![CDATA[${escapeXml(category)}]]></category>` : ''}
      ${author ? `<author><![CDATA[${escapeXml(author)}]]></author>` : ''}
      <guid isPermaLink="true">${escapeXml(guid || link)}</guid>
    </item>`;
}

/**
 * Format date for RSS (RFC 2822 format)
 */
function formatRSSDate(date) {
  if (!date) return new Date().toUTCString();
  
  if (typeof date === 'string') {
    // Handle DD.MM.YYYY format from EEAS
    if (date.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [day, month, year] = date.split('.');
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(date);
    }
  }
  
  return date instanceof Date && !isNaN(date) ? date.toUTCString() : new Date().toUTCString();
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Clean and truncate text for RSS description
 */
function cleanDescription(text, maxLength = 500) {
  if (!text) return '';
  
  // Remove HTML tags, share service metadata, and extra whitespace
  const cleaned = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{"service":"share"[^}]*}/g, '')
    .replace(/PRINT\s+/g, '')
    .replace(/Press and information team[^\.]*\./g, '')
    .replace(/©[^\.]*\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned.length <= maxLength) return cleaned;
  
  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Resolve relative URLs to absolute URLs
 */
function resolveUrl(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return baseUrl.replace(/\/$/, '') + url;
  return baseUrl.replace(/\/$/, '') + '/' + url;
}

export {
  generateRSSFeed,
  generateRSSItem,
  formatRSSDate,
  escapeXml,
  cleanDescription,
  resolveUrl
};