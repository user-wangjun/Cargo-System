import { expect, test } from "@playwright/test";
import { createJsonResponse, mockAdminConfig, seedAdminAuth } from "./helpers.js";

function setupInventoryApiMock(page) {
  const state = {
    suppliers: [
      { id: "sup-1", supplierCode: "S001", name: "远航供应商" },
    ],
    customers: [
      { id: "cust-1", customerCode: "C001", name: "晨星贸易", isActive: true },
    ],
    products: [
      {
        id: "prod-1",
        productCode: "P001",
        name: "白卡纸",
        spec: "A4",
        color: "白色",
        baseUnitId: "unit-ream",
        baseUnitCode: "令",
      },
    ],
    salesOrders: [
      {
        id: "so-1",
        orderNo: "SO-1001",
        customerId: "cust-1",
        customerName: "晨星贸易",
        items: [
          {
            id: "soi-1",
            lineNo: 1,
            productId: "prod-1",
            productName: "白卡纸",
            orderedQty: 10,
            unitId: "unit-ream",
          },
        ],
      },
    ],
    warehouses: [
      { id: "wh-1", warehouseCode: "WH001", name: "主仓" },
    ],
    purchaseReceipts: [
      { id: "pr-1", receiptNo: "PR-001", supplierName: "远航供应商", receiptDate: "2026-04-10", status: "POSTED" },
    ],
    deliveryOrders: [
      { id: "do-1", deliveryNo: "DO-001", customerId: "cust-1", customerName: "晨星贸易", deliveryDate: "2026-04-11", status: "DRAFT", items: [] },
    ],
    balances: [
      { warehouseId: "wh-1", warehouseName: "主仓", productId: "prod-1", productName: "白卡纸", onHandQty: 20, availableQty: 18, updatedAt: "2026-04-11T09:00:00" },
    ],
    ledger: [
      { occurredAt: "2026-04-11T09:00:00", bizType: "PURCHASE", bizNo: "PR-001", productId: "prod-1", productName: "白卡纸", changeQty: 20, balanceQty: 20 },
    ],
    conversions: [],
    postedPayloads: {
      warehouses: [],
      deliveries: [],
    },
  };

  page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (request.method() === "GET" && path === "/suppliers") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.suppliers, total: state.suppliers.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/customers") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.customers, total: state.customers.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/products") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.products, total: state.products.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/sales-orders") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.salesOrders, total: state.salesOrders.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/unit-conversions") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.conversions, total: state.conversions.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/warehouses") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.warehouses, total: state.warehouses.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/purchase-receipts") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.purchaseReceipts, total: state.purchaseReceipts.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/delivery-orders") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.deliveryOrders, total: state.deliveryOrders.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/inventory/balances") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.balances, total: state.balances.length } }));
      return;
    }
    if (request.method() === "GET" && path === "/inventory/ledger") {
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: { list: state.ledger, total: state.ledger.length } }));
      return;
    }

    if (request.method() === "POST" && path === "/warehouses") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.warehouses.push(payload);
      const created = { id: `wh-${state.warehouses.length + 1}`, ...payload };
      state.warehouses = [...state.warehouses, created];
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: created }, 201));
      return;
    }

    if (request.method() === "POST" && path === "/delivery-orders") {
      const payload = JSON.parse(request.postData() || "{}");
      state.postedPayloads.deliveries.push(payload);
      const customer = state.customers.find((item) => item.id === payload.customerId);
      const created = {
        id: `do-${state.deliveryOrders.length + 1}`,
        deliveryNo: `DO-00${state.deliveryOrders.length + 1}`,
        customerId: payload.customerId,
        customerName: customer?.name || "-",
        deliveryDate: payload.deliveryDate,
        status: "DRAFT",
        warehouseId: payload.warehouseId,
        remarks: payload.remarks || "",
        items: payload.items || [],
      };
      state.deliveryOrders = [created, ...state.deliveryOrders];
      await route.fulfill(createJsonResponse({ code: 0, message: "ok", data: created }, 201));
      return;
    }

    await route.fulfill(createJsonResponse({ message: `Unhandled route: ${request.method()} ${path}` }, 500));
  });

  return state;
}

test.describe("admin inventory page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminAuth(page);
    await mockAdminConfig(page);
  });

  test("creates a warehouse from the warehouse tab", async ({ page }) => {
    const state = setupInventoryApiMock(page);

    await page.goto("/admin/inventory.html");
    await page.locator("#tab-warehouse-btn").click();

    await expect(page.locator("#warehouseBody")).toContainText("主仓");
    await page.getByRole("button", { name: "新建仓库" }).click();
    await expect(page.locator("#modalOverlay")).toBeVisible();

    await page.locator("#modalFooter .btn--primary").click();
    await expect(page.locator("#err-whCode")).toHaveText("请输入仓库编码");
    await expect(page.locator("#err-whName")).toHaveText("请输入仓库名称");

    await page.fill("#whCode", "WH002");
    await page.fill("#whName", "二号仓");
    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#modalOverlay")).toBeHidden();
    await expect(page.locator("#warehouseBody")).toContainText("WH002");
    await expect(page.locator("#warehouseBody")).toContainText('二号仓');
    expect(state.postedPayloads.warehouses).toEqual([
      { warehouseCode: "WH002", name: "二号仓" },
    ]);
  });

  test("creates a delivery order from the delivery tab", async ({ page }) => {
    const state = setupInventoryApiMock(page);

    await page.goto("/admin/inventory.html");
    await page.locator("#tab-delivery-btn").click();

    await expect(page.locator("#deliveryBody")).toContainText("DO-001");
    await page.getByRole("button", { name: "新建送货单" }).click();

    await expect(page.locator("#modalOverlay")).toBeVisible();
    await page.locator("#modalFooter .btn--primary").click();
    await expect(page.locator("#err-doCustomer")).toHaveText("请选择客户");
    await expect(page.locator("#err-doWh")).toHaveText("请选择仓库");

    await page.selectOption("#doCustomer", "cust-1");
    await page.selectOption("#doWh", "wh-1");
    await page.locator("#deliveryItems select").first().selectOption("prod-1");
    await page.locator("#deliveryItems input[type='number']").first().fill("3");
    await page.locator("#deliveryItems input").nth(1).fill("令");
    await page.locator("#deliveryItems select").nth(1).selectOption("soi-1");

    await page.locator("#modalFooter .btn--primary").click();

    await expect(page.locator("#modalOverlay")).toBeHidden();
    await expect(page.locator("#deliveryBody")).toContainText("DO-002");
    await expect(page.locator("#deliveryBody")).toContainText("晨星贸易");
    expect(state.postedPayloads.deliveries).toHaveLength(1);
    expect(state.postedPayloads.deliveries[0]).toMatchObject({
      customerId: "cust-1",
      warehouseId: "wh-1",
      items: [
        {
          lineNo: 1,
          productId: "prod-1",
          deliveredQty: 3,
          unitId: "unit-ream",
          relatedSalesOrderItemId: "soi-1",
        },
      ],
    });
  });
});
