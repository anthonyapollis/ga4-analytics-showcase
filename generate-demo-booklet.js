#!/usr/bin/env node
/**
 * Automated GTM Demo Booklet Generator
 *
 * Usage:
 *   node generate-demo-booklet.js
 *
 * This script:
 * 1. Starts a local HTTP server for the GTM demo
 * 2. Opens Puppeteer (headless Chrome)
 * 3. Simulates complete user journey:
 *    - Browse products
 *    - View item details
 *    - Add to cart
 *    - Begin checkout
 *    - Proceed through shipping/payment
 *    - Complete purchase
 * 4. Takes screenshots at each step
 * 5. Captures dataLayer events from browser console
 * 6. Generates enhanced booklet with embedded screenshots
 * 7. Outputs: enhanced-booklet-with-screenshots.html
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-generated');
const DEMO_URL = 'http://localhost:8765/gtm-demo/index.html';
const OUTPUT_FILE = path.join(__dirname, 'enhanced-booklet-with-screenshots.html');

let server;
let screenshots = [];

// ────────────────────────────────────────────────────────────────────────────
// 1. START LOCAL HTTP SERVER
// ────────────────────────────────────────────────────────────────────────────

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('404 Not Found');
          return;
        }

        const ext = path.extname(filePath);
        const contentType = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png'
        }[ext] || 'text/plain';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.listen(8765, () => {
      console.log('✓ Local server started on http://localhost:8765');
      resolve();
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 2. TAKE SCREENSHOT & STORE AS BASE64
// ────────────────────────────────────────────────────────────────────────────

async function captureScreenshot(page, label) {
  const screenshot = await page.screenshot({ fullPage: true });
  const base64 = screenshot.toString('base64');
  screenshots.push({ label, base64 });
  console.log(`  📸 Captured: ${label}`);
  return base64;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. EXTRACT DATALAYER EVENTS
// ────────────────────────────────────────────────────────────────────────────

async function captureDataLayer(page, step) {
  const dataLayer = await page.evaluate(() => window.dataLayer || []);
  console.log(`  📊 DataLayer at step "${step}":`, dataLayer.length, 'events');
  return dataLayer;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. GENERATE ENHANCED BOOKLET HTML
// ────────────────────────────────────────────────────────────────────────────

function generateBooklet(allEvents) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GA4 Analytics Showcase — GTM Demo Visual Guide</title>
  <style>
    :root {
      --bg: #0A0F1A;
      --surface: #111827;
      --card: #1C2437;
      --border: #2A3550;
      --text: #E8EAED;
      --muted: #9AA0B2;
      --g-blue: #4285F4;
      --g-green: #34A853;
      --font-main: 'Google Sans', 'Segoe UI', sans-serif;
      --font-mono: 'Roboto Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font-main); line-height: 1.6; padding: 40px 20px; }
    .container { max-width: 900px; margin: 0 auto; }

    h1 { font-size: 2rem; margin-bottom: 12px; }
    .subtitle { color: var(--muted); font-size: 1.05rem; margin-bottom: 40px; }

    .section { margin: 60px 0; }
    .section h2 { font-size: 1.4rem; margin-bottom: 20px; color: var(--g-blue); }
    .section p { color: var(--muted); margin-bottom: 16px; }

    .step {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .step h3 { font-size: 1.1rem; margin-bottom: 12px; color: var(--text); }
    .step-label {
      display: inline-block;
      background: var(--g-blue);
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-bottom: 12px;
    }

    .screenshot {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin: 16px 0;
    }

    .code-block {
      background: #0D1117;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      margin: 16px 0;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: #A5D6FF;
      line-height: 1.5;
    }

    .event-json {
      background: var(--surface);
      border-left: 4px solid var(--g-green);
      border-radius: 4px;
      padding: 12px;
      margin: 12px 0;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--muted);
      overflow-x: auto;
    }

    footer {
      margin-top: 80px;
      padding-top: 40px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>

<div class="container">
  <h1>GA4 Analytics Showcase</h1>
  <h2 style="color: var(--g-green); margin-bottom: 40px;">GTM Implementation Demo — Visual Walkthrough</h2>

  <p class="subtitle">
    Automated capture of complete ecommerce tracking flow. Shows live product interactions,
    dataLayer event firing, and GTM container integration in action.
  </p>

  <!-- STEP 1: LANDING -->
  <div class="section">
    <h2>Step 1: GTM Demo Landing Page</h2>
    <div class="step">
      <span class="step-label">Initial load</span>
      <h3>Browse the Bash/TFG Catalog</h3>
      <p>The GTM demo loads with 9,275 real Bash/TFG products. Each product is clickable and fires GA4 ecommerce events.</p>
      <img src="data:image/png;base64,${screenshots[0]?.base64 || ''}" alt="GTM Demo Landing" class="screenshot">
      <p style="color: var(--muted); font-size: 0.9rem; margin-top: 12px;">
        <strong>What's happening:</strong> The page initializes with \`view_item_list\` event fired to dataLayer (capture 1).
      </p>
    </div>
  </div>

  <!-- STEP 2: PRODUCT GRID -->
  <div class="section">
    <h2>Step 2: Product Browsing</h2>
    <div class="step">
      <span class="step-label">Product catalog</span>
      <h3>View Item List with Filters</h3>
      <p>Products are displayed in a grid. Users can apply category filters, and each interaction triggers events.</p>
      <img src="data:image/png;base64,${screenshots[1]?.base64 || ''}" alt="Product Grid" class="screenshot">
      <div class="event-json">
        <strong>Event fired:</strong> view_item_list
        <pre>${JSON.stringify(allEvents[1]?.[allEvents[1].length - 1] || {}, null, 2)}</pre>
      </div>
    </div>
  </div>

  <!-- STEP 3: PRODUCT SELECTION -->
  <div class="section">
    <h2>Step 3: Product Selection & Details</h2>
    <div class="step">
      <span class="step-label">Product interaction</span>
      <h3>View Item + Select Item Events</h3>
      <p>When a user clicks "View" on a product, two events fire: \`select_item\` (list context) and \`view_item\` (product detail).</p>
      <img src="data:image/png;base64,${screenshots[2]?.base64 || ''}" alt="Product Detail" class="screenshot">
      <div class="event-json">
        <strong>Events fired:</strong>
        <pre>1. select_item — User clicked product in list
2. view_item — User viewing product details</pre>
      </div>
      <p style="color: var(--g-green); font-size: 0.9rem; margin-top: 12px;">
        ✓ Item-level data captured: item_id, item_name, item_brand, price, category
      </p>
    </div>
  </div>

  <!-- STEP 4: ADD TO CART -->
  <div class="section">
    <h2>Step 4: Add to Cart</h2>
    <div class="step">
      <span class="step-label">Cart action</span>
      <h3>Add to Cart Event</h3>
      <p>User clicks "Add to Cart" button. The \`add_to_cart\` event is fired with complete ecommerce object.</p>
      <img src="data:image/png;base64,${screenshots[3]?.base64 || ''}" alt="Add to Cart" class="screenshot">
      <div class="event-json">
        <strong>Event structure:</strong>
        <pre>event: "add_to_cart"
ecommerce: {
  currency: "ZAR",
  value: 749,
  items: [{
    item_id: "STR-SIL-10",
    item_name: "Sterling Silver Signet Ring",
    item_brand: "Sterns",
    price: 749,
    quantity: 1
  }]
}</pre>
      </div>
    </div>
  </div>

  <!-- STEP 5: VIEW CART -->
  <div class="section">
    <h2>Step 5: View Cart</h2>
    <div class="step">
      <span class="step-label">Cart review</span>
      <h3>View Cart Event</h3>
      <p>User navigates to cart to review items. The \`view_cart\` event shows cart contents with all items.</p>
      <img src="data:image/png;base64,${screenshots[4]?.base64 || ''}" alt="View Cart" class="screenshot">
    </div>
  </div>

  <!-- STEP 6: BEGIN CHECKOUT -->
  <div class="section">
    <h2>Step 6: Begin Checkout</h2>
    <div class="step">
      <span class="step-label">Checkout initiation</span>
      <h3>Begin Checkout Event</h3>
      <p>User clicks "Begin Checkout" to start the purchase flow. This marks the start of the conversion funnel.</p>
      <img src="data:image/png;base64,${screenshots[5]?.base64 || ''}" alt="Begin Checkout" class="screenshot">
      <div class="event-json">
        <strong>Checkpoint event:</strong>
        <pre>event: "begin_checkout"
Marks: User intent to purchase
Includes: All cart items, cart value, currency</pre>
      </div>
    </div>
  </div>

  <!-- STEP 7: SHIPPING INFO -->
  <div class="section">
    <h2>Step 7: Shipping Information</h2>
    <div class="step">
      <span class="step-label">Checkout step 1</span>
      <h3>Add Shipping Info Event</h3>
      <p>User enters shipping information. The \`add_shipping_info\` event captures the checkout progress.</p>
      <img src="data:image/png;base64,${screenshots[6]?.base64 || ''}" alt="Shipping" class="screenshot">
      <div class="event-json">
        <strong>Event fired:</strong>
        <pre>event: "add_shipping_info"
Attributes: shipping_tier (e.g., "collect_and_deliver")</pre>
      </div>
    </div>
  </div>

  <!-- STEP 8: PAYMENT INFO -->
  <div class="section">
    <h2>Step 8: Payment Information</h2>
    <div class="step">
      <span class="step-label">Checkout step 2</span>
      <h3>Add Payment Info Event</h3>
      <p>User enters payment method. The \`add_payment_info\` event captures payment preferences.</p>
      <img src="data:image/png;base64,${screenshots[7]?.base64 || ''}" alt="Payment" class="screenshot">
      <div class="event-json">
        <strong>Event fired:</strong>
        <pre>event: "add_payment_info"
Attributes: payment_type (e.g., "TFG Money Account", "card")</pre>
      </div>
    </div>
  </div>

  <!-- STEP 9: PURCHASE -->
  <div class="section">
    <h2>Step 9: Purchase Confirmation</h2>
    <div class="step">
      <span class="step-label">Conversion</span>
      <h3>Purchase Event (Conversion)</h3>
      <p>User completes purchase. The \`purchase\` event is the conversion — the goal event in GA4.</p>
      <img src="data:image/png;base64,${screenshots[8]?.base64 || ''}" alt="Purchase" class="screenshot">
      <div class="event-json">
        <strong>Conversion event:</strong>
        <pre>event: "purchase"
transaction_id: "BSH-20260621-001"
currency: "ZAR"
value: 749
tax: 112.35
coupon: "WELCOME10"
items: [{ item_id, price, quantity... }]</pre>
      </div>
      <p style="color: var(--g-green); font-size: 0.9rem; margin-top: 12px;">
        ✓ Complete ecommerce transaction captured — ready for GA4 revenue reporting
      </p>
    </div>
  </div>

  <!-- STEP 10: RETURNS -->
  <div class="section">
    <h2>Step 10: Return Request (Post-Purchase)</h2>
    <div class="step">
      <span class="step-label">Post-purchase event</span>
      <h3>Refund Request Event</h3>
      <p>User initiates a return. The \`refund_request\` event captures post-purchase behavior for churn analysis.</p>
      <img src="data:image/png;base64,${screenshots[9]?.base64 || ''}" alt="Returns" class="screenshot">
      <div class="event-json">
        <strong>Event fired:</strong>
        <pre>event: "refund_request"
reason: "wrong_size"
Includes: Original transaction_id, item data, refund value</pre>
      </div>
    </div>
  </div>

  <!-- DATALAYER SUMMARY -->
  <div class="section">
    <h2>Complete DataLayer Event Flow</h2>
    <div class="step">
      <h3>All Events Captured During Automation</h3>
      <p>Total events fired: <strong>${allEvents.flat().length}</strong></p>
      <p>This represents the complete ecommerce tracking taxonomy:</p>
      <ul style="color: var(--muted); margin-left: 20px;">
        <li>✓ <strong>View</strong> events: page_view, view_item_list, view_item, view_cart</li>
        <li>✓ <strong>Add</strong> events: add_to_cart, begin_checkout</li>
        <li>✓ <strong>Shipping/Payment:</strong> add_shipping_info, add_payment_info</li>
        <li>✓ <strong>Purchase:</strong> purchase (conversion)</li>
        <li>✓ <strong>Post-purchase:</strong> refund_request</li>
      </ul>
    </div>
  </div>

  <!-- GTM IMPLEMENTATION -->
  <div class="section">
    <h2>GTM Container Implementation</h2>
    <div class="step">
      <h3>How This Works in Production</h3>
      <p>Each dataLayer event pushes to the GTM container, which processes them according to these rules:</p>
      <div class="code-block">
1. Browser fires JavaScript event (e.g., "Add to Cart" button click)
2. Event handler pushes to dataLayer: window.dataLayer.push({ event: "add_to_cart", ... })
3. GTM container detects the event via trigger rule (event name = "add_to_cart")
4. GTM applies variable mappings (extract item data, cart value, etc.)
5. GTM fires tags: GA4 Event tag, Google Ads conversion, etc.
6. GA4 receives the event, records in BigQuery
7. Conversion data available in GA4 reports → DebugView → BigQuery
      </div>
      <p style="color: var(--g-green); margin-top: 16px;">
        <strong>Portfolio value:</strong> This demo proves you understand the complete tracking flow — from product click → dataLayer structure → GTM trigger/variable/tag → GA4 reporting.
      </p>
    </div>
  </div>

  <!-- INTERVIEW TALKING POINTS -->
  <div class="section">
    <h2>Interview Talking Points (for Jellyfish)</h2>
    <div class="step">
      <ul style="color: var(--muted); margin-left: 20px; line-height: 2;">
        <li><strong>Event taxonomy:</strong> "This demo implements all 6 GA4 ecommerce events. View the complete funnel from browse → purchase."</li>
        <li><strong>Item-level tracking:</strong> "Every product carries full metadata: item_id, brand, category, price, variant. This enables product-level analysis."</li>
        <li><strong>Funnel analysis:</strong> "You can see where users drop off: 100% browse → X% add to cart → Y% checkout → Z% purchase."</li>
        <li><strong>GTM integration:</strong> "The dataLayer events are what GTM tags read. I've documented the trigger → variable → tag flow."</li>
        <li><strong>Data quality:</strong> "Every event includes currency, transaction_id, and full item arrays — ready for BigQuery analysis."</li>
      </ul>
    </div>
  </div>

  <footer>
    <p><strong>Generated:</strong> Automated GTM Demo Booklet</p>
    <p>This walkthrough was auto-generated using Puppeteer. All screenshots captured from live interaction with the GTM demo.</p>
    <p>Full project: <a href="https://github.com/AnthonyApollis/ga4-analytics-showcase" style="color: var(--g-blue);">github.com/AnthonyApollis/ga4-analytics-showcase</a></p>
  </footer>
</div>

</body>
</html>`;

  return html;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. MAIN AUTOMATION FLOW
// ────────────────────────────────────────────────────────────────────────────

async function runAutomation() {
  try {
    console.log('\n🚀 Starting GTM Demo Booklet Generator...\n');

    // Start server
    await startServer();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server

    // Launch Puppeteer
    console.log('🌐 Launching Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.setViewport({ width: 1280, height: 720 });

    const allEvents = [];

    // ── STEP 1: LANDING PAGE ──
    console.log('\n📋 Step 1: Landing page');
    await page.goto(DEMO_URL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await captureScreenshot(page, 'Landing');
    let events = await captureDataLayer(page, 'Landing');
    allEvents.push(events);

    // ── STEP 2: PRODUCT GRID ──
    console.log('\n📋 Step 2: Product grid load');
    await new Promise(resolve => setTimeout(resolve, 1500));
    await captureScreenshot(page, 'Product Grid');
    events = await captureDataLayer(page, 'Product Grid');
    allEvents.push(events);

    // ── STEP 3: SELECT PRODUCT ──
    console.log('\n📋 Step 3: Select product');
    const selectBtn = await page.$('[data-action="select"]');
    if (selectBtn) {
      await selectBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Product Selected');
      events = await captureDataLayer(page, 'Product Selected');
      allEvents.push(events);
    }

    // ── STEP 4: ADD TO CART ──
    console.log('\n📋 Step 4: Add to cart');
    const addBtn = await page.$('[data-action="add"]');
    if (addBtn) {
      await addBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Add to Cart');
      events = await captureDataLayer(page, 'Add to Cart');
      allEvents.push(events);
    }

    // ── STEP 5: VIEW CART ──
    console.log('\n📋 Step 5: View cart');
    const viewCartBtn = await page.$('[data-action="view-cart"]');
    if (viewCartBtn) {
      await viewCartBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'View Cart');
      events = await captureDataLayer(page, 'View Cart');
      allEvents.push(events);
    }

    // ── STEP 6: BEGIN CHECKOUT ──
    console.log('\n📋 Step 6: Begin checkout');
    const beginCheckoutBtn = await page.$('[data-action="begin-checkout"]');
    if (beginCheckoutBtn) {
      await beginCheckoutBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Begin Checkout');
      events = await captureDataLayer(page, 'Begin Checkout');
      allEvents.push(events);
    }

    // ── STEP 7: SHIPPING ──
    console.log('\n📋 Step 7: Add shipping info');
    const shippingBtn = await page.$('[data-action="shipping"]');
    if (shippingBtn) {
      await shippingBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Shipping');
      events = await captureDataLayer(page, 'Shipping');
      allEvents.push(events);
    }

    // ── STEP 8: PAYMENT ──
    console.log('\n📋 Step 8: Add payment info');
    const paymentBtn = await page.$('[data-action="payment"]');
    if (paymentBtn) {
      await paymentBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Payment');
      events = await captureDataLayer(page, 'Payment');
      allEvents.push(events);
    }

    // ── STEP 9: PURCHASE ──
    console.log('\n📋 Step 9: Complete purchase');
    const purchaseBtn = await page.$('[data-action="purchase"]');
    if (purchaseBtn) {
      await purchaseBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Purchase');
      events = await captureDataLayer(page, 'Purchase');
      allEvents.push(events);
    }

    // ── STEP 10: RETURNS ──
    console.log('\n📋 Step 10: Request return');
    const returnBtn = await page.$('[data-action="return"]');
    if (returnBtn) {
      await returnBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await captureScreenshot(page, 'Return Request');
      events = await captureDataLayer(page, 'Return Request');
      allEvents.push(events);
    }

    // Close browser
    await browser.close();

    // Generate booklet
    console.log('\n📚 Generating enhanced booklet...');
    const bookletHTML = generateBooklet(allEvents);
    fs.writeFileSync(OUTPUT_FILE, bookletHTML);

    console.log(`\n✅ SUCCESS!\n`);
    console.log(`📸 Total screenshots: ${screenshots.length}`);
    console.log(`📊 Total events captured: ${allEvents.flat().length}`);
    console.log(`📄 Output file: ${OUTPUT_FILE}`);
    console.log(`\n📖 Enhanced booklet ready for deployment!`);
    console.log(`   Open: enhanced-booklet-with-screenshots.html`);
    console.log(`   Or push to GitHub and view at your portfolio site.\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (server) server.close();
    process.exit(0);
  }
}

// Run automation
runAutomation();
