const { formatPrice, applyDiscount, isValidEmail } = require('../src/utils');

describe('formatPrice', () => {
  test('formats a whole number as USD', () => {
    expect(formatPrice(10)).toBe('$10.00');
  });

  test('formats a decimal number as USD', () => {
    expect(formatPrice(9.5)).toBe('$9.50');
  });

  test('throws on invalid input', () => {
    expect(() => formatPrice('abc')).toThrow();
  });
});

describe('applyDiscount', () => {
  test('applies a 10% discount correctly', () => {
    expect(applyDiscount(100, 10)).toBe(90);
  });

  test('applies a 0% discount correctly', () => {
    expect(applyDiscount(100, 0)).toBe(100);
  });

  test('throws for an out-of-range discount', () => {
    expect(() => applyDiscount(100, 150)).toThrow();
  });
});

describe('isValidEmail', () => {
  test('accepts a valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  test('rejects an email without an @', () => {
    expect(isValidEmail('testexample.com')).toBe(false);
  });
});
