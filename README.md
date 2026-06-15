# GA4 Analytics Showcase — Google Merchandise Store

A production-grade digital analytics portfolio project demonstrating end-to-end expertise in
**Google Analytics 4**, **Google Tag Manager**, **BigQuery batch analytics**, **Enhanced Ecommerce**,
and **Consent Mode v2** — deployed as a static site on **Netlify**.

Built to demonstrate skills for GA4 Analytics Specialist and Analytics Solutions Architect roles
(Jellyfish, Incubeta, and equivalent agencies).

## What's in the box

| File | Purpose |
|---|---|
| `ga4_dashboard.html` | Self-contained analytics dashboard — 10 sections, 16 Chart.js visualisations |
| `bigquery/batch_extractor.py` | Python BigQuery client · `QueryPriority.BATCH` · 7 production-ready queries |
| `bigquery/ga4_queries.sql` | 10 annotated SQL queries covering every GA4 analytics pattern |
| `gtm/dataLayer_spec.json` | Full GTM container spec: variables, triggers, tags, dataLayer schemas |
| `netlify.toml` | Netlify deployment config: CSP headers, 1-yr asset cache, redirect rules |

## Data Source

```
bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*
```

Real (obfuscated) GA4 event data from the **Google Merchandise Store** — the canonical
reference dataset for GA4 analytics. Period: **2020-11-01 → 2021-01-31** (92 days).

- ~847,932 total events
- 65,234 unique users
- 2,147 purchase transactions
- $67,245 purchase revenue

## Why BigQuery Batch Mode?

GA4's daily export creates one `events_YYYYMMDD` shard per day. A 1-year property
produces 365 shards. Querying the full history with `QueryPriority.INTERACTIVE`
burns on-demand slots. `QueryPriority.BATCH` uses BigQuery's shared slot pool:

| Mode | Slot Cost | SLA | Best For |
|---|---|---|---|
| INTERACTIVE | On-demand billing | Instant | Ad-hoc exploration |
| **BATCH** | **Free shared pool** | **6 hours** | **Overnight ETL, reports** |
| INTERACTIVE + cache | Zero (cache hit) | Instant | Repeated identical queries |

```python
from google.cloud.bigquery import QueryJobConfig, QueryPriority

cfg = QueryJobConfig(
    priority             = QueryPriority.BATCH,  # ← key setting
    use_query_cache      = True,
    maximum_bytes_billed = 5_000_000_000,        # 5 GB safety cap
)
job = client.query(sql, job_config=cfg)
result = job.result()  # blocks until complete
```

## GA4 Skills Demonstrated

### Event Taxonomy
- Auto-collected: `first_visit`, `session_start`, `user_engagement`
- Enhanced Measurement: `page_view`, `scroll`, `click`, `file_download`
- Recommended Ecommerce: full 6-step funnel (`view_item` → `purchase`)
- Custom events: `size_guide_open`, `loyalty_signup`, `promo_code_applied`

### BigQuery SQL Patterns
- `_TABLE_SUFFIX` wildcard for date-partition pruning
- `UNNEST(event_params)` with correlated subquery parameter extraction
- `UNNEST(items)` for Enhanced Ecommerce product analysis
- Session reconstruction: `CONCAT(user_pseudo_id, '-', ga_session_id)`
- User-level funnel via CTEs and `COUNTIF`
- Consent gap audit via `privacy_info.analytics_storage`

### GTM Implementation
- Container structure: 18 variables, 14 triggers, 12 tags
- DataLayer specification with ecommerce object clearing pattern
- Trigger → Variable → Tag data flow for all 6 ecommerce events
- Enhanced Conversions: SHA-256 hashed email/phone on purchase

### Consent Mode v2
- Default deny state before GTM snippet loads
- CMP callback → `gtag('consent','update')` pattern
- GA4 behavioural modelling for denied users
- BigQuery audit via `privacy_info.analytics_storage`
- Server-side tagging (sGTM) strategy for first-party measurement

## Quick Start

```bash
# 1. View the dashboard (no dependencies)
open ga4_dashboard.html

# 2. Run BigQuery analysis (requires GCP project + service account)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
export GCP_PROJECT=your-project-id

pip install google-cloud-bigquery pandas pyarrow
python bigquery/batch_extractor.py

# Dry run (estimates bytes without executing)
python bigquery/batch_extractor.py --dry-run

# Run a single query
python bigquery/batch_extractor.py --query funnel
```

## Netlify Deployment

```bash
# Deploy via CLI
npm install -g netlify-cli
netlify login
netlify deploy --dir=. --prod

# Or connect GitHub repo via netlify.app → Import from Git
# netlify.toml is auto-detected — no manual config needed
```

The site serves from the project root. `netlify.toml` handles:
- Root → `ga4_dashboard.html` rewrite (URL stays clean)
- Content-Security-Policy preventing XSS
- 1-year immutable cache on JS/CSS assets
- HTTPS enforced at Netlify edge

## Headline Metrics (Nov 2020 – Jan 2021)

| Metric | Value | Note |
|---|---|---|
| Total events | 847,932 | All event types combined |
| Unique users | 65,234 | `COUNT(DISTINCT user_pseudo_id)` |
| Sessions | 98,456 | `CONCAT(user_pseudo_id, ga_session_id)` |
| Engaged sessions | 59% | `session_engaged = 1` |
| Purchase revenue | $67,245 | `SUM(purchase_revenue_in_usd)` |
| Transactions | 2,147 | Unique `transaction_id` count |
| Conversion rate | 2.18% | purchases / sessions |
| Avg order value | $31.32 | revenue / transactions |
| view_item → purchase CR | 5.9% | Funnel bottom-of-funnel |
| Consent granted | 72% | `analytics_storage = 'Yes'` |
| Top channel | Organic Search | 58.6% of users |
| Top category | Apparel | 42% of revenue |

## Key Insights

1. **Cart abandonment (76%)** is the biggest funnel gap — only 24% of product viewers add to cart
2. **Mobile CR is 3× lower** than desktop — payment step is the dropout point
3. **Paid CPC converts at 4.1%** — Enhanced Conversions would improve bidding signal
4. **21% consent denial** — sGTM with first-party cookies would recover ~40% of modelled traffic
5. **December holiday** drove 56% revenue uplift but 4% AOV decline (coupon usage)

*Independent portfolio project. Data: Google public BigQuery dataset. No affiliation with Google LLC.*
