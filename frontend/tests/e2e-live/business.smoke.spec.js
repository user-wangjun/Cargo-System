import { expect, test } from "@playwright/test";

const apiBase = process.env.LIVE_API_BASE_URL || "http://127.0.0.1:3000/api/v1";
const livePort = process.env.LIVE_FRONTEND_PORT || "8135";
const liveBaseUrl = `http://127.0.0.1:${livePort}`;
const adminUser = process.env.LIVE_ADMIN_USERNAME || "13800138000";
const adminPassword = process.env.LIVE_ADMIN_PASSWORD || "owner123";
const adminCompanyName = process.env.LIVE_ADMIN_COMPANY_NAME || "DGUT";
const adminLoginRole = process.env.LIVE_ADMIN_LOGIN_ROLE || "OWNER";
const financeUser = process.env.LIVE_FINANCE_USERNAME || "finance";
const financePassword = process.env.LIVE_FINANCE_PASSWORD || "finance123";

async function apiCall(request, path, method = "GET", token = "", data) {
  const response = await request.fetch(`${apiBase}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    data,
  });
  expect(response.ok(), `${method} ${path} should succeed`).toBeTruthy();
  const payload = await response.json();
  expect(payload?.code, `${method} ${path} should return code=0`).toBe(0);
  return payload.data;
}

async function firstListItem(request, path, token, name) {
  const data = await apiCall(request, path, "GET", token);
  const list = data?.list || data?.items || data || [];
  expect(Array.isArray(list) && list.length > 0, `${name} list should not be empty`).toBeTruthy();
  return list[0];
}

test.describe("live business flow smoke", () => {
  test("real backend flow appears in admin and user pages", async ({ page, request, browser }) => {
    const today = new Date().toISOString().slice(0, 10);
    const marker = `LIVE-SMOKE-${Date.now()}`;

    const auth = await apiCall(request, "/auth/login", "POST", "", {
      username: adminUser,
      password: adminPassword,
    });
    const token = auth.accessToken;
    expect(token).toBeTruthy();

    const customer = await firstListItem(request, "/customers?page=1&pageSize=1", token, "customers");
    const supplier = await firstListItem(request, "/suppliers", token, "suppliers");
    const product = await firstListItem(request, "/products", token, "products");
    const qty = 2;
    const unitPrice = 88;
    const unitId = product.baseUnitId;
    expect(unitId, "product should expose baseUnitId").toBeTruthy();

    const salesOrder = await apiCall(request, "/sales-orders", "POST", token, {
      orderDate: today,
      customerId: customer.id,
      remarks: marker,
      items: [
        {
          lineNo: 1,
          productId: product.id,
          orderedQty: qty,
          unitId,
          unitPrice,
        },
      ],
    });
    await apiCall(request, `/sales-orders/${salesOrder.id}/confirm`, "POST", token);

    const purchaseReceipt = await apiCall(request, "/purchase-receipts", "POST", token, {
      receiptDate: today,
      supplierId: supplier.id,
      remarks: marker,
      items: [
        {
          lineNo: 1,
          productId: product.id,
          receivedQty: qty,
          unitId,
        },
      ],
    });
    await apiCall(request, `/purchase-receipts/${purchaseReceipt.id}/post`, "POST", token);

    const balances = await apiCall(request, "/inventory/balances?page=1&pageSize=200", "GET", token);
    const balanceRows = balances?.list || balances || [];
    const balanceRow = balanceRows.find((row) => row.productId === product.id && Number(row.onHandQty || 0) >= qty);
    expect(balanceRow, "inventory balance with enough stock should exist").toBeTruthy();

    const deliveryOrder = await apiCall(request, "/delivery-orders", "POST", token, {
      deliveryDate: today,
      customerId: customer.id,
      warehouseId: balanceRow.warehouseId,
      remarks: marker,
      items: [
        {
          lineNo: 1,
          productId: product.id,
          deliveredQty: qty,
          unitId,
        },
      ],
    });
    await apiCall(request, `/delivery-orders/${deliveryOrder.id}/post`, "POST", token);
    await apiCall(request, `/delivery-orders/${deliveryOrder.id}/print`, "POST", token);

    const invoice = await apiCall(request, "/invoices", "POST", token, {
      customerId: customer.id,
      deliveryOrderId: deliveryOrder.id,
      invoiceDate: today,
      totalAmount: qty * unitPrice,
    });
    await apiCall(request, `/invoices/${invoice.id}/issue`, "POST", token);

    const paymentRequest = await apiCall(request, "/payment-requests", "POST", token, {
      customerId: customer.id,
      invoiceId: invoice.id,
      requestDate: today,
      requestedAmount: qty * unitPrice,
    });
    await apiCall(request, `/payment-requests/${paymentRequest.id}/submit`, "POST", token);
    await apiCall(request, `/payment-requests/${paymentRequest.id}/approve`, "POST", token);

    const receipt = await apiCall(request, "/receipts", "POST", token, {
      customerId: customer.id,
      invoiceId: invoice.id,
      receivedDate: today,
      amount: qty * unitPrice,
    });
    await apiCall(request, `/payment-requests/${paymentRequest.id}/close`, "POST", token);

    await page.goto("/admin/login.html");
    await page.fill("#username", adminUser);
    await page.fill("#password", adminPassword);
    await page.fill("#companyName", adminCompanyName);
    await page.selectOption("#loginRole", adminLoginRole);
    await page.locator("#loginBtn").click();
    await page.waitForURL("**/admin/index.html", { timeout: 20_000 });

    await page.goto("/admin/finance.html");
    await page.fill("#invoiceNoFilter", invoice.invoiceNo);
    await page.evaluate(() => window.renderInvoices());
    await expect(page.locator("#invoiceBody")).toContainText(invoice.invoiceNo);
    await expect(page.locator("#invoiceBody")).toContainText("已开具");

    await page.locator("#tab-requests-btn").click();
    await page.fill("#requestNoFilter", paymentRequest.requestNo);
    await page.evaluate(() => window.renderRequests());
    await expect(page.locator("#requestBody")).toContainText(paymentRequest.requestNo);
    await expect(page.locator("#requestBody")).toContainText("已关闭");

    await page.locator("#tab-receipts-btn").click();
    await page.fill("#receiptNoFilter", receipt.receiptNo);
    await page.evaluate(() => window.renderReceipts());
    await expect(page.locator("#receiptBody")).toContainText(receipt.receiptNo);

    const userContext = await browser.newContext({ baseURL: liveBaseUrl });
    const userPage = await userContext.newPage();
    try {
      await userPage.goto("/user/login.html");
      await userPage.fill("#username", financeUser);
      await userPage.fill("#password", financePassword);
      await userPage.getByRole("button", { name: "登录" }).click();
      await userPage.waitForURL("**/user/index.html", { timeout: 20_000 });

      await userPage.goto("/user/invoices.html");
      await userPage.fill("#filterNo", invoice.invoiceNo);
      await userPage.getByRole("button", { name: "查询" }).click();
      await expect(userPage.locator("#invoiceBody")).toContainText(invoice.invoiceNo);

      await userPage.goto("/user/receipts.html");
      await userPage.fill("#filterNo", receipt.receiptNo);
      await userPage.getByRole("button", { name: "查询" }).click();
      await expect(userPage.locator("#receiptBody")).toContainText(receipt.receiptNo);
    } finally {
      await userContext.close();
    }
  });
});
