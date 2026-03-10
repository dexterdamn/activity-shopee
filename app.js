// app.js — StudentMart Vue 3 Application
// Cart is stored per-user: each account has its own cart saved in localStorage.
// Guests cannot add to cart — they are prompted to log in first.

const { createApp, ref, computed, watch } = Vue;

// ===== localStorage HELPERS =====
const LS_USERS = 'studentmart_users';
const LS_USER  = 'studentmart_current_user';

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Per-user cart key — each user gets their own cart
function cartKey(email) {
  return `studentmart_cart_${email}`;
}

// ===== APP =====
createApp({
  setup() {

    // ── State ──────────────────────────────────────────────────────
    const categories       = ref(categoriesData);
    const products         = ref([]);

    // Load products from products.json
    fetch('products.json')
      .then(r => r.json())
      .then(data => { products.value = data; })
      .catch(err => console.error('Failed to load products.json:', err));
    const selectedCategoryId = ref('all');
    const searchQuery      = ref('');
    const searchResults    = ref(null);
    const sortBy           = ref('default');
    const viewMode         = ref('grid');
    const cartOpen         = ref(false);
    const authModalOpen    = ref(false);
    const authMode         = ref('login');
    const loginRequiredOpen = ref(false);
    const showToast        = ref(false);
    const toastMessage     = ref('');
    const toastType        = ref('success');
    const quickViewProduct = ref(null);

    const loginForm  = ref({ email: '', password: '' });
    const registerForm = ref({ name: '', email: '', password: '', confirmPassword: '' });
    const authError  = ref('');

    // Users list
    const users = ref(lsGet(LS_USERS) || []);

    // Current user (restored from localStorage)
    const currentUser = ref(lsGet(LS_USER) || null);

    // Cart — loaded from the CURRENT USER's personal cart slot.
    // Guests have an empty, non-persistent cart (not saved).
    const cart = ref(
      currentUser.value ? (lsGet(cartKey(currentUser.value.email)) || []) : []
    );

    const heroStats = [
      { emoji: '🎓', value: '200+', label: 'Student Sellers' },
      { emoji: '⭐', value: '4.9',  label: 'Avg Rating' },
      { emoji: '🛍️', value: '5K+',  label: 'Happy Buyers' },
    ];

    // ── Persistence watchers ───────────────────────────────────────
    watch(users,       val => lsSet(LS_USERS, val), { deep: true });
    watch(currentUser, val => lsSet(LS_USER,  val));

    // Save cart changes to the logged-in user's personal cart slot
    watch(cart, val => {
      if (currentUser.value) {
        lsSet(cartKey(currentUser.value.email), val);
      }
    }, { deep: true });

    // ── Computed ───────────────────────────────────────────────────
    const currentCategoryName = computed(() => {
      const cat = categories.value.find(c => c.id === selectedCategoryId.value);
      return cat ? cat.name : 'All Products';
    });

    const filteredProducts = computed(() => {
      let list = [...products.value];

      if (selectedCategoryId.value !== 'all') {
        list = list.filter(p => p.categoryId === selectedCategoryId.value);
      }

      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.shop && p.shop.toLowerCase().includes(q)) ||
          p.categoryId.toLowerCase().includes(q)
        );
      }

      switch (sortBy.value) {
        case 'price_asc':  list.sort((a, b) => a.price - b.price); break;
        case 'price_desc': list.sort((a, b) => b.price - a.price); break;
        case 'rating':     list.sort((a, b) => b.rating - a.rating); break;
        case 'sold':       list.sort((a, b) => (b.sold || 0) - (a.sold || 0)); break;
      }

      return list;
    });

    const cartCount = computed(() => cart.value.reduce((s, i) => s + i.quantity, 0));
    const cartTotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.quantity, 0));

    // ── Helpers ────────────────────────────────────────────────────
    function formatPrice(n) {
      return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 });
    }

    function showToastMsg(msg, type = 'success') {
      toastMessage.value = msg;
      toastType.value = type;
      showToast.value = true;
      setTimeout(() => showToast.value = false, 2800);
    }

    // ── Search / Filter ────────────────────────────────────────────
    function onSearch() {
      if (!searchQuery.value.trim()) return;
      selectedCategoryId.value = 'all';
      searchResults.value = searchQuery.value;
    }

    function resetFilters() {
      searchQuery.value = '';
      searchResults.value = null;
      selectedCategoryId.value = 'all';
      sortBy.value = 'default';
    }

    // ── Cart Actions ───────────────────────────────────────────────
    // Guard: require login before adding to cart
    function addToCart(product) {
      if (!currentUser.value) {
        loginRequiredOpen.value = true;
        return;
      }

      const existing = cart.value.find(i => i.productId === product.id);
      if (existing) {
        existing.quantity++;
        showToastMsg(`+1 more added!`, 'success');
      } else {
        cart.value.push({
          productId: product.id,
          name:      product.name,
          price:     product.price,
          image:     product.image,
          quantity:  1
        });
        showToastMsg(`Added to cart!`, 'success');
      }
    }

    function increaseQty(item) { item.quantity++; }

    function decreaseQty(item) {
      if (item.quantity > 1) { item.quantity--; }
      else { removeFromCart(item); }
    }

    function removeFromCart(item) {
      cart.value = cart.value.filter(i => i.productId !== item.productId);
      showToastMsg('Item removed from cart', 'info');
    }

    function clearCart() {
      cart.value = [];
      showToastMsg('Cart cleared');
    }

    function checkout() {
      if (!currentUser.value) {
        cartOpen.value = false;
        openAuthModal('login');
        showToastMsg('Please login to checkout', 'info');
        return;
      }
      showToastMsg('🎉 Order placed successfully!', 'success');
      cart.value = [];
      // Also clear from localStorage for this user
      lsSet(cartKey(currentUser.value.email), []);
      cartOpen.value = false;
    }

    function quickView(product) { quickViewProduct.value = product; }

    // ── Auth ───────────────────────────────────────────────────────
    function openAuthModal(mode) {
      authMode.value  = mode;
      authError.value = '';
      authModalOpen.value = true;
    }

    function closeAuthModal() {
      authModalOpen.value = false;
      authError.value = '';
      loginForm.value    = { email: '', password: '' };
      registerForm.value = { name: '', email: '', password: '', confirmPassword: '' };
    }

    function login() {
      authError.value = '';
      const user = users.value.find(u => u.email === loginForm.value.email);
      if (!user)                                { authError.value = 'No account found with this email.'; return; }
      if (user.password !== loginForm.value.password) { authError.value = 'Incorrect password.'; return; }

      currentUser.value = user;
      lsSet(LS_USER, user);

      // Load THIS user's personal cart from localStorage
      cart.value = lsGet(cartKey(user.email)) || [];

      closeAuthModal();
      showToastMsg(`Welcome back, ${user.name}! 👋`);
    }

    function register() {
      authError.value = '';
      if (registerForm.value.password.length < 6) {
        authError.value = 'Password must be at least 6 characters.'; return;
      }
      if (registerForm.value.password !== registerForm.value.confirmPassword) {
        authError.value = 'Passwords do not match.'; return;
      }
      if (users.value.find(u => u.email === registerForm.value.email)) {
        authError.value = 'Email already registered.'; return;
      }

      const newUser = {
        name:     registerForm.value.name,
        email:    registerForm.value.email,
        password: registerForm.value.password
      };
      users.value.push(newUser);
      lsSet(LS_USERS, users.value);

      currentUser.value = newUser;
      lsSet(LS_USER, newUser);

      // New user starts with an empty cart
      cart.value = [];
      lsSet(cartKey(newUser.email), []);

      closeAuthModal();
      showToastMsg(`Account created! Welcome, ${newUser.name}! 🎉`);
    }

    function logout() {
      // Save current cart to localStorage before logging out
      if (currentUser.value) {
        lsSet(cartKey(currentUser.value.email), cart.value);
      }

      currentUser.value = null;
      lsSet(LS_USER, null);

      // Clear in-memory cart so the next guest sees an empty cart
      cart.value = [];

      showToastMsg('Logged out successfully', 'info');
    }

    // ── Expose to template ─────────────────────────────────────────
    return {
      categories, products, selectedCategoryId, searchQuery, searchResults,
      sortBy, viewMode, cart, cartOpen, cartCount, cartTotal,
      authModalOpen, authMode, currentUser, showToast, toastMessage, toastType,
      loginForm, registerForm, authError, quickViewProduct, heroStats,
      loginRequiredOpen,
      currentCategoryName, filteredProducts,
      formatPrice, onSearch, resetFilters, addToCart, increaseQty, decreaseQty,
      removeFromCart, clearCart, checkout, quickView,
      openAuthModal, closeAuthModal, login, register, logout
    };
  }
}).mount('#app');