# 智能知识工作台

集成知识库管理、智能写作、核稿检查、智能问答和大模型辅助的综合工作平台。

## 功能特性

### 📚 知识库管理
- **仪表盘**：知识总量、分类数量、总字数统计，随机推荐知识卡片
- 知识条目增删改查，支持分类和标签
- 关键词搜索（标题/内容/分类/标签全覆盖）、分类筛选
- 批量管理：批量删除、批量改分类、批量改标签（替换/追加/移除）
- 批量导入（JSON / DOCX / TXT / CSV），支持标记模板格式自动识别
- 批量导出（JSON / DOCX / CSV），导入导出模板统一
- 内容排重
- 网页采集：内嵌浏览器，预置人民网、新华网、求是网、百度、必应等网站
- 采集内容新建知识时支持自定义分类和标签
- 点击知识卡片查看完整信息
- 从写作文稿直接创建知识条目

### ✍️ 写作助手
- Office 2010 Word 风格界面
- Quill 富文本编辑器，支持字体/字号/加粗/斜体/下划线/删除线/颜色/高亮/上标下标/缩进/列表/对齐/引用等
- 文档管理：新建、草稿、已发布状态切换
- 引用知识库内容辅助写作
- 网络搜索：百度、必应、搜狗 + 预设网站快捷按钮（人民网、新华网、求是网、中国纪检监察网、学习强国、深言达意、汉典、写易）
- 核稿检查：预置中文排版规则 + 自定义规则，结果高亮显示
- 文稿内搜索与替换
- 字数统计（中文字数、总字数、段落数）
- 文档导入/导出（DOCX / TXT），保留格式（加粗、斜体、标题等）
- 离开页面自动保存
- 首行缩进 2 字符，段间距自动设置

### 🤖 大模型集成
- **多模型支持**：OpenAI、DeepSeek、通义千问、Ollama（本地）、自定义接口
- **设置页面**：添加/编辑/删除配置，一键激活，连接测试
- **智能问答增强**：手动启用，基于知识库上下文的 AI 问答
- **写作助手增强**：润色 / 续写 / 总结 / 扩写，结果可插入或替换
- **AI 写作**：选取知识库素材 + 编写提纲，AI 自动生成文稿（支持正式公文/通俗易懂/学术论文/新闻报道风格）
- **知识库智能处理**：AI 推荐分类标签、AI 内容总结
- **智能核稿**：AI 辅助检查错别字、标点、语法、逻辑问题
- 所有 AI 功能均为手动触发，未配置大模型时自动降级提示

### 📝 核稿检查
- 基于正则表达式的文本检查引擎
- 预置中文排版规则：重复标点、多余空格、全角数字等
- 支持自定义规则的增删改查
- 错误按严重程度分类（错误 / 警告 / 提示）
- 点击错误项跳转到文稿对应位置并高亮

### 💬 智能问答
- 基于关键词匹配的智能问答
- 可选大模型增强（知识库 RAG 问答）
- 打字机效果展示回答
- 自动关联知识库来源
- 问答历史记录管理

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + React Router 6 + Quill 富文本编辑器 + Vite |
| 后端 | Python + FastAPI + SQLAlchemy + Uvicorn |
| 数据库 | SQLite（零配置，数据存储在 `backend/data/` 目录） |
| AI | OpenAI 兼容 API（支持在线模型和本地模型） |
| 部署 | Docker / 一键脚本 |

## 项目结构

```
knowledge-system/
├── start.sh              # Linux/Mac 一键启动（生产模式）
├── start-dev.sh          # Linux/Mac 开发模式启动
├── start.bat             # Windows 一键启动（生产模式）
├── build.bat             # Windows 打包为 EXE
├── Dockerfile            # Docker 镜像构建
├── docker-compose.yml    # Docker Compose 编排
├── templates/            # 批量导入模板文件（CSV / JSON / TXT）
├── backend/
│   ├── main.py           # FastAPI 主应用（所有 API 路由）
│   ├── database.py       # 数据库配置
│   ├── models.py         # ORM 数据模型（5 张表）
│   ├── schemas.py        # Pydantic 请求/响应 Schema
│   ├── requirements.txt  # Python 依赖
│   └── data/             # SQLite 数据库文件（运行时生成）
└── frontend/
    ├── vite.config.js    # Vite 配置
    ├── package.json      # Node.js 依赖
    └── src/
        ├── App.jsx       # 路由定义
        ├── api.js        # API 封装层
        └── components/
            ├── Layout.jsx        # 整体布局（侧边栏导航）
            ├── KnowledgeBase.jsx # 知识库页面（仪表盘+管理+采集）
            ├── Writing.jsx       # 写作助手页面（编辑器+AI功能）
            ├── Proofread.jsx     # 核稿规则管理组件
            ├── QA.jsx            # 智能问答页面
            └── Settings.jsx      # 大模型设置页面
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

## API 接口

启动后访问 http://localhost:8000/docs 查看完整 API 文档（Swagger UI）。

| 模块 | 路径前缀 | 说明 |
|------|----------|------|
| 知识库 | `/api/knowledge` | CRUD、搜索、批量操作、导入导出、排重 |
| 写作文档 | `/api/writing` | CRUD、导入导出 |
| 智能问答 | `/api/qa` | CRUD、智能问答 |
| 核稿检查 | `/api/proofread` | 规则管理、文本检查 |
| 大模型 | `/api/llm` | 配置管理、对话、写作、问答、核稿 |
| 全局搜索 | `/api/search` | 跨模块搜索 |

## 大模型配置

进入 ⚙️ 设置页面，添加大模型配置：

| 提供商 | API 地址 | 模型示例 |
|--------|---------|---------|
| OpenAI | `https://api.openai.com/v1` | gpt-3.5-turbo |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-turbo |
| Ollama（本地） | `http://localhost:11434/v1` | qwen2:7b |
| 自定义 | 任意 OpenAI 兼容接口 | 自定义 |

支持所有 OpenAI 兼容格式的 API，包括 LM Studio、vLLM 等。

## 批量导入模板

`templates/` 目录提供三种格式的导入模板：

**CSV 模板**（用 Excel 编辑）
```
标题,分类,标签,内容
人工智能的定义,技术,人工智能;AI,人工智能是...
```

**JSON 模板**
```json
[{"title": "标题", "category": "分类", "tags": "标签1,标签2", "content": "内容"}]
```

**TXT 标记模板**
```
标题：人工智能的定义
分类：技术
标签：人工智能,AI
内容：人工智能是...
```

DOCX 文件同样支持上述标记格式，导出的文件可直接重新导入。

## 数据库模型

系统使用 SQLite 数据库，包含 5 张表：

| 表名 | 说明 |
|------|------|
| `knowledge_items` | 知识条目（标题、内容、分类、标签） |
| `writing_documents` | 写作文档（标题、HTML内容、状态、引用知识） |
| `qa_records` | 问答记录（问题、回答、引用知识） |
| `proofread_rules` | 核稿规则（名称、正则表达式、严重程度） |
| `llm_configs` | 大模型配置（提供商、API地址、密钥、模型、参数） |

## 数据安全

本系统设计为**本地部署的单机应用**：

- 所有数据存储在本地 SQLite 文件，不经过外部服务器
- 单用户架构，无多用户数据交叉风险
- 文件上传限制格式白名单，异常捕获防止崩溃
- 富文本编辑器沙盒运行，防止 XSS 攻击

> ⚠️ 本系统无用户认证机制，请确保仅在可信网络环境中使用。如需公网部署，建议配置 Nginx 反向代理 + HTTPS + 访问密码。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | 3.8+ | 后端运行时 |
| Node.js | 16+ | 仅构建前端时需要 |

## License

MIT
