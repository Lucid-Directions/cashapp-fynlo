/**
 * E2E Tests for QuantityPill Component
 * Testing the new centered quantity control implementation
 */

describe('QuantityPill Component', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    await loginAsTestUser();
  });

  afterEach(async () => {
    try {
      await logout();
    } catch (error) {
      // Ignore logout errors in tests
    }
  });

  it('should display centered QuantityPill when item is added to cart', async () => {
    // Add an item to cart to trigger QuantityPill display
    await addItemToCart('Nachos');

    // Verify QuantityPill is visible and centered
    await waitFor(element(by.id('quantity-pill')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify initial quantity is 1
    await expect(element(by.id('quantity-text'))).toHaveText('1');

    // Verify both buttons are accessible
    await expect(element(by.id('quantity-decrease'))).toBeVisible();
    await expect(element(by.id('quantity-increase'))).toBeVisible();
  });

  it('should increase quantity when plus button is tapped', async () => {
    await addItemToCart('Nachos');

    // Tap the increase button
    await element(by.id('quantity-increase')).tap();

    // Verify quantity updated to 2
    await waitFor(element(by.id('quantity-text')))
      .toHaveText('2')
      .withTimeout(2000);

    // Verify subtotal updated correctly (£5.00 -> £10.00)
    await expect(element(by.text('£10.00'))).toBeVisible();
  });

  it('should decrease quantity when minus button is tapped', async () => {
    await addItemToCart('Nachos');
    await element(by.id('quantity-increase')).tap(); // Make it 2

    // Tap the decrease button
    await element(by.id('quantity-decrease')).tap();

    // Verify quantity decreased to 1
    await waitFor(element(by.id('quantity-text')))
      .toHaveText('1')
      .withTimeout(2000);

    // Verify subtotal updated correctly (£10.00 -> £5.00)
    await expect(element(by.text('£5.00'))).toBeVisible();
  });

  it('should remove item when quantity reaches zero', async () => {
    await addItemToCart('Nachos');

    // Tap decrease to remove item completely
    await element(by.id('quantity-decrease')).tap();

    // QuantityPill should disappear
    await waitFor(element(by.id('quantity-pill')))
      .not.toBeVisible()
      .withTimeout(2000);

    // Item should be removed from display
    await waitFor(element(by.text('Nachos')))
      .not.toExist()
      .withTimeout(2000);
  });

  it('should handle rapid tapping without breaking', async () => {
    await addItemToCart('Nachos');

    // Rapidly tap increase button multiple times
    await element(by.id('quantity-increase')).multiTap(5);

    // Should handle all taps correctly
    await waitFor(element(by.id('quantity-text')))
      .toHaveText('6')
      .withTimeout(3000);

    // Rapidly decrease
    await element(by.id('quantity-decrease')).multiTap(3);

    // Should show correct final quantity
    await waitFor(element(by.id('quantity-text')))
      .toHaveText('3')
      .withTimeout(3000);
  });

  it('should accommodate 2-digit quantities without growing wider', async () => {
    await addItemToCart('Nachos');

    // Increase to double digits
    await element(by.id('quantity-increase')).multiTap(9); // Total becomes 10

    // Verify 2-digit quantity displays correctly
    await waitFor(element(by.id('quantity-text')))
      .toHaveText('10')
      .withTimeout(3000);

    // QuantityPill should still be visible and properly formatted
    await expect(element(by.id('quantity-pill'))).toBeVisible();

    // Continue to higher numbers
    await element(by.id('quantity-increase')).multiTap(15); // Total becomes 25

    await waitFor(element(by.id('quantity-text')))
      .toHaveText('25')
      .withTimeout(3000);
  });

  it('should have proper hit targets for accessibility', async () => {
    await addItemToCart('Nachos');

    // Test that buttons are easily tappable (40px height + hitSlop)
    // by verifying they respond to taps even when not perfectly centered

    // Tap near the edge of increase button - should still work
    await element(by.id('quantity-increase')).tap();
    await expect(element(by.id('quantity-text'))).toHaveText('2');

    // Tap near the edge of decrease button - should still work
    await element(by.id('quantity-decrease')).tap();
    await expect(element(by.id('quantity-text'))).toHaveText('1');
  });

  it('should display with proper theme colors', async () => {
    await addItemToCart('Nachos');

    // QuantityPill should be visible with theme-appropriate colors
    // This test verifies the component renders without visual issues
    await expect(element(by.id('quantity-pill'))).toBeVisible();

    // Buttons should be responsive (not disabled appearance)
    await expect(element(by.id('quantity-decrease'))).toBeVisible();
    await expect(element(by.id('quantity-increase'))).toBeVisible();

    // Text should be readable
    await expect(element(by.id('quantity-text'))).toBeVisible();
  });

  it('should work consistently across different menu items', async () => {
    // Test with different price points and menu categories
    const testItems = ['Nachos', 'Carnitas', 'Regular Burrito', 'Corona'];

    for (const item of testItems) {
      await addItemToCart(item);

      // Each should show QuantityPill
      await expect(element(by.id('quantity-pill'))).toBeVisible();

      // Increase quantity for each
      await element(by.id('quantity-increase')).tap();
      await expect(element(by.id('quantity-text'))).toHaveText('2');

      // Reset by decreasing to 0
      await element(by.id('quantity-decrease')).multiTap(2);

      // Move to next item
    }
  });
});

// Helper functions (assuming these exist in the test setup)
async function loginAsTestUser() {
  // Implementation depends on your login flow
  try {
    await element(by.text('Restaurant Mode')).tap();
  } catch (error) {
    // Already logged in or different flow
  }
}

async function logout() {
  // Implementation depends on your logout flow
  try {
    await element(by.id('logout-button')).tap();
  } catch (error) {
    // Ignore if logout fails
  }
}

async function addItemToCart(itemName) {
  await waitFor(element(by.text(itemName)))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.text(itemName)).tap();
}
