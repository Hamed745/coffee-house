// ============================================
// API Configuration
// ============================================
const API_BASE_URL = `${window.location.origin}/api`;

// ============================================
// Global State
// ============================================
let cart = JSON.parse(localStorage.getItem('coffeeHouseCart')) || [];
let currentLang = localStorage.getItem('lang') || 'en';
let products = [];
let settings = null;

function getProductById(productId) {
  return products.find(p => p.id === productId);
}

// ============================================
// API Functions
// ============================================
class CoffeeHouseAPI {
  static async fetchProducts() {
    try {
      const response = await fetch(`${API_BASE_URL}/products?lang=${currentLang}`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  static async fetchSettings() {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return null;
    }
  }

  static async fetchReviews() {
    try {
      const response = await fetch(`${API_BASE_URL}/reviews?status=approved&limit=5`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  }

  static async submitReview(reviewData) {
    try {
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error submitting review:', error);
      return { success: false, error: 'Network error' };
    }
  }

  static async createOrder(orderData) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating order:', error);
      return { success: false, error: 'Network error' };
    }
  }

  static async fetchProductById(productId) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}?lang=${currentLang}`);
      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      return null;
    }
  }
}

// ============================================
// Cart Functions
// ============================================
class CartManager {
  static syncCartWithProducts() {
    if (!Array.isArray(cart) || !Array.isArray(products)) return;

    const validItems = cart
      .map(item => {
        const product = getProductById(item.productId);
        if (!product) return null;

        const nextItem = {
          ...item,
          name: product.name,
          price: product.price,
          image: product.image
        };

        if (product.category === 'dessert') {
          const allowedQty = Math.max(0, product.stock ?? 0);
          nextItem.quantity = Math.min(item.quantity, allowedQty);
          if (nextItem.quantity <= 0) return null;
        }

        return nextItem;
      })
      .filter(Boolean);

    const changed = validItems.length !== cart.length
      || validItems.some((item, idx) => item.productId !== cart[idx]?.productId || item.quantity !== cart[idx]?.quantity);

    if (changed) {
      cart = validItems;
      this.saveCart();
    }
  }

  static async addToCart(productId, quantity = 1) {
    const product = getProductById(productId);
    if (!product) return false;

    // Re-check latest stock from backend to avoid stale UI stock.
    const latest = await CoffeeHouseAPI.fetchProductById(productId);
    if (latest) {
      const idx = products.findIndex(p => p.id === productId);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...latest };
      }
    }
    const current = latest || product;

    if (!current.available || current.stock === 0) {
      UIManager.showNotification('Out of Stock', 'error');
      UIManager.renderProducts();
      return false;
    }

    const existingItem = cart.find(item => item.productId === productId);
    const nextQuantity = (existingItem?.quantity || 0) + quantity;

    if (current.category === 'dessert' && current.stock !== -1 && nextQuantity > current.stock) {
      UIManager.showNotification('Out of Stock', 'error');
      UIManager.renderProducts();
      return false;
    }
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        productId,
        quantity,
        name: current.name,
        price: current.price,
        image: current.image
      });
    }

    this.saveCart();
    this.updateCartUI();
    return true;
  }

  static removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    this.saveCart();
    this.updateCartUI();
  }

  static updateQuantity(productId, quantity) {
    const item = cart.find(item => item.productId === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        const product = getProductById(productId);
        if (product && product.category === 'dessert' && product.stock !== -1 && quantity > product.stock) {
          UIManager.showNotification(`Only ${product.stock} in stock`, 'error');
          return;
        }
        item.quantity = quantity;
      }
      this.saveCart();
      this.updateCartUI();
    }
  }

  static clearCart() {
    cart = [];
    this.saveCart();
    this.updateCartUI();
  }

  static getCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  static getCartCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }

  static saveCart() {
    localStorage.setItem('coffeeHouseCart', JSON.stringify(cart));
  }

  static toggleCart() {
    const cartDropdown = document.getElementById('cartDropdown');
    cartDropdown.classList.toggle('show');
  }

  static hideCart() {
    const cartDropdown = document.getElementById('cartDropdown');
    cartDropdown.classList.remove('show');
  }

  static updateCartUI() {
    const cartTotal = document.getElementById('cartTotal');
    const cartItems = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const cartBadge = document.getElementById('cartBadge');
    const t = translations[currentLang] || translations['en'];

    const count = this.getCartCount();
    const total = this.getCartTotal();

    // Update total
    if (cartTotal) cartTotal.textContent = `${total} RUB`;
    
    // Update badge
    if (cartBadge) {
      cartBadge.textContent = count;
      cartBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    // Update cart items list
    if (cartItems) {
      cartItems.innerHTML = '';
      
      if (cart.length === 0) {
        cartItems.innerHTML = `<p class="empty-cart">${t.cart_empty}</p>`;
        if (checkoutBtn) checkoutBtn.disabled = true;
      } else {
        if (checkoutBtn) checkoutBtn.disabled = false;
        
        cart.forEach(item => {
          const cartItem = document.createElement('div');
          cartItem.className = 'cart-item';
          cartItem.innerHTML = `
            <div class="cart-item-info">
              <span class="cart-item-name">${item.name}</span>
              <span class="cart-item-price">${item.price} RUB × ${item.quantity}</span>
            </div>
            <div class="cart-item-controls">
              <button class="cart-btn minus" data-id="${item.productId}">-</button>
              <span class="cart-quantity">${item.quantity}</span>
              <button class="cart-btn plus" data-id="${item.productId}">+</button>
              <button class="cart-btn remove" data-id="${item.productId}">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `;
          cartItems.appendChild(cartItem);
        });

        // Add event listeners
        this.attachCartEventListeners();
      }
    }
  }

  static attachCartEventListeners() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;

      cartItems.querySelectorAll('.cart-btn.minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productId = btn.dataset.id;
          const item = cart.find(item => item.productId === productId);
        if (item) this.updateQuantity(productId, item.quantity - 1);
        });
      });

      cartItems.querySelectorAll('.cart-btn.plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productId = btn.dataset.id;
          const item = cart.find(item => item.productId === productId);
        if (item) this.updateQuantity(productId, item.quantity + 1);
        });
      });

      cartItems.querySelectorAll('.cart-btn.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productId = btn.dataset.id;
          this.removeFromCart(productId);
        });
      });
    }
}

// ============================================
// Order History Functions
// ============================================
class OrderHistoryManager {
  static getOrders() {
    return JSON.parse(localStorage.getItem('coffeeHouseOrders')) || [];
  }

  static saveOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order); // Add to beginning
    localStorage.setItem('coffeeHouseOrders', JSON.stringify(orders));
  }

  static deleteOrder(orderNumber) {
    let orders = this.getOrders();
    orders = orders.filter(order => order.orderNumber !== orderNumber);
    localStorage.setItem('coffeeHouseOrders', JSON.stringify(orders));
    this.renderOrders();
  }

  static showOrderHistory() {
    const historyPage = document.getElementById('orderHistoryPage');
    historyPage.classList.add('show');
    document.body.style.overflow = 'hidden';
    this.renderOrders();
  }

  static hideOrderHistory() {
    const historyPage = document.getElementById('orderHistoryPage');
    historyPage.classList.remove('show');
    document.body.style.overflow = 'auto';
  }

  static renderOrders() {
    const container = document.getElementById('orderHistoryContent');
    const orders = this.getOrders();
    const t = translations[currentLang] || translations['en'];

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="no-orders">
          <i class="fas fa-shopping-bag"></i>
          <h3>${t.history_no_orders}</h3>
          <p>${t.history_no_orders_msg}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <div class="order-id">${t.history_order}${order.orderNumber}</div>
            <div class="order-date">${this.formatDate(order.date)}</div>
          </div>
          <div class="order-header-actions">
            <span class="order-status ${order.status}">${order.status}</span>
            <button class="delete-order-btn" data-order="${order.orderNumber}" title="Delete Order">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="order-card-body">
          <div class="order-items-list">
            ${order.items.map(item => `
              <div class="order-item-row">
                <div>
                  <span class="order-item-name">${item.name}</span>
                  <span class="order-item-qty"> × ${item.quantity}</span>
                </div>
                <span class="order-item-price">${item.price * item.quantity} RUB</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="order-card-footer">
          <div class="order-type-badge">
            <i class="fas fa-${order.orderType === 'delivery' ? 'truck' : 'store'}"></i>
            ${order.orderType === 'delivery' ? t.history_delivery : t.history_pickup}
          </div>
          <div class="order-total">${t.history_total} <span>${order.total} RUB</span></div>
        </div>
      </div>
    `).join('');

    // Attach delete event listeners
    container.querySelectorAll('.delete-order-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderNumber = btn.dataset.order;
        if (confirm(t.history_delete_confirm)) {
          this.deleteOrder(orderNumber);
        }
      });
    });
  }

  static formatDate(dateString) {
    const date = new Date(dateString);
    const locale = currentLang === 'ru' ? 'ru-RU' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// ============================================
// Checkout Functions
// ============================================
class CheckoutManager {
  static showCheckoutPage() {
    const t = translations[currentLang] || translations['en'];
    if (cart.length === 0) {
      UIManager.showNotification(t.notification_cart_empty, 'error');
      return;
    }

    CartManager.hideCart();
    
    const checkoutPage = document.getElementById('checkoutPage');
    checkoutPage.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    this.updateCheckoutSummary();
  }

  static hideCheckoutPage() {
    const checkoutPage = document.getElementById('checkoutPage');
    checkoutPage.classList.remove('show');
    document.body.style.overflow = 'auto';
  }

  static updateCheckoutSummary() {
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutSubtotal = document.getElementById('checkoutSubtotal');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const t = translations[currentLang] || translations['en'];

    if (checkoutItems) {
      checkoutItems.innerHTML = '';
      cart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'checkout-item';
        itemDiv.innerHTML = `
          <div class="checkout-item-info">
            <div class="checkout-item-name">${item.name}</div>
            <div class="checkout-item-qty">${t.checkout_qty} ${item.quantity}</div>
          </div>
          <div class="checkout-item-price">${item.price * item.quantity} RUB</div>
        `;
        checkoutItems.appendChild(itemDiv);
      });
    }

    const total = CartManager.getCartTotal();
    if (checkoutSubtotal) checkoutSubtotal.textContent = `${total} RUB`;
    if (checkoutTotal) checkoutTotal.textContent = `${total} RUB`;
  }

  static async submitOrder(e) {
    e.preventDefault();
    const t = translations[currentLang] || translations['en'];

    CartManager.syncCartWithProducts();

    if (cart.length === 0) {
      UIManager.showNotification('Cart updated. Please add products again.', 'error');
      return;
    }

    const orderType = document.getElementById('orderType').value;
    const total = CartManager.getCartTotal();
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const customerEmail = document.getElementById('customerEmail').value || '';
    const deliveryAddressRaw = document.getElementById('deliveryAddress')?.value || '';
    const specialInstructions = document.getElementById('specialInstructions').value || '';
    const paymentMethod = document.getElementById('paymentMethod').value;

    if (!customerName.trim() || !customerPhone.trim()) {
      UIManager.showNotification('Name and phone are required', 'error');
      return;
    }

    if (orderType === 'delivery' && !deliveryAddressRaw.trim()) {
      UIManager.showNotification('Delivery address is required', 'error');
      return;
    }

    // Generate temporary local order number; replace with backend number if available
    let orderNumber = 'ORD-' + Date.now().toString().slice(-8);

    const localOrder = {
      orderNumber: orderNumber,
      date: new Date().toISOString(),
      status: 'pending',
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: total,
      orderType: orderType,
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail
      }
    };

    let result;
    try {
      result = await CoffeeHouseAPI.createOrder({
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          specialInstructions: ''
        })),
        customer: localOrder.customer,
        orderType: orderType,
        deliveryAddress: orderType === 'delivery'
          ? { street: deliveryAddressRaw, city: '', apartment: '' }
          : {},
        specialInstructions,
        paymentMethod
      });
    } catch (err) {
      result = { success: false, error: 'Network error' };
    }

    if (!result?.success) {
      UIManager.showNotification(result?.error || result?.message || 'Failed to place order', 'error');
      return;
    }

    if (result?.data?.orderNumber) {
      orderNumber = result.data.orderNumber;
      localOrder.orderNumber = orderNumber;
    }
    OrderHistoryManager.saveOrder(localOrder);

    products = await CoffeeHouseAPI.fetchProducts();
    UIManager.renderProducts();

    this.hideCheckoutPage();
    this.showOrderSuccess(orderNumber);
    CartManager.clearCart();
    document.getElementById('checkoutForm').reset();
  }

  static showOrderSuccess(orderNumber) {
    const modal = document.getElementById('orderSuccessModal');
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    
    if (orderNumberDisplay) orderNumberDisplay.textContent = orderNumber;
    modal.classList.add('show');
  }

  static hideOrderSuccess() {
    const modal = document.getElementById('orderSuccessModal');
    modal.classList.remove('show');
  }
}

// ============================================
// UI Functions
// ============================================
class UIManager {
  static async initialize() {
    products = await CoffeeHouseAPI.fetchProducts();
    CartManager.syncCartWithProducts();
    this.renderProducts();
    
    settings = await CoffeeHouseAPI.fetchSettings();
    if (settings) this.renderSettings();
    
    await this.loadReviews();
    CartManager.updateCartUI();
    this.setupEventListeners();
  }

  static renderProducts() {
    const coffeeMenu = document.getElementById('coffee-menu');
    const dessertMenu = document.getElementById('dessert-menu');
    
    if (coffeeMenu) coffeeMenu.innerHTML = '';
    if (dessertMenu) dessertMenu.innerHTML = '';
    
    const coffeeProducts = products.filter(p => p.category === 'coffee');
    const dessertProducts = products.filter(p => p.category === 'dessert');
    
    coffeeProducts.forEach(product => {
      if (coffeeMenu) coffeeMenu.appendChild(this.createProductCard(product));
    });
    
    dessertProducts.forEach(product => {
      if (dessertMenu) dessertMenu.appendChild(this.createProductCard(product));
    });
  }

  static createProductCard(product) {
    const t = translations[currentLang] || translations['en'];
    const div = document.createElement('div');
    const outOfStock = !product.available || product.stock === 0;
    div.className = `menu-item ${outOfStock ? 'is-out-of-stock' : ''}`;
    div.innerHTML = `
      <img src="${product.image}" alt="${product.name}" onerror="this.src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop'">
      <h3>${product.name}</h3>
      <p class="desc">${product.description}</p>
      ${outOfStock ? '<p class="out-of-stock-message">Out of Stock</p>' : ''}
      <div class="price-box">
        <span class="price">${product.price} RUB</span>
        <button class="add-btn" data-id="${product.id}" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Out of Stock' : t.add_to_cart}
        </button>
      </div>
    `;
    
    div.querySelector('.add-btn').addEventListener('click', async () => {
      const added = await CartManager.addToCart(product.id, 1);
      if (added) {
        this.showNotification(`${product.name} ${t.notification_added}`);
      }
    });
    
    return div;
  }

  static renderSettings() {
    if (!settings) return;
    
    const vkLink = document.getElementById('vkLink');
    const telegramLink = document.getElementById('telegramLink');
    
    if (vkLink && settings.socialMedia?.vk) vkLink.href = settings.socialMedia.vk;
    if (telegramLink && settings.socialMedia?.telegram) telegramLink.href = settings.socialMedia.telegram;
  }

  static async loadReviews() {
    const reviews = await CoffeeHouseAPI.fetchReviews();
    const reviewsContainer = document.getElementById('reviewsContainer');
    
    if (!reviewsContainer) return;
    
    reviewsContainer.innerHTML = '';
    
    if (reviews.length === 0) {
      reviewsContainer.innerHTML = '<div class="review-card"><p>No reviews yet. Be the first to review!</p></div>';
      return;
    }
    
    reviews.forEach(review => {
      const stars = '⭐'.repeat(review.rating);
      const reviewCard = document.createElement('div');
      reviewCard.className = 'review-card';
      reviewCard.innerHTML = `<p>${review.comment}</p><span>- ${review.customerName} ${stars}</span>`;
      reviewsContainer.appendChild(reviewCard);
    });
  }

  static showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  static setupEventListeners() {
    // Cart toggle
    const cartToggleBtn = document.getElementById('cartToggleBtn');
    if (cartToggleBtn) {
      cartToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        CartManager.toggleCart();
      });
    }

    // Cart close button
    const cartCloseBtn = document.getElementById('cartCloseBtn');
    if (cartCloseBtn) {
      cartCloseBtn.addEventListener('click', () => CartManager.hideCart());
    }

    // Prevent cart from closing when clicking inside it
    const cartDropdown = document.getElementById('cartDropdown');
    if (cartDropdown) {
      cartDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Close cart when clicking outside
    document.addEventListener('click', (e) => {
      const cartDropdown = document.getElementById('cartDropdown');
      const cartToggleBtn = document.getElementById('cartToggleBtn');
      if (cartDropdown?.classList.contains('show')) {
        if (!cartDropdown.contains(e.target) && !cartToggleBtn?.contains(e.target)) {
          CartManager.hideCart();
        }
      }
    });

    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => CheckoutManager.showCheckoutPage());
    }

    // Back to shop button
    const backToShopBtn = document.getElementById('backToShopBtn');
    if (backToShopBtn) {
      backToShopBtn.addEventListener('click', () => CheckoutManager.hideCheckoutPage());
    }

    // Order type change (show/hide delivery address)
    const orderType = document.getElementById('orderType');
    if (orderType) {
      orderType.addEventListener('change', (e) => {
        const deliveryGroup = document.getElementById('deliveryAddressGroup');
        if (deliveryGroup) {
          deliveryGroup.style.display = e.target.value === 'delivery' ? 'block' : 'none';
        }
      });
    }

    // Checkout form submit
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => CheckoutManager.submitOrder(e));
    }

    // Continue shopping button
    const continueShoppingBtn = document.getElementById('continueShoppingBtn');
    if (continueShoppingBtn) {
      continueShoppingBtn.addEventListener('click', () => CheckoutManager.hideOrderSuccess());
    }

    // Order history button
    const orderHistoryBtn = document.getElementById('orderHistoryBtn');
    if (orderHistoryBtn) {
      orderHistoryBtn.addEventListener('click', () => OrderHistoryManager.showOrderHistory());
    }

    // Back from history button
    const backFromHistoryBtn = document.getElementById('backFromHistoryBtn');
    if (backFromHistoryBtn) {
      backFromHistoryBtn.addEventListener('click', () => OrderHistoryManager.hideOrderHistory());
    }
    
    // Review form
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
      reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const t = translations[currentLang] || translations['en'];
        
        const reviewData = {
          customerName: document.getElementById('reviewName').value,
          rating: parseInt(document.getElementById('reviewRating').value),
          comment: document.getElementById('reviewComment').value
        };
        
        if (!reviewData.customerName || !reviewData.rating || !reviewData.comment) {
          this.showNotification(t.notification_fill_fields, 'error');
          return;
        }
        
        const result = await CoffeeHouseAPI.submitReview(reviewData);
        
        if (result.success) {
          this.showNotification(t.notification_review_success);
          reviewForm.reset();
          await this.loadReviews();
        } else {
          this.showNotification(t.notification_review_error, 'error');
        }
      });
    }
  }
}

// ============================================
// Back to Top Button
// ============================================
const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
  if (backToTop) {
    backToTop.style.display = window.scrollY > 300 ? "block" : "none";
  }
});

if (backToTop) {
backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
}

// ============================================
// Translation System
// ============================================
const langToggle = document.getElementById('langToggle');
const elements = document.querySelectorAll('[data-key]');

const translations = {
    'en': {
        'title': 'Arabic Coffee',
        'nav_home': 'Home',
        'nav_coffee': 'Coffee',
        'nav_dessert': 'Dessert',
        'nav_location': 'Location',
        'nav_about': 'About',
        'hero_welcome': 'Welcome',
        'hero_slogan': 'Your perfect cup of coffee, every time',
        'hero_button': 'View Menu',
        'menu_coffee_title': 'Coffee Menu',
        'menu_dessert_title': 'Desserts',
        'add_to_cart': 'Add to Cart',
        'location_title': 'Visit Us',
        'location_hours_name': 'Opening Hours',
        'location_hours_1': 'Sunday - Thursday: 7:00 AM - 11:00 PM',
        'location_hours_2': 'Friday - Saturday: 8:00 AM - 12:00 AM',
        'location_location_name': 'Location',
        'location_location_1': 'Krasnoyarsk, Center',
        'location_location_2': 'Mira 96, 2nd floor',
        'reviews_title': 'Happy Customers',
        'about_title': 'About Us',
        'about_text': 'We serve the best coffee made with love and passion. Visit us to experience the aroma and taste of freshly brewed coffee.',
        'footer_text': '© 2025 Coffee House | All Rights Reserved',
        // Cart translations
        'cart_title': 'Your Cart',
        'cart_total': 'Total:',
        'cart_checkout': 'Proceed to Checkout',
        'cart_empty': 'Your cart is empty',
        // Checkout translations
        'checkout_back': 'Back to Menu',
        'checkout_title': 'Checkout',
        'checkout_summary': 'Order Summary',
        'checkout_subtotal': 'Subtotal:',
        'checkout_total': 'Total:',
        'checkout_your_info': 'Your Information',
        'checkout_name': 'Full Name *',
        'checkout_name_placeholder': 'Enter your name',
        'checkout_phone': 'Phone Number *',
        'checkout_email': 'Email (Optional)',
        'checkout_email_placeholder': 'your@email.com',
        'checkout_order_type': 'Order Type *',
        'checkout_pickup': '🏪 Pickup (In-store)',
        'checkout_delivery': '🚗 Delivery',
        'checkout_address': 'Delivery Address *',
        'checkout_address_placeholder': 'Enter your full delivery address',
        'checkout_instructions': 'Special Instructions (Optional)',
        'checkout_instructions_placeholder': 'Any special requests or notes...',
        'checkout_payment': 'Payment Method *',
        'checkout_cash': '💵 Cash on Pickup/Delivery',
        'checkout_card': '💳 Card on Pickup/Delivery',
        'checkout_place_order': 'Place Order',
        'checkout_qty': 'Qty:',
        // Success modal
        'success_title': 'Order Placed Successfully!',
        'success_thanks': 'Thank you for your order.',
        'success_order_num': 'Order #:',
        'success_message': 'We will prepare your order shortly.',
        'success_continue': 'Continue Shopping',
        // Order history
        'history_back': 'Back',
        'history_title': 'Order History',
        'history_no_orders': 'No orders yet',
        'history_no_orders_msg': 'Your order history will appear here after you place an order.',
        'history_order': 'Order #',
        'history_total': 'Total:',
        'history_delivery': 'Delivery',
        'history_pickup': 'Pickup',
        'history_delete_confirm': 'Are you sure you want to delete this order?',
        // Review section
        'review_add_title': 'Add Your Review',
        'review_name_placeholder': 'Your Name',
        'review_select_rating': 'Select Rating',
        'review_comment_placeholder': 'Your Review',
        'review_submit': 'Submit Review',
        // Notifications
        'notification_added': 'added to cart!',
        'notification_cart_empty': 'Your cart is empty',
        'notification_fill_fields': 'Please fill all fields',
        'notification_review_success': 'Review submitted successfully!',
        'notification_review_error': 'Error submitting review',
    },
    'ru': {
        'title': 'Арабский кофе',
        'nav_home': 'Главная',
        'nav_coffee': 'Кофе',
        'nav_dessert': 'Десерты',
        'nav_location': 'Адрес',
        'nav_about': 'О нас',
        'hero_welcome': 'Добро пожаловать',
        'hero_slogan': 'Ваша идеальная чашка кофе, каждый раз',
        'hero_button': 'Посмотреть меню',
        'menu_coffee_title': 'Меню кофе',
        'menu_dessert_title': 'Десерты',
        'add_to_cart': 'В корзину',
        'location_title': 'Посетите нас',
        'location_hours_name': 'Часы работы',
        'location_hours_1': 'Воскресенье - Четверг: 7:00 - 23:00',
        'location_hours_2': 'Пятница - Суббота: 8:00 - 00:00',
        'location_location_name': 'Адрес',
        'location_location_1': 'Красноярск, Центр',
        'location_location_2': 'Мира 96, 2 этаж',
        'reviews_title': 'Отзывы клиентов',
        'about_title': 'О нас',
        'about_text': 'Мы подаём лучший кофе, приготовленный с любовью и страстью. Посетите нас, чтобы ощутить аромат и вкус свежесваренного кофе.',
        'footer_text': '© 2025 Coffee House | Все права защищены',
        // Cart translations
        'cart_title': 'Ваша корзина',
        'cart_total': 'Итого:',
        'cart_checkout': 'Оформить заказ',
        'cart_empty': 'Ваша корзина пуста',
        // Checkout translations
        'checkout_back': 'Назад к меню',
        'checkout_title': 'Оформление заказа',
        'checkout_summary': 'Ваш заказ',
        'checkout_subtotal': 'Подытог:',
        'checkout_total': 'Итого:',
        'checkout_your_info': 'Ваши данные',
        'checkout_name': 'Полное имя *',
        'checkout_name_placeholder': 'Введите ваше имя',
        'checkout_phone': 'Номер телефона *',
        'checkout_email': 'Email (необязательно)',
        'checkout_email_placeholder': 'ваш@email.com',
        'checkout_order_type': 'Тип заказа *',
        'checkout_pickup': '🏪 Самовывоз',
        'checkout_delivery': '🚗 Доставка',
        'checkout_address': 'Адрес доставки *',
        'checkout_address_placeholder': 'Введите полный адрес доставки',
        'checkout_instructions': 'Особые пожелания (необязательно)',
        'checkout_instructions_placeholder': 'Любые особые пожелания или примечания...',
        'checkout_payment': 'Способ оплаты *',
        'checkout_cash': '💵 Наличными при получении',
        'checkout_card': '💳 Картой при получении',
        'checkout_place_order': 'Оформить заказ',
        'checkout_qty': 'Кол-во:',
        // Success modal
        'success_title': 'Заказ успешно оформлен!',
        'success_thanks': 'Спасибо за ваш заказ.',
        'success_order_num': 'Заказ №:',
        'success_message': 'Мы скоро приготовим ваш заказ.',
        'success_continue': 'Продолжить покупки',
        // Order history
        'history_back': 'Назад',
        'history_title': 'История заказов',
        'history_no_orders': 'Заказов пока нет',
        'history_no_orders_msg': 'Ваша история заказов появится здесь после оформления заказа.',
        'history_order': 'Заказ №',
        'history_total': 'Итого:',
        'history_delivery': 'Доставка',
        'history_pickup': 'Самовывоз',
        'history_delete_confirm': 'Вы уверены, что хотите удалить этот заказ?',
        // Review section
        'review_add_title': 'Оставить отзыв',
        'review_name_placeholder': 'Ваше имя',
        'review_select_rating': 'Выберите оценку',
        'review_comment_placeholder': 'Ваш отзыв',
        'review_submit': 'Отправить отзыв',
        // Notifications
        'notification_added': 'добавлен в корзину!',
        'notification_cart_empty': 'Ваша корзина пуста',
        'notification_fill_fields': 'Пожалуйста, заполните все поля',
        'notification_review_success': 'Отзыв успешно отправлен!',
        'notification_review_error': 'Ошибка при отправке отзыва',
    }
};

const panelTranslations = {
  en: {
    customer: '👤 Customer',
    admin: '🔐 Admin',
    welcome: 'Welcome!',
    userSubtitle: 'Enter your username to continue',
    adminTitle: 'Admin Login',
    adminSubtitle: 'Enter admin credentials',
    username: 'Username',
    password: 'Password',
    loginRegister: 'Login / Register',
    loginAdmin: 'Login as Admin',
    adminPanel: '⚙️ Admin Panel',
    tabProducts: 'Products',
    tabAdd: 'Add Product',
    tabOrders: 'Orders',
    allCategories: 'All Categories',
    coffee: 'Coffee',
    dessert: 'Dessert',
    other: 'Other',
    refresh: '🔄 Refresh',
    setDessertStock: 'Set stock for all desserts',
    updateAllDesserts: '📦 Update All Desserts',
    allStatuses: 'All Statuses',
    addNewProduct: 'Add New Product',
    nameEn: 'Name (English) *',
    nameRu: 'Name (Russian)',
    descEn: 'Description (EN)',
    descRu: 'Description (RU)',
    category: 'Category *',
    price: 'Price (RUB) *',
    imageUrl: 'Image URL',
    stock: 'Stock',
    featured: 'Featured product',
    addProduct: '➕ Add Product',
    saveChanges: '💾 Save Changes',
    edit: '✏️ Edit',
    delete: '🗑️ Delete',
    stockLabel: '📦 Stock',
    forgotPassword: 'Forgot password?',
    recoveryEmail: 'Recovery email',
    forgotSendIntro: 'A verification code will be sent to:',
    sendCode: 'Send code',
    codeSentTo: 'A code was sent to',
    verifyCode: 'Verification code',
    forgotContinue: 'Continue',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    saveNewPassword: 'Save new password',
    backToLogin: 'Back to login',
    passwordsMismatch: 'Passwords do not match',
    openTestInbox: 'Open test inbox (read code here)'
  },
  ru: {
    customer: '👤 Клиент',
    admin: '🔐 Админ',
    welcome: 'Добро пожаловать!',
    userSubtitle: 'Введите имя пользователя для входа',
    adminTitle: 'Вход администратора',
    adminSubtitle: 'Введите данные администратора',
    username: 'Имя пользователя',
    password: 'Пароль',
    loginRegister: 'Войти / Регистрация',
    loginAdmin: 'Войти как админ',
    adminPanel: '⚙️ Панель администратора',
    tabProducts: 'Товары',
    tabAdd: 'Добавить товар',
    tabOrders: 'Заказы',
    allCategories: 'Все категории',
    coffee: 'Кофе',
    dessert: 'Десерт',
    other: 'Другое',
    refresh: '🔄 Обновить',
    setDessertStock: 'Установить остаток для всех десертов',
    updateAllDesserts: '📦 Обновить все десерты',
    allStatuses: 'Все статусы',
    addNewProduct: 'Добавить новый товар',
    nameEn: 'Название (Английский) *',
    nameRu: 'Название (Русский)',
    descEn: 'Описание (EN)',
    descRu: 'Описание (RU)',
    category: 'Категория *',
    price: 'Цена (RUB) *',
    imageUrl: 'Ссылка на изображение',
    stock: 'Остаток',
    featured: 'Рекомендуемый товар',
    addProduct: '➕ Добавить товар',
    saveChanges: '💾 Сохранить',
    edit: '✏️ Изменить',
    delete: '🗑️ Удалить',
    stockLabel: '📦 Остаток',
    forgotPassword: 'Забыли пароль?',
    recoveryEmail: 'Email для восстановления',
    forgotSendIntro: 'Код подтверждения будет отправлен на:',
    sendCode: 'Отправить код',
    codeSentTo: 'Код отправлен на',
    verifyCode: 'Код из письма',
    forgotContinue: 'Продолжить',
    newPassword: 'Новый пароль',
    confirmPassword: 'Подтвердите пароль',
    saveNewPassword: 'Сохранить пароль',
    backToLogin: 'Назад ко входу',
    passwordsMismatch: 'Пароли не совпадают',
    openTestInbox: 'Открыть тестовый ящик (код в письме)'
  }
};

function applyPanelTranslations(language) {
  const t = panelTranslations[language] || panelTranslations.en;

  const setText = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  };
  const setPlaceholder = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.placeholder = text;
  };

  setText('#tabUser', t.customer);
  setText('#tabAdmin', t.admin);
  setText('#userLoginForm .modal-title', t.welcome);
  setText('#userLoginForm .modal-subtitle', t.userSubtitle);
  setText('#adminLoginForm .modal-title', t.adminTitle);
  setText('#adminLoginForm .modal-subtitle', t.adminSubtitle);
  setText('#userLoginForm .form-group label', t.username);
  setText('#adminLoginFields .form-group:nth-of-type(1) label', t.username);
  setText('#adminLoginFields .form-group:nth-of-type(2) label', t.password);
  setText('#adminForgotLink', t.forgotPassword);
  setText('#adminRecoveryEmailLabel', t.recoveryEmail);
  const intro = document.getElementById('adminForgotSendText');
  if (intro) {
    const em = document.getElementById('adminRecoveryEmail')?.value || 'ha6456278@gmail.com';
    intro.textContent = `${t.forgotSendIntro} ${em}`;
  }
  setText('#adminForgotSendBtn', t.sendCode);
  setText('#adminForgotCodeLabel', t.verifyCode);
  setText('#adminForgotVerifyBtn', t.forgotContinue);
  setText('#adminForgotNewPwLabel', t.newPassword);
  setText('#adminForgotNewPw2Label', t.confirmPassword);
  setText('#adminForgotSavePwBtn', t.saveNewPassword);
  setText('#adminForgotBack', t.backToLogin);
  setText('#userLoginSubmit', t.loginRegister);
  setText('#adminLoginSubmit', t.loginAdmin);
  setText('.admin-panel-header h2', t.adminPanel);
  setText('.admin-tab[data-tab="products"]', t.tabProducts);
  setText('.admin-tab[data-tab="add"]', t.tabAdd);
  setText('.admin-tab[data-tab="orders"]', t.tabOrders);
  setText('#adminCategoryFilter option[value=""]', t.allCategories);
  setText('#adminCategoryFilter option[value="coffee"]', t.coffee);
  setText('#adminCategoryFilter option[value="dessert"]', t.dessert);
  setText('#adminCategoryFilter option[value="other"]', t.other);
  setText('#adminRefreshProducts', t.refresh);
  setPlaceholder('#bulkDessertStock', t.setDessertStock);
  setText('#bulkDessertStockBtn', t.updateAllDesserts);
  setText('#adminOrderFilter option[value=""]', t.allStatuses);
  setText('#adminTab-add h3', t.addNewProduct);
  setText('#addProductBtn', t.addProduct);
  setText('#editProductSave', t.saveChanges);
  setText('#adminTab-add label[for="apNameEn"], #adminTab-add .admin-form-grid .form-group:nth-of-type(1) label', t.nameEn);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(2) label', t.nameRu);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(3) label', t.descEn);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(4) label', t.descRu);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(5) label', t.category);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(6) label', t.price);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(7) label', t.imageUrl);
  setText('#adminTab-add .admin-form-grid .form-group:nth-of-type(8) label', t.stock);
  setText('#apFeaturedLabel', t.featured);
  setPlaceholder('#userUsername', language === 'ru' ? 'например, ivan' : 'e.g. john_doe');
  setPlaceholder('#adminUsername', language === 'ru' ? 'админ' : 'admin');
}

function translate(language) {
    if (!translations[language]) return;

    // Re-query elements to include any dynamically added ones
    const allElements = document.querySelectorAll('[data-key]');
    allElements.forEach(element => {
        const key = element.getAttribute('data-key');
        if (translations[language][key]) {
            element.textContent = translations[language][key];
        }
    });
    
    // Handle placeholders
    const placeholderElements = document.querySelectorAll('[data-placeholder-key]');
    placeholderElements.forEach(element => {
        const key = element.getAttribute('data-placeholder-key');
        if (translations[language][key]) {
            element.placeholder = translations[language][key];
        }
    });
    
    document.documentElement.lang = language;
    if (langToggle) langToggle.textContent = language.toUpperCase();
    
    // Update cart UI with translations
    CartManager.updateCartUI();
    applyPanelTranslations(language);
}

async function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ru' : 'en';
  localStorage.setItem('lang', currentLang);
  translate(currentLang);
  
  // Re-fetch products with new language
  products = await CoffeeHouseAPI.fetchProducts();
  UIManager.renderProducts();
  
  // Update checkout summary if visible
  const checkoutPage = document.getElementById('checkoutPage');
  if (checkoutPage && checkoutPage.classList.contains('show')) {
    CheckoutManager.updateCheckoutSummary();
  }
  
  // Update order history if visible
  const historyPage = document.getElementById('orderHistoryPage');
  if (historyPage && historyPage.classList.contains('show')) {
    OrderHistoryManager.renderOrders();
  }
}

if (langToggle) langToggle.addEventListener('click', toggleLanguage);

// ============================================
// Dark Mode
// ============================================
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

if (darkModeToggle) {
const icon = darkModeToggle.querySelector('i');

  if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    icon?.classList.replace('fa-moon', 'fa-sun');
}

  darkModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');

    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
      icon?.classList.replace('fa-moon', 'fa-sun');
    } else {
        localStorage.setItem('theme', 'light');
      icon?.classList.replace('fa-sun', 'fa-moon');
    }
  });
}

// ============================================
// Initialize
// ============================================
translate(currentLang);

document.addEventListener('DOMContentLoaded', () => {
    UIManager.initialize();
});

// ============================================================
// ADMIN FORGOT PASSWORD (must load before AuthManager.syncModalState)
// ============================================================
function setAdminForgotOfferVisible(visible) {
  const el = document.getElementById('adminForgotWrap');
  if (!el) return;
  el.style.display = visible ? '' : 'none';
  el.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

const AdminForgotManager = {
  _resetToken: null,
  _active: false,

  isActive() {
    return this._active;
  },

  getRecoveryEmail() {
    const el = document.getElementById('adminRecoveryEmail');
    return (el?.value || 'ha6456278@gmail.com').trim().toLowerCase();
  },

  _t() {
    return panelTranslations[currentLang] || panelTranslations.en;
  },

  _showForgotStep(step) {
    const send = document.getElementById('adminForgotStepSend');
    const code = document.getElementById('adminForgotStepCode');
    const npw = document.getElementById('adminForgotStepNewPw');
    if (send) send.style.display = step === 'send' ? '' : 'none';
    if (code) code.style.display = step === 'code' ? '' : 'none';
    if (npw) npw.style.display = step === 'newpw' ? '' : 'none';
  },

  reset() {
    this._resetToken = null;
    this._active = false;
    const flow = document.getElementById('adminForgotFlow');
    const fields = document.getElementById('adminLoginFields');
    if (flow) {
      flow.style.display = 'none';
      this._showForgotStep('send');
    }
    if (fields) fields.style.display = '';
    ['adminForgotCode', 'adminForgotNewPw', 'adminForgotNewPw2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const pwErr = document.getElementById('adminForgotPwError');
    if (pwErr) pwErr.textContent = '';
    setAdminForgotOfferVisible(false);
  },

  open() {
    this._resetToken = null;
    this._active = true;
    const fields = document.getElementById('adminLoginFields');
    const flow = document.getElementById('adminForgotFlow');
    const err = document.getElementById('adminLoginError');
    if (err) err.textContent = '';
    if (fields) fields.style.display = 'none';
    if (flow) {
      flow.style.display = '';
      this._showForgotStep('send');
    }
    const hint = document.getElementById('adminForgotCodeHint');
    if (hint) hint.textContent = '';
  },

  async sendCode() {
    const email = this.getRecoveryEmail();
    const btn = document.getElementById('adminForgotSendBtn');
    if (btn) { btn.disabled = true; }
    try {
      const data = await AuthManager.requestAdminPasswordReset(email);
      const t = this._t();
      if (data.success) {
        const msg = data.message || `${t.codeSentTo} ${email}`;
        UIManager.showNotification(msg);
        const hint = document.getElementById('adminForgotCodeHint');
        if (hint) {
          hint.textContent = '';
          hint.appendChild(document.createTextNode(msg));
          if (data.devInboxUrl) {
            hint.appendChild(document.createTextNode(' '));
            const a = document.createElement('a');
            a.href = data.devInboxUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = t.openTestInbox;
            hint.appendChild(a);
          }
        }
        this._showForgotStep('code');
      } else {
        UIManager.showNotification(data.error || 'Failed to send code', 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; }
    }
  },

  async verifyCode() {
    const email = this.getRecoveryEmail();
    const code = document.getElementById('adminForgotCode')?.value.trim() || '';
    if (!code) {
      UIManager.showNotification('Enter the verification code', 'error');
      return;
    }
    const btn = document.getElementById('adminForgotVerifyBtn');
    if (btn) btn.disabled = true;
    try {
      const data = await AuthManager.verifyAdminResetCode(email, code);
      if (data.success) {
        this._resetToken = data.resetToken;
        const pwErr = document.getElementById('adminForgotPwError');
        if (pwErr) pwErr.textContent = '';
        this._showForgotStep('newpw');
        if (data.message) UIManager.showNotification(data.message);
      } else {
        UIManager.showNotification(data.error || 'Invalid code', 'error');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async saveNewPassword() {
    const p1 = document.getElementById('adminForgotNewPw')?.value || '';
    const p2 = document.getElementById('adminForgotNewPw2')?.value || '';
    const errEl = document.getElementById('adminForgotPwError');
    const t = this._t();
    if (errEl) errEl.textContent = '';
    if (p1 !== p2) {
      if (errEl) errEl.textContent = t.passwordsMismatch;
      return;
    }
    const btn = document.getElementById('adminForgotSavePwBtn');
    if (btn) btn.disabled = true;
    try {
      const data = await AuthManager.completeAdminPasswordReset(this._resetToken, p1);
      if (data.success) {
        UIManager.showNotification(data.message || 'Password updated. Log in with your new password.');
        this.reset();
        AuthManager.syncModalState();
      } else {
        if (errEl) errEl.textContent = data.error || 'Could not update password';
        UIManager.showNotification(data.error || 'Could not update password', 'error');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};

// ============================================================
// AUTH MANAGER
// ============================================================
class AuthManager {
  static getToken()    { return localStorage.getItem('ch_token'); }
  static getRole()     { return localStorage.getItem('ch_role'); }
  static getUsername() { return localStorage.getItem('ch_username'); }

  static isLoggedIn()  { return !!this.getToken(); }
  static isAdmin()     { return this.getRole() === 'admin'; }

  static save(token, role, username) {
    localStorage.setItem('ch_token', token);
    localStorage.setItem('ch_role', role);
    localStorage.setItem('ch_username', username);
  }

  static clear() {
    localStorage.removeItem('ch_token');
    localStorage.removeItem('ch_role');
    localStorage.removeItem('ch_username');
  }

  static authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` };
  }

  // ── User login (username only) ──────────────────────────────
  static async loginUser(username) {
    const res  = await fetch(`${API_BASE_URL}/auth/user-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    return res.json();
  }

  // ── Admin login ─────────────────────────────────────────────
  static async loginAdmin(username, password) {
    const res = await fetch(`${API_BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  }

  static async requestAdminPasswordReset(email) {
    const res = await fetch(`${API_BASE_URL}/auth/admin-request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  }

  static async verifyAdminResetCode(email, code) {
    const res = await fetch(`${API_BASE_URL}/auth/admin-verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    return res.json();
  }

  static async completeAdminPasswordReset(resetToken, newPassword) {
    const res = await fetch(`${API_BASE_URL}/auth/admin-complete-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword })
    });
    return res.json();
  }

  // ── Logout ──────────────────────────────────────────────────
  static async logout() {
    if (this.getToken()) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: this.authHeaders()
      }).catch(() => {});
    }
    this.clear();
    this.updateHeaderUI();
  }

  // ── Update header buttons ────────────────────────────────────
  static updateHeaderUI() {
    const loginBtn      = document.getElementById('loginBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    if (this.isLoggedIn()) {
      const icon = this.isAdmin() ? '🔐' : '👤';
      if (loginBtn) loginBtn.title = `${icon} ${this.getUsername()} (click to manage)`;
      if (adminPanelBtn) adminPanelBtn.style.display = this.isAdmin() ? 'inline-flex' : 'none';
    } else {
      if (loginBtn) loginBtn.title = 'Login';
      if (adminPanelBtn) adminPanelBtn.style.display = 'none';
    }
  }

  // ── Sync modal state with stored session ─────────────────────
  static syncModalState() {
    const isUser  = this.isLoggedIn() && !this.isAdmin();
    const isAdmin = this.isAdmin();

    const userForm       = document.getElementById('userLoginForm');
    const userInputBlock = userForm?.querySelector('.form-group');
    const userBtn        = document.getElementById('userLoginSubmit');
    const userInfo       = document.getElementById('userLoggedInInfo');
    const loggedUserName = document.getElementById('loggedUserName');

    if (isUser && userInputBlock && userInfo) {
      userInputBlock.style.display = 'none';
      if (userBtn) userBtn.style.display = 'none';
      userInfo.style.display = 'block';
      if (loggedUserName) loggedUserName.textContent = this.getUsername();
    } else if (userInputBlock) {
      userInputBlock.style.display = '';
      if (userBtn) userBtn.style.display = '';
      if (userInfo) userInfo.style.display = 'none';
    }

    const adminLoginFields = document.getElementById('adminLoginFields');
    const adminForgotFlow = document.getElementById('adminForgotFlow');
    const adminBtn         = document.getElementById('adminLoginSubmit');
    const adminInfo        = document.getElementById('adminLoggedInInfo');
    const loggedAdminName  = document.getElementById('loggedAdminName');

    if (isAdmin && adminInfo) {
      AdminForgotManager.reset();
      if (adminLoginFields) adminLoginFields.style.display = 'none';
      if (adminForgotFlow) adminForgotFlow.style.display = 'none';
      adminInfo.style.display = 'block';
      if (loggedAdminName) loggedAdminName.textContent = this.getUsername();
    } else {
      if (adminInfo) adminInfo.style.display = 'none';
      if (AdminForgotManager.isActive()) {
        if (adminLoginFields) adminLoginFields.style.display = 'none';
        if (adminForgotFlow) adminForgotFlow.style.display = '';
      } else {
        if (adminLoginFields) adminLoginFields.style.display = '';
        if (adminForgotFlow) adminForgotFlow.style.display = 'none';
        setAdminForgotOfferVisible(false);
      }
      if (adminBtn) adminBtn.style.display = '';
    }
  }
}

// ============================================================
// ADMIN PANEL MANAGER
// ============================================================
class AdminPanelManager {
  // ── Open / close ─────────────────────────────────────────────
  static open() {
    document.getElementById('adminPanel')?.classList.add('show');
    this.loadProducts();
  }
  static close() {
    document.getElementById('adminPanel')?.classList.remove('show');
  }

  // ── Tab switching ─────────────────────────────────────────────
  static switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`adminTab-${tabName}`)?.classList.add('active');
    if (tabName === 'products') this.loadProducts();
    if (tabName === 'orders')   this.loadOrders();
  }

  // ── Load products ─────────────────────────────────────────────
  static async loadProducts() {
    const container = document.getElementById('adminProductsList');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    const category = document.getElementById('adminCategoryFilter')?.value || '';
    const url = `${API_BASE_URL}/products${category ? `?category=${category}` : ''}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      container.innerHTML = '<p>No products found.</p>';
      return;
    }

    container.innerHTML = data.data.map(p => `
      <div class="admin-product-row" id="aprow-${p.id}">
        <img src="${p.image}" alt="${p.name}" class="admin-thumb">
        <div class="admin-product-info">
          <strong>${p.name}</strong>
          <span class="admin-category-badge ${p.category}">${p.category}</span>
          <span class="admin-price">${p.price} RUB</span>
          ${p.category === 'dessert' ? `<span class="admin-stock ${p.stock === 0 ? 'out' : ''}">${(panelTranslations[currentLang] || panelTranslations.en).stockLabel}: ${Math.max(0, p.stock ?? 0)}</span>` : ''}
          ${!p.available ? '<span class="admin-unavailable">⚠️ Unavailable</span>' : ''}
        </div>
        <div class="admin-product-actions">
          <button class="btn btn-sm btn-edit" onclick="AdminPanelManager.openEditModal('${p.id}', ${JSON.stringify(p).replace(/"/g, '&quot;')})">${(panelTranslations[currentLang] || panelTranslations.en).edit}</button>
          <button class="btn btn-sm btn-delete" onclick="AdminPanelManager.deleteProduct('${p.id}', '${p.name}')">${(panelTranslations[currentLang] || panelTranslations.en).delete}</button>
        </div>
      </div>
    `).join('');
  }

  // ── Delete product ────────────────────────────────────────────
  static async deleteProduct(id, name) {
    if (!AuthManager.isAdmin()) {
      UIManager.showNotification('Admin login required', 'error');
      return;
    }
    if (!confirm(`Delete "${name}"?`)) return;
    const res  = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
      headers: AuthManager.authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      UIManager.showNotification(`"${name}" deleted`);
      this.loadProducts();
      products = await CoffeeHouseAPI.fetchProducts();
      UIManager.renderProducts();
    } else {
      UIManager.showNotification(data.error || 'Error deleting product', 'error');
    }
  }

  // ── Open edit modal ───────────────────────────────────────────
  static openEditModal(id, product) {
    document.getElementById('editProductId').value  = id;
    document.getElementById('editNameEn').value     = product.name || '';
    document.getElementById('editNameRu').value     = '';
    document.getElementById('editPrice').value      = product.price || '';
    document.getElementById('editStock').value      = Math.max(0, product.stock ?? 0);
    document.getElementById('editAvailable').value  = product.available ? 'true' : 'false';
    document.getElementById('editFeatured').value   = product.featured ? 'true' : 'false';
    document.getElementById('editProductError').textContent = '';
    document.getElementById('editProductModal')?.classList.add('show');
  }

  // ── Save edit ─────────────────────────────────────────────────
  static async saveEdit() {
    if (!AuthManager.isAdmin()) {
      UIManager.showNotification('Admin login required', 'error');
      return;
    }
    const id = document.getElementById('editProductId').value;
    const stockRaw = document.getElementById('editStock').value;
    const parsedStock = Number.parseInt(stockRaw, 10);
    const body = {
      'name.en':    document.getElementById('editNameEn').value,
      price:        parseFloat(document.getElementById('editPrice').value),
      available:    document.getElementById('editAvailable').value === 'true',
      featured:     document.getElementById('editFeatured').value === 'true',
    };
    if (!Number.isNaN(parsedStock)) body.stock = parsedStock;
    const nameRu = document.getElementById('editNameRu').value.trim();
    if (nameRu) body['name.ru'] = nameRu;

    const res  = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: AuthManager.authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('editProductModal')?.classList.remove('show');
      UIManager.showNotification('Product updated!');
      this.loadProducts();
      products = await CoffeeHouseAPI.fetchProducts();
      UIManager.renderProducts();
    } else {
      document.getElementById('editProductError').textContent = data.error || data.message || 'Error saving';
      if (res.status === 401 || res.status === 403) {
        UIManager.showNotification('Session expired. Please login as admin again.', 'error');
      }
    }
  }

  // ── Add product ───────────────────────────────────────────────
  static async addProduct() {
    if (!AuthManager.isAdmin()) {
      UIManager.showNotification('Admin login required', 'error');
      return;
    }
    const stockRaw = document.getElementById('apStock').value;
    const parsedStock = Number.parseInt(stockRaw, 10);
    const errEl     = document.getElementById('addProductError');
    const successEl = document.getElementById('addProductSuccess');
    errEl.textContent     = '';
    successEl.textContent = '';

    const nameEn = document.getElementById('apNameEn').value.trim();
    const nameRu = document.getElementById('apNameRu').value.trim();
    const price  = parseFloat(document.getElementById('apPrice').value);
    const cat    = document.getElementById('apCategory').value;

    if (!nameEn || isNaN(price)) {
      errEl.textContent = 'Name (EN) and Price are required';
      return;
    }

    const descEnInput = document.getElementById('apDescEn').value.trim();
    const descRuInput = document.getElementById('apDescRu').value.trim();
    const isRussianMode = currentLang === 'ru';

    const localizedName = isRussianMode ? (nameRu || nameEn) : nameEn;
    const localizedDesc = isRussianMode ? (descRuInput || descEnInput) : descEnInput;

    const body = {
      // In Russian mode, save newly added products with Russian as primary text.
      name: isRussianMode
        ? { en: localizedName, ru: localizedName }
        : { en: nameEn, ru: nameRu || nameEn },
      description: {
        en: isRussianMode ? localizedDesc : descEnInput,
        ru: isRussianMode ? localizedDesc : descRuInput
      },
      category: cat,
      price,
      image:           document.getElementById('apImage').value.trim() || undefined,
      featured:        document.getElementById('apFeatured').checked
    };
    if (cat === 'dessert') {
      body.stock = Number.isNaN(parsedStock) ? 0 : Math.max(0, parsedStock);
    }

    const res  = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: AuthManager.authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      successEl.textContent = `✅ "${nameEn}" added successfully!`;
      ['apNameEn','apNameRu','apDescEn','apDescRu','apImage','apPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('apStock').value = '20';
      document.getElementById('apFeatured').checked = false;
      products = await CoffeeHouseAPI.fetchProducts();
      UIManager.renderProducts();
    } else {
      errEl.textContent = data.message || data.error || 'Error adding product';
      if (res.status === 401 || res.status === 403) {
        UIManager.showNotification('Session expired. Please login as admin again.', 'error');
      }
    }
  }

  static async updateAllDessertStock() {
    const stockInput = document.getElementById('bulkDessertStock');
    const parsedStock = Number.parseInt(stockInput?.value || '', 10);
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      UIManager.showNotification('Enter a valid dessert stock number', 'error');
      return;
    }

    const res = await fetch(`${API_BASE_URL}/products/desserts/stock`, {
      method: 'PATCH',
      headers: AuthManager.authHeaders(),
      body: JSON.stringify({ stock: parsedStock })
    });
    const data = await res.json();

    if (data.success) {
      UIManager.showNotification(`All desserts stock updated to ${parsedStock}`);
      await this.loadProducts();
      products = await CoffeeHouseAPI.fetchProducts();
      UIManager.renderProducts();
    } else {
      UIManager.showNotification(data.error || 'Error updating dessert stock', 'error');
    }
  }

  // ── Load orders ───────────────────────────────────────────────
  static async loadOrders() {
    const container = document.getElementById('adminOrdersList');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    const status = document.getElementById('adminOrderFilter')?.value || '';
    const url = `${API_BASE_URL}/orders${status ? `?status=${status}` : ''}`;
    const res  = await fetch(url, { headers: AuthManager.authHeaders() });
    const data = await res.json();

    if (!data.success || !data.data.length) {
      container.innerHTML = '<p>No orders found.</p>';
      return;
    }

    container.innerHTML = data.data.map(o => `
      <div class="admin-order-row">
        <div class="admin-order-header">
          <strong>#${o.orderNumber}</strong>
          <span class="admin-status-badge status-${o.status}">${o.status}</span>
          <span class="admin-order-total">${o.totalAmount} RUB</span>
          <span class="admin-order-date">${new Date(o.createdAt).toLocaleString()}</span>
        </div>
        <div class="admin-order-customer">
          👤 ${o.customer.name} &nbsp;📞 ${o.customer.phone}
        </div>
        <div class="admin-order-items">
          ${o.items.map(i => `<span class="admin-order-item">${i.quantity}× ${i.product?.name?.en || 'item'}</span>`).join('')}
        </div>
        <div class="admin-order-controls">
          <select onchange="AdminPanelManager.updateOrderStatus('${o._id}', this.value)" class="admin-status-select">
            ${['pending','confirmed','preparing','ready','completed','cancelled'].map(s =>
              `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
      </div>
    `).join('');
  }

  // ── Update order status ───────────────────────────────────────
  static async updateOrderStatus(id, status) {
    const res  = await fetch(`${API_BASE_URL}/orders/${id}/status`, {
      method: 'PUT',
      headers: AuthManager.authHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      UIManager.showNotification(`Order updated to: ${status}`);
    } else {
      UIManager.showNotification('Error updating order', 'error');
      this.loadOrders();
    }
  }
}

// Expose for inline onclick handlers in generated HTML rows.
window.AdminPanelManager = AdminPanelManager;

// ============================================================
// SETUP LOGIN & ADMIN MODAL EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  AuthManager.updateHeaderUI();

  // Open login modal
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    AuthManager.syncModalState();
    document.getElementById('loginModal')?.classList.add('show');
  });

  // Make login the first interaction for new visitors
  if (!AuthManager.isLoggedIn()) {
    document.getElementById('tabUser')?.click();
    document.getElementById('loginModal')?.classList.add('show');
  }

  // Close login modal
  document.getElementById('loginModalClose')?.addEventListener('click', () => {
    if (!AuthManager.isLoggedIn()) {
      document.getElementById('userLoginError').textContent = 'Please login to continue';
      return;
    }
    document.getElementById('loginModal')?.classList.remove('show');
  });
  document.getElementById('loginModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('loginModal') && AuthManager.isLoggedIn())
      document.getElementById('loginModal')?.classList.remove('show');
  });

  // Tab switching inside login modal
  document.getElementById('tabUser')?.addEventListener('click', () => {
    AdminForgotManager.reset();
    document.getElementById('tabUser').classList.add('active');
    document.getElementById('tabAdmin').classList.remove('active');
    document.getElementById('userLoginForm').style.display = '';
    document.getElementById('adminLoginForm').style.display = 'none';
    AuthManager.syncModalState();
  });
  document.getElementById('tabAdmin')?.addEventListener('click', () => {
    document.getElementById('tabAdmin').classList.add('active');
    document.getElementById('tabUser').classList.remove('active');
    document.getElementById('adminLoginForm').style.display = '';
    document.getElementById('userLoginForm').style.display = 'none';
    AuthManager.syncModalState();
  });

  document.getElementById('adminForgotLink')?.addEventListener('click', () => AdminForgotManager.open());
  document.getElementById('adminForgotSendBtn')?.addEventListener('click', () => AdminForgotManager.sendCode());
  document.getElementById('adminForgotVerifyBtn')?.addEventListener('click', () => AdminForgotManager.verifyCode());
  document.getElementById('adminForgotSavePwBtn')?.addEventListener('click', () => AdminForgotManager.saveNewPassword());
  document.getElementById('adminForgotBack')?.addEventListener('click', () => {
    AdminForgotManager.reset();
    AuthManager.syncModalState();
  });

  // User login submit
  document.getElementById('userLoginSubmit')?.addEventListener('click', async () => {
    const username = document.getElementById('userUsername').value.trim();
    const errEl    = document.getElementById('userLoginError');
    errEl.textContent = '';
    if (!username) { errEl.textContent = 'Please enter a username'; return; }
    const data = await AuthManager.loginUser(username);
    if (data.success) {
      AuthManager.save(data.token, 'user', data.username);
      AuthManager.updateHeaderUI();
      AuthManager.syncModalState();
      document.getElementById('loginModal')?.classList.remove('show');
      UIManager.showNotification(`Welcome, ${data.username}!`);
    } else {
      errEl.textContent = data.error || 'Login failed';
    }
  });

  // User logout
  document.getElementById('userLogoutBtn')?.addEventListener('click', async () => {
    await AuthManager.logout();
    AuthManager.syncModalState();
    UIManager.showNotification('Logged out');
  });

  // Admin login submit
  document.getElementById('adminLoginSubmit')?.addEventListener('click', async () => {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errEl    = document.getElementById('adminLoginError');
    errEl.textContent = '';
    if (!username || !password) {
      errEl.textContent = 'Enter username and password';
      setAdminForgotOfferVisible(false);
      return;
    }
    const data = await AuthManager.loginAdmin(username, password);
    if (data.success) {
      setAdminForgotOfferVisible(false);
      AuthManager.save(data.token, 'admin', data.username);
      AuthManager.updateHeaderUI();
      AuthManager.syncModalState();
      document.getElementById('loginModal')?.classList.remove('show');
      UIManager.showNotification(`Welcome, Admin ${data.username}!`);
    } else {
      errEl.textContent = data.error || 'Invalid credentials';
      setAdminForgotOfferVisible(true);
    }
  });

  // Admin logout
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await AuthManager.logout();
    AuthManager.updateHeaderUI();
    AuthManager.syncModalState();
    UIManager.showNotification('Admin logged out');
  });

  // Open admin panel
  document.getElementById('adminPanelBtn')?.addEventListener('click', () => {
    AdminPanelManager.open();
  });

  // Close admin panel
  document.getElementById('adminPanelClose')?.addEventListener('click', () => {
    AdminPanelManager.close();
  });
  document.getElementById('adminPanel')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('adminPanel'))
      AdminPanelManager.close();
  });

  // Admin panel tab switching
  document.querySelectorAll('.admin-tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => AdminPanelManager.switchTab(btn.dataset.tab));
  });

  // Refresh buttons
  document.getElementById('adminRefreshProducts')?.addEventListener('click', () => AdminPanelManager.loadProducts());
  document.getElementById('adminRefreshOrders')?.addEventListener('click', () => AdminPanelManager.loadOrders());

  // Category filter change
  document.getElementById('adminCategoryFilter')?.addEventListener('change', () => AdminPanelManager.loadProducts());

  // Order filter change
  document.getElementById('adminOrderFilter')?.addEventListener('change', () => AdminPanelManager.loadOrders());

  // Add product button
  document.getElementById('addProductBtn')?.addEventListener('click', () => AdminPanelManager.addProduct());
  document.getElementById('bulkDessertStockBtn')?.addEventListener('click', () => AdminPanelManager.updateAllDessertStock());

  // Edit product modal close
  document.getElementById('editModalClose')?.addEventListener('click', () => {
    document.getElementById('editProductModal')?.classList.remove('show');
  });
  document.getElementById('editProductModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('editProductModal'))
      document.getElementById('editProductModal')?.classList.remove('show');
  });

  // Edit product save
  document.getElementById('editProductSave')?.addEventListener('click', () => AdminPanelManager.saveEdit());

  // Stock input stays visible in Add Product form.
});
