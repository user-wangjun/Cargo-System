import { expect, test } from "@playwright/test";
import { createJsonResponse, mockAdminConfig, seedAdminAuth } from "./helpers.js";

function setupFinanceApiMock(page, overrides = {}) {
  const state = {
    customers: [
      { id: "cust-1", name: "晨星贸易" },
    ],
    deliveryOrders: [
      { id: "do-1", deliveryNo: "DO-1001", customerId: "cust-1", customerName: "晨星贸易", deliveryDate: "2026-04-12", status: "POSTED", totalAmount: 1580 },
    ],
    invoices: overrides.invoices || [],
    requests: [],
    receipts: [],
    postedPayloads: {
      invoices: [],
      requests: [],
      receipts: [],
    },
  };

  page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (request.method() === "GET" && path === "/customers") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.customers, total: state.customers.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/delivery-orders") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.deliveryOrders, total: state.deliveryOrders.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/invoices") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.invoices, total: state.invoices.length } }));
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

    if (request.method() === "POST" && path === "/invoices") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.invoices.push(payload);
      const delivery = state.deliveryOrders.find((item) => item.id === payload.deliveryOrderId);
      const created = {
        id: `inv-${state.invoices.length + 1}`,
        invoiceNo: `INV-00${state.invoices.length + 1}`,
        customerId: payload.customerId,
        customerName: delivery?.customerName || "-",
        deliveryOrderId: payload.deliveryOrderId,
        deliveryNo: delivery?.deliveryNo || "-",
        invoiceDate: payload.invoiceDate,
        totalAmount: payload.totalAmount,
        status: "DRAFT",
      };
      state.invoices = [created, ...state.invoices];
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: created }, 201));
      return;
    }

    if (request.method() === "POST" && /^\/invoices\/[^/]+\/issue$/.test(path)) {
      const invoiceId = path.split("/")[2];
      state.invoices = state.invoices.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, status: "ISSUED" } : invoice
      );
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { success: true } }));
      return;
    }

    if (request.method() === "POST" && path === "/payment-requests") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.requests.push(payload);
      const invoice = state.invoices.find((item) => item.id === payload.invoiceId);
      const created = {
        id: `req-${state.requests.length + 1}`,
        requestNo: `PRQ-00${state.requests.length + 1}`,
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

    if (request.method() === "POST" && /^\/payment-requests\/[^/]+\/submit$/.test(path)) {
      const requestId = path.split("/")[2];
      state.requests = state.requests.map((requestItem) =>
        requestItem.id === requestId ? { ...requestItem, status: "SUBMITTED" } : requestItem
      );
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { success: true } }));
      return;
    }

    if (request.method() === "POST" && /^\/payment-requests\/[^/]+\/approve$/.test(path)) {
      const requestId = path.split("/")[2];
      state.requests = state.requests.map((requestItem) =>
        requestItem.id === requestId ? { ...requestItem, status: "APPROVED" } : requestItem
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
        receiptNo: `RC-00${state.receipts.length + 1}`,
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

test.describe("admin finance page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminAuth(page);
    await mockAdminConfig(page);
  });

  test("creates and issues an invoice from a posted delivery order", async ({ page }) => {
    const state = setupFinanceApiMock(page);

    await page.goto("/admin/finance.html");

    await expect(page.locator("#invoiceBody")).toContainText("暂无数据");
    await page.getByRole("button", { name: "生成发票" }).click();
    await expect(page.locator("#modalOverlay")).toBeVisible();

    await page.locator("#modalFooter .btn--primary").click();
    await expect(page.locator("#err-newInvoiceDelivery")).toHaveText("请选择送货单");

    await page.selectOption("#newInvoiceDelivery", "do-1");
    await expect(page.locator("#newInvoiceAmount")).toHaveValue("1580");
    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#invoiceBody")).toContainText("INV-001");
    await expect(page.locator("#invoiceBody")).toContainText("草稿");
    expect(state.postedPayloads.invoices).toEqual([
      {
        customerId: "cust-1",
        deliveryOrderId: "do-1",
        invoiceDate: expect.any(String),
        totalAmount: 1580,
      },
    ]);

    await page.locator("button[title='开具']").first().click();
    await expect(page.locator("#invoiceBody")).toContainText("已开具");
  });

  test("creates a payment request and a receipt from an issued invoice", async ({ page }) => {
    const state = setupFinanceApiMock(page, {
      invoices: [
        {
          id: "inv-1",
          invoiceNo: "INV-1001",
          customerId: "cust-1",
          customerName: "晨星贸易",
          deliveryOrderId: "do-1",
          deliveryNo: "DO-1001",
          invoiceDate: "2026-04-13",
          totalAmount: 1580,
          status: "ISSUED",
        },
      ],
    });

    await page.goto("/admin/finance.html");

    await page.locator("#tab-requests-btn").click();
    await page.getByRole("button", { name: "新建请款单" }).click();
    await expect(page.locator("#modalOverlay")).toBeVisible();

    await page.locator("#modalFooter .btn--primary").click();
    await expect(page.locator("#err-newReqCustomer")).toHaveText("请选择客户");

    await page.selectOption("#newReqCustomer", "cust-1");
    await page.selectOption("#newReqInvoice", "inv-1");
    await page.fill("#newReqAmount", "1200");
    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#requestBody")).toContainText("PRQ-001");
    await expect(page.locator("#requestBody")).toContainText("草稿");
    expect(state.postedPayloads.requests).toEqual([
      {
        customerId: "cust-1",
        invoiceId: "inv-1",
        requestDate: expect.any(String),
        requestedAmount: 1200,
      },
    ]);

    await page.locator("button[title='提交']").first().click();
    await expect(page.locator("#requestBody")).toContainText("已提交");
    await page.locator("button[title='审批']").first().click();
    await expect(page.locator("#requestBody")).toContainText("已审批");

    await page.locator("#tab-receipts-btn").click();
    await page.getByRole("button", { name: "新建回款" }).click();
    await page.selectOption("#newReceiptInvoice", "inv-1");
    await page.fill("#newReceiptAmount", "1200");
    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#receiptBody")).toContainText("RC-001");
    await expect(page.locator("#receiptBody")).toContainText("INV-1001");
    expect(state.postedPayloads.receipts).toEqual([
      {
        customerId: "cust-1",
        invoiceId: "inv-1",
        amount: 1200,
        receivedDate: expect.any(String),
      },
    ]);
  });
});
