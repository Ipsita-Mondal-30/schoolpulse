import { test, expect } from '@playwright/test';

test.describe('SchoolPulse Smoke Tests', () => {

    test('home page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/SchoolPulse/);
        // Check for 'Planner' tab link which is visible on the current screen size
        await expect(page.locator('a[href="/"]:visible', { hasText: 'Planner' }).first()).toBeVisible();
    });

    test('homework page loads', async ({ page }) => {
        await page.goto('/homework');
        await expect(page.getByRole('main')).toBeVisible();
    });

    test('dates page loads', async ({ page }) => {
        await page.goto('/dates');
        await expect(page).toHaveTitle(/SchoolPulse/);
        // Check for the visible 'Events' text or tab which is rendered on this page
        await expect(page.getByText('Events').filter({ visible: true }).first()).toBeVisible();
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
