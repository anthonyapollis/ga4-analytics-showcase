"""
Automated GTM Demo Booklet Generator (Python + Playwright)
Usage:  python generate_booklet.py
"""

import base64, json, threading, time, os, urllib.parse
import http.server, socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_DIR = Path(r"C:\Users\Anthony.DESKTOP-ES5HL78\Downloads\pargo files\PargoParcels_Portfolio\GA4_Analytics_Showcase")
DEMO_URL = "http://localhost:8765/gtm-demo/index.html"
OUTPUT   = BASE_DIR / "enhanced-booklet-with-screenshots.html"
PORT     = 8765

screenshots = []
all_events  = []


# ── 1. HTTP SERVER ─────────────────────────────────────────────────────────────

def make_handler(base):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a): pass

        def do_GET(self):
            raw = urllib.parse.unquote(self.path.split("?")[0].split("#")[0])
            rel = raw.lstrip("/").replace("/", os.sep)
            fp  = base / rel if rel else base / "index.html"

            if fp.is_dir():
                fp = fp / "index.html"

            if not fp.exists():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"404 not found")
                return

            ext = fp.suffix.lower()
            ct  = {
                ".html": "text/html", ".js": "application/javascript",
                ".css":  "text/css",  ".json": "application/json",
                ".png":  "image/png", ".jpg": "image/jpeg",
            }.get(ext, "application/octet-stream")

            data = fp.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    return Handler


def start_server():
    handler = make_handler(BASE_DIR)
    httpd   = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    print(f"  ✓ Server → http://localhost:{PORT}")
    return httpd


# ── 2. CAPTURE HELPERS ─────────────────────────────────────────────────────────

def capture(page, label):
    png = page.screenshot(full_page=True)
    b64 = base64.b64encode(png).decode()
    screenshots.append({"label": label, "base64": b64})
    print(f"  📸 {label}")


def get_dl(page, label):
    try:
        dl = page.evaluate("() => JSON.parse(JSON.stringify(window.dataLayer || []))")
    except Exception:
        dl = []
    all_events.append(dl)
    print(f"  📊 dataLayer → {len(dl)} events")
    return dl


def click(page, selector, label):
    try:
        el = page.query_selector(selector)
        if el:
            el.scroll_into_view_if_needed()
            el.click()
            time.sleep(1.8)
            print(f"  ✓ {label}")
            return True
        print(f"  ⚠ Not found: {label}")
        return False
    except Exception as e:
        print(f"  ⚠ Error ({label}): {e}")
        return False


# ── 3. STEP DEFINITIONS ────────────────────────────────────────────────────────

STEPS = [
    ("Landing Page",      "The GTM demo loads with 9,275 real Bash/TFG products. The page fires <code>page_view</code> and <code>view_item_list</code> immediately.", "page_view + view_item_list", "All visible products tracked as impressions on page load."),
    ("Product Grid",      "Catalog displays 24 products. Filter buttons allow brand/category refinement, each firing <code>filter_apply</code>.", "view_item_list", "24 product impressions captured with full item metadata."),
    ("Product Selected",  "Clicking 'View' fires <code>select_item</code> (list context) then <code>view_item</code> (product detail).", "select_item + view_item", "Dual event pattern matches GA4 Enhanced Ecommerce spec exactly."),
    ("Add to Cart",       "Clicking 'Add' fires <code>add_to_cart</code> with complete ecommerce object: item_id, brand, category, price, quantity, currency.", "add_to_cart", "Cart value and item array ready for GTM → GA4 event tag and Google Ads conversion."),
    ("View Cart",         "User reviews cart. <code>view_cart</code> fires with all cart items and total value.", "view_cart", "Cart contents captured — enables abandoned cart segmentation in GA4 Explorations."),
    ("Begin Checkout",    "<code>begin_checkout</code> marks the start of the checkout funnel.", "begin_checkout", "Drop-off between here and purchase = checkout abandonment rate."),
    ("Shipping Info",     "<code>add_shipping_info</code> fires with <code>shipping_tier</code> attribute.", "add_shipping_info", "Segment conversion rate by delivery method in GA4."),
    ("Payment Info",      "<code>add_payment_info</code> fires with <code>payment_type</code> attribute.", "add_payment_info", "Identify which payment types correlate with higher conversion."),
    ("Purchase",          "<code>purchase</code> is the goal event. Includes transaction_id, revenue, tax, coupon, and full items array.", "purchase", "Revenue attributed here. Populates GA4 purchase reports and BigQuery transactions."),
    ("Return Request",    "<code>refund_request</code> fires with reason and original transaction_id.", "refund_request", "High refund rates by category/shipping method indicate fulfilment issues."),
]


# ── 4. BOOKLET BUILDER ─────────────────────────────────────────────────────────

def step_html(idx):
    label, desc, event_name, insight = STEPS[idx]
    b64 = screenshots[idx]["base64"] if idx < len(screenshots) else ""
    dl  = all_events[idx]           if idx < len(all_events)   else []

    latest = {}
    for ev in reversed(dl):
        if isinstance(ev, dict) and ev.get("event") not in ("gtm.js", "site_boot", "page_view", "gtm.init_consent"):
            latest = ev
            break

    json_str = json.dumps(latest, indent=2)[:900] if latest else '{\n  "event": "' + event_name.split("+")[0].strip() + '",\n  "ecommerce": { ... }\n}'
    img_tag  = f'<img src="data:image/png;base64,{b64}" alt="{label}" class="ss">' if b64 else '<div class="no-ss">Screenshot</div>'

    return f"""
<section class="step" id="s{idx+1}">
  <div class="sh"><span class="sn">{idx+1}</span><h2>{label}</h2></div>
  <p class="sd">{desc}</p>
  {img_tag}
  <div class="er">
    <div class="el">
      <span class="badge">Event</span>
      <code>{event_name}</code>
      <p class="ins">💡 {insight}</p>
    </div>
    <div class="ec">
      <div class="ch">dataLayer push</div>
      <pre>{json_str}</pre>
    </div>
  </div>
</section>"""


def build_html():
    total = len(all_events[-1]) if all_events else 0
    steps = "".join(step_html(i) for i in range(len(STEPS)))
    nav   = "".join(f'<a href="#s{i+1}">{i+1}</a>' for i in range(len(STEPS)))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GTM Demo — Visual Walkthrough | Anthony Apollis</title>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{{--bg:#0A0F1A;--s:#111827;--c:#1C2437;--b:#2A3550;--t:#E8EAED;--m:#9AA0B2;
  --bl:#4285F4;--gr:#34A853;--yl:#FBBC05;--tl:#00BCD4;--mono:'Roboto Mono',monospace}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth}}
body{{background:var(--bg);color:var(--t);font-family:'Google Sans','Segoe UI',sans-serif;line-height:1.7}}
.hero{{background:linear-gradient(135deg,#0D1B3E,#1A2951,#0D2340);padding:60px 40px 50px;border-bottom:1px solid var(--b)}}
.hi{{max-width:960px;margin:0 auto}}
.pill{{display:inline-flex;align-items:center;background:rgba(66,133,244,.15);border:1px solid rgba(66,133,244,.35);color:var(--bl);border-radius:999px;padding:4px 14px;font-size:.76rem;font-weight:500;letter-spacing:.4px;text-transform:uppercase;margin-bottom:16px}}
.hero h1{{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:700;margin-bottom:10px}}
.hero h1 span{{color:var(--bl)}}
.hero p{{color:var(--m);max-width:600px;font-size:.98rem;margin-bottom:22px}}
.tags{{display:flex;flex-wrap:wrap;gap:8px}}
.tag{{padding:4px 12px;border-radius:6px;font-size:.76rem;font-weight:500;border:1px solid transparent}}
.tb{{background:rgba(66,133,244,.18);border-color:rgba(66,133,244,.4);color:#82B1FF}}
.tg{{background:rgba(52,168,83,.18);border-color:rgba(52,168,83,.4);color:#69F0AE}}
.ty{{background:rgba(251,188,5,.18);border-color:rgba(251,188,5,.4);color:#FFD740}}
.tt{{background:rgba(0,188,212,.18);border-color:rgba(0,188,212,.4);color:#84FFFF}}
.kpi-row{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;max-width:960px;margin:28px auto 0;padding:0 40px}}
.kpi{{background:var(--c);border:1px solid var(--b);border-radius:12px;padding:16px;position:relative;overflow:hidden}}
.kpi::before{{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0}}
.kbl::before{{background:var(--bl)}}.kgr::before{{background:var(--gr)}}.kyl::before{{background:var(--yl)}}.ktl::before{{background:var(--tl)}}
.kl{{font-size:.7rem;text-transform:uppercase;letter-spacing:.7px;color:var(--m);margin-bottom:6px}}
.kv{{font-size:1.6rem;font-weight:700;line-height:1}}
.ks{{font-size:.75rem;color:var(--m);margin-top:4px}}
.wrap{{max-width:960px;margin:0 auto;padding:20px 40px 80px}}
.nav{{background:var(--s);border:1px solid var(--b);border-radius:10px;padding:10px 18px;margin:28px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}}
.nav span{{color:var(--m);font-size:.8rem;margin-right:6px}}
.nav a{{color:var(--bl);font-size:.8rem;text-decoration:none;padding:3px 9px;border:1px solid rgba(66,133,244,.3);border-radius:4px}}
.nav a:hover{{background:rgba(66,133,244,.1)}}
.step{{background:var(--c);border:1px solid var(--b);border-radius:14px;padding:28px;margin-bottom:24px}}
.sh{{display:flex;align-items:center;gap:12px;margin-bottom:14px}}
.sn{{background:var(--bl);color:#fff;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:.82rem;font-weight:700;flex-shrink:0}}
.step h2{{font-size:1.1rem;font-weight:600}}
.sd{{color:var(--m);font-size:.9rem;margin-bottom:18px;max-width:700px}}
.ss{{width:100%;border:1px solid var(--b);border-radius:8px;margin:14px 0;display:block}}
.no-ss{{background:var(--s);border:1px dashed var(--b);border-radius:8px;padding:32px;text-align:center;color:var(--m);margin:14px 0}}
.er{{display:grid;grid-template-columns:220px 1fr;gap:14px;margin-top:18px;align-items:start}}
.el .badge{{background:rgba(52,168,83,.15);border:1px solid rgba(52,168,83,.4);color:#69F0AE;border-radius:999px;padding:3px 12px;font-size:.72rem;font-weight:500;letter-spacing:.3px;text-transform:uppercase;display:inline-block;margin-bottom:8px}}
.el code{{display:block;font-family:var(--mono);color:var(--tl);font-size:.88rem;margin-bottom:10px}}
.ins{{font-size:.76rem;color:var(--m);line-height:1.6;background:rgba(66,133,244,.08);border-radius:6px;padding:8px 10px;border-left:3px solid var(--bl)}}
.ec{{background:#0D1117;border:1px solid var(--b);border-radius:8px;overflow:hidden}}
.ch{{background:var(--s);padding:7px 12px;font-size:.73rem;color:var(--m);font-family:var(--mono);border-bottom:1px solid var(--b)}}
.ec pre{{padding:12px;font-family:var(--mono);font-size:.76rem;color:#A5D6FF;line-height:1.6;overflow-x:auto;white-space:pre-wrap}}
.funnel{{background:var(--s);border:1px solid var(--b);border-radius:14px;padding:26px;margin-bottom:24px}}
.funnel h2{{font-size:1.05rem;margin-bottom:18px;color:var(--bl)}}
.fr{{display:grid;grid-template-columns:170px 1fr 70px;align-items:center;gap:10px;margin-bottom:8px}}
.fl{{font-size:.8rem;color:var(--m);text-align:right;font-family:var(--mono)}}
.fbo{{background:rgba(255,255,255,.06);border-radius:4px;height:30px;overflow:hidden}}
.fbi{{height:100%;border-radius:4px;display:flex;align-items:center;padding-left:10px;font-size:.8rem;font-weight:600}}
.fp{{font-family:var(--mono);font-size:.76rem;color:var(--m);text-align:right}}
.ig{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-bottom:24px}}
.ic{{background:var(--c);border:1px solid var(--b);border-radius:12px;padding:16px}}
.ic h3{{font-size:.86rem;font-weight:600;margin-bottom:8px}}
.ic p{{font-size:.76rem;color:var(--m);line-height:1.65}}
.ic ol{{font-size:.76rem;color:var(--m);line-height:2;padding-left:14px}}
.big{{background:#0D1117;border:1px solid var(--b);border-radius:10px;padding:18px;margin:18px 0;overflow-x:auto}}
.big pre{{font-family:var(--mono);font-size:.78rem;color:#A5D6FF;line-height:1.7}}
footer{{margin-top:50px;padding:24px 40px;border-top:1px solid var(--b);background:var(--s);text-align:center;color:var(--m);font-size:.8rem}}
footer a{{color:var(--bl);text-decoration:none}}
@media(max-width:680px){{.er,.fr{{grid-template-columns:1fr}}.hero,.kpi-row,.wrap{{padding-left:20px;padding-right:20px}}}}
</style>
</head>
<body>

<div class="hero">
<div class="hi">
  <div class="pill">📸 Auto-Generated · Python Playwright</div>
  <h1>GTM Demo — <span>Visual Walkthrough</span></h1>
  <p>Automated screenshot capture of the complete GA4 ecommerce tracking flow. Every step shows the browser state, the GA4 event that fired, and the exact dataLayer JSON.</p>
  <div class="tags">
    <span class="tag tb">✦ Google Tag Manager</span>
    <span class="tag tg">✦ GA4 Ecommerce Events</span>
    <span class="tag ty">✦ DataLayer Architecture</span>
    <span class="tag tt">✦ Bash/TFG Catalog</span>
  </div>
</div>
</div>

<div class="kpi-row">
  <div class="kpi kbl"><div class="kl">Steps captured</div><div class="kv">{len(screenshots)}</div><div class="ks">Browse → Return</div></div>
  <div class="kpi kgr"><div class="kl">Total events</div><div class="kv">{total}</div><div class="ks">All dataLayer pushes</div></div>
  <div class="kpi kyl"><div class="kl">Products</div><div class="kv">9,275</div><div class="ks">Real Bash/TFG catalog</div></div>
  <div class="kpi ktl"><div class="kl">Event types</div><div class="kv">10</div><div class="ks">Full GA4 taxonomy</div></div>
</div>

<div class="wrap">
<div class="nav"><span>Jump:</span>{nav}</div>

{steps}

<div class="funnel">
  <h2>📊 Ecommerce Conversion Funnel</h2>
  <div class="fr"><span class="fl">view_item_list</span><div class="fbo"><div class="fbi" style="width:100%;background:var(--bl)">100% — 9,275 products</div></div><span class="fp">100%</span></div>
  <div class="fr"><span class="fl">select_item</span><div class="fbo"><div class="fbi" style="width:60%;background:var(--tl)">60% clicked</div></div><span class="fp">60%</span></div>
  <div class="fr"><span class="fl">add_to_cart</span><div class="fbo"><div class="fbi" style="width:28%;background:var(--gr)">28% added</div></div><span class="fp">28%</span></div>
  <div class="fr"><span class="fl">begin_checkout</span><div class="fbo"><div class="fbi" style="width:18%;background:var(--yl)">18% checked out</div></div><span class="fp">18%</span></div>
  <div class="fr"><span class="fl">purchase</span><div class="fbo"><div class="fbi" style="width:12%;background:#EA4335">12% purchased</div></div><span class="fp">12%</span></div>
</div>

<div class="ig">
  <div class="ic"><h3>🔄 GTM Processing Flow</h3><ol><li>Button click triggers JS</li><li>dataLayer.push() fires</li><li>GTM container detects trigger</li><li>Variables extract item data</li><li>GA4 event tag fires</li><li>BigQuery receives event</li></ol></div>
  <div class="ic"><h3>🏷️ GTM Container</h3><p><strong>Variables:</strong> event name, ecommerce object, currency, transaction_id<br><br><strong>Triggers:</strong> Custom event trigger per GA4 event name<br><br><strong>Tags:</strong> GA4 event tag + Google Ads conversion (purchase only)</p></div>
  <div class="ic"><h3>🔒 Consent Mode v2</h3><p>Every event includes:<br><br><code style="font-size:.78rem;color:var(--tl)">consent_analytics: "granted"</code><br><code style="font-size:.78rem;color:var(--tl)">consent_ads: "denied"</code><br><br>GTM reads this to decide which tags fire — only analytics tags fire until consent is granted.</p></div>
</div>

<div class="big"><pre>// Complete purchase event — dataLayer push:
window.dataLayer.push({{
  event: "purchase",
  transaction_id: "BSH-20260621-001",
  currency: "ZAR",
  value: 749,
  tax: 112.35,
  shipping: 0,
  coupon: "WELCOME10",
  user: {{ login_status: "guest", consent_analytics: "granted", consent_ads: "denied" }},
  ecommerce: {{
    items: [{{
      item_id: "STR-SIL-10",
      item_name: "Sterling Silver Signet Ring",
      item_brand: "Sterns",
      item_category: "Men",
      item_category2: "Jewellery",
      price: 749, quantity: 1
    }}]
  }}
}});</pre></div>

</div>

<footer>
  <p><strong>GA4 Analytics Showcase</strong> · Anthony Apollis · <a href="mailto:anthony.apollis@gmail.com">anthony.apollis@gmail.com</a></p>
  <p style="margin-top:6px">Auto-generated · Python + Playwright · <a href="https://github.com/AnthonyApollis/ga4-analytics-showcase">GitHub Repo</a></p>
</footer>
</body>
</html>"""


# ── 5. MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("\n🚀 GTM Demo Booklet Generator\n")
    httpd = start_server()
    time.sleep(1)

    # Quick server check
    import urllib.request
    try:
        r = urllib.request.urlopen(f"http://localhost:{PORT}/gtm-demo/index.html", timeout=5)
        print(f"  ✓ Server serving GTM demo ({r.length or '?'} bytes)")
    except Exception as e:
        print(f"  ❌ Server check failed: {e}")
        httpd.shutdown()
        return

    with sync_playwright() as pw:
        print("🌐 Launching Chromium (headless)...")
        browser = pw.chromium.launch(headless=True)
        page    = browser.new_page(viewport={"width": 1280, "height": 720})

        # Step 1: Landing
        print("\n📋 Step 1: Landing page")
        page.goto(DEMO_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)
        capture(page, "Landing")
        get_dl(page, "Landing")

        # Step 2: Product grid
        print("\n📋 Step 2: Product grid")
        page.evaluate("window.scrollTo(0, 500)")
        page.wait_for_timeout(1000)
        capture(page, "Product Grid")
        get_dl(page, "Product Grid")

        # Step 3: Select product
        print("\n📋 Step 3: Select product")
        btns = page.query_selector_all("button[data-action='select']")
        print(f"  Found {len(btns)} View buttons")
        if btns:
            btns[0].click()
            page.wait_for_timeout(2000)
        capture(page, "Product Selected")
        get_dl(page, "Product Selected")

        # Step 4: Add to cart
        print("\n📋 Step 4: Add to cart")
        btns = page.query_selector_all("button[data-action='add']")
        print(f"  Found {len(btns)} Add buttons")
        if btns:
            btns[0].click()
            page.wait_for_timeout(2000)
        capture(page, "Add to Cart")
        get_dl(page, "Add to Cart")

        # Steps 5-10: Checkout flow
        for action, label, step_num in [
            ("view-cart",      "View Cart",      5),
            ("begin-checkout", "Begin Checkout", 6),
            ("shipping",       "Shipping Info",  7),
            ("payment",        "Payment Info",   8),
            ("purchase",       "Purchase",       9),
            ("return",         "Return Request", 10),
        ]:
            print(f"\n📋 Step {step_num}: {label}")
            page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.65)")
            page.wait_for_timeout(500)
            btn = page.query_selector(f"button[data-action='{action}']")
            if btn:
                btn.click()
                page.wait_for_timeout(2000)
                if action == "purchase":
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(800)
            else:
                print(f"  ⚠ Button not found: {action}")
            capture(page, label)
            get_dl(page, label)

        browser.close()

    httpd.shutdown()

    print("\n📚 Generating booklet...")
    OUTPUT.write_text(build_html(), encoding="utf-8")
    size = OUTPUT.stat().st_size / 1_048_576

    print(f"""
✅  DONE!
📸  Screenshots : {len(screenshots)}
📊  Events      : {len(all_events[-1]) if all_events else 0}
📄  Output      : {OUTPUT}
📦  Size        : {size:.1f} MB
""")


if __name__ == "__main__":
    main()
