import { scrapeECANews } from "./utils/eca-scraper-final.js";

async function testECA() {
  try {
    console.log("Testing enhanced ECA scraper...");
    const items = await scrapeECANews();
    console.log("Total items found:", items.length);
    
    if (items.length > 0 && items[0].title \!== "European Court of Auditors - Latest News Available on Website") {
      console.log("SUCCESS: Real news items found\!");
      console.log("First 2 items:");
      items.slice(0, 2).forEach((item, i) => {
        console.log(`Item ${i+1}: ${item.title}`);
        console.log(`  Link: ${item.link}`);
        console.log(`  Date: ${item.pubDate}`);
        console.log(`  Category: ${item.category}`);
        console.log(`  Description: ${item.description.substring(0, 100)}...`);
        console.log("");
      });
    } else {
      console.log("Still getting fallback content - need to debug further");
    }
  } catch (error) {
    console.error("Test failed:", error.message);
  }
  process.exit(0);
}

testECA();
