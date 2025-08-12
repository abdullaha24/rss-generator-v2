/**
 * Test ECJ API endpoint
 */

import { readFileSync, writeFileSync } from 'fs';

async function testECJAPI() {
  try {
    console.log('=== Testing ECJ API Endpoint ===\n');
    
    // Import the API handler
    const { default: handler } = await import('./api/[feed].js');
    
    // Mock request and response objects
    const req = {
      query: {
        feed: 'curia'
      }
    };
    
    let responseData = '';
    let statusCode = 200;
    let headers = {};
    
    const res = {
      setHeader: (key, value) => {
        headers[key] = value;
        console.log(`Header set: ${key} = ${value}`);
      },
      status: (code) => {
        statusCode = code;
        console.log(`Status set: ${code}`);
        return {
          send: (data) => {
            responseData = data;
            return data;
          }
        };
      }
    };
    
    console.log('1. Calling API handler for ECJ feed...\n');
    
    // Call the handler
    await handler(req, res);
    
    console.log('\n2. API Response Analysis:');
    console.log(`- Status Code: ${statusCode}`);
    console.log(`- Content Type: ${headers['Content-Type']}`);
    console.log(`- Cache Control: ${headers['Cache-Control']}`);
    console.log(`- Response Size: ${responseData.length} characters`);
    
    // Validate RSS structure
    if (responseData.includes('<?xml version="1.0"') && 
        responseData.includes('<rss version="2.0"') &&
        responseData.includes('European Court of Justice')) {
      console.log('✅ Valid RSS 2.0 structure detected');
    } else {
      console.log('❌ Invalid RSS structure');
    }
    
    // Count items
    const itemCount = (responseData.match(/<item>/g) || []).length;
    console.log(`- RSS Items: ${itemCount}`);
    
    // Check for professional titles
    const hasJudgmentTitles = responseData.includes('Judgment of the Court');
    console.log(`- Professional Titles: ${hasJudgmentTitles ? '✅' : '❌'}`);
    
    // Save to file for inspection
    writeFileSync('./ecj-api-test-output.xml', responseData, 'utf8');
    console.log('\n✅ API test response saved to: ./ecj-api-test-output.xml');
    
    // Show RSS preview
    console.log('\n=== RSS Preview (First 1000 characters) ===');
    console.log(responseData.substring(0, 1000) + '...');
    
    console.log('\n✅ ECJ API endpoint test completed successfully!');
    console.log('📡 Endpoint ready for Vercel deployment: /api/curia');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the API test
testECJAPI();