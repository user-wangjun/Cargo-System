import { expect, test } from "@playwright/test";
import { createJsonResponse, mockAdminConfig, seedAdminAuth } from "./helpers.js";

function setupOrdersApiMock(page) {
  const state = {
    customers: [
      { id: "cust-1", customerCode: "C001", name: "晨星贸易", contactName: "李华", phone: "13800000001", address: "上海", isActive: true },
      { id: "cust-2", customerCode: "C002", name: "海岸物流", contactName: "王静", phone: "13800000002", address: "杭州", isActive: true },
    ],
    products: [
      { id: "prod-1", productCode: "P001", name: "白卡纸", spec: "A4", color: "白色", baseUnitId: "unit-ream", baseUnitCode: "令" },
      { id: "prod-2", productCode: "P002", name: "牛皮纸", spec: "A3", color: "原色", baseUnitId: "unit-roll", baseUnitCode: "卷" },
    ],
    orders: [
      { id: "order-1", orderNo: "SO-001", customerId: "cust-1", customerName: "晨星贸易", orderDate: "2026-04-10", status: "DRAFT", remarks: "", items: [] },
      { id: "order-2", orderNo: "SO-002", customerId: "cust-2", customerName: "海岸物流", orderDate: "2026-04-08", status: "CONFIRMED", remarks: "", items: [] },
    ],
    postedPayloads: [],
  };

  page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (request.method() === "GET" && path === "/customers") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.customers, total: state.customers.length } }));
      return;
    }

    if (request.method() === "GET" && path === "/products") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.products, total: state.products.length } }));
      return;
    }

    if (request.method() === "GET" && path === "/sales-orders") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.orders, total: state.orders.length } }));
      return;
    }

    if (request.method() === "POST" && path === "/sales-orders") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.push(payload);
      const customer = state.customers.find((item) => item.id === payload.customerId);
      const created = {
        id: `order-${state.orders.length + 1}`,
        orderNo: `SO-00${state.orders.length + 1}`,
        customerId: payload.customerId,
        customerName: customer?.name || "-",
        orderDate: payload.orderDate,
        status: "DRAFT",
        remarks: payload.remarks || "",
        items: payload.items || [],
      };
      state.orders = [created, ...state.orders];
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: created }, 201));
      return;
    }

    if (request.method() === "POST" && /^\/sales-orders\/[^/]+\/confirm$/.test(path)) {
      const orderId = path.split("/")[2];
      state.orders = state.orders.map((order) =>
        order.id === orderId ? { ...order, status: "CONFIRMED" } : order
      );
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { success: true } }));
      return;
    }

    await route.fulfill(createJsonResponse({ message: `Unhandled route: ${request.method()} ${path}` }, 500));
  });

  return state;
}

test.describe("admin orders page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminAuth(page);
    await mockAdminConfig(page);
  });

  test("loads orders and filters by customer and status", async ({ page }) => {
    setupOrdersApiMock(page);

    await page.goto("/admin/orders.html");
    await page.getByRole("tab", { name: "销售订单" }).click();

    await expect(page.locator("#navUsername")).toHaveText("测试管理员");
    await expect(page.locator("#ordersBody")).toContainText("SO-001");
    await expect(page.locator("#ordersBody")).toContainText("晨星贸易");
    await expect(page.locator("#ordersBody")).toContainText("SO-002");

    await page.fill("#filterOrderCustomer", "晨星");
    await page.selectOption("#filterOrderStatus", "DRAFT");
    await page.getByRole("button", { name: "查询" }).last().click();

    await expect(page.locator("#ordersBody")).toContainText("SO-001");
    await expect(page.locator("#ordersBody")).not.toContainText("SO-002");

    await page.getByRole("button", { name: "重置" }).last().click();
    await expect(page.locator("#ordersBody")).toContainText("SO-002");
  });

  test("creates a new order and confirms a draft order", async ({ page }) => {
    const state = setupOrdersApiMock(page);

    await page.goto("/admin/orders.html");
    await page.getByRole("tab", { name: "销售订单" }).click();

    await page.getByRole("button", { name: "新建订单" }).click();
    await expect(page.locator("#modalOverlay")).toBeVisible();

    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator("#err-orderCustomerId")).toHaveText("请选择客户");
    await expect(page.locator("#err-orderItems")).toHaveText("请完整填写至少一行明细");

    await page.selectOption("#orderCustomerId", "cust-1");
    await page.fill("#orderRemarks", "自动化创建订单");
    await page.locator("#orderItemsBody select").selectOption("prod-1");
    await page.locator("#orderItemsBody input[type='number']").first().fill("5");
    await page.locator("#orderItemsBody input").nth(1).fill("令");
    await page.locator("#orderItemsBody input[type='number']").nth(1).fill("12.5");

    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.locator("#modalOverlay")).toBeHidden();
    await expect(page.locator("#ordersBody")).toContainText("SO-003");
    await expect(page.locator("#ordersBody")).toContainText("晨星贸易");
    expect(state.postedPayloads).toHaveLength(1);
    expect(state.postedPayloads[0]).toMatchObject({
      customerId: "cust-1",
      remarks: "自动化创建订单",
      items: [
        {
          lineNo: 1,
          productId: "prod-1",
          orderedQty: 5,
          unitId: "unit-ream",
          unitPrice: 12.5,
        },
      ],
    });

    await page.locator("button[title='确认']").first().click();
    await expect(page.locator("#ordersBody")).toContainText("已确认");
  });
});
