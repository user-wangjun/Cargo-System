const REGISTER_FIELDS = [
  "roleType",
  "companyName",
  "fullName",
  "phone",
  "password",
  "confirmPassword",
  "inviteCode",
];

function byId(id) {
  return document.getElementById(id);
}

function isPhone(value) {
  return /^\d{11}$/.test(value);
}

function isStrongPassword(value) {
  return /^(?=.*[A-Za-z])(?=.*\d).{7,}$/.test(value);
}

function getRoleType() {
  return byId("roleType")?.value || "EMPLOYEE";
}

function toggleRoleFields() {
  const roleType = getRoleType();
  const inviteCodeLabel = byId("inviteCodeLabel");
  const inviteCodeInput = byId("inviteCode");
  if (inviteCodeLabel) {
    inviteCodeLabel.textContent = roleType === "OWNER" ? "邀请码（老板）" : "邀请码（员工）";
  }
  if (inviteCodeInput) {
    inviteCodeInput.placeholder = roleType === "OWNER" ? "请输入老板邀请码" : "请输入所属公司邀请码（6位）";
  }
  window.clearFieldErrors(["inviteCode"]);
}

function getRegisterFormData() {
  return {
    roleType: getRoleType(),
    companyName: byId("companyName")?.value.trim() || "",
    fullName: byId("fullName")?.value.trim() || "",
    phone: byId("phone")?.value.trim() || "",
    password: byId("password")?.value || "",
    confirmPassword: byId("confirmPassword")?.value || "",
    inviteCode: byId("inviteCode")?.value.trim() || "",
  };
}

export function validateRegisterData(data) {
  const errors = {};

  if (!data.roleType) errors.roleType = "请选择注册身份";
  if (!data.companyName) errors.companyName = "请输入所属/管理公司";
  if (!data.fullName) errors.fullName = "请输入姓名";

  if (!data.phone) {
    errors.phone = "请输入手机号";
  } else if (!isPhone(data.phone)) {
    errors.phone = "手机号必须为 11 位数字";
  }

  if (!data.password) {
    errors.password = "请输入登录密码";
  } else if (!isStrongPassword(data.password)) {
    errors.password = "密码需为字母+数字，且长度大于 6";
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = "请再次输入密码";
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = "两次输入的密码不一致";
  }

  if (!data.inviteCode) {
    errors.inviteCode = "请输入邀请码";
  } else if (data.roleType === "EMPLOYEE" && !/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6}$/.test(data.inviteCode.toUpperCase())) {
    errors.inviteCode = "员工邀请码需为 6 位大写字母+数字组合";
  }

  return errors;
}

export function setRegisterSubmitting(isSubmitting) {
  const button = byId("registerBtn");
  if (!button) return;
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "提交中..." : "提交注册";
}

function applyRegisterErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    window.showFieldError(field, message);
  });
}

async function handleRegister() {
  window.clearFieldErrors(REGISTER_FIELDS);
  const data = getRegisterFormData();
  const errors = validateRegisterData(data);
  if (Object.keys(errors).length > 0) {
    applyRegisterErrors(errors);
    return;
  }

  setRegisterSubmitting(true);
  try {
    const res = await window.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        roleType: data.roleType,
        companyName: data.companyName,
        fullName: data.fullName,
        phone: data.phone,
        username: data.phone,
        password: data.password,
        inviteCode: data.inviteCode,
      }),
    });

    const payload = res?.data || {};
    const token = payload.accessToken || "";
    const user = payload.user || {};
    window.setToken(token);
    window.setUser({
      ...user,
      roles: user.roles || payload.roles || [],
      permissions: user.permissions || payload.permissions || [],
    });

    const isOwner = data.roleType === "OWNER";
    const successTitle = isOwner ? `欢迎创建企业：${data.companyName}` : `欢迎加入企业：${data.companyName}`;
    const successMessage = isOwner
      ? `${data.fullName} 已成为企业老板账号，可在后台管理企业和员工权限。`
      : `${data.fullName} 已注册为企业员工，后续权限由老板在管理界面分配。`;

    window.setAuthFlash({
      type: "success",
      title: successTitle,
      message: successMessage,
      meta: isOwner ? `${data.companyName} · OWNER` : `${data.companyName} · EMPLOYEE`,
      actionText: isOwner ? "去管理员工" : "进入系统",
      actionHref: isOwner ? "./users.html" : "./index.html",
    });

    if (isOwner) {
      window.showToast("success", "老板账号注册成功，正在进入管理端");
    } else {
      window.showToast("success", "员工账号注册成功，正在进入系统");
    }

    if (!window.__CARGO_TEST_NO_REDIRECT__) {
      window.setTimeout(() => {
        window.location.href = "./index.html";
      }, 250);
    }
  } catch (err) {
    const msg = window.getErrorMessage(err);
    const lower = msg.toLowerCase();

    if (lower.includes("account already exists")) {
      window.showFieldError("phone", "该手机号账号已存在");
      return;
    }
    if (lower.includes("owner invite code")) {
      window.showFieldError("inviteCode", "老板邀请码错误");
      return;
    }
    if (lower.includes("company invite code is invalid")) {
      window.showFieldError("inviteCode", "公司邀请码错误或与公司不匹配");
      return;
    }
    if (lower.includes("phone number must be 11 digits")) {
      window.showFieldError("phone", "手机号必须为 11 位数字");
      return;
    }
    if (lower.includes("password must be longer than 6")) {
      window.showFieldError("password", "密码需为字母+数字，且长度大于 6");
      return;
    }

    window.showToast("error", `注册失败：${msg}`);
  } finally {
    setRegisterSubmitting(false);
  }
}

export function initRegisterPage() {
  window.initTheme();
  window.initInputToggles();

  if (window.getToken()) {
    window.location.href = "./index.html";
    return;
  }

  const roleType = byId("roleType");
  if (roleType && roleType.dataset.bound !== "true") {
    roleType.dataset.bound = "true";
    roleType.addEventListener("change", toggleRoleFields);
  }
  toggleRoleFields();

  const registerBtn = byId("registerBtn");
  if (registerBtn && registerBtn.dataset.bound !== "true") {
    registerBtn.dataset.bound = "true";
    registerBtn.addEventListener("click", handleRegister);
  }

  ["phone", "password", "confirmPassword", "inviteCode", "companyName", "fullName"].forEach((id) => {
    const input = byId(id);
    if (!input || input.dataset.enterBound === "true") return;
    input.dataset.enterBound = "true";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleRegister();
    });
  });
}

if (typeof window !== "undefined" && !window.__CARGO_SKIP_AUTO_INIT__) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRegisterPage, { once: true });
  } else {
    initRegisterPage();
  }
}
