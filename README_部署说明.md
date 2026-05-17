# 情侣99件事 · Supabase 前端写死密码版

本版本已经帮你填好了 Supabase 配置，可以直接上传 GitHub。

## 当前已配置

```js
window.COUPLE_SUPABASE = {
  url: "https://ojjmtlegorgcqvbretgb.supabase.co",
  anonKey: "sb_publishable_azSNA2djUl5eMgH0TlYa9Q_WHXD7WRk",
  bucket: "couple-photos"
};
```

登录密码写在 `index.html`：

```js
window.COUPLE_LOCAL_USERS = [
  { role: "wang", name: "小王同学", password: "20040624", avatar: "assets/avatars/wang.webp" },
  { role: "han", name: "小韩同学", password: "20040519", avatar: "assets/avatars/han.webp" }
];
```

## 你现在的进度

你已经完成了：拿到 Supabase Project URL 和 publishable key。

下一步还需要完成：

1. 在 Supabase SQL Editor 执行数据库脚本。
2. 创建 Storage bucket：`couple-photos`。
3. 本地测试。
4. 上传 GitHub。
5. 部署 Vercel。

## 第一步：执行数据库脚本

进入 Supabase 项目后台：

`SQL Editor` → `New query`

打开本项目里的：

```text
supabase/schema_hardcoded_password.sql
```

复制全部内容，粘贴到 SQL Editor，点击 Run。

执行成功后，去 `Table Editor` 检查是否出现这些表：

```text
couple_wishes
couple_wish_messages
couple_wish_records
couple_wish_images
couple_daily_entries
couple_activities
couple_app_state
```

## 第二步：创建图片桶

进入 Supabase：

`Storage` → `New bucket`

创建：

```text
couple-photos
```

建议选择 private bucket。

## 第三步：本地测试

双击 `index.html` 打开页面。

测试：

1. 选择小王同学，输入 `20040624` 登录。
2. 新增一个心愿。
3. 回到 Supabase Table Editor，打开 `couple_wishes`，确认出现数据。
4. 退出后用小韩同学，输入 `20040519` 登录，确认能看到同一条心愿。
5. 测试留言、今日状态、今日情侣问题和上传照片。

## 第四步：上传 GitHub

上传整个项目文件夹里的所有内容：

```text
index.html
supabase-config.js
src/
assets/
supabase/
README_部署说明.md
```

不要只上传 `index.html`。

## 第五步：部署 Vercel

在 Vercel 中导入 GitHub 仓库。

设置：

```text
Framework Preset: Other
Build Command: 留空
Output Directory: 留空或 ./
```

点击 Deploy。

## 重要提醒

这个版本没有使用 Supabase Auth，登录密码写在前端。  
这适合你们两个人私密使用，不适合公开传播链接。
