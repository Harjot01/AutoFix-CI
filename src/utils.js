/**
 * Formats a number as a USD price string.
 * e.g. formatPrice(10) -> "$10.00"
 */
function formatPrice(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    throw new Error('formatPrice expects a valid number');
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Adds a percentage-based discount to a price.
 * e.g. applyDiscount(100, 10) -> 90 (10% off)
 */
function applyDiscount(price, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('discountPercent must be between 0 and 100');
  }
  return price - (price * discountPercent) / 100;
}

/**
 * Validates a simple email format.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { formatPrice, applyDiscount, isValidEmail };
