# Color Master 云端服务配置指南

本应用已集成 **Clerk**（认证）+ **Supabase**（数据库/Edge Functions）+ **Stripe**（付费，可选）。

部署云端功能前，请按以下步骤配置。

---

## 1. Clerk（认证）

1. 访问 [Clerk Dashboard](https://dashboard.clerk.com/) 创建应用。
2. 在 **API Keys** 页面复制：
   - `Publishable key`（前端用，如 `pk_test_...`）
   - `Secret key`（仅后端/Edge Functions 用，如 `sk_test_...`）
3. 在 **JWT Templates** 页面找到你的 Frontend API 地址，例如 `https://clerk.your-app.clerk.accounts.dev`，JWKS 地址为：
   ```
   https://clerk.your-app.clerk.accounts.dev/.well-known/jwks.json
   ```
   这个地址要填到 Supabase Edge Functions 的 `CLERK_JWKS_URL`。
4. （可选）在 Clerk Dashboard 配置允许的发件域名、登录方式（邮箱/密码、Magic Link）。

---

## 2. Supabase（数据库 + Edge Functions）

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard) 创建项目。
2. 记录项目 URL（`https://<project-ref>.supabase.co`）和 `anon` / `service_role` key。
3. 安装 Supabase CLI 并登录：
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <project-ref>
   ```
4. 运行数据库迁移：
   ```bash
   supabase db push
   ```
   或手动在 Supabase SQL Editor 执行 `supabase/migrations/001_cloud_profiles.sql`。
5. 部署 Edge Function：
   ```bash
   supabase functions deploy profiles --no-verify-jwt
   ```
6. 设置 Edge Functions 环境变量：
   ```bash
   supabase secrets set CLERK_JWKS_URL=https://clerk.your-app.clerk.accounts.dev/.well-known/jwks.json
   supabase secrets set CLERK_SECRET_KEY=sk_test_...
   ```
   `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 自动注入，无需手动设置。

---

## 3. Vercel（前端部署）

在项目设置的 **Environment Variables** 中添加：

| 变量名 | 值 | 环境 |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Production / Preview / Development |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Production / Preview / Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...`（Supabase anon key，仅用于调用 Edge Functions） | Production / Preview / Development |

重新部署后生效。

---

## 4. Stripe（付费功能，第二阶段）

当前代码已预留付费入口，但**第一阶段默认不强制付费**。如需开启：

1. 在 [Stripe Dashboard](https://dashboard.stripe.com/) 创建产品和价格（Price ID）。
2. 创建 Edge Function `create-checkout-session` 和 `stripe-webhooks`。
3. 在 Supabase 中设置 Stripe secrets：
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. 在前端 `.env` 中添加：
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
5. 启用 `ProfileSettings` 中的付费检查逻辑（目前上传按钮仅在登录+云端配置正确时启用，付费墙代码需额外接入）。

---

## 本地开发

复制 `.env.example` 为 `.env.local` 并填入真实值：

```bash
cp .env.example .env.local
```

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

运行：

```bash
npm run dev
```

---

## 验证

配置完成后：

1. `npm run check` 应通过（lint + 测试 + 构建）。
2. 打开应用 → 完成校准 → 进入「配置与备份」→ 点击「保存到云端」→ 应弹出 Clerk 登录/注册窗口。
3. 登录后，备份列表应能读取、上传、下载、删除。

---

## 安全提醒

- 不要把 `CLERK_SECRET_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY` 暴露到前端。
- `.env.local` 已在 `.gitignore` 中，不会被提交。
- 云端数据通过 Clerk JWT 在 Edge Function 中验证，用户只能访问自己的配置。
