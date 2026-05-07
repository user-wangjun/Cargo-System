const API         = resolveApiBaseUrl();
const TOKEN_KEY   = "cargo_user_token";
const USER_KEY    = "cargo_user_user";
const THEME_KEY   = "cargo_theme";
const SIDEBAR_KEY = "cargo_sidebar_collapsed";
const LOGIN_PAGE  = "./login.html";

function resolveApiBaseUrl() {
  const configured = window.APP_CONFIG?.API_BASE_URL;
  if (configured) return String(configured).replace(/\/+$/, "");
  return "/api/v1";
}

function getToken()  { return localStorage.getItem(TOKEN_KEY) || ""; }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t || ""); }
function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY) || "{}"); } catch { return {}; } }
function setUser(u)  { localStorage.setItem(USER_KEY, JSON.stringify(u || {})); }
function clearAuth() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

function isLoginPage() {
  return window.location.pathname.endsWith("/login.html") || window.location.pathname.endsWith("\\login.html");
}

function requireAuth() {
  if (isLoginPage()) return;
  if (!getToken()) {
    window.location.href = LOGIN_PAGE;
  }
}

function getRoles()       { return getUser()?.roles || []; }
function getPermissions() { return getUser()?.permissions || []; }
function hasRole(role)    { return getRoles().includes(role); }
function hasPermission(permission) { return hasRole("ADMIN") || getPermissions().includes(permission); }
function hasAnyPermission(codes) { return hasRole("ADMIN") || codes.some((c) => getPermissions().includes(c)); }

function applyPermissionUi(root = document) {
  root.querySelectorAll("[data-perm-any]").forEach((el) => {
    const perms = (el.getAttribute("data-perm-any") || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (perms.length && !hasAnyPermission(perms)) el.style.display = "none";
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}
function initTheme() { applyTheme(localStorage.getItem(THEME_KEY) || "light"); }
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "light" ? "dark" : "light");
}

function initSidebar() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
}
function toggleSidebar() {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_KEY, String(collapsed));
}
function initMobileDrawer() {
  const hamburger = document.getElementById("hamburgerBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("drawerOverlay");
  if (!hamburger || !sidebar || !overlay) return;
  hamburger.addEventListener("click", () => {
    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    if (isMobile) {
      sidebar.classList.toggle("mobile-open");
      overlay.classList.toggle("active");
      return;
    }
    toggleSidebar();
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("active");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("active");
  });
}

function showToast(type, message, duration) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const ms = duration != null ? duration : (type === "error" ? 5000 : 3000);
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${_escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 220); }, ms);
}

function showModal({ title = "", body = "", footer = "" } = {}) {
  const overlay = document.getElementById("modalOverlay");
  if (!overlay) return;
  document.getElementById("modalHeader").innerHTML = _escHtml(title);
  document.getElementById("modalBody").innerHTML = body;
  document.getElementById("modalFooter").innerHTML = footer;
  overlay.style.display = "flex";
}
function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) overlay.style.display = "none";
}
function showConfirm(message, onConfirm, onCancel) {
  showModal({
    title: "确认操作",
    body: `<p>${_escHtml(message)}</p>`,
    footer: `<button class="btn btn--ghost btn--sm" id="_confirmCancelBtn">取消</button><button class="btn btn--danger btn--sm" id="_confirmOkBtn">确认</button>`
  });
  document.getElementById("_confirmOkBtn").onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
  document.getElementById("_confirmCancelBtn").onclick = () => { closeModal(); if (onCancel) onCancel(); };
}

function renderPagination(containerId, total, page, pageSize, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));

  const buildPageTokens = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
    if (currentPage >= totalPages - 3) return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
  };

  let pageButtons = "";
  buildPageTokens().forEach((token) => {
    if (token === "ellipsis") {
      pageButtons += `<span class="pagination__ellipsis" aria-hidden="true">...</span>`;
      return;
    }
    pageButtons += `<button class="pagination__btn${token === currentPage ? " pagination__btn--active" : ""}" data-page="${token}">${token}</button>`;
  });

  container.innerHTML = `
    <div class="pagination">
      <span class="pagination__total">共 ${safeTotal} 条</span>
      <span class="pagination__pages">第 ${currentPage} / ${totalPages} 页</span>
      <button class="pagination__btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>‹ 上一页</button>
      ${pageButtons}
      <button class="pagination__btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>下一页 ›</button>
      <div class="pagination__jump">
        <input class="pagination__jump-input" id="${containerId}_jumpInput" type="number" inputmode="numeric" min="1" max="${totalPages}" placeholder="1-${totalPages}" aria-label="输入页码" />
        <button class="pagination__jump-btn" id="${containerId}_jumpBtn" type="button">跳转</button>
      </div>
      <select class="pagination__size-select" id="${containerId}_sizeSelect">
        ${[10, 20, 50, 100].map((s) => `<option value="${s}" ${s === safePageSize ? "selected" : ""}>${s} 条/页</option>`).join("")}
      </select>
    </div>
  `;

  const triggerPageChange = (targetPage, targetPageSize = safePageSize) => {
    if (typeof onPageChange !== "function") return;
    const p = Math.min(totalPages, Math.max(1, Number(targetPage) || 1));
    onPageChange(p, targetPageSize);
  };

  container.querySelectorAll(".pagination__btn[data-page]").forEach((btn) => {
    btn.onclick = () => {
      const p = Number(btn.getAttribute("data-page"));
      if (Number.isInteger(p)) triggerPageChange(p);
    };
  });

  const jumpInput = document.getElementById(`${containerId}_jumpInput`);
  const jumpBtn = document.getElementById(`${containerId}_jumpBtn`);
  const handleJump = () => {
    if (!jumpInput) return;
    const targetPage = Number(jumpInput.value);
    if (!Number.isInteger(targetPage)) return;
    triggerPageChange(targetPage);
  };
  if (jumpBtn) jumpBtn.onclick = handleJump;
  if (jumpInput) {
    jumpInput.onkeydown = (event) => {
      if (event.key === "Enter") handleJump();
    };
  }

  const sizeSelect = document.getElementById(`${containerId}_sizeSelect`);
  if (sizeSelect) {
    sizeSelect.onchange = (e) => triggerPageChange(1, Number(e.target.value));
  }
}

async function _readResponseBody(res) {
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  try {
    if (contentType.includes("application/json")) return await res.json();
    const text = await res.text();
    return text ? { message: text } : null;
  } catch {
    return null;
  }
}

function getErrorMessage(err, fallback = "未知错误") {
  if (!err) return fallback;
  if (typeof err === "string") return err || fallback;
  if (Array.isArray(err)) {
    const joined = err.map((x) => getErrorMessage(x, "")).filter(Boolean).join("；");
    return joined || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  if (Array.isArray(err.message)) {
    const joined = err.message.map((x) => String(x || "").trim()).filter(Boolean).join("；");
    return joined || fallback;
  }
  if (typeof err.message === "string" && err.message.trim()) return err.message.trim();
  if (typeof err.error === "string" && err.error.trim()) return err.error.trim();
  if (typeof err.statusText === "string" && err.statusText.trim()) return err.statusText.trim();
  return fallback;
}

function _createRequestError(res, payload) {
  const error = new Error(getErrorMessage(payload, `${res.status} ${res.statusText}`.trim()));
  error.status = res.status;
  error.payload = payload || null;
  return error;
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers || {});
  if (options.body != null && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, Object.assign({}, options, { headers }));
  if (res.status === 401) { clearAuth(); window.location.href = LOGIN_PAGE; throw new Error("请先登录"); }
  const data = await _readResponseBody(res);
  if (!res.ok) throw _createRequestError(res, data);
  return data ?? { success: true };
}

function validateRequired(fields) {
  const errors = {};
  Object.entries(fields).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) errors[k] = `${k} 为必填项`;
  });
  return { valid: Object.keys(errors).length === 0, errors };
}
function showFieldError(id, msg) {
  const errEl = document.getElementById(`err-${id}`);
  if (errEl) errEl.textContent = msg;
  const inputEl = document.getElementById(id);
  if (inputEl) inputEl.classList.add("form-input--error");
}
function clearFieldErrors(ids) {
  (ids || []).forEach((id) => {
    const errEl = document.getElementById(`err-${id}`);
    if (errEl) errEl.textContent = "";
    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.classList.remove("form-input--error");
  });
}

function toggleInputVisibility(inputId, triggerEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const nextType = input.type === "password" ? "text" : "password";
  input.type = nextType;
  if (triggerEl) {
    const label = triggerEl.dataset.toggleLabel || "内容";
    const actionText = nextType === "password" ? "显示" : "隐藏";
    triggerEl.textContent = actionText;
    triggerEl.setAttribute("aria-pressed", String(nextType !== "password"));
    triggerEl.setAttribute("aria-label", `${actionText}${label}`);
  }
}

function initInputToggles(root = document) {
  root.querySelectorAll("[data-toggle-target]").forEach((btn) => {
    if (btn.dataset.toggleBound === "true") return;
    btn.dataset.toggleBound = "true";
    btn.addEventListener("click", () => toggleInputVisibility(btn.dataset.toggleTarget, btn));
  });
}

function filterByField(list, field, value) {
  if (!value) return list;
  const lower = String(value).toLowerCase();
  return list.filter((x) => String(x[field] || "").toLowerCase().includes(lower));
}
function filterByDateRange(list, field, from, to) {
  if (!from && !to) return list;
  return list.filter((x) => {
    if (!x[field]) return false;
    const d = new Date(x[field]);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  });
}
function sortBy(list, field, direction) {
  if (!direction) return list;
  return [...list].sort((a, b) => {
    const av = a[field], bv = b[field];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return direction === "desc" ? -cmp : cmp;
  });
}
function calcConvertedQty(qty, fromUnit, toUnit, conversions) {
  if (fromUnit === toUnit) return qty;
  const conv = (conversions || []).find((c) => c.fromUnit === fromUnit && c.toUnit === toUnit);
  return conv ? qty * conv.ratio : qty;
}
function formatProductOption(product) {
  const parts = [product?.name, product?.spec, product?.color]
    .map((x) => String(x ?? "").trim())
    .filter((x) => x);
  return parts.length ? parts.join(" / ") : "-";
}

const _BADGE_MAP = {
  DRAFT:{color:"gray",label:"草稿"}, CONFIRMED:{color:"blue",label:"已确认"}, COMPLETED:{color:"green",label:"已完成"}, CANCELLED:{color:"red",label:"已取消"},
  ISSUED:{color:"green",label:"已开具"}, SUBMITTED:{color:"blue",label:"已提交"}, APPROVED:{color:"green",label:"已审批"}, REJECTED:{color:"red",label:"已拒绝"},
  POSTED:{color:"green",label:"已入库"}, VOID:{color:"red",label:"已作废"}, PRINTED:{color:"blue",label:"已打印"}, CLOSED:{color:"gray",label:"已关闭"}
};
function renderBadge(status) {
  const m = _BADGE_MAP[status];
  if (!m) return `<span class="badge badge--gray"><span class="badge__dot"></span>${_escHtml(status || "")}</span>`;
  return `<span class="badge badge--${m.color}"><span class="badge__dot"></span>${m.label}</span>`;
}

function initNavbar() {
  const user = getUser();
  const navUsername = document.getElementById("navUsername");
  if (navUsername) navUsername.textContent = user.fullName || user.username || "未登录";
  const navRole = document.getElementById("navRole");
  if (navRole) {
    const roles = getRoles();
    if (roles.length) { navRole.textContent = roles[0]; navRole.style.display = ""; } else navRole.style.display = "none";
  }
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.onclick = toggleTheme;
  ensureChangePasswordBtn();
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = () => { clearAuth(); window.location.href = LOGIN_PAGE; };
  applyPermissionUi(document);
}

function ensureChangePasswordBtn() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  let btn = document.getElementById("changePwdBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "changePwdBtn";
    btn.className = "btn btn--default btn--sm";
    btn.type = "button";
    btn.textContent = "修改密码";
    logoutBtn.parentNode.insertBefore(btn, logoutBtn);
  }
  btn.onclick = openChangePasswordModal;
}

function openChangePasswordModal() {
  showModal({
    title: "修改密码",
    body: `<div class="form-item"><label class="form-label form-label--required">原密码</label><input class="form-input" id="oldPassword" type="password" autocomplete="current-password" /><span class="form-error" id="err-oldPassword"></span></div>
      <div class="form-item"><label class="form-label form-label--required">新密码</label><input class="form-input" id="newPassword" type="password" autocomplete="new-password" /><span class="form-error" id="err-newPassword"></span></div>
      <div class="form-item"><label class="form-label form-label--required">确认新密码</label><input class="form-input" id="confirmPassword" type="password" autocomplete="new-password" /><span class="form-error" id="err-confirmPassword"></span></div>`,
    footer: `<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="saveChangePassword()">提交</button>`
  });
}
window.openChangePasswordModal = openChangePasswordModal;

async function saveChangePassword() {
  clearFieldErrors(["oldPassword", "newPassword", "confirmPassword"]);
  const oldPassword = document.getElementById("oldPassword")?.value || "";
  const newPassword = document.getElementById("newPassword")?.value || "";
  const confirmPassword = document.getElementById("confirmPassword")?.value || "";
  if (!oldPassword) showFieldError("oldPassword", "请输入原密码");
  if (!newPassword) showFieldError("newPassword", "请输入新密码");
  if (newPassword && newPassword.length < 6) showFieldError("newPassword", "新密码至少 6 位");
  if (!confirmPassword) showFieldError("confirmPassword", "请再次输入新密码");
  if (newPassword && confirmPassword && newPassword !== confirmPassword) showFieldError("confirmPassword", "两次输入的新密码不一致");
  if (!oldPassword || !newPassword || !confirmPassword || newPassword.length < 6 || newPassword !== confirmPassword) return;
  try {
    await request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword })
    });
    closeModal();
    showToast("success", "密码修改成功，请重新登录");
    clearAuth();
    window.location.href = LOGIN_PAGE;
  } catch (err) {
    const msg = getErrorMessage(err, "");
    if (msg.includes("404") || msg.includes("Cannot POST") || msg.includes("Cannot PATCH")) {
      showToast("error", "后端暂未提供修改密码接口，请联系后端同学补充 /auth/change-password");
    } else {
      showToast("error", "修改密码失败：" + getErrorMessage(err));
    }
  }
}
window.saveChangePassword = saveChangePassword;

function _escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _escAttr(str) {
  return _escHtml(str).replace(/'/g, "&#39;");
}

function getLocalDateInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

requireAuth();
