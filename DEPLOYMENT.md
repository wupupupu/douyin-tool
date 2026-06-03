# 部署教程

## 方案 A：本地运行（推荐先测试）

### 前提
- Python 3.8+ 已安装
- 在终端中可使用 `python` 和 `pip` 命令

### 步骤

```bash
# 1. 进入项目目录
cd F:\douyin-tool

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动应用
python app.py
```

显示以下信息表示成功：
```
 * Running on http://127.0.0.1:5000
```

浏览器打开 `http://localhost:5000` 即可使用。

### 在同一 WiFi 下用 iPad 访问

1. 查看电脑 IP 地址（终端输入 `ipconfig`，找 IPv4 地址）
2. 在 iPad Safari 中输入 `http://电脑IP:5000`

---

## 方案 B：Railway 云部署

Railway 提供免费额度（$5/月），足够此应用使用。

### 第 1 步：注册 GitHub 账号
访问 `https://github.com` 注册（已有则跳过）

### 第 2 步：创建 GitHub 仓库
1. 登录 GitHub，点击右上角 `+` → `New repository`
2. 仓库名：`douyin-tool`
3. 选择 Public，点击 Create

### 第 3 步：推送代码到 GitHub

```bash
cd F:\douyin-tool
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/douyin-tool.git
git push -u origin main
```

### 第 4 步：注册 Railway
访问 `https://railway.app`，用 GitHub 账号登录

### 第 5 步：部署
1. 点击 `New Project`
2. 选择 `Deploy from GitHub repo`
3. 搜索 `douyin-tool` 并选择
4. Railway 自动部署（约 2-3 分钟）

### 第 6 步：获取链接
1. 项目页 → Settings → Domains
2. 复制生成的域名：`https://douyin-tool-production.up.railway.app`

### 第 7 步：在 iPad 上使用
1. Safari 打开上面的链接
2. 分享按钮 →「添加到主屏幕」
3. 之后像 App 一样使用

### 更新应用
修改代码后：
```bash
git add .
git commit -m "更新说明"
git push origin main
```
Railway 会自动重新部署（1-2 分钟）。

---

## 注意事项

- Railway 免费额度每月 $5，此应用用量极低，基本不会超额
- 部署后数据存储在 Railway 服务器上，免费实例 30 分钟无请求会休眠（冷启动约 5-10 秒）
- 第一次用 iPad 访问可能稍慢，之后再访问就会快很多
