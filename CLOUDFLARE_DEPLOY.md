# Cloudflare 纯网页一键部署

这套方案不需要在你的电脑安装 Node.js、pnpm、Wrangler 或项目依赖。依赖安装和构建全部发生在 Cloudflare Workers Builds 中。

## 前提

- 一个 Cloudflare 账户。
- 一个 GitHub 账户。
- 本项目已经放在公开 GitHub 仓库中。Deploy to Cloudflare 目前要求公开的 GitHub 或 GitLab 仓库。
- Resin 已部署，并且其 Admin API 能从公网访问。

## 部署

### 1. 点击部署按钮

打开仓库首页，点击 README 顶部的 **Deploy to Cloudflare** 按钮。

Cloudflare 会要求登录 GitHub 和 Cloudflare，并把模板仓库复制到你的 GitHub 账户。这是正常流程，后续更新也会保留在你的仓库中。

### 2. 保持资源默认设置

在部署配置页面：

- Worker 名称可以保持 `resin-free-proxy-sync`。
- KV 绑定保持 `STATE`。
- Cloudflare 会自动创建并绑定 KV Namespace。
- Cron `*/5 * * * *` 会从 `wrangler.toml` 自动部署。

不需要手工创建 KV，也不需要填写 KV ID。

### 3. 填写 Secret

Cloudflare 会根据 `.dev.vars.example` 显示以下字段：

#### `RESIN_API_BASE`

填写 Resin 服务根地址，例如：

```text
http://服务器IP:2260
```

不要添加末尾 `/api/v1`。HTTP 地址允许使用。

Cloudflare Workers 直接请求裸 IPv4 时可能返回 `1003`。项目会自动把 HTTP 裸 IP 转成等价的 `sslip.io` 主机名，例如把 `http://203.0.113.10:2260` 转成 `http://203-0-113-10.sslip.io:2260`。这个过程仍然使用 HTTP，不需要域名配置或 HTTPS 证书。

#### `RESIN_ADMIN_TOKEN`

复制 Resin 的 Admin Token。你的旧项目中可在下面文件找到：

```text
O:\AIProject\proxyscrape-register-lite\data\config.json
```

只复制字段值到 Cloudflare Secret 表单，不要把 Token 写入 GitHub 仓库。

#### `ADMIN_TOKEN`

自行设置一个至少 32 个字符的长密码。部署后打开 Worker 管理页时使用。

#### `FEED_TOKEN`

再设置一个较长密码，用于保护 `/feed/<FEED_TOKEN>` 订阅地址。不使用 feed 时也可以填写随机长密码。

### 4. 点击部署

确认后点击部署。Cloudflare 将自动：

1. 在 Cloudflare 构建环境中安装 pnpm 依赖。
2. 运行 TypeScript 构建检查。
3. 创建并绑定 Workers KV。
4. 配置每 5 分钟唤醒一次的 Cron Trigger。
5. 上传四项 Secret。
6. 发布 Worker 并提供 `workers.dev` 地址。

这些步骤都发生在 Cloudflare，不会在你的电脑创建 `node_modules`。

## 部署后必须做一次的设置

1. 打开部署结果中的 `workers.dev` 地址。
2. 输入你填写的 `ADMIN_TOKEN`。
3. 选择免费代理来源和协议。
4. 设置 `Asia/Shanghai` 与每天执行时间。
5. 打开“启用每日任务”。
6. 保存后点击一次“立即同步”。
7. 在 Resin 中确认固定订阅已经创建或更新。

## HTTP 说明

HTTP Resin 地址不会被 Cloudflare 强制改成 HTTPS。Worker 支持 `2260` 等自定义端口，并会自动处理 Cloudflare 对裸 IPv4 请求的 `1003` 限制。

需要接受的风险是：通过 HTTP 调用 Resin 时，Admin Token 会明文经过公网。

## 更新项目

Cloudflare 部署流程会在你的 GitHub 账户中创建一份仓库。以后修改或同步仓库后，Workers Builds 可以自动重新构建和部署，不需要本地工具。
