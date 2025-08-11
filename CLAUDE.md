# RSS FEED GENERATOR PROJECT

## Project Summary

Client Request: Create RSS feeds for 9 European institutional websites that lack RSS or have problematic feeds for WordPress RSS Aggregator plugin import.
Client Workflow: Uses WP RSS Aggregator to automatically pull RSS feeds → create WordPress draft posts → manual review/publish.

## Target Sites Analysis

### 1. EEAS Press Material

- **URL**: https://www.eeas.europa.eu/eeas/press-material_en
- **Status**: No RSS
- **Type**: Standard web scraping required

### 2. European Court of Justice

- **URL**: https://curia.europa.eu/jcms/jcms/Jo2_7052/en/
- **Status**: No RSS
- **Special**: PDF documents - requires PDF text extraction
- **Strategy**: Extract summary from PDFs + provide full PDF link

### 3. European Parliament Q&A

- **URL**: https://www.europarl.europa.eu/rss/doc/written-questions-answers/en.xml
- **Status**: RSS exists but problematic
- **Issue**: Sometimes links to PDFs without content display
- **Strategy**: Enhance existing RSS + add PDF text extraction

### 4. European Court of Auditors

- **URL**: https://www.eca.europa.eu/en/all-news
- **Status**: No RSS
- **Type**: Standard web scraping required

### 5. EU Council Press Releases

- **URL**: https://www.consilium.europa.eu/en/press/press-releases/
- **Status**: No RSS
- **Type**: Standard web scraping required

### 6. Frontex News

- **URL**: https://frontex.europa.eu/media-centre/news/news-release/feed
- **Status**: RSS exists but doesn't work with WP plugin
- **Strategy**: Fix/rebuild RSS format for compatibility

### 7. Europol News

- **URL**: https://www.europol.europa.eu/cms/api/rss/news
- **Status**: RSS exists but truncated content
- **Strategy**: Enhance RSS with full content extraction

### 8. Council of Europe Newsroom

- **URL**: https://www.coe.int/en/web/portal/newsroom
- **Status**: No RSS
- **Type**: Standard web scraping required

### 9. NATO News

- **URL**: https://www.nato.int/cps/en/natohq/news.htm
- **Status**: No RSS
- **Type**: Standard web scraping required

## TECHNICAL ARCHITECTURE

### Technology Stack

- **Platform**: Vercel Serverless Functions (Node.js)
- **RSS Format**: RSS 2.0 (WordPress RSS Aggregator preferred format)
- **Scraping**: Cheerio for DOM manipulation
- **PDF Processing**: PDF-parse for text extraction
- **HTTP Client**: Native fetch with anti-bot headers
- **Caching**: 15-30 minute intervals for fresh content

### Project Structure

```
/api/
  └── [...feed].js    # Single file handling all 9 endpoints
/utils/
  └── rss-builder.js  # RSS generation utilities
  └── scrapers.js     # Individual site scrapers
  └── pdf-extractor.js # PDF content processing
```

### Endpoints Structure

- `/api/eeas` - EEAS Press Material
- `/api/curia` - European Court of Justice
- `/api/europarl` - European Parliament Q&A
- `/api/eca` - European Court of Auditors
- `/api/consilium` - EU Council Press
- `/api/frontex` - Frontex News
- `/api/europol` - Europol News
- `/api/coe` - Council of Europe
- `/api/nato` - NATO News

### RSS Feed Standards

- **Format**: RSS 2.0 XML
- **Quality**: BBC-grade professional feeds
- **WordPress Compatibility**: Full WP RSS Aggregator support
- **Elements**: title, description, link, pubDate, guid, author
- **PDF Handling**: Summary + enclosure for full document

### PDF Content Extraction Strategy

**For sites with PDF content (Curia, European Parliament):**

1. Use PDF-parse library to extract text
2. Generate summary: First 2-3 paragraphs or 300-500 words
3. RSS structure:
   - `<title>`: Document title
   - `<description>`: Summary + "... [Read full document]"
   - `<link>`: Direct PDF URL
   - `<enclosure>`: PDF attachment for download
4. Fallback: If PDF parsing fails, use page title + link

### Anti-Bot/403 Error Mitigation

**Primary Defenses:**

- Realistic User-Agent headers (Mozilla/5.0...)
- Standard browser headers (Accept, Accept-Language, Referer)
- Rate limiting (1-2 second delays)
- Session/cookie persistence

**Advanced Techniques:**

- Rotating User-Agents (different browsers/OS)
- Request randomization (timing/headers)
- Mobile User-Agents (often less restricted)
- Alternative endpoints (mobile versions)

**Fallback Cascade:**

1. Primary scraping attempt
2. Retry with different User-Agent
3. Try mobile endpoint
4. Return cached data (if available)
5. Return error feed with explanation

### Caching Strategy

- Cache scraped content for 15-30 minutes
- Ensure fresh data on each WP plugin fetch
- Leverage Vercel edge caching for performance
- Handle cache invalidation gracefully

### Error Handling

- Graceful degradation for failed scrapes
- Meaningful error messages in RSS format
- Fallback to cached content when possible
- Logging for debugging and monitoring

## IMPLEMENTATION APPROACH

- **Custom Solution**: No RSSHub framework
- **Build Strategy**: One feed at a time, iterative development
- **Testing**: Handle 403s as they occur during development
- **Deployment**: Vercel-optimized serverless functions
- **Monitoring**: Built-in error tracking and feed validation

## DEVELOPMENT INSTRUCTIONS

1. Start with simpler sites (standard scraping) to establish foundation
2. Move to PDF-heavy sites for complex extraction
3. Enhance existing problematic RSS feeds last
4. Thoroughly explore DOM structure for each site
5. Implement robust error handling from the start
6. Test WordPress RSS Aggregator compatibility
7. Optimize for Vercel deployment constraints

## FEED QUALITY REQUIREMENTS

- Professional-grade RSS feeds (BBC quality standard)
- Full content extraction (not just summaries unless PDF)
- Proper publication dates and metadata
- Valid XML structure and encoding
- Consistent update frequency
- WordPress RSS Aggregator plugin compatibility
