/**
 * Personify Demo Site — deliberately flawed e-commerce with UX anti-patterns:
 *
 * Flaw 1: Tiny, low-contrast "Proceed" button (9px font, cream on white)
 * Flaw 2: Confusing jargon — "Initiate SKU Acquirement Workflow" instead of "Buy Now"
 * Flaw 3: Email field with no label (only vague placeholder: "Enter requisite email datum")
 * Flaw 4: Password field hidden behind an unmarked icon button
 * Flaw 5: No error messages — form silently resets on invalid input
 * Flaw 6: "Proceed to Fulfilment Matrix" button on checkout (dead until email confirmed)
 * Flaw 7: Success page auto-redirects in 3s with no warning
 *
 * Routes:
 *   GET /           → Product page (landing)
 *   GET /signup     → Sign-up form
 *   POST /signup    → Validate, redirect to /checkout or back with error
 *   GET /checkout   → Checkout form
 *   POST /checkout  → Submit, redirect to /success
 *   GET /success    → Order confirmed
 */

import express from 'express';
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Shared HTML wrapper ──────────────────────────────────────────────────────

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ShopZone</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; min-height: 100vh; }

    /* Nav */
    nav { background: #1a1a2e; color: white; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
    nav a { color: #ccc; text-decoration: none; font-size: 14px; }
    nav .logo { font-size: 22px; font-weight: bold; color: white; margin-right: auto; }

    /* Container */
    .container { max-width: 900px; margin: 40px auto; padding: 0 20px; }

    /* Product card */
    .product-card { background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; gap: 32px; }
    .product-img { width: 220px; height: 220px; background: #e0e0e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #999; font-size: 13px; }
    .product-info h1 { font-size: 20px; margin-bottom: 8px; }
    .product-info .price { font-size: 28px; color: #c0392b; font-weight: bold; margin: 12px 0; }
    .product-info .desc { font-size: 13px; color: #666; line-height: 1.6; margin-bottom: 20px; }
    .product-info .rating { font-size: 13px; color: #888; margin-bottom: 20px; }

    /* === DELIBERATE UX FLAW 1 & 2: Tiny button + confusing jargon === */
    .btn-primary {
      display: inline-block;
      background: #6C63FF;
      color: white;
      padding: 12px 28px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: #5a52e0; }

    /* The real CTA is tiny and low-contrast */
    .btn-proceed {
      display: inline-block;
      background: #f8f8f6; /* cream on near-white — very low contrast */
      color: #ccc;
      padding: 4px 10px;
      border-radius: 3px;
      font-size: 9px; /* deliberately tiny */
      border: 1px solid #e8e8e8;
      cursor: pointer;
      text-decoration: none;
      margin-top: 8px;
    }

    /* === FLAW 6: Disabled-looking button that is actually the checkout CTA === */
    .btn-fulfilment {
      background: #bdc3c7;
      color: #7f8c8d;
      padding: 14px 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 12px;
      width: 100%;
    }

    /* Form styles */
    .form-card { background: white; border-radius: 8px; padding: 40px; max-width: 480px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .form-card h2 { font-size: 22px; margin-bottom: 24px; }

    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #555; }

    /* === FLAW 3: Email field with deliberately vague placeholder, no label === */
    .input-no-label { display: block; width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .input-no-label::placeholder { color: #bbb; }

    input[type="text"], input[type="email"], input[type="password"], select {
      display: block; width: 100%; padding: 10px 12px;
      border: 1px solid #ddd; border-radius: 4px; font-size: 14px;
    }
    input:focus, select:focus { outline: 2px solid #6C63FF; border-color: #6C63FF; }

    /* === FLAW 4: Password field hidden behind unmarked icon === */
    .password-wrapper { position: relative; }
    .password-wrapper input { padding-right: 36px; }
    .password-toggle {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      font-size: 18px; color: #999; width: 28px; height: 28px;
      /* No title/aria-label — deliberately inaccessible */
    }

    /* === FLAW 5: Error area hidden === */
    .error-msg { display: none; color: #e74c3c; font-size: 12px; margin-top: 4px; }

    .form-submit { margin-top: 24px; }
    .form-submit button { width: 100%; }

    /* Required asterisk that looks decorative */
    .req { color: #ccc; font-weight: normal; font-size: 11px; } /* should be red */

    /* Jargon tooltip */
    .jargon { border-bottom: 1px dashed #999; cursor: help; }

    /* Cart sidebar */
    .page-layout { display: flex; gap: 24px; }
    .checkout-form { flex: 1; }
    .order-summary { width: 260px; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); height: fit-content; }
    .order-summary h3 { font-size: 15px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .order-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #555; }
    .order-total { font-weight: bold; color: #333; border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px; }

    /* Progress steps */
    .steps-bar { display: flex; gap: 0; margin-bottom: 32px; }
    .step-item { flex: 1; text-align: center; font-size: 11px; color: #bbb; padding: 8px 4px; border-bottom: 3px solid #eee; }
    .step-item.active { color: #6C63FF; border-color: #6C63FF; font-weight: bold; }
    .step-item.done { color: #27ae60; border-color: #27ae60; }

    /* Success */
    .success-box { text-align: center; background: white; border-radius: 12px; padding: 60px 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .success-box .icon { font-size: 64px; margin-bottom: 16px; }
    .success-box h2 { font-size: 26px; color: #27ae60; margin-bottom: 8px; }
    .success-box p { color: #666; font-size: 14px; }
    .redirect-notice { margin-top: 16px; font-size: 12px; color: #999; }

    /* Alert */
    .alert { padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
    .alert-error { background: #fdecea; color: #c0392b; border: 1px solid #e74c3c; }
    .alert-info { background: #ebf5fb; color: #1a5276; border: 1px solid #3498db; }

    @media (max-width: 600px) {
      .product-card { flex-direction: column; }
      .product-img { width: 100%; }
      .page-layout { flex-direction: column; }
      .order-summary { width: 100%; }
    }
  </style>
</head>
<body>
  <nav>
    <span class="logo">🛒 ShopZone</span>
    <a href="/">Home</a>
    <a href="/signup">My Account</a>
    <a href="/checkout">Cart (1)</a>
  </nav>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;
}

// ─── Product Page ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send(page('Premium Wireless Headphones', `
    <div class="product-card">
      <div class="product-img">📦 Product Image</div>
      <div class="product-info">
        <h1>SoundMax Pro X9 Wireless Headphones</h1>
        <div class="rating">⭐⭐⭐⭐☆ (1,284 reviews)</div>
        <div class="price">₹4,299 <span style="font-size:14px;color:#999;text-decoration:line-through">₹7,999</span></div>
        <div class="desc">
          Experience premium audio with 40-hour battery life, active noise cancellation,
          and multi-device connectivity. Foldable design for portability.
          <br><br>
          <strong>Stock:</strong> Only 3 units left at this price!
        </div>

        <!-- Primary visible action — but it only opens the signup page -->
        <a href="/signup" class="btn-primary">Create Account to Buy</a>

        <!-- FLAW 1 + 2: Real "add to cart" is tiny and uses jargon -->
        <br>
        <a href="/signup" class="btn-proceed"
           title="Initiate SKU Acquirement Workflow">
          Initiate SKU Acquirement Workflow
        </a>

        <p style="font-size:11px;color:#bbb;margin-top:8px;">
          * Account required for <span class="jargon" title="Payment processing">PCI-DSS compliant transaction fulfilment</span>
        </p>
      </div>
    </div>

    <!-- Related products (distraction) -->
    <div style="margin-top: 40px;">
      <h3 style="font-size:16px;margin-bottom:16px;">Frequently Bought Together</h3>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${[
          ['USB-C Cable', '₹299'], ['Carrying Case', '₹599'], ['Ear Cushions', '₹449'],
        ].map(([name, price]) => `
          <div style="background:white;border-radius:8px;padding:16px;width:160px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="height:80px;background:#f0f0f0;border-radius:4px;margin-bottom:8px;"></div>
            <div style="font-size:13px;font-weight:600;">${name}</div>
            <div style="font-size:14px;color:#c0392b;margin-top:4px;">${price}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `));
});

// ─── Sign-up Page ─────────────────────────────────────────────────────────────

app.get('/signup', (req, res) => {
  const error = req.query.error;
  res.send(page('Create Account', `
    <div class="form-card">
      <div class="steps-bar">
        <div class="step-item active">1. Account</div>
        <div class="step-item">2. Shipping</div>
        <div class="step-item">3. Payment</div>
      </div>

      <h2>Create Your Account</h2>

      ${error ? `<div class="alert alert-error">${decodeURIComponent(error)}</div>` : ''}

      <form method="POST" action="/signup">
        <!-- FLAW 3: No visible label on email field -->
        <div class="form-group">
          <input
            class="input-no-label"
            type="email"
            name="email"
            placeholder="Enter requisite email datum"
            required
            autocomplete="off"
          />
          <!-- FLAW 5: Error message is hidden and never shown via JS -->
          <div class="error-msg" id="email-err">Please enter a valid email address.</div>
        </div>

        <!-- FLAW 4: Password hidden behind unmarked toggle icon -->
        <div class="form-group">
          <label for="password">Password <span class="req">(min 12 chars + special char)</span></label>
          <div class="password-wrapper">
            <input type="password" id="password" name="password" required autocomplete="new-password" />
            <!-- No aria-label on this button -->
            <button type="button" class="password-toggle" onclick="
              var p=document.getElementById('password');
              p.type=p.type==='password'?'text':'password';
            ">👁</button>
          </div>
        </div>

        <div class="form-group">
          <label for="fullname">Full Name</label>
          <input type="text" id="fullname" name="fullname" placeholder="As on government ID" required />
        </div>

        <div class="form-group">
          <label for="phone">Mobile Number <span class="req">*</span></label>
          <input type="text" id="phone" name="phone" placeholder="+91 XXXXX XXXXX" />
          <!-- Note: field marked required visually but not enforced -->
        </div>

        <!-- FLAW: Agree to T&C checkbox with 8px font -->
        <div class="form-group" style="display:flex;align-items:flex-start;gap:8px;">
          <input type="checkbox" name="agree" id="agree" required style="margin-top:3px;" />
          <label for="agree" style="font-size:8px;color:#aaa;font-weight:normal;">
            I agree to ShopZone's <a href="#" style="color:#6C63FF;">Terms of Unified Digital Commercial Engagement</a>
            and <a href="#" style="color:#6C63FF;">Privacy & Biometric Data Retention Policy (v3.2.1)</a>.
            This consent is valid for 18 months and covers marketing communications.
          </label>
        </div>

        <div class="form-submit">
          <!-- FLAW: Button says "Register Entity" not "Create Account" or "Sign Up" -->
          <button type="submit" class="btn-primary" style="width:100%;">Register Entity</button>
        </div>

        <p style="text-align:center;margin-top:16px;font-size:12px;color:#999;">
          Already have an account? <a href="/checkout" style="color:#6C63FF;">Proceed directly to checkout</a>
        </p>
      </form>
    </div>
  `));
});

app.post('/signup', (req, res) => {
  const { email, password, fullname, agree } = req.body;

  // FLAW 5: Validation silently fails without user-friendly messages
  if (!email || !password || !fullname || !agree) {
    // Just redirect back with a cryptic message
    return res.redirect('/signup?error=' + encodeURIComponent('Submission validation failed. Rectify form anomalies.'));
  }
  if (password.length < 12) {
    return res.redirect('/signup?error=' + encodeURIComponent('Password entropy insufficient. Minimum 12 characters with special symbol required.'));
  }

  res.redirect('/checkout?user=' + encodeURIComponent(email));
});

// ─── Checkout Page ────────────────────────────────────────────────────────────

app.get('/checkout', (req, res) => {
  const user = req.query.user || 'guest';
  const error = req.query.error;
  res.send(page('Checkout', `
    <div class="steps-bar">
      <div class="step-item done">1. Account ✓</div>
      <div class="step-item active">2. Shipping</div>
      <div class="step-item">3. Payment</div>
    </div>

    ${error ? `<div class="alert alert-error">${decodeURIComponent(error)}</div>` : ''}

    <div class="page-layout">
      <div class="checkout-form">
        <div class="form-card" style="max-width:100%;">
          <h2>Shipping & Payment</h2>
          <form method="POST" action="/checkout">
            <input type="hidden" name="user" value="${user}" />

            <div class="form-group">
              <label>Delivery Address <span class="req">*</span></label>
              <input type="text" name="address" placeholder="House/Flat, Street" required />
            </div>
            <div style="display:flex;gap:12px;">
              <div class="form-group" style="flex:1">
                <label>City</label>
                <input type="text" name="city" placeholder="City" />
              </div>
              <div class="form-group" style="flex:1">
                <!-- FLAW: "PIN" label only — users outside India won't know this is zip code -->
                <label>PIN</label>
                <input type="text" name="pin" placeholder="6-digit PIN" />
              </div>
            </div>

            <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
            <h3 style="font-size:15px;margin-bottom:16px;">Payment Method</h3>

            <!-- FLAW: Payment options are radio buttons with no visual grouping -->
            <div class="form-group" style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;">
                <input type="radio" name="payment" value="upi" checked /> UPI / PhonePe / GPay
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;">
                <input type="radio" name="payment" value="card" /> Credit / Debit Card
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;">
                <input type="radio" name="payment" value="cod" /> Cash on Delivery
              </label>
            </div>

            <div class="form-group" id="upi-field">
              <!-- FLAW: UPI ID field has no explanation of what UPI is -->
              <label>UPI ID <span class="req">*</span></label>
              <input type="text" name="upi_id" placeholder="yourname@upi" />
            </div>

            <!-- FLAW 6: The real submit button looks disabled (grey) and uses jargon -->
            <button type="submit" class="btn-fulfilment">
              Proceed to Fulfilment Matrix
            </button>

            <!-- Tiny secondary button that is actually easier to spot -->
            <p style="text-align:center;margin-top:8px;">
              <a href="/" class="btn-proceed">Continue Shopping Instead</a>
            </p>
          </form>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="order-summary">
        <h3>Order Summary</h3>
        <div class="order-row"><span>SoundMax Pro X9</span><span>₹4,299</span></div>
        <div class="order-row"><span>Delivery</span><span style="color:#27ae60;">FREE</span></div>
        <div class="order-row"><span>Platform Fee</span><span>₹3</span></div>
        <div class="order-row order-total"><span>Total</span><span>₹4,302</span></div>
        <p style="font-size:10px;color:#bbb;margin-top:12px;">
          * Price inclusive of all taxes. GST invoice will be emailed post transaction clearance.
        </p>
      </div>
    </div>
  `));
});

app.post('/checkout', (req, res) => {
  const { user, address, city, pin, payment } = req.body;
  if (!address || !city) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Mandatory address fields incomplete.'));
  }
  res.redirect('/success?orderId=ORD' + Date.now().toString().slice(-8));
});

// ─── Success Page ─────────────────────────────────────────────────────────────

app.get('/success', (req, res) => {
  const orderId = req.query.orderId || 'ORD12345';
  // FLAW 7: Auto-redirect in 3s with no user control
  res.send(page('Order Confirmed', `
    <div class="success-box">
      <div class="icon">✅</div>
      <h2>Order Placed Successfully!</h2>
      <p>Your order <strong>${orderId}</strong> has been confirmed.</p>
      <p style="margin-top:8px;color:#888;">Estimated delivery: 3-5 business days</p>
      <div class="redirect-notice">
        ⚠️ This page will auto-redirect in 3 seconds...
      </div>
      <div style="margin-top:24px;">
        <a href="/" class="btn-primary">Continue Shopping</a>
      </div>
    </div>
    <script>
      // FLAW 7: Auto-redirect without user consent
      setTimeout(() => { window.location.href = '/'; }, 3000);
    </script>
  `));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.DEMO_PORT || 3456;
app.listen(PORT, () => {
  console.log(`\n🛒 Demo site running at http://localhost:${PORT}`);
  console.log(`   Deliberate UX flaws:`);
  console.log(`   1. Tiny (9px), low-contrast "Proceed" CTA`);
  console.log(`   2. "Initiate SKU Acquirement Workflow" jargon`);
  console.log(`   3. Email field with no label`);
  console.log(`   4. Password toggle with no aria-label`);
  console.log(`   5. Silent form errors`);
  console.log(`   6. Grey "Proceed to Fulfilment Matrix" checkout button`);
  console.log(`   7. Auto-redirect on success (3s)\n`);
});
