# 抖音账号运营助手

为内容创作者设计的轻量级运营工具，集数据分析、选题库、发布日历于一体。

## 功能特性

### 数据分析
- CSV 文件上传与解析（支持抖音创作者后台导出格式）
- 自动统计点赞率、评论率、平均互动数
- IP 角色表现排行（柱状图）
- 风格标签效果分析（饼图）
- 点赞/评论趋势图（折线图）
- 视频详情数据表格

### 选题库
- 按 IP 角色 / 热门音乐 / 舞蹈风格 / 场景布景分类
- 参考链接保存
- 灵感快速记录

### 发布日历
- 发布计划规划
- 状态追踪（计划中 → 已发布 → 已取消）
- 备注记录

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端 | Python 3.11 + Flask |
| 前端 | HTML5 + CSS3 + JavaScript |
| 图表 | Chart.js 4 |
| 数据存储 | JSON 文件持久化 |
| 部署 | Railway / 本地 Flask |

## 快速开始

### 方案 A：本地运行（推荐先测试）

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动应用
python app.py

# 3. 浏览器打开
# http://localhost:5000
```

### 方案 B：Railway 云部署

详见 `DEPLOYMENT.md`

## CSV 数据格式

从抖音创作者后台导出数据后，确保包含以下列：

```
视频标题,IP角色,风格标签,播放量,点赞数,评论数,分享数,发布日期
```

详见 `CSV_FORMAT.md`

## 文件说明

| 文件 | 说明 |
|------|------|
| `app.py` | Flask 后端主程序 |
| `requirements.txt` | Python 依赖 |
| `Procfile` | Railway 启动配置 |
| `Dockerfile` | Docker 容器配置 |
| `railway.json` | Railway 部署配置 |
| `templates/index.html` | 前端页面 |
| `static/style.css` | 样式表 |
| `static/script.js` | 前端交互逻辑 |
| `data_storage.json` | 数据文件（自动生成） |
