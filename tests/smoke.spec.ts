import { test, expect } from '@playwright/test';

test.describe('SchoolPulse Smoke Tests', () => {

    test('home page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('link', { name: 'SchoolPulse' }).first()).toBeVisible();
        await expect(
            page.getByRole('heading', { name: /Good (morning|afternoon|evening)/i }).first(),
        ).toBeVisible({ timeout: 15000 });
    });

    test('planner page loads', async ({ page }) => {
        await page.goto('/planner');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('heading', { name: /^Planner$/i })).toBeVisible();
    });

    test('homework page loads', async ({ page }) => {
        await page.goto('/homework');
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('heading', { name: /^Homework$/i })).toBeVisible();
    });

    test('dates page loads', async ({ page }) => {
        await page.goto('/dates');
        await expect(page).toHaveTitle(/SchoolPulse/);
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

    test('this week deadlines page loads', async ({ page }) => {
        await page.goto('/this-week');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('heading', { name: /^This Week$/i }).first()).toBeVisible({
            timeout: 15000,
        });
    });

    test('changes page loads', async ({ page }) => {
        await page.goto('/changes');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(
            page.getByRole('heading', { name: /Something Changed/i }),
        ).toBeVisible({ timeout: 15000 });
    });

    test('login page loads', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
        await expect(page.getByLabel('Email')).toBeVisible();
        await expect(page.getByLabel('Password')).toBeVisible();
        await expect(page.getByRole('link', { name: /Create account/i })).toBeVisible();
    });

    test('sign-up page loads', async ({ page }) => {
        await page.goto('/sign-up');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('heading', { name: /Create account/i })).toBeVisible();
        await expect(page.getByLabel('Name')).toBeVisible();
        await expect(page.getByLabel('Email')).toBeVisible();
        await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    });

    test('sign-in redirects to login', async ({ page }) => {
        await page.goto('/sign-in');
        await expect(page).toHaveURL(/\/login/);
    });

    test('notices page loads', async ({ page }) => {
        await page.goto('/notices', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('heading', { name: /^Notices$/i }).first()).toBeVisible({
            timeout: 20000,
        });
    });

    test('admin page loads', async ({ page }) => {
        await page.goto('/admin');
        await expect(page).toHaveTitle(/SchoolPulse/);
        await expect(page.getByRole('heading', { name: /Admin Access/i })).toBeVisible();
    });

    test('navigation works', async ({ page }) => {
        await page.goto('/');
        const mobileHw = page.locator('nav[aria-label="Primary"] a[href="/homework"]');
        const desktopHw = page.locator('nav[aria-label="Main"] a[href="/homework"]');
        if (await mobileHw.isVisible().catch(() => false)) {
            await mobileHw.click();
        } else {
            await desktopHw.click();
        }
        await expect(page).toHaveURL(/\/homework/, { timeout: 15000 });
    });
});
