const API = "http://127.0.0.1:3000/api/v1";
const TOKEN_KEY = "cargo_admin_token";
const USER_KEY = "cargo_admin_user";

function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
function setToken(token) { localStorage.setItem(TOKEN_KEY, token || ""); }
function setUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user || {})); }
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || "{}"); } catch { return {}; } }
function clearAuth() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

function tokenMask(token) {
  if (!token) return "-";
  return token.length <= 24 ? token : token.slice(0, 12) + "..." + token.slice(-10);
}

function safeMsg(err) {
  return err?.message || err?.error || JSON.stringify(err);
}

function getRoles() { return getUser()?.roles || []; }
function getPermissions() { return getUser()?.permissions || []; }
function hasRole(role) { return getRoles().includes(role); }
function hasPermission(permission) { return hasRole("ADMIN") || getPermissions().includes(permission); }
function hasAnyPermission(codes) { return hasRole("ADMIN") || codes.some((c) => getPermissions().includes(c)); }

async function request(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, Object.assign({}, options, { headers }));
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

function renderStatus() {
  const badge = document.getElementById("loginStatus");
  if (!badge) return;
  const logged = !!getToken();
  badge.className = "status " + (logged ? "ok" : "warn");
  badge.textContent = logged ? "已登录" : "未登录";
}

function applyPermissionUi(root = document) {
  root.querySelectorAll("[data-perm-any]").forEach((el) => {
    const perms = (el.getAttribute("data-perm-any") || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (perms.length && !hasAnyPermission(perms)) el.style.display = "none";
  });
  root.querySelectorAll("[data-role-any]").forEach((el) => {
    const roles = (el.getAttribute("data-role-any") || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (roles.length && !roles.some((r) => hasRole(r))) el.style.display = "none";
  });
}

function setupAuthPanel(logElId = "log") {
  const loginBtn = document.getElementById("loginBtn");
  const meBtn = document.getElementById("meBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo = document.getElementById("userInfo");
  const logger = document.getElementById(logElId);

  function log(payload) {
    if (!logger) return;
    logger.textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  }

  function paintUser() {
    const u = getUser();
    userInfo.textContent = u?.username
      ? `当前用户：${u.fullName || u.username} | 角色：${(u.roles || []).join(", ")} | Token: ${tokenMask(getToken())}`
      : "默认账号：admin / admin123";
  }

  if (loginBtn) {
    loginBtn.onclick = async () => {
      try {
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const res = await request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
        setToken(res.data.accessToken);
        setUser({ ...res.data.user, roles: res.data.roles, permissions: res.data.permissions });
        renderStatus();
        paintUser();
        applyPermissionUi();
        log(res);
      } catch (err) {
        log("登录失败: " + safeMsg(err));
      }
    };
  }

  if (meBtn) {
    meBtn.onclick = async () => {
      try {
        const data = await request("/auth/me");
        setUser({ ...getUser(), ...data.data, roles: data.data.roles || [], permissions: data.data.permissions || [] });
        applyPermissionUi();
        log(data);
      } catch (err) {
        log("查询失败: " + safeMsg(err));
      }
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      clearAuth();
      renderStatus();
      paintUser();
      applyPermissionUi();
      log("已退出登录。");
    };
  }

  renderStatus();
  paintUser();
  applyPermissionUi();
  return log;
}
