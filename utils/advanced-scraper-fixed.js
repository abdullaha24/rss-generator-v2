/**
 * Vercel-Compatible Advanced Browser Automation Scraper
 * Fixed for proper serverless deployment with conditional package loading
 */

import * as cheerio from 'cheerio';

/**
 * Vercel-optimized browser automation class
 */
class AdvancedScraperFixed {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
    this.isLocal = !this.isVercel;
  }

  /**
   * Initialize browser with proper environment detection and conditional imports
   */
  async initBrowser() {
    console.log(`Environment: ${this.isVercel ? 'Vercel' : 'Local'}`);
    console.log('Environment variables:', {
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV
    });

    try {
      if (this.isVercel) {
        return await this.initVercelBrowser();
      } else {
        return await this.initLocalBrowser();
      }
    } catch (error) {
      console.error('Browser initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize browser for Vercel serverless environment
   */
  async initVercelBrowser() {
    console.log('Initializing Vercel serverless browser...');
    
    // Dynamic imports for Vercel
    const [chromium, puppeteerCore] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core')
    ]);

    const launchOptions = {
      args: [
        ...chromium.default.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-pings',
        '--hide-scrollbars',
        '--disable-logging',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--disable-extensions']
    };

    console.log('Launching Vercel browser with chromium path:', await chromium.default.executablePath());
    
    this.browser = await puppeteerCore.default.launch(launchOptions);
    this.page = await this.browser.newPage();
    
    await this.configurePage();
    console.log('Vercel browser initialized successfully');
    return true;
  }

  /**
   * Initialize browser for local development
   */
  async initLocalBrowser() {
    console.log('Initializing local development browser...');
    
    // Dynamic import for local development
    const puppeteer = await import('puppeteer');

    const launchOptions = {
      headless: 'new',
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-pings',
        '--hide-scrollbars',
        '--disable-logging',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor'
      ]
    };

    this.browser = await puppeteer.default.launch(launchOptions);
    this.page = await this.browser.newPage();
    
    await this.configurePage();
    console.log('Local browser initialized successfully');
    return true;
  }

  /**
   * Configure page with realistic headers and settings
   */
  async configurePage() {
    // Set realistic viewport with slight randomization
    const width = 1920 + Math.floor(Math.random() * 200) - 100;
    const height = 1080 + Math.floor(Math.random() * 200) - 100;
    
    await this.page.setViewport({ 
      width,
      height,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });

    // Realistic User-Agent rotation
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
    ];
    
    const selectedUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    console.log('Using User-Agent:', selectedUserAgent.substring(0, 50) + '...');
    
    await this.page.setUserAgent(selectedUserAgent);

    // Set realistic headers with randomization
    const acceptLanguages = [
      'en-US,en;q=0.9',
      'en-US,en;q=0.9,es;q=0.8',
      'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
      'en-US,en;q=0.9,it;q=0.8'
    ];

    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1',
      'Referer': 'https://www.google.com/',
      'Connection': 'keep-alive'
    });

    // Remove webdriver detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      if (window.navigator.permissions && window.navigator.permissions.query) {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      }
    });
  }

  /**
   * Navigate to URL with human-like behavior and Cloudflare handling
   */
  async navigateWithStealth(url, options = {}) {
    const {
      waitForSelector = null,
      timeout = this.isVercel ? 45000 : 30000,
      waitForNetworkIdle = true
    } = options;

    // Try multiple strategies for navigation
    const strategies = [
      { method: 'direct', waitUntil: 'networkidle2' },
      { method: 'direct', waitUntil: 'domcontentloaded' },
      { method: 'with_referer', waitUntil: 'networkidle0' },
      { method: 'delayed', waitUntil: 'load' }
    ];

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      
      try {
        console.log(`Navigation attempt ${i + 1} using ${strategy.method} strategy`);

        if (strategy.method === 'delayed') {
          await this.randomDelay(2000, 4000);
        } else if (strategy.method === 'with_referer') {
          // Add Google referrer for this attempt
          const currentHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'DNT': '1',
            'Referer': 'https://www.google.com/search?q=eu+council+press+releases',
            'Connection': 'keep-alive'
          };
          await this.page.setExtraHTTPHeaders(currentHeaders);
          await this.randomDelay(1000, 2000);
        } else {
          await this.randomDelay(500, 1500);
        }

        console.log(`Navigating to: ${url}`);

        // Navigate with strategy-specific settings
        const response = await this.page.goto(url, {
          waitUntil: waitForNetworkIdle ? strategy.waitUntil : 'domcontentloaded',
          timeout: Math.min(timeout, 40000)
        });

        if (!response) {
          console.warn(`Strategy ${i + 1}: No response received`);
          continue;
        }

        if (!response.ok()) {
          console.warn(`Strategy ${i + 1}: HTTP ${response.status()}: ${response.statusText()}`);
          if (i === strategies.length - 1) {
            throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
          }
          continue;
        }

        console.log(`Strategy ${i + 1}: Success! Status ${response.status()}`);

        // Check for Cloudflare challenge
        const content = await this.page.content();
        if (this.isCloudflareChallenge(content)) {
          console.log('Cloudflare challenge detected, handling...');
          const challengeResult = await this.handleCloudflareChallenge();
          if (!challengeResult) {
            console.warn(`Strategy ${i + 1}: Cloudflare challenge failed`);
            if (i < strategies.length - 1) continue;
          }
        }

        // Wait for specific selector if provided
        if (waitForSelector) {
          try {
            await this.page.waitForSelector(waitForSelector, { 
              timeout: Math.min(timeout / 3, 15000),
              visible: true 
            });
            console.log(`Found required selector: ${waitForSelector}`);
          } catch (selectorError) {
            console.warn(`Selector wait timeout for ${waitForSelector}, continuing...`);
          }
        }

        // Light scrolling simulation
        await this.simulateScrolling();

        return response;

      } catch (error) {
        console.error(`Strategy ${i + 1} failed: ${error.message}`);
        if (i === strategies.length - 1) {
          throw error;
        }
        // Wait before trying next strategy
        await this.randomDelay(2000, 3000);
      }
    }

    throw new Error('All navigation strategies failed');
  }

  /**
   * Check if page contains Cloudflare challenge
   */
  isCloudflareChallenge(content) {
    const cloudflareIndicators = [
      'Just a moment...',
      'cf-browser-verification',
      'checking your browser',
      'cloudflare',
      'Please enable JavaScript',
      'DDoS protection by Cloudflare'
    ];
    
    return cloudflareIndicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Handle Cloudflare challenge page with timeout
   */
  async handleCloudflareChallenge() {
    try {
      console.log('Handling Cloudflare challenge...');
      
      // Wait for challenge to complete (shorter timeout for serverless)
      const challengeTimeout = this.isVercel ? 12000 : 18000;
      
      // Multiple indicators to wait for challenge completion
      const challengeComplete = await Promise.race([
        this.page.waitForFunction(
          () => !document.querySelector('title')?.textContent?.includes('Just a moment'),
          { timeout: challengeTimeout }
        ).then(() => 'title-change'),
        this.page.waitForFunction(
          () => !document.body?.textContent?.includes('checking your browser'),
          { timeout: challengeTimeout }
        ).then(() => 'body-change'),
        this.page.waitForFunction(
          () => document.readyState === 'complete' && !document.querySelector('[class*="cf-browser-verification"]'),
          { timeout: challengeTimeout }
        ).then(() => 'page-ready'),
        new Promise(resolve => setTimeout(() => resolve('timeout'), challengeTimeout))
      ]);
      
      if (challengeComplete === 'timeout') {
        console.warn('Cloudflare challenge handling timed out');
        return false;
      }
      
      console.log(`Cloudflare challenge completed via ${challengeComplete}`);
      
      // Additional wait for page to stabilize
      await this.randomDelay(2000, 4000);
      
      return true;
      
    } catch (error) {
      console.warn('Cloudflare challenge handling failed:', error.message);
      return false;
    }
  }

  /**
   * Lightweight scrolling simulation for serverless
   */
  async simulateScrolling() {
    try {
      // Minimal scrolling to trigger content loading
      const scrollDistance = 400;
      
      await this.page.evaluate((distance) => {
        window.scrollBy(0, distance);
      }, scrollDistance);
      
      await this.randomDelay(300, 600);
      
      // Scroll back to top
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
    } catch (error) {
      console.warn('Scrolling simulation failed:', error.message);
    }
  }

  /**
   * Extract content using multiple strategies with optimized timeouts
   */
  async extractContent(selectors, options = {}) {
    const {
      waitForContent = true,
      maxRetries = this.isVercel ? 2 : 3,
      retryDelay = this.isVercel ? 1500 : 2000
    } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Content extraction attempt ${attempt}/${maxRetries}`);

        if (waitForContent && attempt === 1) {
          // Wait for dynamic content to load (only on first attempt)
          await this.waitForDynamicContent();
        }

        // Get page content
        const html = await this.page.content();
        const $ = cheerio.load(html);

        // Try each selector in order
        for (const selector of selectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            return { html, selector, elements: elements.length };
          }
        }

        // If no content found, wait and retry
        if (attempt < maxRetries) {
          console.log('No content found, retrying...');
          await this.randomDelay(retryDelay, retryDelay + 500);
        }

      } catch (error) {
        console.error(`Extraction attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) throw error;
        await this.randomDelay(1000, 2000);
      }
    }

    throw new Error('Failed to extract content with any selector');
  }

  /**
   * Wait for dynamic content with serverless-optimized timeouts
   */
  async waitForDynamicContent() {
    try {
      // Shorter timeouts for serverless environment
      const contentTimeout = this.isVercel ? 5000 : 8000;
      
      // Wait for network to be mostly idle
      try {
        await this.page.waitForFunction(() => 
          document.readyState === 'complete',
          { timeout: contentTimeout / 2 }
        );
      } catch (readyStateError) {
        console.warn('Ready state check timed out, continuing...');
      }

      // Wait for potential AJAX requests
      await this.randomDelay(1500, 2500);

      // Check if content is still loading (with timeout)
      try {
        await this.page.waitForFunction(
          () => {
            const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"]');
            return loadingIndicators.length === 0;
          },
          { timeout: contentTimeout / 2 }
        );
      } catch (loadingError) {
        console.warn('Loading indicators check timed out, continuing...');
      }

    } catch (error) {
      console.warn('Dynamic content wait failed:', error.message);
    }
  }

  /**
   * Optimized random delay for serverless
   */
  async randomDelay(min, max) {
    // Shorter delays in serverless environment to save time
    const multiplier = this.isVercel ? 0.7 : 1.0;
    const adjustedMin = Math.floor(min * multiplier);
    const adjustedMax = Math.floor(max * multiplier);
    
    const delay = Math.floor(Math.random() * (adjustedMax - adjustedMin + 1)) + adjustedMin;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Wait for ECA React component to load news content
   * Specifically waits for SharePoint NewsPageWebPart to render
   */
  async waitForECAReactContent() {
    try {
      console.log('ECA: Waiting for React component to load news content...');
      
      const reactTimeout = this.isVercel ? 15000 : 20000;
      
      // First, wait for the React root element to appear
      await this.page.waitForSelector('section.news[data-reactroot]', { 
        timeout: reactTimeout / 2,
        visible: true 
      });
      
      console.log('ECA: React root found, waiting for news list...');
      
      // Then wait for the news list to populate with items
      const newsLoaded = await Promise.race([
        // Strategy 1: Wait for news list with items
        this.page.waitForFunction(
          () => {
            const newsList = document.querySelector('ul.news-list');
            const newsItems = document.querySelectorAll('ul.news-list li .card.card-news');
            return newsList && newsItems.length > 0;
          },
          { timeout: reactTimeout }
        ).then(() => 'news-loaded'),
        
        // Strategy 2: Wait for cards with content
        this.page.waitForFunction(
          () => {
            const cards = document.querySelectorAll('.card.card-news');
            const cardsWithTitles = Array.from(cards).filter(card => {
              const title = card.querySelector('h5.card-title');
              return title && title.textContent.trim().length > 5;
            });
            return cardsWithTitles.length > 0;
          },
          { timeout: reactTimeout }
        ).then(() => 'cards-loaded'),
        
        // Strategy 3: Wait for specific content patterns
        this.page.waitForFunction(
          () => {
            const content = document.body.textContent;
            return content.includes('ECA Journal') || content.includes('Newsletter') || content.includes('Special Report');
          },
          { timeout: reactTimeout }
        ).then(() => 'content-loaded'),
        
        // Timeout fallback
        new Promise(resolve => setTimeout(() => resolve('timeout'), reactTimeout))
      ]);
      
      if (newsLoaded === 'timeout') {
        console.warn('ECA: React content loading timed out, proceeding with available content');
      } else {
        console.log(`ECA: React content loaded successfully via ${newsLoaded}`);
      }
      
      // Additional wait for content to stabilize
      await this.randomDelay(2000, 3000);
      
      // Check if we have news items
      const itemCount = await this.page.evaluate(() => {
        return document.querySelectorAll('ul.news-list li .card.card-news').length;
      });
      
      console.log(`ECA: Found ${itemCount} news items after React loading`);
      
      return itemCount > 0;
      
    } catch (error) {
      console.warn('ECA: React content wait failed:', error.message);
      return false;
    }
  }

  /**
   * Clean up resources with error handling
   */
  async cleanup() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log('Browser cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error.message);
      // Force cleanup
      try {
        if (this.browser) {
          await this.browser.close();
        }
      } catch (forceError) {
        console.error('Force cleanup failed:', forceError.message);
      }
    }
  }
}

export default AdvancedScraperFixed;