export function calcConvertedQty(qty, fromUnit, toUnit, conversions) {
  if (fromUnit === toUnit) return qty;
  const conv = (conversions || []).find((c) => c.fromUnit === fromUnit && c.toUnit === toUnit);
  if (!conv) return qty;
  return qty * conv.ratio;
}

export function filterByField(list, field, value) {
  if (value === null || value === undefined || value === "") return list;
  const lower = String(value).toLowerCase();
  return list.filter((item) => {
    const val = item[field];
    if (val === null || val === undefined) return false;
    return String(val).toLowerCase().includes(lower);
  });
}

export function filterByDateRange(list, field, from, to) {
  if (!from && !to) return list;
  return list.filter((item) => {
    const val = item[field];
    if (!val) return false;
    const date = new Date(val);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to + "T23:59:59")) return false;
    return true;
  });
}

export function sortBy(list, field, direction) {
  if (!direction) return list;
  return [...list].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return direction === "desc" ? -cmp : cmp;
  });
}

export function formatProductOption(product) {
  return `${product.name} / ${product.spec} / ${product.color}`;
}

const BADGE_MAP = {
  DRAFT: { color: "gray", label: "草稿" },
  CONFIRMED: { color: "blue", label: "已确认" },
  COMPLETED: { color: "green", label: "已完成" },
  CANCELLED: { color: "red", label: "已取消" },
  ISSUED: { color: "green", label: "已开具" },
  SUBMITTED: { color: "blue", label: "已提交" },
  APPROVED: { color: "green", label: "已审批" },
  REJECTED: { color: "red", label: "已拒绝" },
  POSTED: { color: "green", label: "已入库" },
  VOID: { color: "red", label: "已作废" },
  PRINTED: { color: "blue", label: "已打印" },
  CLOSED: { color: "gray", label: "已关闭" },
};

export function renderBadge(status) {
  const entry = BADGE_MAP[status];
  if (!entry) return `<span class="badge badge--gray"><span class="badge__dot"></span>${status || ""}</span>`;
  return `<span class="badge badge--${entry.color}"><span class="badge__dot"></span>${entry.label}</span>`;
}

export function applyPermissionUi(root, hasAnyPermissionFn) {
  root.querySelectorAll("[data-perm-any]").forEach((el) => {
    const perms = (el.getAttribute("data-perm-any") || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (perms.length && !hasAnyPermissionFn(perms)) el.style.display = "none";
    else el.style.display = "";
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme(THEME_KEY = "cargo_theme") {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

export function initTheme(THEME_KEY = "cargo_theme") {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

export function initSidebar(SIDEBAR_KEY = "cargo_sidebar_collapsed") {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
}

export function toggleSidebar(SIDEBAR_KEY = "cargo_sidebar_collapsed") {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_KEY, String(collapsed));
}

export function showToast(type, message) {
  const container = document.getElementById("toastContainer");
  if (!container) return null;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = String(message);
  container.appendChild(toast);
  return toast;
}
