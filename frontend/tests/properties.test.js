// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  applyPermissionUi,
  applyTheme,
  calcConvertedQty,
  filterByDateRange,
  filterByField,
  initSidebar,
  initTheme,
  renderBadge,
  showToast,
  toggleSidebar,
  toggleTheme,
} from "./utils.js";

const KNOWN_STATUSES = ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED", "ISSUED", "SUBMITTED", "APPROVED", "REJECTED", "POSTED", "VOID", "PRINTED"];

describe("cargo-management-frontend properties", () => {
  beforeEach(() => {
    document.body.className = "";
    document.documentElement.setAttribute("data-theme", "light");
    document.body.innerHTML = "";
    localStorage.clear();
  });

  // Feature: cargo-management-frontend, Property 1: 权限控制 UI 可见性
  it("Property 1: applyPermissionUi visibility control", () => {
    const permissionArb = fc.constantFrom(
      "master.edit",
      "order.edit",
      "order.approve",
      "inventory.edit",
      "finance.edit",
      "finance.approve",
      "user.manage"
    );
    fc.assert(
      fc.property(
        fc.array(permissionArb, { maxLength: 8 }),
        fc.array(permissionArb, { minLength: 1, maxLength: 4 }),
        (userPerms, requiredPerms) => {
          document.body.innerHTML = `<button id="x" data-perm-any="${requiredPerms.join(",")}">x</button>`;
          const hasAny = (codes) => codes.some((c) => userPerms.includes(c));
          applyPermissionUi(document, hasAny);
          const el = document.getElementById("x");
          const shouldShow = requiredPerms.some((c) => userPerms.includes(c));
          return shouldShow ? el.style.display !== "none" : el.style.display === "none";
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cargo-management-frontend, Property 2: 主题切换持久化 Round-Trip
  it("Property 2: theme round-trip persistence", () => {
    fc.assert(
      fc.property(fc.constantFrom("light", "dark"), (theme) => {
        applyTheme(theme);
        if (document.documentElement.getAttribute("data-theme") !== theme) return false;
        toggleTheme("cargo_theme");
        const saved = localStorage.getItem("cargo_theme");
        if (saved !== document.documentElement.getAttribute("data-theme")) return false;
        initTheme("cargo_theme");
        return document.documentElement.getAttribute("data-theme") === saved;
      }),
      { numRuns: 100 }
    );
  });

  // Feature: cargo-management-frontend, Property 3: 侧边栏折叠状态持久化 Round-Trip
  it("Property 3: sidebar round-trip persistence", () => {
    fc.assert(
      fc.property(fc.boolean(), (startCollapsed) => {
        localStorage.setItem("cargo_sidebar_collapsed", String(startCollapsed));
        initSidebar("cargo_sidebar_collapsed");
        const before = document.body.classList.contains("sidebar-collapsed");
        if (before !== startCollapsed) return false;
        toggleSidebar("cargo_sidebar_collapsed");
        const after = document.body.classList.contains("sidebar-collapsed");
        const saved = localStorage.getItem("cargo_sidebar_collapsed") === "true";
        if (after !== saved) return false;
        initSidebar("cargo_sidebar_collapsed");
        return document.body.classList.contains("sidebar-collapsed") === saved;
      }),
      { numRuns: 100 }
    );
  });

  // Feature: cargo-management-frontend, Property 4: 单位折算计算正确性
  it("Property 4: unit conversion correctness", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (qty, fromUnit, toUnit, ratio) => {
          if (fromUnit === toUnit) {
            return calcConvertedQty(qty, fromUnit, toUnit, []) === qty;
          }
          const result = calcConvertedQty(qty, fromUnit, toUnit, [{ fromUnit, toUnit, ratio }]);
          return Math.abs(result - qty * ratio) < 0.001;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cargo-management-frontend, Property 5: 筛选结果一致性
  it("Property 5: filter result consistency", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            customerName: fc.string(),
            bizDate: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map((d) => d.toISOString().slice(0, 10)),
          })
        ),
        fc.string(),
        fc.option(fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map((d) => d.toISOString().slice(0, 10))),
        fc.option(fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map((d) => d.toISOString().slice(0, 10))),
        (list, keyword, fromOpt, toOpt) => {
          const from = fromOpt ?? "";
          const to = toOpt ?? "";
          const byField = filterByField(list, "customerName", keyword);
          if (keyword === "") {
            if (byField.length !== list.length) return false;
          } else if (!byField.every((x) => String(x.customerName).toLowerCase().includes(keyword.toLowerCase()))) {
            return false;
          }
          const byDate = filterByDateRange(byField, "bizDate", from, to);
          if (!from && !to) return byDate.length === byField.length;
          return byDate.every((x) => {
            const d = new Date(x.bizDate);
            if (from && d < new Date(from)) return false;
            if (to && d > new Date(to + "T23:59:59")) return false;
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: cargo-management-frontend, Property 6: 状态 Badge 渲染完整性
  it("Property 6: badge completeness", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KNOWN_STATUSES), (status) => {
        const html = renderBadge(status);
        return html.includes("badge__dot") && html.includes("badge--") && html.includes("span");
      }),
      { numRuns: 100 }
    );
  });

  // Feature: cargo-management-frontend, Property 7: Toast 通知内容完整性
  it("Property 7: toast content completeness", () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        document.body.innerHTML = '<div id="toastContainer"></div>';
        const t1 = showToast("success", msg);
        const t2 = showToast("error", msg);
        return (
          !!t1 &&
          !!t2 &&
          t1.classList.contains("toast--success") &&
          t2.classList.contains("toast--error") &&
          t1.textContent.includes(msg) &&
          t2.textContent.includes(msg)
        );
      }),
      { numRuns: 100 }
    );
  });
});
