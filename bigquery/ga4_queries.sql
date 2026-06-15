-- ============================================================
-- GA4 Analytics Query Library
-- Source : bigquery-public-data.ga4_obfuscated_sample_ecommerce
-- Period : 2020-11-01 → 2021-01-31  (Google Merchandise Store)
-- Author : Anthony Apollis
--
-- All queries use:
--   • _TABLE_SUFFIX wildcard  →  date-partition pruning, avoids full scans
--   • UNNEST(event_params)    →  GA4's repeated-record event parameters
--   • UNNEST(items)           →  Enhanced Ecommerce item arrays
--   • QueryPriority.BATCH     →  see batch_extractor.py for Python wrapper
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. SESSION METRICS  (matches GA4 "Overview" report)
-- ────────────────────────────────────────────────────────────
SELECT
    PARSE_DATE('%Y%m%d', event_date)                        AS date,
    COUNT(DISTINCT user_pseudo_id)                          AS users,
    COUNT(DISTINCT CONCAT(
        user_pseudo_id, '-',
        CAST((SELECT value.int_value
              FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING)
    ))                                                      AS sessions,

    -- GA4 defines "engaged session" as >10 s, 1+ conversion, or 2+ page views
    COUNTIF(
        (SELECT value.int_value FROM UNNEST(event_params)
         WHERE key = 'session_engaged') = 1
    )                                                       AS engaged_sessions,

    ROUND(
        SUM(COALESCE(
            (SELECT value.int_value FROM UNNEST(event_params)
             WHERE key = 'engagement_time_msec'), 0
        )) / 1000.0
        / NULLIF(COUNT(DISTINCT user_pseudo_id), 0), 1
    )                                                       AS avg_engagement_secs

FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
  AND event_name = 'session_start'
GROUP BY date
ORDER BY date;


-- ────────────────────────────────────────────────────────────
-- 2. ECOMMERCE FUNNEL  (view → cart → checkout → purchase)
-- ────────────────────────────────────────────────────────────
WITH user_steps AS (
    SELECT
        user_pseudo_id,
        MAX(CASE WHEN event_name = 'view_item'          THEN 1 END) AS s1_view,
        MAX(CASE WHEN event_name = 'add_to_cart'        THEN 1 END) AS s2_cart,
        MAX(CASE WHEN event_name = 'begin_checkout'     THEN 1 END) AS s3_checkout,
        MAX(CASE WHEN event_name = 'add_shipping_info'  THEN 1 END) AS s4_shipping,
        MAX(CASE WHEN event_name = 'add_payment_info'   THEN 1 END) AS s5_payment,
        MAX(CASE WHEN event_name = 'purchase'           THEN 1 END) AS s6_purchase
    FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
    WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
    GROUP BY user_pseudo_id
)
SELECT
    step,
    step_label,
    users,
    LAG(users) OVER (ORDER BY step)                        AS prev_users,
    ROUND(users * 100.0 / FIRST_VALUE(users) OVER
          (ORDER BY step ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 1) AS pct_of_top,
    ROUND(100.0 - users * 100.0 / NULLIF(LAG(users) OVER (ORDER BY step), 0), 1)
                                                           AS drop_off_pct
FROM (
    SELECT 1 AS step, 'view_item'        AS step_label, COUNTIF(s1_view=1)     AS users FROM user_steps
    UNION ALL
    SELECT 2, 'add_to_cart',        COUNTIF(s2_cart=1)     FROM user_steps
    UNION ALL
    SELECT 3, 'begin_checkout',     COUNTIF(s3_checkout=1) FROM user_steps
    UNION ALL
    SELECT 4, 'add_shipping_info',  COUNTIF(s4_shipping=1) FROM user_steps
    UNION ALL
    SELECT 5, 'add_payment_info',   COUNTIF(s5_payment=1)  FROM user_steps
    UNION ALL
    SELECT 6, 'purchase',           COUNTIF(s6_purchase=1) FROM user_steps
)
ORDER BY step;


-- ────────────────────────────────────────────────────────────
-- 3. REVENUE BY ITEM CATEGORY  (Enhanced Ecommerce)
-- ────────────────────────────────────────────────────────────
SELECT
    COALESCE(i.item_category, '(not set)')     AS category,
    COUNT(DISTINCT e.ecommerce.transaction_id) AS transactions,
    SUM(i.quantity)                            AS units,
    ROUND(SUM(i.price * i.quantity), 2)        AS revenue_usd,
    ROUND(AVG(i.price), 2)                     AS avg_item_price
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*` AS e,
     UNNEST(e.items) AS i
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
  AND e.event_name  = 'purchase'
GROUP BY category
ORDER BY revenue_usd DESC;


-- ────────────────────────────────────────────────────────────
-- 4. TRAFFIC SOURCE / MEDIUM ATTRIBUTION
-- ────────────────────────────────────────────────────────────
SELECT
    COALESCE(traffic_source.source, '(direct)')   AS source,
    COALESCE(traffic_source.medium, '(none)')     AS medium,
    COUNT(DISTINCT user_pseudo_id)                AS users,
    COUNTIF(event_name = 'purchase')              AS purchases,
    ROUND(SUM(ecommerce.purchase_revenue_in_usd), 2) AS revenue_usd,
    ROUND(
        COUNTIF(event_name = 'purchase') * 100.0
        / NULLIF(COUNT(DISTINCT user_pseudo_id), 0), 2
    )                                             AS conversion_rate_pct
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
  AND event_name IN ('first_visit', 'purchase')
GROUP BY source, medium
ORDER BY revenue_usd DESC;


-- ────────────────────────────────────────────────────────────
-- 5. DEVICE & BROWSER BREAKDOWN
-- ────────────────────────────────────────────────────────────
SELECT
    device.category                         AS device_type,
    device.web_info.browser                 AS browser,
    device.operating_system                 AS os,
    COUNT(DISTINCT user_pseudo_id)          AS users,
    COUNTIF(event_name = 'purchase')        AS purchases,
    ROUND(
        COUNTIF(event_name='purchase') * 100.0
        / NULLIF(COUNT(DISTINCT user_pseudo_id),0), 2
    )                                       AS cr_pct
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
GROUP BY device_type, browser, os
ORDER BY users DESC
LIMIT 30;


-- ────────────────────────────────────────────────────────────
-- 6. CONSENT MODE v2 AUDIT
--    analytics_storage = 'Yes'  → measurement consented
--    analytics_storage = 'No'   → modelled in GA4 (Consent Mode cookieless ping)
-- ────────────────────────────────────────────────────────────
SELECT
    privacy_info.analytics_storage          AS analytics_consent,
    privacy_info.ads_storage                AS ads_consent,
    COUNT(*)                                AS events,
    COUNT(DISTINCT user_pseudo_id)          AS affected_users,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS share_pct
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
GROUP BY 1, 2
ORDER BY events DESC;


-- ────────────────────────────────────────────────────────────
-- 7. GTM DEBUG — MISSING REQUIRED EVENT PARAMETERS
--    A missing ga_session_id on a non-session event indicates
--    a GTM trigger misconfiguration or dataLayer push ordering issue.
-- ────────────────────────────────────────────────────────────
SELECT
    event_name,
    COUNT(*)                                AS total,
    COUNTIF((SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'ga_session_id') = 0)   AS no_session_id,
    COUNTIF((SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'page_location') = 0)   AS no_page_location,
    COUNTIF((SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'page_title') = 0)      AS no_page_title
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
  AND event_name NOT IN ('session_start','first_visit')
GROUP BY event_name
HAVING total > 500
ORDER BY no_session_id DESC;


-- ────────────────────────────────────────────────────────────
-- 8. USER LTV COHORT  (by first-visit month)
-- ────────────────────────────────────────────────────────────
SELECT
    FORMAT_DATE('%Y-%m',
        DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))) AS cohort_month,
    COUNT(DISTINCT user_pseudo_id)                          AS cohort_size,
    ROUND(SUM(user_ltv.revenue), 2)                         AS total_ltv_usd,
    ROUND(AVG(user_ltv.revenue), 2)                         AS avg_ltv_usd,
    ROUND(AVG(user_ltv.revenue) / NULLIF(
        DATE_DIFF(DATE '2021-02-01',
            MIN(DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))), MONTH
        ), 0), 2)                                           AS monthly_ltv_rate
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
  AND user_first_touch_timestamp IS NOT NULL
GROUP BY cohort_month
ORDER BY cohort_month;


-- ────────────────────────────────────────────────────────────
-- 9. ENHANCED CONVERSIONS — PURCHASE DETAIL
--    transaction_id deduplication prevents double-counting
--    when the same purchase fires across multiple GA4 events.
-- ────────────────────────────────────────────────────────────
SELECT
    e.ecommerce.transaction_id,
    MIN(TIMESTAMP_MICROS(e.event_timestamp))    AS purchase_time,
    SUM(e.ecommerce.purchase_revenue_in_usd)    AS revenue_usd,
    SUM(e.ecommerce.tax_value_in_usd)           AS tax_usd,
    SUM(e.ecommerce.shipping_value_in_usd)      AS shipping_usd,
    SUM(e.ecommerce.total_item_quantity)        AS items,
    geo.country,
    device.category                             AS device
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*` AS e
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
  AND event_name   = 'purchase'
  AND ecommerce.transaction_id IS NOT NULL
GROUP BY transaction_id, geo.country, device   -- dedup by txn
ORDER BY purchase_time
LIMIT 500;


-- ────────────────────────────────────────────────────────────
-- 10. PAGE PERFORMANCE  (page_view + scroll depth)
--     scroll event fires when user reaches 90% of page —
--     ratio to page_views = effective scroll-depth engagement rate.
-- ────────────────────────────────────────────────────────────
WITH page_events AS (
    SELECT
        (SELECT value.string_value FROM UNNEST(event_params)
         WHERE key = 'page_location')   AS page,
        (SELECT value.string_value FROM UNNEST(event_params)
         WHERE key = 'page_title')      AS title,
        event_name
    FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
    WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
      AND event_name IN ('page_view','scroll')
)
SELECT
    page,
    title,
    COUNTIF(event_name = 'page_view')   AS page_views,
    COUNTIF(event_name = 'scroll')      AS scroll_events,
    ROUND(
        COUNTIF(event_name='scroll') * 100.0
        / NULLIF(COUNTIF(event_name='page_view'), 0), 1
    )                                   AS scroll_depth_pct
FROM page_events
GROUP BY page, title
HAVING page_views > 50
ORDER BY page_views DESC
LIMIT 25;
