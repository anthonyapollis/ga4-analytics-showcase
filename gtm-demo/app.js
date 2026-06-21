const config = window.BASH_GTM_DEMO_CONFIG || { currency: "ZAR" };
const catalog = window.BASH_CATALOG_DATA;
const fallbackProducts = [
  {
    item_id: "STR-SIL-10",
    item_name: "Sterling Silver Signet Ring",
    item_brand: "Sterns",
    item_category: "Men",
    item_category2: "Jewellery",
    item_category3: "Rings",
    item_variant: "Size 10 / Silver",
    material: "Sterling Silver",
    price: 749,
    original_price: 899,
    quantity: 1,
    index: 1,
    image: "https://images.unsplash.com/photo-1603561596112-db1d6d1eb7fd?auto=format&fit=crop&w=700&q=80"
  },
  {
    item_id: "TIB-BLK-10",
    item_name: "Black Titanium Band",
    item_brand: "American Swiss",
    item_category: "Men",
    item_category2: "Jewellery",
    item_category3: "Rings",
    item_variant: "Size 10 / Black",
    material: "Titanium",
    price: 699,
    original_price: 699,
    quantity: 1,
    index: 2,
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=700&q=80"
  },
  {
    item_id: "GLD-PLT-11",
    item_name: "Gold Plated Classic Ring",
    item_brand: "Bash",
    item_category: "Men",
    item_category2: "Jewellery",
    item_category3: "Rings",
    item_variant: "Size 11 / Gold",
    material: "Gold Plated",
    price: 399,
    original_price: 499,
    quantity: 1,
    index: 3,
    image: "https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=700&q=80"
  },
  {
    item_id: "STL-CHAIN-09",
    item_name: "Steel Detail Ring",
    item_brand: "Foschini",
    item_category: "Men",
    item_category2: "Jewellery",
    item_category3: "Rings",
    item_variant: "Size 9 / Steel",
    material: "Stainless Steel",
    price: 299,
    original_price: 349,
    quantity: 1,
    index: 4,
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=700&q=80"
  }
];

const products = catalog?.products?.length ? catalog.products : fallbackProducts;
const displayProducts = products.slice(0, 24);

let selectedProduct = products[0];
let cart = [selectedProduct];
let eventCount = 0;

const gtmStatus = document.querySelector("#gtmStatus");
const grid = document.querySelector("#productGrid");
const log = document.querySelector("#eventLog");
const noscript = document.querySelector("#gtm-noscript");
const catalogSource = document.querySelector("#catalogSource");
const catalogStats = document.querySelector("#catalog");
const filterButtons = document.querySelector("#filterButtons");
const productCount = document.querySelector("#productCount");

function formatMoney(value) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: config.currency || "ZAR"
  }).format(value);
}

function gaItem(product) {
  return {
    item_id: product.item_id,
    item_name: product.item_name,
    item_brand: product.item_brand,
    item_category: product.item_category,
    item_category2: product.item_category2 || "Bash Catalog",
    item_category3: product.item_category3 || product.item_category,
    item_list_id: "bash_catalog_preview",
    item_list_name: "Bash catalog preview",
    item_variant: product.item_variant,
    price: product.price,
    quantity: product.quantity,
    index: product.index
  };
}

function pushEvent(eventName, payload = {}) {
  const eventPayload = {
    event: eventName,
    event_id: `evt_${Date.now()}_${eventCount}`,
    page_type: "category",
    page_path: window.location.pathname + window.location.hash,
    user: {
      login_status: "guest",
      customer_type: "prospect",
      tfg_rewards_member: false,
      consent_analytics: "granted",
      consent_ads: "denied"
    },
    ...payload
  };

  window.dataLayer.push(eventPayload);
  eventCount += 1;
  renderLog(eventPayload);
}

function renderLog(eventPayload) {
  const entry = JSON.stringify(eventPayload, null, 2);
  log.textContent = `[${new Date().toLocaleTimeString()}] ${entry}\n\n${log.textContent}`;
}

function renderProducts() {
  grid.innerHTML = displayProducts.map((product) => `
    <article class="product-card">
      <img src="${product.image}" alt="${product.item_name}">
      <div class="product-body">
        <div class="meta">
          <span>${product.item_brand}</span>
          <span>${product.availability || "Catalog"}</span>
        </div>
        <h3>${product.item_name}</h3>
        <div class="price-row">
          <strong>${product.display_price || formatMoney(product.price)}</strong>
          <span>${product.item_category}</span>
        </div>
        <div class="card-actions">
          <button type="button" data-action="select" data-sku="${product.item_id}">View</button>
          <button class="primary" type="button" data-action="add" data-sku="${product.item_id}">Add</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCatalogSummary() {
  if (!catalog) return;
  catalogSource.textContent = `${catalog.total_products.toLocaleString()} products loaded from Bash/TFG CSV data`;
  productCount.textContent = `${displayProducts.length} shown from ${catalog.total_products.toLocaleString()} products`;
  catalogStats.innerHTML = `
    <article class="stat-tile"><span>Total products</span><strong>${catalog.total_products.toLocaleString()}</strong></article>
    <article class="stat-tile"><span>Categories</span><strong>${catalog.total_categories.toLocaleString()}</strong></article>
    <article class="stat-tile"><span>TFG brands</span><strong>${catalog.total_brands.toLocaleString()}</strong></article>
    <article class="stat-tile"><span>Avg price</span><strong>${formatMoney(catalog.price_summary.average)}</strong></article>
  `;
}

function renderFilters() {
  const brandButtons = (catalog?.top_brands || []).slice(0, 5).map(([brand, count]) => `
    <button type="button" data-action="filter" data-filter="brand:${brand}">${brand} (${count})</button>
  `).join("");
  const categoryButtons = (catalog?.top_categories || []).slice(0, 4).map(([category, count]) => `
    <button type="button" data-action="filter" data-filter="category:${category}">${category} (${count})</button>
  `).join("");
  filterButtons.innerHTML = brandButtons + categoryButtons + `
    <button type="button" data-action="filter" data-filter="availability:InStock">In stock</button>
  `;
}

function cartValue() {
  return cart.reduce((sum, product) => sum + product.price * product.quantity, 0);
}

function purchasePayload() {
  return {
    transaction_id: `BSH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-001`,
    affiliation: "Bash Netlify Demo",
    currency: config.currency || "ZAR",
    value: cartValue(),
    tax: Number((cartValue() * 0.15).toFixed(2)),
    shipping: 0,
    coupon: "WELCOME10",
    payment_type: "card",
    shipping_tier: "standard_delivery",
    ecommerce: {
      transaction_id: `BSH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-001`,
      currency: config.currency || "ZAR",
      value: cartValue(),
      tax: Number((cartValue() * 0.15).toFixed(2)),
      shipping: 0,
      coupon: "WELCOME10",
      items: cart.map(gaItem)
    }
  };
}

function handleProductAction(action, sku) {
  const product = products.find((item) => item.item_id === sku);
  if (!product) return;
  selectedProduct = product;

  if (action === "select") {
    pushEvent("select_item", {
      ecommerce: {
        item_list_id: "men_jewellery_rings",
        item_list_name: "Men > Jewellery > Rings",
        items: [gaItem(product)]
      }
    });
    pushEvent("view_item", {
      page_type: "product_detail",
      ecommerce: {
        currency: config.currency || "ZAR",
        value: product.price,
        items: [gaItem(product)]
      }
    });
  }

  if (action === "add") {
    cart = [product];
    pushEvent("add_to_cart", {
      ecommerce: {
        currency: config.currency || "ZAR",
        value: product.price,
        items: [gaItem(product)]
      }
    });
  }
}

function handleGlobalAction(action, target) {
  if (action === "filter") {
    pushEvent("filter_apply", {
      filter: target.dataset.filter,
      item_list_id: "men_jewellery_rings"
    });
  }

  if (action === "store-search") {
    pushEvent("store_locator_search", {
      search_term: "Cape Town",
      store_service: "collect_and_deliver"
    });
  }

  if (action === "login") {
    pushEvent("login", {
      method: "email",
      user: {
        login_status: "logged_in",
        customer_type: "returning",
        tfg_rewards_member: true,
        consent_analytics: "granted",
        consent_ads: "granted"
      }
    });
  }

  if (action === "view-cart") {
    pushEvent("view_cart", {
      ecommerce: {
        currency: config.currency || "ZAR",
        value: cartValue(),
        items: cart.map(gaItem)
      }
    });
  }

  if (action === "begin-checkout") {
    pushEvent("begin_checkout", {
      ecommerce: {
        currency: config.currency || "ZAR",
        value: cartValue(),
        coupon: "WELCOME10",
        items: cart.map(gaItem)
      }
    });
  }

  if (action === "shipping") {
    pushEvent("add_shipping_info", {
      ecommerce: {
        currency: config.currency || "ZAR",
        value: cartValue(),
        shipping_tier: "collect_and_deliver",
        items: cart.map(gaItem)
      }
    });
  }

  if (action === "payment") {
    pushEvent("add_payment_info", {
      ecommerce: {
        currency: config.currency || "ZAR",
        value: cartValue(),
        payment_type: "TFG Money Account",
        items: cart.map(gaItem)
      }
    });
  }

  if (action === "purchase") {
    pushEvent("purchase", purchasePayload());
  }

  if (action === "return") {
    pushEvent("refund_request", {
      reason: "wrong_size",
      ecommerce: {
        currency: config.currency || "ZAR",
        value: selectedProduct.price,
        transaction_id: "BSH-20260612-001",
        items: [gaItem(selectedProduct)]
      }
    });
  }

  if (action === "clear-log") {
    log.textContent = "";
  }
}

function initGtmStatus() {
  const id = config.gtmId || "GTM-XXXXXXX";
  gtmStatus.textContent = id === "GTM-XXXXXXX" ? "Demo mode: add GTM ID" : id;
  if (noscript && id !== "GTM-XXXXXXX") {
    noscript.src = `https://www.googletagmanager.com/ns.html?id=${id}`;
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;

  if (action === "select" || action === "add") {
    handleProductAction(action, target.dataset.sku);
    return;
  }

  handleGlobalAction(action, target);
});

renderCatalogSummary();
renderFilters();
renderProducts();
initGtmStatus();
pushEvent("page_view", {
  page_title: document.title,
  page_location: window.location.href
});
pushEvent("view_item_list", {
  ecommerce: {
    item_list_id: "bash_catalog_preview",
    item_list_name: "Bash catalog preview",
    items: displayProducts.map(gaItem)
  }
});
