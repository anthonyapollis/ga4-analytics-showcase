-- ============================================================
-- GA4 Analytics Query Library — Bash (TFG)
-- Source : {project_id}.analytics_{property_id}.events_*
--          (Bash GA4 BigQuery export — ZAR currency, SA market)
-- Author : Anthony Apollis
--
-- All queries use:
--   • _TABLE_SUFFIX wildcard  →  date-partition pruning, avoids full scans
--   • UNNEST(event_params)    →  GA4's repeated-record event parameters
--   • UNNEST(items)           →  Enhanced Ecommerce item arrays
--   • QueryPriority.BATCH     →  see batch_extractor.py for Python wrapper
--
-- Bash-specific dimensions used throughout:
--   trading_season  — Black Friday Season / Festive Peak / January Slump / Standard Trading
--   loyalty_tier    — Gold / Silver / Bronze / Standard
--   province        — SA province from add_shipping_info push
--   payment_type    — Credit Card / EFT / SnapScan / Payflex / Store Credit
--   item_brand      — TFG sub-brand (The FIX / Jet / Exact / Cotton On / Nike etc.)
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

    -- GA4 defines "engaged session" as >10s, 1+ conversion, or 2+ page views
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

FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name = 'session_start'
GROUP BY date
ORDER BY date;


-- ────────────────────────────────────────────────────────────
-- 2. ECOMMERCE FUNNEL  (view → cart → checkout → purchase)
--    Bash-specific: includes add_shipping_info and add_payment_info
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
    FROM `{project_id}.analytics_{property_id}.events_*`
    WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
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
-- 3. REVENUE BY ITEM BRAND  (Bash multi-brand breakdown)
--    The FIX / Jet / Exact / Cotton On / Nike / Bash Marketplace etc.
-- ────────────────────────────────────────────────────────────
SELECT
    COALESCE(i.item_brand, '(not set)')          AS brand,
    COALESCE(i.item_category, '(not set)')       AS category,
    COUNT(DISTINCT e.ecommerce.transaction_id)   AS transactions,
    SUM(i.quantity)                              AS units_sold,
    ROUND(SUM(i.price * i.quantity), 2)          AS revenue_zar,
    ROUND(AVG(i.price), 2)                       AS avg_item_price_zar,
    ROUND(SUM(i.price * i.quantity)
        / NULLIF(COUNT(DISTINCT e.ecommerce.transaction_id), 0), 2)
                                                 AS avg_basket_zar
FROM `{project_id}.analytics_{property_id}.events_*` AS e,
     UNNEST(e.items) AS i
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND e.event_name  = 'purchase'
GROUP BY brand, category
ORDER BY revenue_zar DESC;


-- ────────────────────────────────────────────────────────────
-- 4. REVENUE BY TRADING SEASON
--    Black Friday Season (Nov) / Festive Peak (Dec) /
--    January Slump (Jan-Feb) / Standard Trading
-- ────────────────────────────────────────────────────────────
SELECT
    CASE
        WHEN SUBSTR(event_date, 5, 2) = '11'         THEN 'Black Friday Season'
        WHEN SUBSTR(event_date, 5, 2) = '12'         THEN 'Festive Peak'
        WHEN SUBSTR(event_date, 5, 2) IN ('01','02') THEN 'January Slump'
        ELSE 'Standard Trading'
    END                                              AS trading_season,
    COUNT(DISTINCT ecommerce.transaction_id)         AS transactions,
    ROUND(SUM(ecommerce.purchase_revenue), 2)        AS revenue_zar,
    ROUND(AVG(ecommerce.purchase_revenue), 2)        AS avg_order_value_zar,
    COUNT(DISTINCT user_pseudo_id)                   AS buyers,
    ROUND(SUM(ecommerce.purchase_revenue)
        / NULLIF(COUNT(DISTINCT user_pseudo_id), 0), 2)
                                                     AS revenue_per_buyer_zar
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name = 'purchase'
GROUP BY trading_season
ORDER BY revenue_zar DESC;


-- ────────────────────────────────────────────────────────────
-- 5. TRAFFIC SOURCE / MEDIUM ATTRIBUTION  (ZAR revenue)
--    Bash media mix: Google Ads, Meta, TikTok, SA360, DV360, Email (Braze)
-- ────────────────────────────────────────────────────────────
SELECT
    COALESCE(traffic_source.source, '(direct)')     AS source,
    COALESCE(traffic_source.medium, '(none)')       AS medium,
    COUNT(DISTINCT user_pseudo_id)                  AS users,
    COUNTIF(event_name = 'purchase')                AS purchases,
    ROUND(SUM(ecommerce.purchase_revenue), 2)       AS revenue_zar,
    ROUND(
        COUNTIF(event_name = 'purchase') * 100.0
        / NULLIF(COUNT(DISTINCT user_pseudo_id), 0), 2
    )                                               AS conversion_rate_pct,
    ROUND(SUM(ecommerce.purchase_revenue)
        / NULLIF(COUNTIF(event_name = 'purchase'), 0), 2)
                                                    AS avg_order_value_zar
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name IN ('first_visit', 'purchase')
GROUP BY source, medium
ORDER BY revenue_zar DESC;


-- ────────────────────────────────────────────────────────────
-- 6. SA PROVINCE BREAKDOWN
--    province is a custom event parameter pushed on add_shipping_info
-- ────────────────────────────────────────────────────────────
SELECT
    (SELECT value.string_value FROM UNNEST(event_params)
     WHERE key = 'province')                          AS province,
    COUNT(DISTINCT user_pseudo_id)                    AS users,
    COUNTIF(event_name = 'purchase')                  AS purchases,
    ROUND(SUM(ecommerce.purchase_revenue), 2)         AS revenue_zar,
    ROUND(AVG(ecommerce.purchase_revenue), 2)         AS avg_order_value_zar,
    ROUND(
        COUNTIF(event_name = 'purchase') * 100.0
        / NULLIF(COUNT(DISTINCT user_pseudo_id), 0), 2
    )                                                 AS conversion_rate_pct
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name IN ('add_shipping_info', 'purchase')
GROUP BY province
HAVING province IS NOT NULL
ORDER BY revenue_zar DESC;


-- ────────────────────────────────────────────────────────────
-- 7. LOYALTY TIER CONVERSION & REVENUE
--    loyalty_tier is a custom user-scoped parameter pushed on page_data_ready
--    and login events for authenticated Bash account holders
-- ────────────────────────────────────────────────────────────
SELECT
    (SELECT value.string_value FROM UNNEST(event_params)
     WHERE key = 'loyalty_tier')                     AS loyalty_tier,
    COUNT(DISTINCT user_pseudo_id)                   AS users,
    COUNTIF(event_name = 'purchase')                 AS purchases,
    ROUND(SUM(ecommerce.purchase_revenue), 2)        AS revenue_zar,
    ROUND(AVG(ecommerce.purchase_revenue), 2)        AS avg_order_value_zar,
    ROUND(
        COUNTIF(event_name = 'purchase') * 100.0
        / NULLIF(COUNT(DISTINCT user_pseudo_id), 0), 2
    )                                                AS conversion_rate_pct
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name IN ('purchase', 'view_item')
GROUP BY loyalty_tier
ORDER BY
    CASE loyalty_tier
        WHEN 'Gold'     THEN 1
        WHEN 'Silver'   THEN 2
        WHEN 'Bronze'   THEN 3
        WHEN 'Standard' THEN 4
        ELSE 5
    END;


-- ────────────────────────────────────────────────────────────
-- 8. PAYMENT METHOD BREAKDOWN
--    SA-specific methods: SnapScan, Payflex, EFT, TFG Money Card
--    payment_type is a custom event parameter on add_payment_info / purchase
-- ────────────────────────────────────────────────────────────
SELECT
    (SELECT value.string_value FROM UNNEST(event_params)
     WHERE key = 'payment_type')                     AS payment_type,
    COUNT(DISTINCT ecommerce.transaction_id)         AS transactions,
    ROUND(SUM(ecommerce.purchase_revenue), 2)        AS revenue_zar,
    ROUND(AVG(ecommerce.purchase_revenue), 2)        AS avg_order_value_zar,
    ROUND(
        COUNT(DISTINCT ecommerce.transaction_id) * 100.0
        / SUM(COUNT(DISTINCT ecommerce.transaction_id)) OVER (), 2
    )                                                AS share_of_transactions_pct
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name = 'purchase'
GROUP BY payment_type
HAVING payment_type IS NOT NULL
ORDER BY transactions DESC;


-- ────────────────────────────────────────────────────────────
-- 9. POPIA CONSENT MODE AUDIT
--    analytics_storage = 'Yes' → consented measurement
--    analytics_storage = 'No'  → modelled in GA4 (Consent Mode cookieless ping)
--    Bash must report consent rates to comply with POPIA obligations
-- ────────────────────────────────────────────────────────────
SELECT
    privacy_info.analytics_storage                  AS analytics_consent,
    privacy_info.ads_storage                        AS ads_consent,
    privacy_info.uses_transient_token               AS cookieless_session,
    COUNT(*)                                        AS events,
    COUNT(DISTINCT user_pseudo_id)                  AS affected_users,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS share_pct,
    -- Consent gap = users measured only via modelling (no direct measurement)
    COUNTIF(privacy_info.analytics_storage = 'No')  AS modelled_only_events
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
GROUP BY 1, 2, 3
ORDER BY events DESC;


-- ────────────────────────────────────────────────────────────
-- 10. GTM DEBUG — MISSING REQUIRED EVENT PARAMETERS
--     Missing ga_session_id indicates a GTM trigger misconfiguration
--     or dataLayer push ordering issue. Missing province on
--     add_shipping_info indicates the checkout dataLayer push is broken.
-- ────────────────────────────────────────────────────────────
SELECT
    event_name,
    COUNT(*)                                        AS total,
    COUNTIF((SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'ga_session_id') = 0)      AS no_session_id,
    COUNTIF((SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'page_location') = 0)      AS no_page_location,
    COUNTIF((SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'page_title') = 0)         AS no_page_title,
    -- Bash-specific: province must be present on shipping and purchase events
    COUNTIF(
        event_name IN ('add_shipping_info', 'purchase')
        AND (SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'province') = 0
    )                                               AS missing_province,
    -- trading_season must be present on all purchase events
    COUNTIF(
        event_name = 'purchase'
        AND (SELECT COUNT(1) FROM UNNEST(event_params)
             WHERE key = 'trading_season') = 0
    )                                               AS missing_trading_season
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name NOT IN ('session_start', 'first_visit')
GROUP BY event_name
HAVING total > 100
ORDER BY no_session_id DESC;


-- ────────────────────────────────────────────────────────────
-- 11. USER LTV COHORT  (by first-visit month)
--     Revenue in ZAR — useful for comparing Black Friday cohorts
--     to standard-month cohorts (Bash has strong seasonal skew)
-- ────────────────────────────────────────────────────────────
SELECT
    FORMAT_DATE('%Y-%m',
        DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))) AS cohort_month,
    COUNT(DISTINCT user_pseudo_id)                          AS cohort_size,
    ROUND(SUM(user_ltv.revenue), 2)                         AS total_ltv_zar,
    ROUND(AVG(user_ltv.revenue), 2)                         AS avg_ltv_zar,
    ROUND(AVG(user_ltv.revenue) / NULLIF(
        DATE_DIFF(CURRENT_DATE(),
            MIN(DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))), MONTH
        ), 0), 2)                                           AS monthly_ltv_rate_zar,
    -- Flag Black Friday cohorts — they typically show higher LTV
    CASE
        WHEN FORMAT_DATE('%m', DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))) = '11'
        THEN 'Black Friday Cohort'
        WHEN FORMAT_DATE('%m', DATE(TIMESTAMP_MICROS(user_first_touch_timestamp))) = '12'
        THEN 'Festive Cohort'
        ELSE 'Standard Cohort'
    END                                                     AS cohort_type
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND user_first_touch_timestamp IS NOT NULL
GROUP BY cohort_month, cohort_type
ORDER BY cohort_month;


-- ────────────────────────────────────────────────────────────
-- 12. PURCHASE DETAIL WITH DEDUPLICATION
--     transaction_id deduplication prevents double-counting
--     when the order confirmation page is refreshed.
--     Bash order IDs follow the pattern BASH-ORD-XXXXX.
-- ────────────────────────────────────────────────────────────
SELECT
    e.ecommerce.transaction_id,
    MIN(TIMESTAMP_MICROS(e.event_timestamp))             AS purchase_time,
    ROUND(SUM(e.ecommerce.purchase_revenue), 2)          AS revenue_zar,
    ROUND(SUM(e.ecommerce.tax_value), 2)                 AS tax_zar,
    ROUND(SUM(e.ecommerce.shipping_value), 2)            AS shipping_zar,
    SUM(e.ecommerce.total_item_quantity)                 AS items,
    (SELECT value.string_value FROM UNNEST(e.event_params)
     WHERE key = 'payment_type')                        AS payment_type,
    (SELECT value.string_value FROM UNNEST(e.event_params)
     WHERE key = 'trading_season')                      AS trading_season,
    (SELECT value.string_value FROM UNNEST(e.event_params)
     WHERE key = 'loyalty_tier')                        AS loyalty_tier,
    geo.region                                           AS province,
    device.category                                      AS device
FROM `{project_id}.analytics_{property_id}.events_*` AS e
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name   = 'purchase'
  AND ecommerce.transaction_id IS NOT NULL
GROUP BY
    transaction_id, payment_type, trading_season, loyalty_tier,
    geo.region, device   -- dedup by transaction_id
ORDER BY purchase_time
LIMIT 1000;


-- ────────────────────────────────────────────────────────────
-- 13. ZERO-RESULTS SEARCH AUDIT
--     search_results_count = 0 reveals catalogue gaps.
--     High-volume zero-result searches → product sourcing signal.
-- ────────────────────────────────────────────────────────────
SELECT
    (SELECT value.string_value FROM UNNEST(event_params)
     WHERE key = 'search_term')                       AS search_term,
    COUNT(*)                                          AS searches,
    COUNTIF(
        (SELECT value.int_value FROM UNNEST(event_params)
         WHERE key = 'search_results_count') = 0
    )                                                 AS zero_result_searches,
    ROUND(
        COUNTIF(
            (SELECT value.int_value FROM UNNEST(event_params)
             WHERE key = 'search_results_count') = 0
        ) * 100.0 / NULLIF(COUNT(*), 0), 1
    )                                                 AS zero_result_rate_pct
FROM `{project_id}.analytics_{property_id}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
  AND event_name = 'search'
GROUP BY search_term
HAVING searches >= 20
ORDER BY zero_result_searches DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────
-- 14. PAGE PERFORMANCE  (page_view + scroll depth)
--     scroll event fires when user reaches 90% of page height.
--     Ratio = effective scroll-depth engagement rate per URL.
-- ────────────────────────────────────────────────────────────
WITH page_events AS (
    SELECT
        (SELECT value.string_value FROM UNNEST(event_params)
         WHERE key = 'page_location')  AS page,
        (SELECT value.string_value FROM UNNEST(event_params)
         WHERE key = 'page_title')     AS title,
        event_name
    FROM `{project_id}.analytics_{property_id}.events_*`
    WHERE _TABLE_SUFFIX BETWEEN '20240101' AND '20241231'
      AND event_name IN ('page_view', 'scroll')
)
SELECT
    page,
    title,
    COUNTIF(event_name = 'page_view')                   AS page_views,
    COUNTIF(event_name = 'scroll')                      AS scroll_events,
    ROUND(
        COUNTIF(event_name = 'scroll') * 100.0
        / NULLIF(COUNTIF(event_name = 'page_view'), 0), 1
    )                                                   AS scroll_depth_pct
FROM page_events
GROUP BY page, title
HAVING page_views > 100
ORDER BY page_views DESC
LIMIT 50;
