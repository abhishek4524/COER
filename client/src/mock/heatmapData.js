import { all50Personas } from './personas.js';

// ─── 5 Tested Screens Configuration ─────────────────────────────────────────
export const testedScreens = [
  {
    id: 'product',
    label: 'Product',
    fullName: 'Lumen One Wireless Headphones',
    thumbnail: '/assets/steps/product.png',
    frictionLevel: 'amber',
    frictionDot: '#F59E0B',
    frictionScore: 32,
    hotspots: [
      { id: 'hp1', name: 'Add to Cart Button', selector: 'button#add-to-cart', cx: 480, cy: 375, baseClicks: 44, rageClicks: 5, frustration: 38, type: 'click' },
      { id: 'hp2', name: 'Color Variant Swatches', selector: 'div.color-swatches', cx: 440, cy: 285, baseClicks: 32, rageClicks: 3, frustration: 28, type: 'click' },
      { id: 'hp3', name: 'Customer Reviews Tab', selector: 'a#reviews-tab', cx: 270, cy: 435, baseClicks: 22, rageClicks: 6, frustration: 52, type: 'click' },
      { id: 'hp4', name: 'Product Hero Image', selector: 'img.product-hero', cx: 240, cy: 240, baseClicks: 26, rageClicks: 1, frustration: 18, type: 'scroll' },
    ],
    scrollDepth: {
      percentages: [100, 84, 52, 28],
      averageFold: 58,
    },
    topHotspot: {
      elementName: 'Color Variant Selector',
      selector: 'div.swatches-grid',
      issue: '16 personas hesitated due to low contrast on selected ring',
      severity: 'medium',
      affectedCount: 16,
      suggestedFix: 'Increase selected swatch border to 3px with #6C63FF accent glow and aria-checked="true".',
    },
    pins: [
      { id: 'pin-devin', personaId: 'p5', name: 'Devin Chen', age: 26, avatar: '/assets/personas/devin.png', altAvatar: '/assets/personas/devin-cool.png', x: 485, y: 370, quote: 'Expected Cmd+Enter shortcut to add to cart directly.', frustration: 35, type: 'click' },
      { id: 'pin-kenji', personaId: 'p9', name: 'Kenji Sato', age: 29, avatar: '/assets/personas/kenji.png', altAvatar: '/assets/personas/kenji-smile.png', x: 435, y: 280, quote: 'Contrast ratio on secondary links fails WCAG AA.', frustration: 48, type: 'click' },
      { id: 'pin-priya', personaId: 'p3', name: 'Priya K.', age: 34, avatar: '/assets/personas/priya.png', altAvatar: '/assets/personas/priya-smile.png', x: 260, y: 430, quote: 'Review stars did not open the breakdown drawer.', frustration: 55, type: 'click' },
    ],
  },
  {
    id: 'cart',
    label: 'Cart',
    fullName: 'Slide-Over Cart Review',
    thumbnail: '/assets/steps/cart.png',
    frictionLevel: 'amber',
    frictionDot: '#F59E0B',
    frictionScore: 48,
    hotspots: [
      { id: 'hc1', name: 'Proceed to Checkout Button', selector: 'button#cart-proceed', cx: 520, cy: 430, baseClicks: 48, rageClicks: 12, frustration: 72, type: 'rage' },
      { id: 'hc2', name: 'Promo Code Input Field', selector: 'input#cart-promo', cx: 420, cy: 345, baseClicks: 36, rageClicks: 15, frustration: 68, type: 'rage' },
      { id: 'hc3', name: 'Quantity Increment (+)', selector: 'button.qty-plus', cx: 480, cy: 260, baseClicks: 24, rageClicks: 3, frustration: 35, type: 'click' },
      { id: 'hc4', name: 'Continue Shopping Link', selector: 'a.cart-back', cx: 200, cy: 120, baseClicks: 14, rageClicks: 4, frustration: 42, type: 'dead' },
    ],
    scrollDepth: {
      percentages: [100, 78, 44, 18],
      averageFold: 52,
    },
    topHotspot: {
      elementName: 'Promo Code Field',
      selector: 'input#cart-promo',
      issue: '24 personas repeatedly tapped submit without validation feedback',
      severity: 'high',
      affectedCount: 24,
      suggestedFix: 'Show real-time validation spinner and display immediate inline green/coral badge upon code entry.',
    },
    pins: [
      { id: 'pin-aisha', personaId: 'p6', name: 'Aisha Patel', age: 41, avatar: '/assets/personas/aisha.png', altAvatar: '/assets/personas/aisha-happy.png', x: 425, y: 340, quote: 'I entered 3 promo codes before I found the actual checkout link.', frustration: 68, type: 'rage' },
      { id: 'pin-liam', personaId: 'p7', name: 'Liam O\'Connor', age: 19, avatar: '/assets/personas/liam.png', altAvatar: '/assets/personas/liam-bored.png', x: 525, y: 425, quote: 'Too many taps just to see my estimated total.', frustration: 74, type: 'rage' },
    ],
  },
  {
    id: 'shipping',
    label: 'Shipping',
    fullName: 'Delivery & Shipping Details',
    thumbnail: '/assets/steps/shipping.png',
    frictionLevel: 'sage',
    frictionDot: '#8FB8A8',
    frictionScore: 14,
    hotspots: [
      { id: 'hs1', name: 'Street Address Field', selector: 'input#address_line1', cx: 320, cy: 220, baseClicks: 46, rageClicks: 2, frustration: 22, type: 'click' },
      { id: 'hs2', name: 'Delivery Speed Radio', selector: 'div.shipping-speed', cx: 380, cy: 335, baseClicks: 40, rageClicks: 1, frustration: 18, type: 'click' },
      { id: 'hs3', name: 'Continue to Payment Button', selector: 'button#shipping-next', cx: 495, cy: 420, baseClicks: 44, rageClicks: 3, frustration: 24, type: 'click' },
    ],
    scrollDepth: {
      percentages: [100, 92, 74, 58],
      averageFold: 68,
    },
    topHotspot: {
      elementName: 'Delivery Speed Selector',
      selector: 'div.shipping-speed',
      issue: 'Minimal friction. 94% of users completed this step smoothly.',
      severity: 'low',
      affectedCount: 6,
      suggestedFix: 'Pre-select Standard Free shipping by default to shave another 4 seconds off checkout.',
    },
    pins: [
      { id: 'pin-elena', personaId: 'p10', name: 'Elena Rostova', age: 44, avatar: '/assets/personas/elena.png', altAvatar: '/assets/personas/elena-confused.png', x: 380, y: 330, quote: 'Clear radio buttons. Standard shipping was easy to choose.', frustration: 20, type: 'click' },
      { id: 'pin-fatima', personaId: 'p11', name: 'Fatima Al-Mansoor', age: 31, avatar: '/assets/personas/fatima.png', altAvatar: '/assets/personas/fatima-thoughtful.png', x: 320, y: 215, quote: 'Address autocomplete filled city and state accurately.', frustration: 15, type: 'click' },
    ],
  },
  {
    id: 'otp',
    label: 'OTP',
    fullName: 'SMS OTP & Payment Gate (Friction Hotspot)',
    thumbnail: '/assets/steps/otp.png',
    frictionLevel: 'coral',
    frictionDot: '#F08A7E',
    frictionScore: 88,
    hotspots: [
      { id: 'ho1', name: 'SMS OTP 6-Box Verification Gate', selector: 'div.otp-input-group', cx: 380, cy: 245, baseClicks: 68, rageClicks: 26, frustration: 92, type: 'rage', isRageCluster: true },
      { id: 'ho2', name: 'Missing Apple Pay / Fast Checkout Area', selector: 'div.quick-pay-tray', cx: 420, cy: 160, baseClicks: 44, rageClicks: 18, frustration: 88, type: 'rage', isRageCluster: true },
      { id: 'ho3', name: 'Resend OTP Code Countdown', selector: 'button#resend-code', cx: 380, cy: 325, baseClicks: 36, rageClicks: 14, frustration: 76, type: 'click' },
      { id: 'ho4', name: 'Dead Space / Unclickable Label', selector: 'label.verify-subtitle', cx: 280, cy: 200, baseClicks: 18, rageClicks: 7, frustration: 65, type: 'dead' },
      { id: 'ho5', name: 'Complete Order Button (Disabled)', selector: 'button#submit-otp', cx: 480, cy: 410, baseClicks: 52, rageClicks: 22, frustration: 94, type: 'rage', isRageCluster: true },
    ],
    scrollDepth: {
      percentages: [100, 68, 31, 9], // Stacked segments 100%, 68%, 31%, 9% as requested!
      averageFold: 48,
    },
    topHotspot: {
      elementName: 'SMS OTP Verification Gate',
      selector: 'div.otp-input-group',
      issue: '38 of 50 personas missed primary CTA or abandoned at this screen',
      severity: 'critical',
      affectedCount: 38,
      suggestedFix: 'Implement 1-tap passkey biometric login, Google Pay / Apple Pay express buttons, or email magic link alternative.',
    },
    pins: [
      { id: 'pin-riya', personaId: 'p1', name: 'Riya Sharma', age: 17, avatar: '/assets/personas/riya.png', altAvatar: '/assets/personas/riya-confused.png', x: 420, y: 160, quote: 'Why is there no Apple Pay option? Closing app.', frustration: 94, type: 'rage' },
      { id: 'pin-sharma', personaId: 'p2', name: 'Uncle Sharma', age: 58, avatar: '/assets/personas/sharma.png', altAvatar: '/assets/personas/sharma-frown.png', x: 380, y: 245, quote: 'Is this text clickable? Can\'t find buy button.', frustration: 86, type: 'rage' },
      { id: 'pin-noah', personaId: 'p12', name: 'Noah Brooks', age: 21, avatar: '/assets/personas/noah.png', altAvatar: '/assets/personas/noah-annoyed.png', x: 480, y: 410, quote: 'Spinning loader took 3s. Tab closed.', frustration: 96, type: 'rage' },
      { id: 'pin-marcus', personaId: 'p4', name: 'Marcus Vance', age: 62, avatar: '/assets/personas/marcus.png', altAvatar: '/assets/personas/marcus-serious.png', x: 280, y: 200, quote: 'Screen reader announced "edit text" 6 times with no form legend.', frustration: 88, type: 'dead' },
      { id: 'pin-grace', personaId: 'p8', name: 'Grace Hopper', age: 71, avatar: '/assets/personas/grace.png', altAvatar: '/assets/personas/grace-smile.png', x: 380, y: 325, quote: 'I waited for text message but telephone is in other room.', frustration: 82, type: 'click' },
    ],
  },
  {
    id: 'success',
    label: 'Success',
    fullName: 'Order Confirmation & Receipt',
    thumbnail: '/assets/steps/success.png',
    frictionLevel: 'sage',
    frictionDot: '#8FB8A8',
    frictionScore: 4,
    hotspots: [
      { id: 'hsucc1', name: 'Success Confirmation Badge', selector: 'div.order-confirmed-badge', cx: 380, cy: 190, baseClicks: 26, rageClicks: 0, frustration: 5, type: 'click' },
      { id: 'hsucc2', name: 'Track Delivery Button', selector: 'button#track-package', cx: 380, cy: 355, baseClicks: 42, rageClicks: 1, frustration: 10, type: 'click' },
      { id: 'hsucc3', name: 'Continue Shopping Link', selector: 'a.keep-shopping', cx: 380, cy: 420, baseClicks: 20, rageClicks: 0, frustration: 8, type: 'click' },
    ],
    scrollDepth: {
      percentages: [100, 95, 82, 64],
      averageFold: 72,
    },
    topHotspot: {
      elementName: 'Track Delivery CTA',
      selector: 'button#track-package',
      issue: '96% satisfaction rate. Clear confirmation feedback.',
      severity: 'low',
      affectedCount: 2,
      suggestedFix: 'Offer SMS tracking opt-in checkbox directly on confirmation receipt.',
    },
    pins: [
      { id: 'pin-devin2', personaId: 'p5', name: 'Devin Chen', age: 26, avatar: '/assets/personas/devin.png', altAvatar: '/assets/personas/devin-cool.png', x: 380, y: 355, quote: 'Confirmation details and webhook receipt arrived instantly.', frustration: 5, type: 'click' },
      { id: 'pin-grace2', personaId: 'p8', name: 'Grace Hopper', age: 71, avatar: '/assets/personas/grace.png', altAvatar: '/assets/personas/grace-smile.png', x: 380, y: 190, quote: 'I was so relieved when the big green checkmark appeared!', frustration: 10, type: 'click' },
    ],
  },
];

// ─── Generate chronological replay click events ─────────────────────────────
export const generateReplayEvents = (screenId = 'otp') => {
  const screen = testedScreens.find(s => s.id === screenId) || testedScreens[3];
  const events = [];
  const activePins = screen.pins;

  for (let t = 1; t <= 45; t++) {
    if (t % 2 === 0) {
      const pin = activePins[(t / 2) % activePins.length];
      const isRage = pin.frustration > 80 && Math.random() < 0.45;
      const isDead = pin.type === 'dead';

      events.push({
        time: t,
        x: pin.x + (Math.random() - 0.5) * 35,
        y: pin.y + (Math.random() - 0.5) * 25,
        type: isRage ? 'rage' : isDead ? 'dead' : 'click',
        personaName: pin.name,
        personaId: pin.personaId,
        avatar: pin.avatar,
        color: isRage ? '#F08A7E' : '#6C63FF',
        frustration: pin.frustration,
        quote: pin.quote,
      });
    }
  }
  return events;
};
