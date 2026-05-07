# CargoSystem

CargoSystem 是一个面向中小团队的货运与单据协同管理系统（MVP），覆盖接单、收货、送货、库存、发票与收款申请等核心流程，支持后台 API 与前台页面联动验证。

## 项目目标

- 统一管理主数据：客户、供应商、商品、单位、仓库
- 打通业务闭环：销售订单 -> 收货入库 -> 送货出库 -> 发票与收款
- 提供基于角色的权限控制（RBAC）和基础审计能力
- 支持数据导入与校验，便于从历史表格迁移到系统

## 核心模块

- 认证与权限：登录、用户角色、权限点控制
- 主数据管理：客户、供应商、商品、单位换算、仓库
- 单据流转：销售订单、收货单、送货单、发票、收款申请
- 库存管理：库存台账与库存结余更新
- 审计模块：关键操作记录与追踪

## 技术栈

- Backend：NestJS + TypeORM + PostgreSQL + Swagger
- Frontend：静态页面（统一登录入口，共用一个静态服务）
- 脚本工具：PowerShell + Node.js（本地一键启动/停止）

## 目录结构

```text
CargoSystem/
  backend/      # NestJS 后端服务
  frontend/
    admin/      # 管理端静态页面
    user/       # 用户端静态页面
  data/         # 导入数据、归一化数据与校验结果
  docs/         # 方案文档、API 清单、运行手册
  scripts/      # 一键启动/停止脚本与静态服务脚本
```

## 快速启动（Windows PowerShell）

1. 安装依赖

```powershell
cd backend
npm install
cd ..
```

环境变量配置（首次）：

```powershell
copy backend\.env.example backend\.env
```

请在 `backend/.env` 中至少配置：

- `JWT_SECRET`
- `OWNER_INVITE_CODE`（老板注册邀请码）

2. 启动全部服务

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1
```

3. 访问地址

- Backend API: `http://127.0.0.1:3000/api/v1`
- Frontend Login: `http://127.0.0.1:5173/`（自动跳转到 `/admin/login.html`）
- Frontend Register: `http://127.0.0.1:5173/admin/register.html`

4. 关闭服务

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-all.ps1
```

## 测试账号（仅开发/联调）

- 18800000000 / AdminDemo123
- admin / admin123
- owner / owner123
- finance / finance123
- viewer / viewer123
