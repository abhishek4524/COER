/**
 * razorpay.js — Dynamic Razorpay Checkout SDK Integration & Payment Verification
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Dynamically loads Razorpay checkout script if not present on window.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Initiates Razorpay Checkout flow for a given plan and interval.
 */
export async function initiateCheckout({ plan, interval = 'monthly', onSuccess, onError, onCancel }) {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    if (onError) onError('Failed to load Razorpay SDK. Please check your internet connection.');
    return;
  }

  try {
    // 1. Fetch order details from backend
    const res = await fetch(`${API_URL}/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan, interval }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to initialize payment checkout.');
    }

    const { orderId, amount, currency, keyId, user } = json.data;

    // 2. Configure Razorpay options
    const options = {
      key: keyId,
      amount,
      currency,
      name: 'VibeTest AI',
      description: `Upgrade to ${plan.toUpperCase()} Plan (${interval})`,
      image: '/assets/personas/aisha.png',
      order_id: orderId,
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
      },
      theme: {
        color: '#6C63FF',
      },
      handler: async function (response) {
        try {
          // 3. Verify payment signature on server
          const verifyRes = await fetch(`${API_URL}/billing/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id || orderId,
              razorpayPaymentId: response.razorpay_payment_id || `pay_mock_${Date.now()}`,
              razorpaySignature: response.razorpay_signature || 'mock_sig',
              plan,
              interval,
            }),
          });

          const verifyJson = await verifyRes.json();
          if (!verifyRes.ok || !verifyJson.success) {
            throw new Error(verifyJson.error || 'Payment signature verification failed.');
          }

          if (onSuccess) onSuccess(verifyJson.data);
        } catch (vErr) {
          if (onError) onError(vErr.message);
        }
      },
      modal: {
        ondismiss: function () {
          if (onCancel) onCancel();
        },
      },
    };

    // 3. Open Razorpay Checkout overlay
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      if (onError) onError(resp.error?.description || 'Payment failed');
    });
    rzp.open();
  } catch (err) {
    if (onError) onError(err.message);
  }
}
