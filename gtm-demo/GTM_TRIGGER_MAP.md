# GTM Trigger Map

Use this file to create Google Tag Manager Custom Event triggers and GA4 Event tags for the demo site.

| Journey step | GTM trigger type | Event name | GA4 event tag name |
|---|---|---|---|
| Site boot | Custom Event | `site_boot` | Optional debug tag |
| Page loaded | Custom Event | `page_view` | GA4 - page_view |
| Category/list loaded | Custom Event | `view_item_list` | GA4 - view_item_list |
| Product clicked | Custom Event | `select_item` | GA4 - select_item |
| Product detail viewed | Custom Event | `view_item` | GA4 - view_item |
| Product added to cart | Custom Event | `add_to_cart` | GA4 - add_to_cart |
| Cart opened | Custom Event | `view_cart` | GA4 - view_cart |
| Checkout started | Custom Event | `begin_checkout` | GA4 - begin_checkout |
| Delivery chosen | Custom Event | `add_shipping_info` | GA4 - add_shipping_info |
| Payment chosen | Custom Event | `add_payment_info` | GA4 - add_payment_info |
| Purchase completed | Custom Event | `purchase` | GA4 - purchase |
| Return created | Custom Event | `refund_request` | Custom GA4 event or map to `refund` |
| Store locator used | Custom Event | `store_locator_search` | Custom GA4 event |
| Login clicked | Custom Event | `login` | GA4 - login |

## Useful Data Layer Variables

| GTM variable name | Data Layer Variable Name |
|---|---|
| DLV - ecommerce.currency | `ecommerce.currency` |
| DLV - ecommerce.value | `ecommerce.value` |
| DLV - ecommerce.items | `ecommerce.items` |
| DLV - transaction_id | `ecommerce.transaction_id` |
| DLV - payment_type | `ecommerce.payment_type` |
| DLV - shipping_tier | `ecommerce.shipping_tier` |
| DLV - user.login_status | `user.login_status` |
| DLV - user.tfg_rewards_member | `user.tfg_rewards_member` |

## GA4 Tag Setup Pattern

For most GA4 ecommerce tags:

- Event Name: use the Custom Event name, for example `add_to_cart`.
- Event Parameters:
  - `currency` = `{{DLV - ecommerce.currency}}`
  - `value` = `{{DLV - ecommerce.value}}`
  - `items` = `{{DLV - ecommerce.items}}`

For purchase:

- Event Name: `purchase`
- Event Parameters:
  - `transaction_id` = `{{DLV - transaction_id}}`
  - `currency` = `{{DLV - ecommerce.currency}}`
  - `value` = `{{DLV - ecommerce.value}}`
  - `items` = `{{DLV - ecommerce.items}}`
