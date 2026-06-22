/**
 * GTM Simulation Layer — GTM-BSHDEMO
 * Intercepts dataLayer.push(), evaluates triggers, fires virtual tags.
 * Renders a Tag Assistant panel below the dataLayer console.
 */
(function () {
  'use strict';

  // ── CONTAINER ──────────────────────────────────────────────────────────────
  var CONTAINER_ID = 'GTM-BSHDEMO';
  var GA4_ID = 'G-KLNNNZY8JW';

  // ── VARIABLES ──────────────────────────────────────────────────────────────
  // Mirrors a real GTM container variable list (shown in tag params)
  var VARS = {
    'GA4 Measurement ID':           { value: GA4_ID },
    'DLV - event':                  { path: 'event' },
    'DLV - ecommerce.currency':     { path: 'ecommerce.currency' },
    'DLV - ecommerce.value':        { path: 'ecommerce.value' },
    'DLV - ecommerce.transaction_id': { path: 'ecommerce.transaction_id' },
    'DLV - ecommerce.items':        { path: 'ecommerce.items' },
    'DLV - page_type':              { path: 'page_type' },
    'DLV - user.login_status':      { path: 'user.login_status' },
    'DLV - user.consent_analytics': { path: 'user.consent_analytics' },
    'DLV - user.consent_ads':       { path: 'user.consent_ads' },
    'DLV - user.tfg_rewards_member':{ path: 'user.tfg_rewards_member' },
    'DLV - payment_type':           { path: 'payment_type' },
  };

  // ── TRIGGERS ───────────────────────────────────────────────────────────────
  var TRIGGERS = {
    'All Pages':              { events: ['gtm.js', 'gtm.init', 'page_view', 'site_boot'] },
    'CE - page_view':         { events: ['page_view'] },
    'CE - view_item_list':    { events: ['view_item_list'] },
    'CE - select_item':       { events: ['select_item'] },
    'CE - view_item':         { events: ['view_item'] },
    'CE - add_to_cart':       { events: ['add_to_cart'] },
    'CE - view_cart':         { events: ['view_cart'] },
    'CE - begin_checkout':    { events: ['begin_checkout'] },
    'CE - add_shipping_info': { events: ['add_shipping_info'] },
    'CE - add_payment_info':  { events: ['add_payment_info'] },
    'CE - purchase':          { events: ['purchase'] },
    'CE - refund_request':    { events: ['refund_request'] },
    'CE - login':             { events: ['login'] },
    'CE - custom events':     { events: ['filter_apply', 'store_locator_search'] },
  };

  // ── TAGS ───────────────────────────────────────────────────────────────────
  var TAGS = [
    {
      id: 1,
      name: 'Consent Mode — Default State',
      typeLabel: 'Consent Initialization',
      typeClass: 'consent',
      triggers: ['All Pages'],
      consentRequired: null,
      params: { 'analytics_storage': 'denied', 'ad_storage': 'denied',
                'functionality_storage': 'granted', 'wait_for_update': '500ms' }
    },
    {
      id: 2,
      name: 'GA4 — Configuration',
      typeLabel: 'GA4 Configuration',
      typeClass: 'ga4',
      triggers: ['All Pages'],
      consentRequired: 'analytics',
      params: { 'Measurement ID': '{{GA4 Measurement ID}}',
                'Send Page View': 'true',
                'User Properties': 'login_status: {{DLV - user.login_status}}' }
    },
    {
      id: 3,
      name: 'GA4 — page_view',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - page_view'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'page_view', 'page_type': '{{DLV - page_type}}' }
    },
    {
      id: 4,
      name: 'GA4 — view_item_list',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - view_item_list'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'view_item_list', 'Ecommerce data': 'Data Layer',
                'item_list_id': 'bash_catalog_preview' }
    },
    {
      id: 5,
      name: 'GA4 — select_item',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - select_item'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'select_item', 'Ecommerce data': 'Data Layer' }
    },
    {
      id: 6,
      name: 'GA4 — view_item',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - view_item'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'view_item', 'Ecommerce data': 'Data Layer',
                'page_type': 'product_detail' }
    },
    {
      id: 7,
      name: 'GA4 — add_to_cart',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - add_to_cart'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'add_to_cart', 'Ecommerce data': 'Data Layer',
                'currency': '{{DLV - ecommerce.currency}}' }
    },
    {
      id: 8,
      name: 'GA4 — view_cart',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - view_cart'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'view_cart', 'Ecommerce data': 'Data Layer' }
    },
    {
      id: 9,
      name: 'GA4 — begin_checkout',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - begin_checkout'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'begin_checkout', 'Ecommerce data': 'Data Layer',
                'coupon': 'WELCOME10' }
    },
    {
      id: 10,
      name: 'GA4 — add_shipping_info',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - add_shipping_info'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'add_shipping_info', 'Ecommerce data': 'Data Layer',
                'shipping_tier': 'collect_and_deliver' }
    },
    {
      id: 11,
      name: 'GA4 — add_payment_info',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - add_payment_info'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'add_payment_info', 'Ecommerce data': 'Data Layer',
                'payment_type': '{{DLV - payment_type}}' }
    },
    {
      id: 12,
      name: 'GA4 — purchase',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - purchase'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'purchase', 'Ecommerce data': 'Data Layer',
                'transaction_id': '{{DLV - ecommerce.transaction_id}}' }
    },
    {
      id: 13,
      name: 'GA4 — refund',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - refund_request'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'refund', 'Ecommerce data': 'Data Layer' }
    },
    {
      id: 14,
      name: 'GA4 — login',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - login'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'login', 'method': 'email' }
    },
    {
      id: 15,
      name: 'GA4 — User Properties',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - login'],
      consentRequired: 'analytics',
      params: { 'Event Name': 'set_user_properties',
                'tfg_rewards_member': '{{DLV - user.tfg_rewards_member}}',
                'login_status': '{{DLV - user.login_status}}' }
    },
    {
      id: 16,
      name: 'GA4 — Custom Events',
      typeLabel: 'GA4 Event',
      typeClass: 'ga4',
      triggers: ['CE - custom events'],
      consentRequired: 'analytics',
      params: { 'Event Name': '{{DLV - event}}', 'Ecommerce data': 'Data Layer' }
    },
    {
      id: 17,
      name: 'GAds — Dynamic Remarketing',
      typeLabel: 'Google Ads Remarketing',
      typeClass: 'ads',
      triggers: ['CE - purchase'],
      consentRequired: 'ads',
      params: { 'Conversion ID': 'AW-XXXXXXXXXX', 'ecomm_pagetype': 'purchase',
                'ecomm_totalvalue': '{{DLV - ecommerce.value}}' }
    },
  ];

  // ── STATE ──────────────────────────────────────────────────────────────────
  var consentState = { analytics: 'denied', ads: 'denied' };
  var firedCount = 0;
  var blockedCount = 0;

  // ── DATAΛAYER INTERCEPT ────────────────────────────────────────────────────
  window.dataLayer = window.dataLayer || [];
  var _nativePush = Array.prototype.push;

  window.dataLayer.push = function () {
    var result = _nativePush.apply(this, arguments);
    for (var i = 0; i < arguments.length; i++) {
      var item = arguments[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        processEvent(item);
      }
    }
    return result;
  };

  // Replay events already in the DL before this script loaded
  var _snapshot = window.dataLayer.slice();
  for (var i = 0; i < _snapshot.length; i++) {
    if (_snapshot[i] && _snapshot[i].event) processEvent(_snapshot[i]);
  }

  // ── EVENT PROCESSING ───────────────────────────────────────────────────────
  function processEvent(push) {
    // Update consent state from this push
    if (push.user) {
      if (push.user.consent_analytics) consentState.analytics = push.user.consent_analytics;
      if (push.user.consent_ads)       consentState.ads       = push.user.consent_ads;
    }

    var event = push.event;
    if (!event) return;

    // Find matching triggers
    var matchedTriggers = [];
    Object.keys(TRIGGERS).forEach(function (name) {
      if (TRIGGERS[name].events.indexOf(event) !== -1) matchedTriggers.push(name);
    });
    if (!matchedTriggers.length) return;

    // Fire tags whose triggers matched
    TAGS.forEach(function (tag) {
      var triggered = tag.triggers.some(function (t) {
        return matchedTriggers.indexOf(t) !== -1;
      });
      if (!triggered) return;

      var status = 'fired';
      var blockedReason = null;
      if (tag.consentRequired === 'analytics' && consentState.analytics !== 'granted') {
        status = 'blocked'; blockedReason = 'analytics_storage: denied';
      } else if (tag.consentRequired === 'ads' && consentState.ads !== 'granted') {
        status = 'blocked'; blockedReason = 'ad_storage: denied';
      }

      if (status === 'fired') firedCount++; else blockedCount++;
      queueRender(tag, event, status, blockedReason);
    });
  }

  // ── DEFERRED RENDER ────────────────────────────────────────────────────────
  var renderQueue = [];
  var renderScheduled = false;

  function queueRender(tag, event, status, blockedReason) {
    renderQueue.push({ tag: tag, event: event, status: status, blockedReason: blockedReason });
    if (!renderScheduled) {
      renderScheduled = true;
      setTimeout(flushRenderQueue, 0);
    }
  }

  function flushRenderQueue() {
    renderScheduled = false;
    var log = document.getElementById('gtm-sim-log');
    var empty = document.getElementById('gtm-sim-empty');
    if (!log) return;
    if (renderQueue.length && empty) empty.style.display = 'none';

    renderQueue.forEach(function (item) {
      log.insertBefore(buildRow(item.tag, item.event, item.status, item.blockedReason), log.firstChild);
    });
    renderQueue = [];
    updateSummary();
  }

  function buildRow(tag, event, status, blockedReason) {
    var paramPairs = Object.entries(tag.params).slice(0, 3)
      .map(function (kv) { return kv[0] + ': ' + kv[1]; }).join(' · ');
    var triggerStr = tag.triggers.join(', ');

    var row = document.createElement('div');
    row.className = 'gsim-row ' + status;
    row.innerHTML =
      '<div class="gsim-status ' + status + '">' +
        '<span class="gsim-dot"></span>' +
        (status === 'fired' ? 'Fired' : 'Blocked') +
      '</div>' +
      '<div class="gsim-info">' +
        '<div class="gsim-name">' + tag.name + '</div>' +
        '<div class="gsim-meta">' +
          '<span class="gsim-trigger">' + triggerStr + '</span>' +
          (blockedReason ? ' · <span class="gsim-blocked">' + blockedReason + '</span>' : '') +
          '<br><span class="gsim-params">' + paramPairs + '</span>' +
        '</div>' +
      '</div>' +
      '<span class="gsim-type ' + tag.typeClass + '">' + tag.typeLabel + '</span>' +
      '<span class="gsim-time">' + new Date().toLocaleTimeString() + '</span>';
    return row;
  }

  function updateSummary() {
    var el = document.getElementById('gtm-sim-summary');
    if (el) el.textContent = firedCount + ' fired · ' + blockedCount + ' blocked';
  }

  // ── STYLES ─────────────────────────────────────────────────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '.gsim-panel{margin:0 clamp(16px,5vw,72px) 48px;border:2px solid #1a73e8;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;font-size:13px;background:#0f1117;color:#e8eaed}',
      '.gsim-head{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#1a73e8;color:#fff}',
      '.gsim-head-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}',
      '.gsim-logo{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;background:#fff;color:#1a73e8;font-size:10px;font-weight:800;flex-shrink:0}',
      '.gsim-title{font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px}',
      '.gsim-badge{font-size:10px;font-weight:600;background:rgba(255,255,255,.25);border-radius:4px;padding:1px 6px}',
      '.gsim-sub{font-size:11px;opacity:.8;font-family:"Courier New",monospace}',
      '.gsim-summary{font-size:12px;font-weight:600;white-space:nowrap;opacity:.9}',
      '.gsim-btn{min-height:auto!important;height:28px;padding:0 10px;border-radius:4px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3)!important;color:#fff!important;cursor:pointer;font-size:12px}',
      '.gsim-btn:hover{background:rgba(255,255,255,.28)!important;color:#fff!important}',
      '.gsim-body{max-height:380px;overflow-y:auto;padding:8px}',
      '.gsim-body.collapsed{display:none}',
      '.gsim-empty{padding:24px;text-align:center;color:#5f6368;font-style:italic}',
      '.gsim-log{display:grid;gap:4px}',
      '.gsim-row{display:grid;grid-template-columns:76px 1fr auto auto;align-items:start;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid #2d2d35;background:#15161f;animation:gsim-in .22s ease}',
      '@keyframes gsim-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}',
      '.gsim-row.blocked{border-color:#3d2200;background:#1a1000}',
      '.gsim-status{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;white-space:nowrap}',
      '.gsim-status.fired{color:#34a853}.gsim-status.blocked{color:#ea8600}',
      '.gsim-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
      '.fired .gsim-dot{background:#34a853}.blocked .gsim-dot{background:#ea8600}',
      '.gsim-name{font-weight:700;color:#e8eaed;font-size:12.5px}',
      '.gsim-meta{font-size:11px;color:#80868b;margin-top:2px;line-height:1.5}',
      '.gsim-trigger{color:#8ab4f8}.gsim-blocked{color:#ea8600}.gsim-params{color:#5f6368}',
      '.gsim-type{font-size:10px;padding:2px 6px;border-radius:3px;font-weight:600;white-space:nowrap;align-self:start}',
      '.gsim-type.ga4{background:#1e3a5f;color:#8ab4f8}',
      '.gsim-type.consent{background:#1a2e1f;color:#81c995}',
      '.gsim-type.ads{background:#3d2800;color:#ffa000}',
      '.gsim-time{font-size:10px;color:#5f6368;white-space:nowrap;font-family:"Courier New",monospace;align-self:start}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── DOM ────────────────────────────────────────────────────────────────────
  function buildPanel() {
    var panel = document.createElement('section');
    panel.id = 'gtm-sim-panel';
    panel.className = 'gsim-panel';
    panel.innerHTML =
      '<div class="gsim-head">' +
        '<div class="gsim-head-left">' +
          '<div class="gsim-logo">GTM</div>' +
          '<div>' +
            '<div class="gsim-title">Tag Assistant <span class="gsim-badge">Simulated</span></div>' +
            '<div class="gsim-sub">' + CONTAINER_ID + ' · ' + GA4_ID + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gsim-summary" id="gtm-sim-summary">0 fired · 0 blocked</div>' +
        '<button class="gsim-btn" id="gtm-sim-clear" type="button">Clear</button>' +
        '<button class="gsim-btn" id="gtm-sim-toggle" type="button">▲</button>' +
      '</div>' +
      '<div class="gsim-body" id="gtm-sim-body">' +
        '<div class="gsim-empty" id="gtm-sim-empty">Waiting for dataLayer events…</div>' +
        '<div class="gsim-log" id="gtm-sim-log"></div>' +
      '</div>';
    return panel;
  }

  function attachPanel() {
    var anchor = document.getElementById('events');
    var panel = buildPanel();
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    } else {
      document.body.appendChild(panel);
    }

    // Update GTM status chip in hero panel
    var statusEl = document.getElementById('gtmStatus');
    if (statusEl) statusEl.textContent = CONTAINER_ID + ' (simulated)';

    document.getElementById('gtm-sim-toggle').addEventListener('click', function () {
      var body = document.getElementById('gtm-sim-body');
      var btn  = document.getElementById('gtm-sim-toggle');
      body.classList.toggle('collapsed');
      btn.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
    });

    document.getElementById('gtm-sim-clear').addEventListener('click', function () {
      document.getElementById('gtm-sim-log').innerHTML = '';
      document.getElementById('gtm-sim-empty').style.display = '';
      firedCount = 0; blockedCount = 0;
      updateSummary();
    });

    // Flush any events that queued before DOM was ready
    flushRenderQueue();
  }

  function init() {
    injectStyles();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachPanel);
    } else {
      attachPanel();
    }
  }

  init();
})();
