# Bash-style GTM Ecommerce Demo

This is a Netlify-ready static mock ecommerce site for testing Google Tag Manager, GA4 ecommerce events, and `dataLayer` triggers.

## Use it

1. Replace `GTM-XXXXXXX` in `config.js` with your GTM container ID.
2. Deploy this folder to Netlify.
3. Open the Netlify URL in GTM Preview Mode.
4. Click through the mock shop and watch the `dataLayer` panel.

## Deploy on Netlify

Use `outputs/bash-gtm-demo` as the deploy folder.

Netlify settings:

- Build command: leave empty
- Publish directory: `.`
- Framework preset: static site

After deployment, use the Netlify URL in:

- Google Tag Manager Preview Mode
- Google Tag Assistant
- GA4 DebugView

## Events included

- `page_view`
- `view_item_list`
- `select_item`
- `view_item`
- `add_to_wishlist`
- `add_to_cart`
- `view_cart`
- `begin_checkout`
- `add_shipping_info`
- `add_payment_info`
- `purchase`
- `refund_request`
- `store_locator_search`
- `login`
- `newsletter_signup`

The event payloads use GA4-style ecommerce parameters with Bash-like category paths, ZAR currency, product SKUs, brands, sizes, delivery types, payment types, and TFG-style account fields.
