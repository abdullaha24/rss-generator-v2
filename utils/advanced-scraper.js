/**
 * Advanced Browser Automation Scraper
 * Uses Puppeteer with stealth techniques to bypass Cloudflare protection
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';
import * as cheerio from 'cheerio';

// Add stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Browser automation class with anti-detection measures
 */
class AdvancedScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser with stealth configuration
   */
  async initBrowser() {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV;
    const isLocalDev = !isProduction;
    
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
        '--disable-default-apps',
        '--mute-audio',
        '--no-pings',
        '--hide-scrollbars',
        '--disable-logging',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      ]
    };

    if (isProduction) {
      // Use serverless Chromium for production
      launchOptions.executablePath = await chromium.executablePath();
      launchOptions.args.push(...chromium.args);
    } else {
      // For local development, try to find system Chrome
      const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/opt/google/chrome/google-chrome', // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows 32-bit
      ];
      
      const fs = await import('fs');
      let chromePath = null;
      
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          chromePath = path;
          break;
        }
      }
      
      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log(`Using local Chrome at: ${chromePath}`);
      } else {
        console.log('Chrome not found in standard locations, trying puppeteer fallback...');
        // Try without specifying executablePath (will use bundled Chromium if available)
        delete launchOptions.executablePath;
      }
    }

    try {
      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      // Set realistic viewport and user agent
      await this.page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });

      // Set additional headers to mimic real browser
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1'
      });

      // Remove webdriver property
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      console.log('Advanced browser initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize browser:', error.message);
      return false;
    }
  }

  /**
   * Navigate to URL with human-like behavior
   */
  async navigateWithStealth(url, options = {}) {
    const {
      waitForSelector = null,
      timeout = 30000,
      waitForNetworkIdle = true
    } = options;

    try {
      console.log(`Navigating to: ${url}`);

      // Random delay before navigation (human-like)
      await this.randomDelay(500, 2000);

      // Navigate with realistic options
      const response = await this.page.goto(url, {
        waitUntil: waitForNetworkIdle ? 'networkidle2' : 'domcontentloaded',
        timeout
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Check for Cloudflare challenge page
      const content = await this.page.content();
      if (this.isCloudflareChallenge(content)) {
        console.log('Cloudflare challenge detected, waiting...');
        await this.handleCloudflareChallenge();
      }

      // Wait for specific selector if provided
      if (waitForSelector) {
        await this.page.waitForSelector(waitForSelector, { 
          timeout,
          visible: true 
        });
      }

      // Simulate human scrolling behavior
      await this.simulateHumanScrolling();

      return response;

    } catch (error) {
      console.error(`Navigation failed: ${error.message}`);
      throw error;
    }
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
   * Handle Cloudflare challenge page
   */
  async handleCloudflareChallenge() {
    try {
      console.log('Handling Cloudflare challenge...');
      
      // Wait for challenge to complete (up to 15 seconds)
      await this.page.waitForFunction(
        () => !document.querySelector('title')?.textContent.includes('Just a moment'),
        { timeout: 15000 }
      );
      
      // Additional wait for page to stabilize
      await this.randomDelay(2000, 4000);
      
      console.log('Cloudflare challenge completed');
      
    } catch (error) {
      console.warn('Cloudflare challenge handling timed out:', error.message);
      // Continue anyway - sometimes the challenge completes silently
    }
  }

  /**
   * Simulate human-like scrolling behavior
   */
  async simulateHumanScrolling() {
    try {
      // Random scroll behavior
      const scrolls = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < scrolls; i++) {
        const scrollDistance = Math.floor(Math.random() * 800) + 200;
        
        await this.page.evaluate((distance) => {
          window.scrollBy(0, distance);
        }, scrollDistance);
        
        await this.randomDelay(300, 800);
      }
      
      // Scroll back to top
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
    } catch (error) {
      console.warn('Scrolling simulation failed:', error.message);
    }
  }

  /**
   * Extract content using multiple strategies
   */
  async extractContent(selectors, options = {}) {
    const {
      waitForContent = true,
      maxRetries = 3,
      retryDelay = 2000
    } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Content extraction attempt ${attempt}/${maxRetries}`);

        if (waitForContent) {
          // Wait for dynamic content to load
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
          await this.randomDelay(retryDelay, retryDelay + 1000);
        }

      } catch (error) {
        console.error(`Extraction attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) throw error;
      }
    }

    throw new Error('Failed to extract content with any selector');
  }

  /**
   * Wait for dynamic content to load
   */
  async waitForDynamicContent() {
    try {
      // Wait for network to be mostly idle
      await this.page.waitForLoadState?.('networkidle') ?? 
            await this.page.waitForFunction(() => 
              document.readyState === 'complete'
            );

      // Wait for potential AJAX requests
      await this.randomDelay(2000, 4000);

      // Check if content is still loading
      await this.page.waitForFunction(
        () => {
          const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"]');
          return loadingIndicators.length === 0;
        },
        { timeout: 10000 }
      ).catch(() => {
        console.warn('Loading indicators check timed out');
      });

    } catch (error) {
      console.warn('Dynamic content wait failed:', error.message);
    }
  }

  /**
   * Random delay to simulate human behavior
   */
  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log('Browser cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error.message);
    }
  }
}

export default AdvancedScraper;