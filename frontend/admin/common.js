// ─────────────────────────────────────────────────────────────────────────────
// 1. 常量与存储工具
// ─────────────────────────────────────────────────────────────────────────────

const API         = resolveApiBaseUrl();
const TOKEN_KEY   = "cargo_admin_token";
const USER_KEY    = "cargo_admin_user";
const THEME_KEY   = "cargo_theme";
const SIDEBAR_KEY = "cargo_sidebar_collapsed";
const LOGIN_PAGE  = "./login.html";
const AUTH_FLASH_KEY = "cargo_admin_auth_flash";

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
function setAuthFlash(messageOrPayload, type = "success") {
  const payload = typeof messageOrPayload === "object" && messageOrPayload
    ? { ...messageOrPayload }
    : { message: messageOrPayload, type };
  if (!payload.message && !payload.title) return;
  sessionStorage.setItem(AUTH_FLASH_KEY, JSON.stringify(payload));
}
function clearAuthFlash() {
  sessionStorage.removeItem(AUTH_FLASH_KEY);
}
function _readAuthFlash(shouldConsume = false) {
  let raw = "";
  let shouldClear = shouldConsume;
  try {
    raw = sessionStorage.getItem(AUTH_FLASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const normalized = {
      title: parsed?.title ? String(parsed.title) : "",
      message: parsed?.message ? String(parsed.message) : "",
      type: String(parsed?.type || "success"),
      meta: parsed?.meta ? String(parsed.meta) : "",
      actionText: parsed?.actionText ? String(parsed.actionText) : "",
      actionHref: parsed?.actionHref ? String(parsed.actionHref) : "",
    };
    if (!normalized.title && !normalized.message) return null;
    return normalized;
  } catch {
    shouldClear = true;
    return null;
  } finally {
    if (shouldClear || !raw) clearAuthFlash();
  }
}
function peekAuthFlash() {
  return _readAuthFlash(false);
}
function consumeAuthFlash() {
  return _readAuthFlash(true);
}

function isLoginPage() {
  return window.location.pathname.endsWith("/login.html") || window.location.pathname.endsWith("\\login.html");
}

function shouldSkipAuthRedirect() {
  return document.body?.getAttribute("data-require-auth") === "false";
}

function requireAuth() {
  if (isLoginPage() || shouldSkipAuthRedirect()) return;
  if (!getToken()) {
    window.location.href = LOGIN_PAGE;
  }
}

function getUserProfile(user = getUser()) {
  return {
    realName: String(user?.realName || user?.fullName || "").trim(),
    phone: String(user?.phone || "").trim(),
    email: String(user?.email || "").trim(),
    birthday: String(user?.birthday || "").trim(),
    gender: String(user?.gender || "").trim(),
    address: String(user?.address || "").trim(),
    updatedAt: String(user?.updatedAt || "").trim(),
  };
}

function isValidPhone(value = "") {
  return /^1\d{10}$/.test(String(value || "").trim());
}

function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function hasProfileVerified(profile = getUserProfile()) {
  return Boolean(profile.realName);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 权限工具
// ─────────────────────────────────────────────────────────────────────────────

function getRoles()       { return getUser()?.roles || []; }
function getPermissions() { return getUser()?.permissions || []; }
function hasRole(role)    { return getRoles().includes(role); }
function hasPermission(permission) {
  return hasRole("ADMIN") || getPermissions().includes(permission);
}
function hasAnyPermission(codes) {
  return hasRole("ADMIN") || codes.some((c) => getPermissions().includes(c));
}

function applyPermissionUi(root = document) {
  root.querySelectorAll("[data-perm-any]").forEach((el) => {
    const perms = (el.getAttribute("data-perm-any") || "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    if (perms.length && !hasAnyPermission(perms)) el.style.display = "none";
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 主题管理
// ─────────────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "light" ? "dark" : "light");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 布局管理
// ─────────────────────────────────────────────────────────────────────────────

function initSidebar() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
  if (collapsed) {
    document.body.classList.add("sidebar-collapsed");
  } else {
    document.body.classList.remove("sidebar-collapsed");
  }
  _updateCollapseIcon();
}

function toggleSidebar() {
  const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_KEY, String(isCollapsed));
  _updateCollapseIcon();
}

function _updateCollapseIcon() {
  const btn = document.getElementById("collapseBtn");
  if (!btn) return;
  const isCollapsed = document.body.classList.contains("sidebar-collapsed");
  btn.setAttribute("aria-pressed", String(isCollapsed));
}

function initMobileDrawer() {
  const hamburger = document.getElementById("hamburgerBtn");
  const sidebar   = document.querySelector(".layout-sidebar");
  const overlay   = document.querySelector(".drawer-overlay");
  if (!hamburger) return;

  hamburger.addEventListener("click", () => {
    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    if (isMobile) {
      if (sidebar)  sidebar.classList.toggle("mobile-open");
      if (overlay)  overlay.classList.toggle("active");
      return;
    }
    toggleSidebar();
    if (sidebar) sidebar.classList.remove("mobile-open");
    if (overlay) overlay.classList.remove("active");
  });

  if (overlay) {
    overlay.addEventListener("click", () => {
      if (sidebar)  sidebar.classList.remove("mobile-open");
      overlay.classList.remove("active");
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Toast 通知
// ─────────────────────────────────────────────────────────────────────────────

const _TOAST_ICONS = {
  success: "✅",
  error:   "❌",
  warning: "⚠️",
  info:    "ℹ️",
};

const _TOAST_DEFAULTS = {
  success: 3000,
  error:   5000,
  warning: 4000,
  info:    4000,
};

function showToast(type, message, duration) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const ms = duration != null ? duration : (_TOAST_DEFAULTS[type] ?? 4000);

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__icon">${_TOAST_ICONS[type] || ""}</span>
<span class="toast__msg">${_escHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 200ms";
    setTimeout(() => toast.remove(), 220);
  }, ms);
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _escAttr(str) {
  return _escHtml(str).replace(/'/g, "&#39;");
}

function getLocalDateInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Modal 弹窗
// ─────────────────────────────────────────────────────────────────────────────

function showModal({ title = "", body = "", footer = "", maxWidth = "" } = {}) {
  const overlay = document.getElementById("modalOverlay");
  const header  = document.getElementById("modalHeader");
  const bodyEl  = document.getElementById("modalBody");
  const footerEl = document.getElementById("modalFooter");
  const modal = document.getElementById("modal");
  if (!overlay) return;

  if (header)   header.innerHTML  = _escHtml(title);
  if (bodyEl)   bodyEl.innerHTML  = body;
  if (footerEl) footerEl.innerHTML = footer;
  if (modal) {
    if (maxWidth) modal.style.maxWidth = maxWidth;
    else modal.style.removeProperty("max-width");
  }

  overlay.style.display = "flex";
}

function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) overlay.style.display = "none";
}

function showConfirm(message, onConfirm, onCancel) {
  const footer = `
    <button class="btn btn--ghost btn--sm" id="_confirmCancelBtn">取消</button>
    <button class="btn btn--danger btn--sm" id="_confirmOkBtn">确认</button>`;

  showModal({ title: "确认操作", body: `<p>${_escHtml(message)}</p>`, footer });

  const okBtn     = document.getElementById("_confirmOkBtn");
  const cancelBtn = document.getElementById("_confirmCancelBtn");

  if (okBtn) {
    okBtn.onclick = () => {
      closeModal();
      if (typeof onConfirm === "function") onConfirm();
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      closeModal();
      if (typeof onCancel === "function") onCancel();
    };
  }
}

let _receiptPrintDocHtml = "";

function _toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function _formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, _toNumber(value)));
}

function _formatDate(value) {
  if (!value) return getLocalDateInputValue(new Date());
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return getLocalDateInputValue(d);
}

function _resolveOrderAmount(order) {
  const direct = _toNumber(order?.totalAmount ?? order?.amount);
  if (direct > 0) return direct;
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, item) => {
    const itemAmount = _toNumber(item?.amount ?? item?.lineAmount ?? item?.totalAmount);
    if (itemAmount > 0) return sum + itemAmount;
    return sum + _toNumber(item?.orderedQty) * _toNumber(item?.unitPrice);
  }, 0);
}

function _toRmbUppercase(amount) {
  const num = Math.max(0, _toNumber(amount));
  if (num === 0) return "零元整";
  const fraction = ["角", "分"];
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [["元", "万", "亿", "兆"], ["", "拾", "佰", "仟"]];
  let head = "";
  let s = "";
  const cents = Math.round(num * 100);
  const integer = Math.floor(cents / 100);
  const decimal = cents % 100;

  if (integer > 9999999999999) return "金额过大";

  const jiao = Math.floor(decimal / 10);
  const fen = decimal % 10;
  s += (jiao ? digit[jiao] + fraction[0] : "");
  s += (fen ? digit[fen] + fraction[1] : "");
  if (!s) s = "整";

  let n = integer;
  for (let i = 0; i < unit[0].length && n > 0; i += 1) {
    let p = "";
    for (let j = 0; j < unit[1].length && n > 0; j += 1) {
      p = digit[n % 10] + unit[1][j] + p;
      n = Math.floor(n / 10);
    }
    p = p.replace(/(零.)*零$/, "").replace(/^$/, "零");
    head = p + unit[0][i] + head;
  }
  head = head
    .replace(/(零.)*零元/, "元")
    .replace(/(零.)+/g, "零")
    .replace(/^整$/, "零元整");
  return head + s;
}

function _buildReceiptPrintDocument(receiptInnerHtml) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>收据打印</title>
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #111; }
    .receipt-sheet { width: 780px; margin: 0 auto; border: 1px solid #111; padding: 20px; box-sizing: border-box; }
    .receipt-head { text-align: center; margin-bottom: 14px; }
    .receipt-title { margin: 0; font-size: 30px; letter-spacing: 6px; font-weight: 700; }
    .receipt-subtitle { margin-top: 6px; font-size: 13px; color: #333; }
    .receipt-meta { display: grid; grid-template-columns: 1fr 1fr; row-gap: 6px; column-gap: 24px; font-size: 14px; margin-bottom: 12px; }
    .receipt-label { color: #555; }
    .receipt-line { border: 1px solid #111; margin-bottom: 10px; }
    .receipt-line__row { display: grid; grid-template-columns: 120px 1fr; min-height: 40px; border-bottom: 1px solid #111; }
    .receipt-line__row:last-child { border-bottom: none; }
    .receipt-line__label { padding: 10px; border-right: 1px solid #111; background: #f7f7f7; }
    .receipt-line__value { padding: 10px; }
    .receipt-amount { display: grid; grid-template-columns: 120px 1fr 120px 1fr; border-top: 1px solid #111; }
    .receipt-items table { width: 100%; border-collapse: collapse; }
    .receipt-items th, .receipt-items td { border: 1px solid #111; padding: 8px; font-size: 13px; }
    .receipt-items th { background: #f7f7f7; text-align: left; }
    .receipt-sign { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; font-size: 14px; }
    .receipt-sign__cell { border-top: 1px solid #111; padding-top: 8px; min-height: 46px; }
    .receipt-note { margin-top: 12px; font-size: 12px; color: #555; }
  </style>
</head>
<body>
${receiptInnerHtml}
</body>
</html>`;
}

function printCurrentReceipt() {
  if (!_receiptPrintDocHtml) {
    showToast("error", "暂无可打印的收据");
    return;
  }
  const win = window.open("", "_blank", "width=980,height=760");
  if (!win) {
    showToast("error", "浏览器拦截了弹窗，请允许后重试");
    return;
  }
  win.document.open();
  win.document.write(_receiptPrintDocHtml);
  win.document.close();
  win.focus();
  win.print();
}

function showOrderReceiptModal(order = {}, options = {}) {
  const user = getUser() || {};
  const amount = _toNumber(options.amount != null ? options.amount : _resolveOrderAmount(order));
  const orderNo = String(order.orderNo || order.id || "-");
  const companyName = String(options.companyName || user.companyName || "Cargo 管理系统").trim() || "Cargo 管理系统";
  const payerName = String(options.payerName || order.customerName || "—");
  const receivedDate = _formatDate(options.receivedDate || order.orderDate || new Date());
  const receiptNo = String(options.receiptNo || `RCV-${orderNo}`.replace(/\s+/g, ""));
  const purpose = String(options.purpose || `销售货款（订单号：${orderNo}）`);
  const operatorName = String(options.operatorName || user.fullName || user.username || "经办人");
  const remark = String(options.remark || order.remarks || "—");
  const currency = String(options.currency || "人民币");

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items.length
    ? items.map((item, idx) => {
      const qty = _toNumber(item.orderedQty);
      const unitPrice = _toNumber(item.unitPrice);
      const lineAmount = _toNumber(item.amount || qty * unitPrice);
      const product = String(item.productLabel || item.productName || item.productId || "—");
      return `<tr>
        <td>${idx + 1}</td>
        <td>${_escHtml(product)}</td>
        <td>${_escHtml(_formatMoney(qty))}</td>
        <td>${_escHtml(String(item.unitCode || item.unitId || "—"))}</td>
        <td>${_escHtml(_formatMoney(unitPrice))}</td>
        <td>${_escHtml(_formatMoney(lineAmount))}</td>
      </tr>`;
    }).join("")
    : `<tr><td>1</td><td>${_escHtml(purpose)}</td><td>1.00</td><td>项</td><td>${_escHtml(_formatMoney(amount))}</td><td>${_escHtml(_formatMoney(amount))}</td></tr>`;

  const receiptInnerHtml = `
    <section class="receipt-sheet">
      <header class="receipt-head">
        <h2 class="receipt-title">收 据</h2>
        <div class="receipt-subtitle">${_escHtml(companyName)}</div>
      </header>

      <div class="receipt-meta">
        <div><span class="receipt-label">收据编号：</span><strong>${_escHtml(receiptNo)}</strong></div>
        <div><span class="receipt-label">日期：</span><strong>${_escHtml(receivedDate)}</strong></div>
        <div><span class="receipt-label">收款单位：</span><strong>${_escHtml(companyName)}</strong></div>
        <div><span class="receipt-label">付款单位：</span><strong>${_escHtml(payerName)}</strong></div>
      </div>

      <div class="receipt-line">
        <div class="receipt-line__row">
          <div class="receipt-line__label">收款事由</div>
          <div class="receipt-line__value">${_escHtml(purpose)}</div>
        </div>
        <div class="receipt-amount">
          <div class="receipt-line__label">币种</div>
          <div class="receipt-line__value">${_escHtml(currency)}</div>
          <div class="receipt-line__label">金额（小写）</div>
          <div class="receipt-line__value">¥ ${_escHtml(_formatMoney(amount))}</div>
        </div>
        <div class="receipt-line__row">
          <div class="receipt-line__label">金额（大写）</div>
          <div class="receipt-line__value">${_escHtml(_toRmbUppercase(amount))}</div>
        </div>
        <div class="receipt-line__row">
          <div class="receipt-line__label">备注</div>
          <div class="receipt-line__value">${_escHtml(remark)}</div>
        </div>
      </div>

      <div class="receipt-items">
        <table>
          <thead>
            <tr>
              <th style="width:56px;">序号</th>
              <th>项目</th>
              <th style="width:110px;">数量</th>
              <th style="width:90px;">单位</th>
              <th style="width:120px;">单价</th>
              <th style="width:130px;">金额</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      <div class="receipt-sign">
        <div class="receipt-sign__cell">收款单位（盖章）</div>
        <div class="receipt-sign__cell">经办人：${_escHtml(operatorName)}</div>
        <div class="receipt-sign__cell">复核人：</div>
      </div>
      <div class="receipt-note">说明：本收据由系统依据订单信息自动生成，供业务留存与对账使用。</div>
    </section>
  `;

  _receiptPrintDocHtml = _buildReceiptPrintDocument(receiptInnerHtml);
  showModal({
    title: "收据预览",
    body: receiptInnerHtml,
    footer: `
      <button class="btn btn--default btn--sm" id="_receiptPrintBtn">打印收据</button>
      <button class="btn btn--primary btn--sm" onclick="closeModal()">关闭</button>
    `,
    maxWidth: "900px",
  });

  const printBtn = document.getElementById("_receiptPrintBtn");
  if (printBtn) printBtn.onclick = printCurrentReceipt;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. 分页
// ─────────────────────────────────────────────────────────────────────────────

function renderPagination(containerId, total, page, pageSize, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const safeTotal = Math.max(0, Number(total) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));

  const buildPageTokens = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis", totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
  };

  const tokens = buildPageTokens();
  let pageButtons = "";
  tokens.forEach((token) => {
    if (token === "ellipsis") {
      pageButtons += `<span class="pagination__ellipsis" aria-hidden="true">...</span>`;
      return;
    }
    const active = token === currentPage ? " pagination__btn--active" : "";
    pageButtons += `<button class="pagination__btn${active}" data-page="${token}">${token}</button>`;
  });

  container.innerHTML = `
    <div class="pagination">
      <span class="pagination__total">共 ${safeTotal} 条</span>
      <span class="pagination__pages">第 ${currentPage} / ${totalPages} 页</span>
      <button class="pagination__btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>‹ 上一页</button>
      ${pageButtons}
      <button class="pagination__btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>下一页 ›</button>
      <div class="pagination__jump">
        <input
          class="pagination__jump-input"
          id="${containerId}_jumpInput"
          type="number"
          inputmode="numeric"
          min="1"
          max="${totalPages}"
          placeholder="1-${totalPages}"
          aria-label="输入页码"
        />
        <button class="pagination__jump-btn" id="${containerId}_jumpBtn" type="button">跳转</button>
      </div>
      <select class="pagination__size-select" id="${containerId}_sizeSelect">
        ${[10, 20, 50, 100].map((s) =>
          `<option value="${s}" ${s === safePageSize ? "selected" : ""}>${s} 条/页</option>`
        ).join("")}
      </select>
    </div>`;

  const triggerPageChange = (targetPage, targetPageSize = safePageSize) => {
    if (typeof onPageChange !== "function") return;
    const p = Math.min(totalPages, Math.max(1, Number(targetPage) || 1));
    onPageChange(p, targetPageSize);
  };

  container.querySelectorAll(".pagination__btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.getAttribute("data-page"), 10);
      if (!isNaN(p)) triggerPageChange(p);
    });
  });

  const jumpInput = document.getElementById(`${containerId}_jumpInput`);
  const jumpBtn = document.getElementById(`${containerId}_jumpBtn`);
  const handleJump = () => {
    if (!jumpInput) return;
    const targetPage = Number(jumpInput.value);
    if (!Number.isInteger(targetPage)) return;
    triggerPageChange(targetPage);
  };
  if (jumpBtn) jumpBtn.addEventListener("click", handleJump);
  if (jumpInput) {
    jumpInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleJump();
    });
  }

  const sizeSelect = document.getElementById(`${containerId}_sizeSelect`);
  if (sizeSelect) {
    sizeSelect.addEventListener("change", () => {
      const newSize = parseInt(sizeSelect.value, 10);
      if (!isNaN(newSize)) triggerPageChange(1, newSize);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 骨架屏
// ─────────────────────────────────────────────────────────────────────────────

function showSkeleton(containerId, rows = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = "";
  for (let i = 0; i < rows; i++) {
    html += `<div class="skeleton skeleton--rect" style="margin-bottom:8px;"></div>`;
  }
  container.innerHTML = html;
  container.setAttribute("data-skeleton", "true");
}

function hideSkeleton(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.getAttribute("data-skeleton") === "true") {
    container.innerHTML = "";
    container.removeAttribute("data-skeleton");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. API 请求封装
// ─────────────────────────────────────────────────────────────────────────────

async function _readResponseBody(res) {
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  try {
    if (contentType.includes("application/json")) {
      return await res.json();
    }
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
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API + path, Object.assign({}, options, { headers }));

  if (res.status === 401 && !isLoginPage() && !shouldSkipAuthRedirect()) {
    clearAuth();
    window.location.href = LOGIN_PAGE;
    throw new Error("请先登录");
  }

  const data = await _readResponseBody(res);
  if (!res.ok) throw _createRequestError(res, data);
  return data ?? { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. 表单工具
// ─────────────────────────────────────────────────────────────────────────────

function validateRequired(fields) {
  const errors = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "" ||
        (Array.isArray(value) && value.length === 0)) {
      errors[key] = `${key} 为必填项`;
    }
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// 11. 数据工具
// ─────────────────────────────────────────────────────────────────────────────

function filterByField(list, field, value) {
  if (value === null || value === undefined || value === "") return list;
  const lower = String(value).toLowerCase();
  return list.filter((item) => {
    const val = item[field];
    if (val === null || val === undefined) return false;
    return String(val).toLowerCase().includes(lower);
  });
}

function filterByDateRange(list, field, from, to) {
  if (!from && !to) return list;
  return list.filter((item) => {
    const val = item[field];
    if (!val) return false;
    const date = new Date(val);
    if (from && date < new Date(from)) return false;
    if (to   && date > new Date(to + "T23:59:59")) return false;
    return true;
  });
}

function sortBy(list, field, direction) {
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

function calcConvertedQty(qty, fromUnit, toUnit, conversions) {
  if (fromUnit === toUnit) return qty;
  const conv = (conversions || []).find(
    (c) => c.fromUnit === fromUnit && c.toUnit === toUnit
  );
  if (!conv) return qty;
  return qty * conv.ratio;
}

function formatProductOption(product) {
  const parts = [product?.name, product?.spec, product?.color]
    .map((x) => String(x ?? "").trim())
    .filter((x) => x);
  return parts.length ? parts.join(" / ") : "-";
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. 状态标签
// ─────────────────────────────────────────────────────────────────────────────

const _BADGE_MAP = {
  DRAFT:     { color: "gray",  label: "草稿"  },
  CONFIRMED: { color: "blue",  label: "已确认" },
  COMPLETED: { color: "green", label: "已完成" },
  CANCELLED: { color: "red",   label: "已取消" },
  ISSUED:    { color: "green", label: "已开具" },
  SUBMITTED: { color: "blue",  label: "已提交" },
  APPROVED:  { color: "green", label: "已审批" },
  REJECTED:  { color: "red",   label: "已拒绝" },
  POSTED:    { color: "green", label: "已入库" },
  VOID:      { color: "red",   label: "已作废" },
  PRINTED:   { color: "blue",  label: "已打印" },
  CLOSED:    { color: "gray",  label: "已关闭" },
};

function renderBadge(status) {
  const entry = _BADGE_MAP[status];
  if (!entry) {
    return `<span class="badge badge--gray"><span class="badge__dot"></span>${_escHtml(status || "")}</span>`;
  }
  return `<span class="badge badge--${entry.color}"><span class="badge__dot"></span>${entry.label}</span>`;
}

function renderAuthFlashBanner(container, flash) {
  if (!container || !flash) return false;
  const title = flash.title || "欢迎使用 Cargo 管理系统";
  const message = flash.message || "";
  const meta = flash.meta
    ? `<span class="badge badge--blue"><span class="badge__dot"></span>${_escHtml(flash.meta)}</span>`
    : "";
  const action = flash.actionText && flash.actionHref
    ? `<a class="btn btn--primary btn--sm" href="${_escAttr(flash.actionHref)}">${_escHtml(flash.actionText)}</a>`
    : "";
  container.innerHTML = `
    <div>
      <div class="welcome-banner__eyebrow">
        <span>新企业已就绪</span>
        ${meta}
      </div>
      <h2 class="welcome-banner__title">${_escHtml(title)}</h2>
      <p class="welcome-banner__desc">${_escHtml(message)}</p>
    </div>
    <div class="welcome-banner__actions">
      ${action}
      <button class="btn btn--ghost btn--sm welcome-banner__close" type="button" id="authWelcomeBannerClose">稍后处理</button>
    </div>`;
  container.hidden = false;
  const closeBtn = document.getElementById("authWelcomeBannerClose");
  if (closeBtn) {
    closeBtn.onclick = () => {
      container.hidden = true;
    };
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. 顶部导航栏初始化
// ─────────────────────────────────────────────────────────────────────────────

function initNavbar() {
  const user = getUser();

  // 渲染用户名
  const navUsername = document.getElementById("navUsername");
  if (navUsername) {
    navUsername.textContent = user.fullName || user.username || "未登录";
  }

  // 渲染角色标签
  const navRole = document.getElementById("navRole");
  if (navRole) {
    const roles = getRoles();
    if (roles.length > 0) {
      navRole.textContent = roles[0];
      navRole.style.display = "";
    } else {
      navRole.style.display = "none";
    }
  }

  ensureProfileStatusBadge();

  // 主题按钮
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  ensureProfileBtn();
  ensureChangePasswordBtn();

  // 退出按钮
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth();
      window.location.href = LOGIN_PAGE;
    });
  }

  // 应用权限 UI
  applyPermissionUi(document);

  const flash = peekAuthFlash();
  const banner = document.getElementById("authWelcomeBanner");
  if (flash && banner) {
    renderAuthFlashBanner(banner, flash);
    clearAuthFlash();
  } else if (flash) {
    clearAuthFlash();
    showToast(flash.type, flash.message || flash.title);
  }

  void syncCurrentUserFromServer();
}

async function syncCurrentUserFromServer() {
  if (!getToken()) return;
  try {
    const res = await request("/auth/me");
    const me = res?.data || {};
    const existing = getUser();
    const merged = {
      ...existing,
      ...me,
      roles: me.roles || existing.roles || [],
      permissions: me.permissions || existing.permissions || [],
    };
    setUser(merged);
    const navUsername = document.getElementById("navUsername");
    if (navUsername) {
      navUsername.textContent = merged.fullName || merged.username || "未登录";
    }
    const navRole = document.getElementById("navRole");
    if (navRole) {
      const roles = merged.roles || [];
      if (roles.length > 0) {
        navRole.textContent = roles[0];
        navRole.style.display = "";
      } else {
        navRole.style.display = "none";
      }
    }
    ensureProfileStatusBadge();
    applyPermissionUi(document);
  } catch {
    // ignore
  }
}

function ensureProfileStatusBadge() {
  const navUser = document.querySelector(".nav-bar__user");
  if (!navUser) return;
  let badge = document.getElementById("profileStatusBadge");
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "profileStatusBadge";
    badge.className = "badge nav-bar__profile-status";
    navUser.appendChild(badge);
  }
  const verified = hasProfileVerified();
  badge.classList.remove("badge--green", "badge--orange");
  badge.classList.add(verified ? "badge--green" : "badge--orange");
  badge.textContent = verified ? "资料已完善" : "待完善";
  badge.title = verified ? "个人资料已完善" : "请补充个人资料";
}

function ensureProfileBtn() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn || !logoutBtn.parentNode) return;
  let btn = document.getElementById("profileBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "profileBtn";
    btn.className = "btn btn--default btn--sm";
    btn.textContent = "个人信息";
    btn.type = "button";
    logoutBtn.parentNode.insertBefore(btn, logoutBtn);
  }
  btn.onclick = openProfileModal;
}

function ensureChangePasswordBtn() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  let btn = document.getElementById("changePwdBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "changePwdBtn";
    btn.className = "btn btn--default btn--sm";
    btn.textContent = "修改密码";
    btn.type = "button";
    logoutBtn.parentNode.insertBefore(btn, logoutBtn);
  }
  btn.onclick = openChangePasswordModal;
}

async function openProfileModal() {
  let profile = getUserProfile();
  try {
    const res = await request("/auth/me");
    const me = res?.data || {};
    const existing = getUser();
    const merged = {
      ...existing,
      ...me,
      roles: me.roles || existing.roles || [],
      permissions: me.permissions || existing.permissions || [],
    };
    setUser(merged);
    profile = getUserProfile(merged);
    const navUsername = document.getElementById("navUsername");
    if (navUsername) navUsername.textContent = merged.fullName || merged.username || "未登录";
    ensureProfileStatusBadge();
  } catch {
    // 使用本地缓存兜底
  }

  const gender = profile.gender || "UNKNOWN";
  showModal({
    title: "个人信息",
    body: `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <div class="form-item">
          <label class="form-label form-label--required">真实姓名</label>
          <input class="form-input" id="profileRealName" value="${_escAttr(profile.realName)}" placeholder="请输入真实姓名" />
          <span class="form-error" id="err-profileRealName"></span>
        </div>
        <div class="form-item">
          <label class="form-label">手机号码</label>
          <input class="form-input" id="profilePhone" value="${_escAttr(profile.phone)}" placeholder="请输入11位手机号" maxlength="11" />
          <span class="form-error" id="err-profilePhone"></span>
        </div>
        <div class="form-item">
          <label class="form-label">邮箱</label>
          <input class="form-input" id="profileEmail" value="${_escAttr(profile.email)}" placeholder="请输入邮箱" />
          <span class="form-error" id="err-profileEmail"></span>
        </div>
        <div class="form-item">
          <label class="form-label">性别</label>
          <select class="form-select" id="profileGender">
            <option value="UNKNOWN" ${gender === "UNKNOWN" ? "selected" : ""}>未设置</option>
            <option value="MALE" ${gender === "MALE" ? "selected" : ""}>男</option>
            <option value="FEMALE" ${gender === "FEMALE" ? "selected" : ""}>女</option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">出生日期</label>
          <input class="form-input" id="profileBirthday" type="date" value="${_escAttr(profile.birthday)}" />
        </div>
        <div class="form-item" style="grid-column:1 / -1;">
          <label class="form-label">联系地址</label>
          <input class="form-input" id="profileAddress" value="${_escAttr(profile.address)}" placeholder="请输入联系地址" />
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--color-text-secondary);">为降低敏感信息风险，系统不采集和保存身份证号。</div>`,
    footer: `<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="saveProfileInfo()">保存</button>`
  });
}
window.openProfileModal = openProfileModal;

async function saveProfileInfo() {
  clearFieldErrors(["profileRealName", "profilePhone", "profileEmail"]);
  const realName = String(document.getElementById("profileRealName")?.value || "").trim();
  const phone = String(document.getElementById("profilePhone")?.value || "").trim();
  const email = String(document.getElementById("profileEmail")?.value || "").trim();
  const gender = String(document.getElementById("profileGender")?.value || "UNKNOWN").trim();
  const birthday = String(document.getElementById("profileBirthday")?.value || "").trim();
  const address = String(document.getElementById("profileAddress")?.value || "").trim();

  let hasError = false;
  if (!realName) {
    showFieldError("profileRealName", "请输入真实姓名");
    hasError = true;
  }
  if (phone && !isValidPhone(phone)) {
    showFieldError("profilePhone", "手机号应为11位数字");
    hasError = true;
  }
  if (email && !isValidEmail(email)) {
    showFieldError("profileEmail", "邮箱格式不正确");
    hasError = true;
  }
  if (hasError) return;

  try {
    const res = await request("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ realName, phone, email, gender, birthday, address }),
    });
    const me = res?.data || {};
    const existing = getUser();
    const merged = {
      ...existing,
      ...me,
      roles: me.roles || existing.roles || [],
      permissions: me.permissions || existing.permissions || [],
    };
    setUser(merged);
    const navUsername = document.getElementById("navUsername");
    if (navUsername) navUsername.textContent = merged.fullName || merged.username || "未登录";
    ensureProfileStatusBadge();
    closeModal();
    showToast("success", "个人信息已保存到服务器");
  } catch (err) {
    const msg = getErrorMessage(err, "保存失败");
    if (msg.toLowerCase().includes("phone already exists")) {
      showFieldError("profilePhone", "该手机号已被其他账号占用");
      return;
    }
    showToast("error", "保存失败：" + msg);
  }
}
window.saveProfileInfo = saveProfileInfo;

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

requireAuth();
