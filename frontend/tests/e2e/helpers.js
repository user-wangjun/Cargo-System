export async function seedAdminAuth(page, overrides = {}) {
  await page.addInitScript((payload) => {
    localStorage.setItem(
      "cargo_admin_token",
      payload.token || "test-token"
    );
    localStorage.setItem(
      "cargo_admin_user",
      JSON.stringify({
        id: "user-admin",
        username: "qa-admin",
        fullName: "测试管理员",
        companyId: "company-1",
        companyName: "自动化联调企业",
        roles: ["ADMIN"],
        permissions: [
          "master.edit",
          "order.edit",
          "order.approve",
          "inventory.edit",
          "finance.edit",
          "finance.approve",
          "user.manage",
        ],
        ...(payload.user || {}),
      })
    );
  }, overrides);
}

export async function seedUserAuth(page, overrides = {}) {
  await page.addInitScript((payload) => {
    localStorage.setItem(
      "cargo_user_token",
      payload.token || "user-test-token"
    );
    localStorage.setItem(
      "cargo_user_user",
      JSON.stringify({
        id: "user-finance",
        username: "qa-finance",
        fullName: "测试财务",
        companyId: "company-1",
        companyName: "自动化联调企业",
        roles: ["FINANCE"],
        permissions: [
          "finance.edit",
          "finance.approve",
        ],
        ...(payload.user || {}),
      })
    );
  }, overrides);
}

export function createJsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  };
}

export async function mockAdminConfig(page) {
  await page.route("**/admin/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.APP_CONFIG = { API_BASE_URL: '/api/v1' };",
    });
  });
}

export async function mockUserConfig(page) {
  await page.route("**/user/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.APP_CONFIG = { API_BASE_URL: '/api/v1' };",
    });
  });
}
