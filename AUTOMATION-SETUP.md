# Automated GTM Demo Booklet Generator

**Generates a visually complete booklet showing the entire GTM demo workflow — with screenshots automatically captured at each step.**

## What It Does

The `generate-demo-booklet.js` script:

1. **Starts a local HTTP server** serving your GTM demo files
2. **Launches Puppeteer** (headless Chrome automation)
3. **Simulates a complete user journey:**
   - Browse products → Select product → View item details
   - Add to cart → View cart → Begin checkout
   - Add shipping info → Add payment info → Purchase
   - Request return
4. **Takes screenshots** at each step
5. **Extracts dataLayer events** from the browser
6. **Generates an enhanced HTML booklet** with all screenshots embedded as base64
7. **Outputs:** `enhanced-booklet-with-screenshots.html`

## Setup (5 minutes)

### 1. Install Node.js

Download from [nodejs.org](https://nodejs.org/) (v16+)

Verify installation:
```bash
node --version
npm --version
```

### 2. Install Dependencies

In the GA4_Analytics_Showcase folder:

```bash
npm install
```

This installs Puppeteer (~150 MB — first run downloads Chrome).

### 3. Run the Generator

```bash
npm run generate-booklet
```

**Expected output:**
```
✓ Local server started on http://localhost:8765
✓ Launching Puppeteer...
📋 Step 1: Landing page
  📸 Captured: Landing
  📊 DataLayer at step "Landing": 2 events
📋 Step 2: Product grid load
  📸 Captured: Product Grid
  ...
[10 steps total]
✅ SUCCESS!
📸 Total screenshots: 10
📊 Total events captured: 47
📄 Output file: enhanced-booklet-with-screenshots.html
```

### 4. View the Result

Open the generated booklet in your browser:

```bash
start enhanced-booklet-with-screenshots.html
# or
open enhanced-booklet-with-screenshots.html
```

Or push it to GitHub Pages:

```bash
git add enhanced-booklet-with-screenshots.html
git commit -m "Add automated GTM demo visual walkthrough"
git push
```

Then visit: `https://anthonyapollis.github.io/ga4-analytics-showcase/enhanced-booklet-with-screenshots.html`

---

## What Gets Generated

### **enhanced-booklet-with-screenshots.html**

A complete visual guide with:

- **10 steps** — Full ecommerce funnel from browse to purchase
- **10 embedded screenshots** — Each step shows the UI state
- **DataLayer event listings** — Shows the JSON structure for each event
- **Event flow explanation** — How GTM processes the events
- **Interview talking points** — How to explain this to Jellyfish
- **Dark theme** — Matches your portfolio aesthetic
- **Responsive** — Works on all devices

**Size:** ~5-8 MB (includes base64-encoded PNG screenshots)

---

## File Structure After Generation

```
GA4_Analytics_Showcase/
├── generate-demo-booklet.js          ← The automation script
├── package.json                      ← npm config
├── AUTOMATION-SETUP.md               ← This file
├── enhanced-booklet-with-screenshots.html  ← GENERATED OUTPUT
├── index.html
├── ga4_dashboard.html
├── gtm-demo/
│   ├── index.html
│   ├── app.js
│   └── ...
└── ...
```

---

## Troubleshooting

### **"Puppeteer timeout" error**

Puppeteer is slow on first run. Increase timeout:

```bash
# Edit generate-demo-booklet.js, line 250:
# Change: await page.goto(DEMO_URL, { waitUntil: 'networkidle2' });
# To:
await page.goto(DEMO_URL, { waitUntil: 'networkidle0', timeout: 60000 });
```

### **"Chrome not found"**

Puppeteer downloads Chrome automatically. If it fails:

```bash
npm install --save-dev puppeteer
npm run generate-booklet
```

### **"Port 8765 already in use"**

Change the port in `generate-demo-booklet.js`:

```javascript
// Line 28: server.listen(8765, () => {
server.listen(3000, () => {  // Use 3000 instead
```

And update `DEMO_URL` (line 30):

```javascript
const DEMO_URL = 'http://localhost:3000/gtm-demo/index.html';
```

---

## Using the Generated Booklet

### **For GitHub Portfolio**

```bash
git add enhanced-booklet-with-screenshots.html
git commit -m "Add automated GTM demo visual guide with screenshots"
git push
```

Then link from your portfolio site:
```html
<a href="enhanced-booklet-with-screenshots.html">
  View GTM Demo Walkthrough (Automated Screenshots)
</a>
```

### **For Jellyfish Interview**

Send them the portfolio URL. They click through:
1. **index.html** → Portfolio landing page
2. **ga4_dashboard.html** → Analytics dashboard
3. **enhanced-booklet-with-screenshots.html** → GTM demo visual guide

Say during interview:
> "This booklet was auto-generated using Puppeteer. It shows the complete GTM demo workflow with screenshots at each step — browse, select, add to cart, checkout, purchase. You can see the dataLayer events at each stage, which is what GTM tags read."

---

## Customizing the Script

### **Add More Steps**

In `generate-demo-booklet.js`, duplicate a step block:

```javascript
// ── STEP 11: CUSTOM INTERACTION ──
console.log('\n📋 Step 11: Custom action');
const customBtn = await page.$('[data-action="my-custom-action"]');
if (customBtn) {
  await customBtn.click();
  await new Promise(resolve => setTimeout(resolve, 1500));
  await captureScreenshot(page, 'Custom Action');
  events = await captureDataLayer(page, 'Custom Action');
  allEvents.push(events);
}
```

### **Change Screenshot Dimensions**

Line 188:
```javascript
page.setViewport({ width: 1280, height: 720 });
// Change to: { width: 1920, height: 1080 } for 4K
```

### **Change Output Filename**

Line 23:
```javascript
const OUTPUT_FILE = path.join(__dirname, 'enhanced-booklet-with-screenshots.html');
// Change to: 'gtm-demo-visual-guide.html'
```

---

## Performance Notes

- **Runtime:** ~2-3 minutes (first Puppeteer setup slower)
- **Browser used:** Headless Chrome (no visible window)
- **System requirements:** 2GB RAM, 500MB disk space
- **Works on:** Windows, Mac, Linux

---

## Next Steps

1. ✅ `npm install` — Install Puppeteer
2. ✅ `npm run generate-booklet` — Generate the booklet
3. ✅ Open `enhanced-booklet-with-screenshots.html` — Preview locally
4. ✅ `git push` — Deploy to GitHub Pages
5. ✅ Send link to Jellyfish interview

---

**Questions?** Check the script comments in `generate-demo-booklet.js` — every step is annotated.

**Ready for interviews!** 🎯
