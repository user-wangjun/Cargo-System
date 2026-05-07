import { expect, test } from "@playwright/test";
import { createJsonResponse, mockUserConfig, seedUserAuth } from "./helpers.js";

function setupUserFinanceApiMock(page) {
  const state = {
    invoices: [
      {
        id: "inv-1",
        invoiceNo: "INV-1001",
        customerId: "cust-1",
        customerName: "晨星贸易",
        deliveryOrderId: "do-1",
        deliveryNo: "DO-1001",
        invoiceDate: "2026-04-15",
        totalAmount: 1580,
        status: "ISSUED",
        items: [
          { productId: "prod-1", productName: "白卡纸", qty: 5, unitPrice: 100, amount: 500 },
        ],
      },
      {
        id: "inv-2",
        invoiceNo: "INV-1002",
        customerId: "cust-2",
        customerName: "海岸物流",
        deliveryOrderId: "do-2",
        deliveryNo: "DO-1002",
        invoiceDate: "2026-04-16",
        totalAmount: 980,
        status: "DRAFT",
        items: [],
      },
    ],
    requests: [
      {
        id: "req-1",
        requestNo: "PRQ-1001",
        invoiceId: "inv-1",
        invoiceNo: "INV-1001",
        customerId: "cust-1",
        customerName: "晨星贸易",
        requestedAmount: 600,
        requestDate: "2026-04-16",
        status: "SUBMITTED",
      },
    ],
    receipts: [
      {
        id: "rec-1",
        receiptNo: "RC-1001",
        invoiceId: "inv-1",
        invoiceNo: "INV-1001",
        customerId: "cust-1",
        customerName: "晨星贸易",
        amount: 300,
        receivedDate: "2026-04-16",
      },
    ],
    postedPayloads: {
      requests: [],
      receipts: [],
    },
  };

  page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (request.method() === "GET" && path === "/invoices") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.invoices, total: state.invoices.length } }));
      return;
    }

    if (request.method() === "GET" && /^\/invoices\/[^/]+$/.test(path)) {
      const invoiceId = path.split("/")[2];
      const invoice = state.invoices.find((item) => item.id === invoiceId);
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: invoice || null }));
      return;
    }

    if (request.method() === "GET" && path === "/payment-requests") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.requests, total: state.requests.length } }));
      return;
    }

    if (request.method() === "GET" && path === "/receipts") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.receipts, total: state.receipts.length } }));
      return;
    }

    if (request.method() === "POST" && path === "/payment-requests") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.requests.push(payload);
      const invoice = state.invoices.find((item) => item.id === payload.invoiceId);
      const created = {
        id: `req-${state.requests.length + 1}`,
        requestNo: `PRQ-10${state.requests.length + 1}`,
        invoiceId: payload.invoiceId,
        invoiceNo: invoice?.invoiceNo || "-",
        customerId: payload.customerId,
        customerName: invoice?.customerName || "-",
        requestedAmount: payload.requestedAmount,
        requestDate: payload.requestDate,
        status: "DRAFT",
      };
      state.requests = [created, ...state.requests];
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: created }, 201));
      return;
    }

    if (request.method() === "POST" && /^\/payment-requests\/[^/]+\/approve$/.test(path)) {
      const requestId = path.split("/")[2];
      state.requests = state.requests.map((item) =>
        item.id === requestId ? { ...item, status: "APPROVED" } : item
      );
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { success: true } }));
      return;
    }

    if (request.method() === "POST" && path === "/receipts") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.receipts.push(payload);
      const invoice = state.invoices.find((item) => item.id === payload.invoiceId);
      const created = {
        id: `rec-${state.receipts.length + 1}`,
        receiptNo: `RC-10${state.receipts.length + 1}`,
        invoiceId: payload.invoiceId,
        invoiceNo: invoice?.invoiceNo || "-",
        customerId: payload.customerId,
        customerName: invoice?.customerName || "-",
        amount: payload.amount,
        receivedDate: payload.receivedDate,
      };
      state.receipts = [created, ...state.receipts];
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: created }, 201));
      return;
    }

    await route.fulfill(createJsonResponse({ message: `Unhandled route: ${request.method()} ${path}` }, 500));
  });

  return state;
}

test.describe("user finance pages", () => {
  test.beforeEach(async ({ page }) => {
    await seedUserAuth(page);
    await mockUserConfig(page);
  });

  test("loads dashboard KPIs and shows invoice detail", async ({ page }) => {
    setupUserFinanceApiMock(page);

    await page.goto("/user/index.html");

    await expect(page.locator("#navUsername")).toHaveText("测试财务");
    await expect(page.locator("#kpiInv")).toHaveText("2");
    await expect(page.locator("#kpiReq")).toHaveText("1");
    await expect(page.locator("#kpiRec")).toHaveText("1");
    await expect(page.locator("#invoiceBody")).toContainText("INV-1001");

    await page.goto("/user/invoices.html");
    await page.fill("#filterCustomer", "晨星");
    await page.getByRole("button", { name: "查询" }).click();
    await expect(page.locator("#invoiceBody")).toContainText("INV-1001");
    await expect(page.locator("#invoiceBody")).not.toContainText("INV-1002");

    await page.locator("#invoiceBody tr").first().click();
    await expect(page.locator("#modalOverlay")).toBeVisible();
    await expect(page.locator("#modalHeader")).toContainText("发票详情");
    await expect(page.locator("#modalBody")).toContainText("白卡纸");
  });

  test("creates a request, approves a submitted request, and creates a receipt", async ({ page }) => {
    const state = setupUserFinanceApiMock(page);

    await page.goto("/user/requests.html");

    await expect(page.locator("#requestBody")).toContainText("PRQ-1001");
    await page.getByRole("button", { name: "新建请款单" }).click();
    await expect(page.locator("#modalOverlay")).toBeVisible();
    await page.locator("#modalFooter .btn--primary").click();
    await expect(page.locator("#err-newCustomer")).toHaveText("请选择客户");

    await page.selectOption("#newCustomer", "cust-1");
    await page.selectOption("#newInvoice", "inv-1");
    await page.fill("#newAmount", "1200");
    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#requestBody")).toContainText("PRQ-102");
    expect(state.postedPayloads.requests).toEqual([
      {
        customerId: "cust-1",
        invoiceId: "inv-1",
        requestDate: expect.any(String),
        requestedAmount: 1200,
      },
    ]);

    await page.locator("button[title='审批']").first().click();
    await expect(page.locator("#requestBody")).toContainText("已审批");

    await page.goto("/user/receipts.html");
    await page.getByRole("button", { name: "新建回款" }).click();
    await page.fill("#newAmt", "900");
    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#receiptBody")).toContainText("RC-102");
    expect(state.postedPayloads.receipts).toEqual([
      {
        customerId: "cust-1",
        invoiceId: "inv-1",
        amount: 900,
        receivedDate: expect.any(String),
      },
    ]);
  });
});
