import { test, expect } from '@playwright/test';

test.describe('SchoolPulse Smoke Tests', () => {

    test('home page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/SchoolPulse/);
        // Use a more specific selector to avoid strict mode violations (header vs footer)
        // Check for the main heading or brand text which should be visible
        // Check for something visible on both mobile and desktop (e.g., the 'Today' navigation item)
        await expect(page.locator('a[href="/"]', { hasText: 'Today' })).toBeVisible();
    });

    test('homework page loads', async ({ page }) => {
        await page.goto('/homework');
        // Check for common elements or just that it didn't 404/crash
        // Assuming the page title or a header exists
        await expect(page.getByRole('main')).toBeVisible();
    });

    test('dates page loads', async ({ page }) => {
        await page.goto('/dates');
        await expect(page).toHaveTitle(/SchoolPulse/);
        // Use .first() as the text might appear in multiple places (header vs page title)
        await expect(page.getByText('Important Dates').first()).toBeVisible();
    });

    test('rhymes page loads', async ({ page }) => {
        await page.goto('/rhymes');
        await expect(page).toHaveTitle(/SchoolPulse/);
    });

    test('week view page loads', async ({ page }) => {
        await page.goto('/week');
        await expect(page).toHaveTitle(/SchoolPulse/);
    });



    // Test that checks navigation from home
    test('navigation works', async ({ page }) => {
        await page.goto('/');
        // Click the first Homework link found (likely the navigation item)
        // Click the visible Homework link (handles mobile/desktop distinct elements)
        // Click the visible Homework link
        await page.click('a[href="/homework"]:visible');
        await expect(page).toHaveURL(/.*\/homework/);
    });
});
