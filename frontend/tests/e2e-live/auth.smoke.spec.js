import { expect, test } from "@playwright/test";

const adminUser = process.env.LIVE_ADMIN_USERNAME || "13800138000";
const adminPassword = process.env.LIVE_ADMIN_PASSWORD || "owner123";
const adminCompanyName = process.env.LIVE_ADMIN_COMPANY_NAME || "DGUT";
const adminLoginRole = process.env.LIVE_ADMIN_LOGIN_ROLE || "OWNER";
const financeUser = process.env.LIVE_FINANCE_USERNAME || "finance";
const financePassword = process.env.LIVE_FINANCE_PASSWORD || "finance123";

test.describe("live auth smoke", () => {
  test("admin login reaches dashboard and loads summary", async ({ page }) => {
    await page.goto("/admin/login.html");

    await page.fill("#username", adminUser);
    await page.fill("#password", adminPassword);
    await page.fill("#companyName", adminCompanyName);
    await page.selectOption("#loginRole", adminLoginRole);
    await page.locator("#loginBtn").click();

    await page.waitForURL("**/admin/index.html", { timeout: 20_000 });
    await expect(page.locator("#navUsername")).not.toHaveText("未登录");
    await expect(page.locator("#kpiCustomers")).not.toContainText("—");
    await expect(page.locator("#recentOrdersBody")).not.toContainText("暂无数据");
  });

  test("user login reaches finance dashboard and loads invoice KPI", async ({ page }) => {
    await page.goto("/user/login.html");

    await page.fill("#username", financeUser);
    await page.fill("#password", financePassword);
    await page.getByRole("button", { name: "登录" }).click();

    await page.waitForURL("**/user/index.html", { timeout: 20_000 });
    await expect(page.locator("#navUsername")).not.toHaveText("未登录");
    await expect(page.locator("#kpiInv")).not.toContainText("—");
    await expect(page.locator("#invoiceBody")).not.toContainText("暂无数据");
  });
});
