"""
GA4 BigQuery Batch Extractor
=============================
Source : bigquery-public-data.ga4_obfuscated_sample_ecommerce
Dataset : Google Merchandise Store – Nov 2020 → Jan 2021

Why batch mode?
    GA4 exports to BigQuery produce large event tables (millions of rows).
    Using QueryPriority.BATCH means queries run in BigQuery's shared slot pool
    instead of on-demand slots — zero per-byte cost for jobs under 1 TB/month
    in the free tier, and significant savings in production.  Batch jobs have a
    6-hour SLA (vs. instant for interactive) so we schedule them overnight.

Why this dataset?
    bigquery-public-data.ga4_obfuscated_sample_ecommerce is the canonical
    reference dataset for GA4 analytics.  It contains real (obfuscated) events
    from the Google Merchandise Store and covers every GA4 event type:
    auto-collected, enhanced-measurement, recommended, and custom.

Usage:
    # Set your GCP project and credentials
    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
    export GCP_PROJECT=your-project-id

    python batch_extractor.py                  # run all queries
    python batch_extractor.py --query funnel   # run funnel only
    python batch_extractor.py --dry-run        # estimate bytes without running
"""

import os
import json
import time
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone

from google.cloud import bigquery
from google.cloud.bigquery import QueryJobConfig, QueryPriority, WriteDisposition

# ── Config ──────────────────────────────────────────────────────────────────
PROJECT_ID    = os.environ.get("GCP_PROJECT", "your-gcp-project-id")
DATASET       = "GA4_ANALYTICS"          # destination dataset in your project
OUTPUT_DIR    = Path(__file__).parent.parent / "data"
BQ_SOURCE     = "bigquery-public-data.ga4_obfuscated_sample_ecommerce"
DATE_RANGE    = ("20201101", "20210131")  # matches the public sample period
MAX_BYTES     = 5_000_000_000            # 5 GB safety cap per query

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── BigQuery client — always BATCH priority ──────────────────────────────────
def get_client() -> bigquery.Client:
    return bigquery.Client(project=PROJECT_ID)


def batch_job_config(destination_table: str | None = None) -> QueryJobConfig:
    """
    Return a QueryJobConfig configured for batch priority.

    BATCH  → runs on free shared slots (no reservation needed).
             SLA is 24 hours but typical wait is < 60 s for small queries.
             This halves BigQuery costs compared to interactive priority on
             large GA4 exports.
    """
    cfg = QueryJobConfig(
        priority=QueryPriority.BATCH,
        use_query_cache=True,
        maximum_bytes_billed=MAX_BYTES,
    )
    if destination_table:
        cfg.destination          = f"{PROJECT_ID}.{DATASET}.{destination_table}"
        cfg.write_disposition    = WriteDisposition.WRITE_TRUNCATE
        cfg.create_disposition   = bigquery.CreateDisposition.CREATE_IF_NEEDED
    return cfg


# ── SQL queries  ─────────────────────────────────────────────────────────────
QUERIES: dict[str, tuple[str, str]] = {

    "event_summary": (
        "ga4_event_summary",
        f"""
        -- GA4 Event Volume by Date and Event Name
        -- Uses _TABLE_SUFFIX wildcard to scan only the target date range,
        -- avoiding full-scan costs on the entire events_ sharded table.
        SELECT
            PARSE_DATE('%Y%m%d', event_date)           AS event_date,
            event_name,
            COUNT(*)                                    AS event_count,
            COUNT(DISTINCT user_pseudo_id)              AS unique_users,
            COUNT(DISTINCT
                CONCAT(user_pseudo_id, '-',
                    CAST((SELECT value.int_value
                          FROM UNNEST(event_params)
                          WHERE key = 'ga_session_id') AS STRING))
            )                                           AS unique_sessions
        FROM `{BQ_SOURCE}.events_*`
        WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
        GROUP BY 1, 2
        ORDER BY 1, event_count DESC
        """,
    ),

    "funnel": (
        "ga4_ecommerce_funnel",
        f"""
        -- Enhanced Ecommerce Funnel (GA4 recommended events)
        -- Counts users who fired each funnel step at least once.
        -- Step order matches the GA4 Enhanced Ecommerce specification.
        WITH funnel_steps AS (
            SELECT
                user_pseudo_id,
                COUNTIF(event_name = 'view_item')           > 0 AS viewed_item,
                COUNTIF(event_name = 'add_to_cart')         > 0 AS added_to_cart,
                COUNTIF(event_name = 'begin_checkout')      > 0 AS began_checkout,
                COUNTIF(event_name = 'add_shipping_info')   > 0 AS added_shipping,
                COUNTIF(event_name = 'add_payment_info')    > 0 AS added_payment,
                COUNTIF(event_name = 'purchase')            > 0 AS purchased
            FROM `{BQ_SOURCE}.events_*`
            WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
            GROUP BY user_pseudo_id
        )
        SELECT
            'view_item'         AS funnel_step, 1 AS step_order,
            COUNTIF(viewed_item)           AS users FROM funnel_steps
        UNION ALL SELECT 'add_to_cart',        2, COUNTIF(added_to_cart)    FROM funnel_steps
        UNION ALL SELECT 'begin_checkout',     3, COUNTIF(began_checkout)   FROM funnel_steps
        UNION ALL SELECT 'add_shipping_info',  4, COUNTIF(added_shipping)   FROM funnel_steps
        UNION ALL SELECT 'add_payment_info',   5, COUNTIF(added_payment)    FROM funnel_steps
        UNION ALL SELECT 'purchase',           6, COUNTIF(purchased)        FROM funnel_steps
        ORDER BY step_order
        """,
    ),

    "traffic_source": (
        "ga4_traffic_source",
        f"""
        -- User Acquisition by Traffic Source
        -- Reads first_visit events only (one per user) to avoid double-counting.
        -- The traffic_source struct on session_start reflects the session's
        -- medium; first_visit.traffic_source reflects lifetime acquisition.
        SELECT
            t.traffic_source.source    AS source,
            t.traffic_source.medium    AS medium,
            t.traffic_source.name      AS campaign,
            COUNT(DISTINCT e.user_pseudo_id)  AS new_users,
            SUM(
                (SELECT value.double_value
                 FROM UNNEST(e.event_params)
                 WHERE key = 'engagement_time_msec')
            ) / 1000 / COUNT(DISTINCT e.user_pseudo_id)
                                        AS avg_engagement_secs
        FROM `{BQ_SOURCE}.events_*`  AS e,
             UNNEST([e.traffic_source]) AS t   -- safe struct expansion
        WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
          AND e.event_name = 'first_visit'
        GROUP BY 1, 2, 3
        ORDER BY new_users DESC
        LIMIT 50
        """,
    ),

    "revenue": (
        "ga4_revenue_by_category",
        f"""
        -- Revenue by Product Category (Enhanced Ecommerce)
        -- The items array is UNNEST-ed per-item so each product contributes
        -- its individual quantity × price to revenue.
        SELECT
            i.item_category                AS category,
            i.item_brand                   AS brand,
            COUNT(DISTINCT e.user_pseudo_id)              AS buyers,
            SUM(i.quantity)                AS units_sold,
            ROUND(SUM(i.price * i.quantity), 2)           AS gross_revenue_usd,
            ROUND(AVG(i.price), 2)         AS avg_price_usd
        FROM `{BQ_SOURCE}.events_*`   AS e,
             UNNEST(e.items)           AS i
        WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
          AND e.event_name = 'purchase'
          AND i.item_category IS NOT NULL
        GROUP BY 1, 2
        ORDER BY gross_revenue_usd DESC
        LIMIT 30
        """,
    ),

    "consent_signals": (
        "ga4_consent_mode_signals",
        f"""
        -- Consent Mode v2 Signal Distribution
        -- privacy_info.analytics_storage and ads_storage reflect the
        -- Consent Mode state at event fire time.  'Yes' = consent granted,
        -- 'No' = denied, 'unset' = Consent Mode not implemented.
        -- This query quantifies the consent gap — events without consent that
        -- GA4 models via behavioural modelling.
        SELECT
            p.analytics_storage,
            p.ads_storage,
            p.uses_transient_token,
            COUNT(*)                    AS event_count,
            COUNT(DISTINCT user_pseudo_id) AS affected_users,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct_of_total
        FROM `{BQ_SOURCE}.events_*`    AS e,
             UNNEST([e.privacy_info])   AS p
        WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
        GROUP BY 1, 2, 3
        ORDER BY event_count DESC
        """,
    ),

    "user_ltv": (
        "ga4_user_ltv_cohorts",
        f"""
        -- User Lifetime Value by Acquisition Month
        -- user_ltv.revenue is cumulative purchase revenue per user_pseudo_id
        -- as calculated by GA4.  Grouping by acquisition month lets us track
        -- how each cohort's LTV grows over time.
        SELECT
            FORMAT_DATE('%Y-%m',
                DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))
            )                              AS acquisition_month,
            COUNT(DISTINCT user_pseudo_id) AS cohort_size,
            ROUND(SUM(user_ltv.revenue), 2)           AS total_ltv_usd,
            ROUND(AVG(user_ltv.revenue), 2)           AS avg_ltv_per_user,
            ROUND(MAX(user_ltv.revenue), 2)           AS max_ltv_usd
        FROM `{BQ_SOURCE}.events_*`
        WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
          AND user_first_touch_timestamp IS NOT NULL
        GROUP BY 1
        ORDER BY 1
        """,
    ),

    "gtm_event_quality": (
        "ga4_gtm_event_quality",
        f"""
        -- GTM / Data Layer Event Quality Audit
        -- Checks for events that fire without required parameters.
        -- A well-implemented GTM container always populates page_location,
        -- page_title, and ga_session_id on every hit.
        SELECT
            event_name,
            COUNT(*)                    AS total_events,
            COUNTIF(
                (SELECT COUNT(1) FROM UNNEST(event_params)
                 WHERE key = 'page_location') = 0
            )                           AS missing_page_location,
            COUNTIF(
                (SELECT COUNT(1) FROM UNNEST(event_params)
                 WHERE key = 'ga_session_id') = 0
            )                           AS missing_session_id,
            COUNTIF(
                (SELECT COUNT(1) FROM UNNEST(event_params)
                 WHERE key = 'page_title') = 0
            )                           AS missing_page_title,
            ROUND(
                COUNTIF(
                    (SELECT COUNT(1) FROM UNNEST(event_params)
                     WHERE key = 'page_location') = 0
                ) * 100.0 / COUNT(*), 2
            )                           AS pct_missing_location
        FROM `{BQ_SOURCE}.events_*`
        WHERE _TABLE_SUFFIX BETWEEN '{DATE_RANGE[0]}' AND '{DATE_RANGE[1]}'
          AND event_name NOT IN ('session_start','first_visit','app_remove')
        GROUP BY event_name
        HAVING total_events > 100
        ORDER BY pct_missing_location DESC
        """,
    ),
}


# ── Runner ───────────────────────────────────────────────────────────────────
def estimate_bytes(client: bigquery.Client, sql: str) -> int:
    cfg = QueryJobConfig(dry_run=True, use_query_cache=False)
    job = client.query(sql, job_config=cfg)
    return job.total_bytes_processed


def run_query(
    client: bigquery.Client,
    name: str,
    table: str,
    sql: str,
    dry_run: bool = False,
) -> None:
    log.info("▶  %s", name)

    if dry_run:
        bytes_est = estimate_bytes(client, sql)
        log.info("   DRY RUN — estimated bytes: %s MB",
                 round(bytes_est / 1_000_000, 1))
        return

    cfg   = batch_job_config(destination_table=table)
    job   = client.query(sql, job_config=cfg)
    log.info("   Job ID: %s  (BATCH priority — waiting…)", job.job_id)

    t0    = time.time()
    result = job.result()         # blocks until complete (respects 6-h SLA)
    elapsed = time.time() - t0

    rows   = result.total_rows
    bytes_ = job.total_bytes_billed or 0
    log.info("   ✓  %s rows  |  %s MB billed  |  %.1f s",
             f"{rows:,}", round(bytes_ / 1_000_000, 1), elapsed)

    # Save a local JSON sample for the dashboard
    df   = result.to_dataframe()
    path = OUTPUT_DIR / f"{name}.json"
    df.head(200).to_json(path, orient="records", date_format="iso")
    log.info("   Saved sample → %s", path.name)


def main() -> None:
    parser = argparse.ArgumentParser(description="GA4 BigQuery batch extractor")
    parser.add_argument("--query",   help="Run a single query by key")
    parser.add_argument("--dry-run", action="store_true",
                        help="Estimate bytes without executing")
    args = parser.parse_args()

    client  = get_client()
    queries = {args.query: QUERIES[args.query]} if args.query else QUERIES

    log.info("=== GA4 Batch Extractor  project=%s  batch=True ===", PROJECT_ID)
    for name, (table, sql) in queries.items():
        try:
            run_query(client, name, table, sql.strip(), dry_run=args.dry_run)
        except Exception as exc:
            log.error("   FAILED: %s", exc)

    log.info("=== Done ===")


if __name__ == "__main__":
    main()
