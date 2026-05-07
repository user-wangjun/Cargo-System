// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_INVITE_CODE = "TEST_OWNER_INVITE_CODE";

function renderRegisterDom() {
  document.body.innerHTML = `
    <main>
      <select id="roleType">
        <option value="EMPLOYEE">员工</option>
        <option value="OWNER">老板</option>
      </select>
      <input id="companyName" />
      <span id="err-companyName"></span>
      <input id="fullName" />
      <span id="err-fullName"></span>
      <input id="phone" />
      <span id="err-phone"></span>
      <div class="input-with-action">
        <input id="password" type="password" />
        <button type="button" data-toggle-target="password" data-toggle-label="密码">显示</button>
      </div>
      <span id="err-password"></span>
      <div class="input-with-action">
        <input id="confirmPassword" type="password" />
        <button type="button" data-toggle-target="confirmPassword" data-toggle-label="确认密码">显示</button>
      </div>
      <span id="err-confirmPassword"></span>
      <label id="inviteCodeLabel" for="inviteCode">邀请码</label>
      <div class="input-with-action">
        <input id="inviteCode" type="password" />
        <button type="button" data-toggle-target="inviteCode" data-toggle-label="邀请码">显示</button>
      </div>
      <span id="err-inviteCode"></span>
      <button id="registerBtn" type="button">提交注册</button>
      <div id="toastContainer"></div>
    </main>
  `;
}

function wireFieldErrors() {
  window.showFieldError = vi.fn((id, msg) => {
    const errEl = document.getElementById(`err-${id}`);
    const inputEl = document.getElementById(id);
    if (errEl) errEl.textContent = msg;
    if (inputEl) inputEl.classList.add("form-input--error");
  });
  window.clearFieldErrors = vi.fn((ids) => {
    (ids || []).forEach((id) => {
      const errEl = document.getElementById(`err-${id}`);
      const inputEl = document.getElementById(id);
      if (errEl) errEl.textContent = "";
      if (inputEl) inputEl.classList.remove("form-input--error");
    });
  });
}

function wireInputToggles() {
  window.initInputToggles = vi.fn(() => {
    document.querySelectorAll("[data-toggle-target]").forEach((btn) => {
      if (btn.dataset.toggleBound === "true") return;
      btn.dataset.toggleBound = "true";
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.toggleTarget);
        const nextType = input.type === "password" ? "text" : "password";
        input.type = nextType;
        btn.textContent = nextType === "password" ? "显示" : "隐藏";
      });
    });
  });
}

async function loadRegisterModule() {
  vi.resetModules();
  window.__CARGO_SKIP_AUTO_INIT__ = true;
  window.__CARGO_TEST_NO_REDIRECT__ = true;
  return import("../admin/register.js");
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("enterprise register page", () => {
  beforeEach(() => {
    renderRegisterDom();
    localStorage.clear();
    sessionStorage.clear();
    wireFieldErrors();
    wireInputToggles();
    window.initTheme = vi.fn();
    window.getToken = vi.fn(() => "");
    window.getErrorMessage = vi.fn((err) => err?.message || "未知错误");
    window.request = vi.fn();
    window.setToken = vi.fn();
    window.setUser = vi.fn();
    window.setAuthFlash = vi.fn();
    window.showToast = vi.fn();
  });

  it("blocks submit when passwords do not match", async () => {
    const { initRegisterPage } = await loadRegisterModule();
    initRegisterPage();

    document.getElementById("roleType").value = "OWNER";
    document.getElementById("companyName").value = "星河货运";
    document.getElementById("fullName").value = "王老板";
    document.getElementById("phone").value = "13800138000";
    document.getElementById("password").value = "secret12";
    document.getElementById("confirmPassword").value = "secret34";
    document.getElementById("inviteCode").value = OWNER_INVITE_CODE;

    document.getElementById("registerBtn").click();

    expect(window.request).not.toHaveBeenCalled();
    expect(document.getElementById("err-confirmPassword").textContent).toBe("两次输入的密码不一致");
    expect(document.getElementById("registerBtn").disabled).toBe(false);
  });

  it("toggles password visibility and keeps loading state until owner register completes", async () => {
    let resolveRequest;
    window.request = vi.fn(() =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { initRegisterPage } = await loadRegisterModule();
    initRegisterPage();

    const passwordInput = document.getElementById("password");
    const passwordToggle = document.querySelector('[data-toggle-target="password"]');
    passwordToggle.click();
    expect(passwordInput.type).toBe("text");
    expect(passwordToggle.textContent).toBe("隐藏");

    document.getElementById("roleType").value = "OWNER";
    document.getElementById("companyName").value = "星河货运";
    document.getElementById("fullName").value = "王老板";
    document.getElementById("phone").value = "13800138000";
    document.getElementById("password").value = "secret12";
    document.getElementById("confirmPassword").value = "secret12";
    document.getElementById("inviteCode").value = OWNER_INVITE_CODE;

    document.getElementById("registerBtn").click();

    expect(document.getElementById("registerBtn").disabled).toBe(true);
    expect(document.getElementById("registerBtn").textContent).toBe("提交中...");

    resolveRequest({
      data: {
        accessToken: "token-1",
        user: { username: "13800138000", fullName: "王老板" },
        roles: ["OWNER"],
        permissions: ["user.manage"],
      },
    });
    await flushPromises();

    expect(window.setToken).toHaveBeenCalledWith("token-1");
    expect(window.setUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "13800138000",
        roles: ["OWNER"],
        permissions: ["user.manage"],
      })
    );
    expect(window.setAuthFlash).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "欢迎创建企业：星河货运",
        actionHref: "./users.html",
      })
    );
    expect(window.showToast).toHaveBeenCalledWith("success", "老板账号注册成功，正在进入管理端");
    expect(document.getElementById("registerBtn").disabled).toBe(false);
    expect(document.getElementById("registerBtn").textContent).toBe("提交注册");
  });
});
