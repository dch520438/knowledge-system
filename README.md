# 智能知识工作台

集成知识库管理、智能写作、核稿检查和问答系统的综合工作平台。

## 功能特性

### 📚 知识库管理
- 知识条目的增删改查，支持分类和标签
- 关键词搜索、分类筛选
- 批量导入（JSON / DOCX / PDF / TXT / CSV）
- 批量导出（JSON / DOCX / CSV）
- 内容排重
- 网页采集：内嵌浏览器，预置人民网、求是网等网站
- 从写作文稿直接创建知识条目

### ✍️ 写作助手
- Quill 富文本编辑器，支持多种格式
- 文档管理：新建、草稿、已发布状态切换
- 引用知识库内容辅助写作
- 网络搜索：百度、必应、搜狗，内嵌浏览器显示
- 核稿检查：10 条预置中文排版规则 + 自定义规则
- 核稿结果在文稿对应位置高亮显示（红/黄/蓝三级）
- 文稿内搜索与替换
- 字数统计（中文字数、总字数、段落数）
- 选中内容实时字数统计
- 文档导入/导出（DOCX / TXT）
- 离开页面自动保存

### 📝 核稿检查
- 基于正则表达式的文本检查引擎
- 10 条预置规则：重复句号、重复逗号、多余空格、全角数字等
- 支持自定义规则的增删改查
- 错误按严重程度分类（错误 / 警告 / 提示）
- 点击错误项跳转到文稿对应位置

### 💬 智能问答
- 基于关键词匹配的智能问答
- 打字机效果展示回答
- 自动关联知识库来源
- 问答历史记录管理

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + React Router 6 + Quill 富文本编辑器 + Vite |
| 后端 | Python + FastAPI + SQLAlchemy + Uvicorn |
| 数据库 | SQLite（零配置，数据存储在 `backend/data/` 目录） |
| 部署 | Docker / PyInstaller（打包为独立 EXE） |

## 项目结构

```
knowledge-system/
├── start.sh              # Linux/Mac 一键启动（生产模式）
├── start-dev.sh          # Linux/Mac 开发模式启动
├── start.bat             # Windows 一键启动（生产模式）
├── build.bat             # Windows 打包为 EXE
├── Dockerfile            # Docker 镜像构建
├── docker-compose.yml    # Docker Compose 编排
├── backend/
│   ├── main.py           # FastAPI 主应用（所有 API 路由）
│   ├── database.py       # 数据库配置
│   ├── models.py         # ORM 数据模型（4 张表）
│   ├── schemas.py        # Pydantic 请求/响应 Schema
│   ├── requirements.txt  # Python 依赖
│   └── data/             # SQLite 数据库文件（运行时生成）
└── frontend/
    ├── vite.config.js    # Vite 配置（开发代理 /api 到后端）
    ├── package.json      # Node.js 依赖
    └── src/
        ├── App.jsx       # 路由定义（3 个页面）
        ├── api.js        # API 封装层
        └── components/
            ├── KnowledgeBase.jsx  # 知识库页面
            ├── Writing.jsx       # 写作助手页面
            ├── Proofread.jsx     # 核稿检查组件
            └── QA.jsx            # 智能问答页面
```

## 快速开始

### 方式一：一键启动脚本（推荐）

**Linux / Mac：**
```bash
# 需要 Python 3.8+ 和 Node.js 16+
chmod +x start.sh
./start.sh
# 访问 http://localhost:8000
```

**Windows：**
```
# 需要 Python 3.8+（无需 Node.js，前端已预构建）
双击 start.bat
# 访问 http://localhost:8000
```

### 方式二：Docker 部署

```bash
docker-compose up -d
# 访问 http://localhost:8000
# 数据持久化在 ./data 目录
```

### 方式三：开发模式

```bash
# 终端 1 - 启动后端
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# 终端 2 - 启动前端
cd frontend
npm install
npm run dev
# 前端: http://localhost:3000
# 后端 API 文档: http://localhost:8000/docs
```

### 方式四：打包为独立 EXE（Windows）

```bash
# 需要 Python 3.8+ 和 Node.js 16+
双击 build.bat
# 生成 backend/dist/KnowledgeWorkstation.exe
# 复制到任意 Windows 电脑双击运行即可，无需安装任何依赖
```

## API 接口

启动后访问 http://localhost:8000/docs 查看完整 API 文档（Swagger UI）。

主要接口模块：

| 模块 | 路径前缀 | 说明 |
|------|----------|------|
| 知识库 | `/api/knowledge` | CRUD、搜索、导入导出、排重 |
| 写作文档 | `/api/writing` | CRUD、导入导出 |
| 智能问答 | `/api/qa` | CRUD、智能问答 |
| 核稿检查 | `/api/proofread` | 规则管理、文本检查 |
| 网页代理 | `/api/proxy/web` | 去除 iframe 限制，重写链接 |
| 全局搜索 | `/api/search` | 跨模块搜索 |

## 数据库模型

系统使用 SQLite 数据库，包含 4 张表：

- **knowledge_items** — 知识条目（标题、内容、分类、标签）
- **writing_documents** — 写作文档（标题、HTML内容、状态、引用知识）
- **qa_records** — 问答记录（问题、回答、引用知识）
- **proofread_rules** — 核稿规则（名称、正则表达式、严重程度）

## 数据安全

### 当前安全机制

本系统设计为**本地部署的单机应用**，数据安全依托以下机制：

| 安全层面 | 措施 | 说明 |
|----------|------|------|
| 数据存储 | SQLite 本地文件 | 所有素材和文稿存储在本机 `backend/data/knowledge_system.db`，不经过任何外部服务器 |
| 数据隔离 | 单用户架构 | 数据库为当前用户独占，无多用户数据交叉风险 |
| 网络暴露 | 仅绑定 localhost | 默认监听 `0.0.0.0:8000`，局域网内可访问，但不对外网暴露 |
| 文件上传 | 格式白名单 | 仅允许 `.json / .docx / .pdf / .txt / .csv` 格式，拒绝其他文件类型 |
| 文件名过滤 | 特殊字符过滤 | 上传文件名中的 `\ / : * ? " < > |` 等危险字符会被替换为下划线 |
| 导入解析 | 异常捕获 | 文件导入时对解析异常进行捕获，不会因恶意文件导致服务崩溃 |
| 前端编辑 | Quill 沙盒 | 富文本编辑器在沙盒环境中运行，防止 XSS 攻击 |
| 自动保存 | 本地触发 | 离开页面时自动保存到本地数据库，不经过网络传输 |

### 数据备份建议

由于数据存储在本地 SQLite 文件中，建议定期备份：

```bash
# 手动备份数据库文件
cp backend/data/knowledge_system.db backup/knowledge_system_$(date +%Y%m%d).db
```

Docker 部署时，数据已通过 Volume 挂载到 `./data` 目录，备份该目录即可。

### 安全注意事项

- **本系统无用户认证机制**，任何能访问服务端口的人都可以操作数据。请确保仅在可信网络环境中使用。
- 如需在公网部署，建议在前方部署 Nginx 反向代理并配置 HTTPS 和访问密码。
- 网页采集功能通过后端代理访问外部网站，请勿访问不可信的网站，以免代理被恶意内容利用。
- 导入文件时请确认文件来源可靠，避免导入含有恶意内容的外部文件。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | 3.8+ | 后端运行时 |
| Node.js | 16+ | 仅构建前端时需要，生产部署不需要 |
| pip | 最新 | Python 包管理器 |

## License

MIT
