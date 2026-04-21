# -*- coding: utf-8 -*-
"""
FastAPI主应用模块
包含知识库、写作文档、问答记录的CRUD路由和全局搜索功能
以及批量导入导出、智能问答等扩展功能
"""

from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, Response, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from urllib.parse import quote as url_quote, urljoin, urlparse, urlencode
import io
import json
import csv
import re
import os

import httpx
from bs4 import BeautifulSoup

from docx import Document
import pdfplumber

from database import engine, Base, get_db, SessionLocal
from models import KnowledgeItem, WritingDocument, QARecord, ProofreadRule
from schemas import (
    KnowledgeItemCreate, KnowledgeItemResponse, KnowledgeItemUpdate,
    WritingDocumentCreate, WritingDocumentResponse, WritingDocumentUpdate,
    QARecordCreate, QARecordResponse, QARecordUpdate,
    SearchResult,
    BatchKnowledgeCreate,
    SmartAnswerRequest,
    ProofreadRuleCreate, ProofreadRuleResponse,
)

# 创建FastAPI应用实例
app = FastAPI(
    title="知识管理系统 API",
    description="提供知识库管理、写作文档管理和问答记录管理的RESTful API",
    version="1.0.0",
)

# 添加CORS中间件，允许所有来源访问（开发模式）
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 启动事件：自动创建数据库表 ====================

@app.on_event("startup")
def startup_event():
    """应用启动时自动创建所有数据库表"""
    Base.metadata.create_all(bind=engine)
    # 初始化预置核稿规则
    init_proofread_rules()


# ==================== 知识库路由 ====================

@app.post("/api/knowledge", response_model=KnowledgeItemResponse, summary="创建知识条目")
def create_knowledge_item(item: KnowledgeItemCreate, db: Session = Depends(get_db)):
    """
    创建一个新的知识条目
    - **title**: 知识标题（必填）
    - **content**: 知识内容（必填）
    - **category**: 分类（可选）
    - **tags**: 标签，逗号分隔（可选）
    """
    db_item = KnowledgeItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@app.post("/api/knowledge/search", response_model=List[KnowledgeItemResponse], summary="搜索知识条目")
def search_knowledge_items(
    search_data: dict,
    db: Session = Depends(get_db),
):
    """
    通过POST请求搜索知识条目，避免URL编码问题
    - **keyword**: 搜索关键词
    - **category**: 按分类筛选
    """
    keyword = search_data.get("keyword", "")
    category = search_data.get("category", "")

    query = db.query(KnowledgeItem)
    if category:
        query = query.filter(KnowledgeItem.category == category)
    if keyword:
        query = query.filter(
            or_(
                KnowledgeItem.title.contains(keyword),
                KnowledgeItem.content.contains(keyword),
            )
        )
    items = query.order_by(KnowledgeItem.created_at.desc()).all()
    return items


@app.get("/api/knowledge", response_model=List[KnowledgeItemResponse], summary="获取知识列表")
def get_knowledge_items(
    category: Optional[str] = Query(None, description="按分类筛选"),
    db: Session = Depends(get_db),
):
    """
    获取知识条目列表，支持按分类筛选
    - **category**: 按分类筛选
    """
    query = db.query(KnowledgeItem)
    if category:
        query = query.filter(KnowledgeItem.category == category)
    items = query.order_by(KnowledgeItem.created_at.desc()).all()
    return items


@app.get("/api/knowledge/categories", response_model=List[str], summary="获取所有分类列表")
def get_categories(db: Session = Depends(get_db)):
    """获取所有不重复的分类列表"""
    categories = db.query(KnowledgeItem.category).distinct().filter(KnowledgeItem.category.isnot(None)).all()
    return [c[0] for c in categories]


@app.get("/api/knowledge/export", summary="导出知识库")
def export_knowledge(
    format: str = Query("json", description="导出格式：json, docx, csv"),
    db: Session = Depends(get_db),
):
    """
    导出知识库中所有知识条目
    - **format**: 导出格式，支持 json / docx / csv
    - **JSON**: 返回所有知识的JSON数组
    - **DOCX**: 生成Word文档，每个知识一个标题+内容段落
    - **CSV**: 生成CSV文件
    """
    items = db.query(KnowledgeItem).order_by(KnowledgeItem.created_at.desc()).all()

    if format == "json":
        # JSON格式导出
        data = []
        for item in items:
            data.append({
                "id": item.id,
                "title": item.title,
                "content": item.content,
                "category": item.category,
                "tags": item.tags,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            })
        json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename*=UTF-8''knowledge_export.json"},
        )

    elif format == "docx":
        # DOCX格式导出
        doc = Document()
        for item in items:
            # 添加标题
            doc.add_heading(item.title, level=2)
            # 添加内容
            doc.add_paragraph(item.content)
            # 添加分类和标签信息
            meta_parts = []
            if item.category:
                meta_parts.append(f"分类: {item.category}")
            if item.tags:
                meta_parts.append(f"标签: {item.tags}")
            if meta_parts:
                doc.add_paragraph(" | ".join(meta_parts))
            # 添加分隔
            doc.add_paragraph("")
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename*=UTF-8''knowledge_export.docx"},
        )

    elif format == "csv":
        # CSV格式导出
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        # 写入标题行
        writer.writerow(["id", "title", "content", "category", "tags", "created_at", "updated_at"])
        # 写入数据行
        for item in items:
            writer.writerow([
                item.id,
                item.title,
                item.content,
                item.category or "",
                item.tags or "",
                item.created_at.isoformat() if item.created_at else "",
                item.updated_at.isoformat() if item.updated_at else "",
            ])
        csv_bytes = buffer.getvalue().encode("utf-8-sig")  # 使用utf-8-sig以支持Excel打开
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename*=UTF-8''knowledge_export.csv"},
        )

    else:
        raise HTTPException(status_code=400, detail=f"不支持的导出格式: {format}，请使用 json / docx / csv")


@app.get("/api/knowledge/{item_id}", response_model=KnowledgeItemResponse, summary="获取单个知识条目")
def get_knowledge_item(item_id: int, db: Session = Depends(get_db)):
    """根据ID获取单个知识条目"""
    db_item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    return db_item


@app.put("/api/knowledge/{item_id}", response_model=KnowledgeItemResponse, summary="更新知识条目")
def update_knowledge_item(item_id: int, item: KnowledgeItemUpdate, db: Session = Depends(get_db)):
    """
    更新指定ID的知识条目
    只更新请求中提供的字段，未提供的字段保持不变
    """
    db_item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="知识条目不存在")

    update_data = item.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


@app.delete("/api/knowledge/{item_id}", summary="删除知识条目")
def delete_knowledge_item(item_id: int, db: Session = Depends(get_db)):
    """删除指定ID的知识条目"""
    db_item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    db.delete(db_item)
    db.commit()
    return {"message": "知识条目已删除", "id": item_id}


@app.post("/api/knowledge/deduplicate", summary="知识库排重")
def deduplicate_knowledge(db: Session = Depends(get_db)):
    """
    删除内容完全相同的知识条目，每个重复内容只保留最早创建的一条
    返回删除的数量
    """
    # 获取所有知识条目，按创建时间升序
    items = db.query(KnowledgeItem).order_by(KnowledgeItem.created_at.asc()).all()
    
    # 用字典记录已见过的内容
    seen_content = {}
    duplicates_to_delete = []
    
    for item in items:
        # 标准化内容用于比较（去除首尾空白）
        normalized_content = item.content.strip() if item.content else ""
        
        if normalized_content in seen_content:
            # 这是重复内容，标记删除
            duplicates_to_delete.append(item.id)
        else:
            # 首次见到此内容，记录
            seen_content[normalized_content] = item.id
    
    # 删除重复条目
    for item_id in duplicates_to_delete:
        db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).delete()
    
    db.commit()
    
    return {"removed_count": len(duplicates_to_delete), "message": f"成功删除 {len(duplicates_to_delete)} 条重复知识"}


# ==================== 知识库批量导入/导出路由 ====================

@app.post("/api/knowledge/batch", response_model=List[KnowledgeItemResponse], summary="批量创建知识条目")
def batch_create_knowledge_items(batch: BatchKnowledgeCreate, db: Session = Depends(get_db)):
    """
    批量创建知识条目
    - **items**: 知识条目数组，每个条目包含 title, content, category, tags
    """
    created_items = []
    for item_data in batch.items:
        db_item = KnowledgeItem(**item_data.model_dump())
        db.add(db_item)
        created_items.append(db_item)
    db.commit()
    for item in created_items:
        db.refresh(item)
    return created_items


@app.post("/api/knowledge/import", response_model=List[KnowledgeItemResponse], summary="从文件导入知识")
async def import_knowledge_from_file(
    file: UploadFile = File(..., description="上传文件，支持 .json / .docx / .pdf / .txt / .csv"),
    db: Session = Depends(get_db),
):
    """
    从文件导入知识条目，支持多种文件格式：
    - **JSON**: 解析数组 [{title, content, category, tags}]
    - **DOCX**: 每个段落作为一条知识（标题取前20字）
    - **PDF**: 每页作为一条知识（标题取前20字）
    - **TXT**: 按空行分割，每段作为一条知识
    - **CSV**: 第一行标题列和内容列，后续行数据
    """
    # 读取文件内容
    content_bytes = await file.read()

    # 获取文件扩展名
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    knowledge_list = []  # 存储解析后的知识条目 {title, content, category, tags}

    if ext == "json":
        # JSON格式：解析数组 [{title, content, category, tags}]
        try:
            text = content_bytes.decode("utf-8")
            data = json.loads(text)
            if not isinstance(data, list):
                raise HTTPException(status_code=400, detail="JSON文件内容必须是数组格式")
            for item in data:
                title = item.get("title", "").strip()
                content = item.get("content", "").strip()
                if not title or not content:
                    continue
                knowledge_list.append({
                    "title": title[:255],
                    "content": content,
                    "category": item.get("category"),
                    "tags": item.get("tags", ""),
                })
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="JSON文件解析失败")

    elif ext == "docx":
        # DOCX格式：支持标题样式和标记格式
        try:
            doc = Document(io.BytesIO(content_bytes))
            
            # 检测是否包含标记格式（标题：分类：等）
            full_text = "\n".join([p.text for p in doc.paragraphs])
            if re.search(r'标题[：:]', full_text):
                # 标记模板格式
                entries = re.split(r'\n\s*(?=标题[：:])', full_text.strip())
                for entry in entries:
                    entry = entry.strip()
                    if not entry:
                        continue
                    title_match = re.search(r'标题[：:]\s*(.+)', entry)
                    category_match = re.search(r'分类[：:]\s*(.+)', entry)
                    tags_match = re.search(r'标签[：:]\s*(.+)', entry)
                    content_match = re.search(r'内容[：:]\s*(.+)', entry, re.DOTALL)
                    
                    title = title_match.group(1).strip() if title_match else ""
                    content = content_match.group(1).strip() if content_match else ""
                    if not title or not content:
                        continue
                    knowledge_list.append({
                        "title": title[:255],
                        "content": content,
                        "category": category_match.group(1).strip() if category_match else None,
                        "tags": tags_match.group(1).strip() if tags_match else "",
                    })
            else:
                # 普通格式：每个段落作为一条知识
                for para in doc.paragraphs:
                    text = para.text.strip()
                    if not text:
                        continue
                    title = text[:20] + ("..." if len(text) > 20 else "")
                    knowledge_list.append({
                        "title": title,
                        "content": text,
                        "category": None,
                        "tags": "",
                    })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"DOCX文件解析失败: {str(e)}")

    elif ext == "pdf":
        # PDF格式：每页作为一条知识（标题取前20字）
        try:
            with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
                for page in pdf.pages:
                    text = (page.extract_text() or "").strip()
                    if not text:
                        continue
                    title = text[:20] + ("..." if len(text) > 20 else "")
                    knowledge_list.append({
                        "title": title,
                        "content": text,
                        "category": None,
                        "tags": "",
                    })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF文件解析失败: {str(e)}")

    elif ext == "txt":
        # TXT格式：支持标记模板和空行分割两种格式
        try:
            text = content_bytes.decode("utf-8")
            
            # 检测是否为标记模板格式（包含"标题："或"标题:"）
            if re.search(r'标题[：:]', text):
                # 标记模板格式：按"标题："分割为多个知识条目
                entries = re.split(r'\n\s*(?=标题[：:])', text.strip())
                for entry in entries:
                    entry = entry.strip()
                    if not entry:
                        continue
                    title_match = re.search(r'标题[：:]\s*(.+)', entry)
                    category_match = re.search(r'分类[：:]\s*(.+)', entry)
                    tags_match = re.search(r'标签[：:]\s*(.+)', entry)
                    content_match = re.search(r'内容[：:]\s*(.+)', entry, re.DOTALL)
                    
                    title = title_match.group(1).strip() if title_match else ""
                    content = content_match.group(1).strip() if content_match else ""
                    if not title or not content:
                        continue
                    knowledge_list.append({
                        "title": title[:255],
                        "content": content,
                        "category": category_match.group(1).strip() if category_match else None,
                        "tags": tags_match.group(1).strip() if tags_match else "",
                    })
            else:
                # 普通格式：按空行分割段落
                paragraphs = re.split(r'\n\s*\n', text)
                for para in paragraphs:
                    para_text = para.strip()
                    if not para_text:
                        continue
                    para_text = re.sub(r'\n', ' ', para_text).strip()
                    title = para_text[:20] + ("..." if len(para_text) > 20 else "")
                    knowledge_list.append({
                        "title": title,
                        "content": para_text,
                        "category": None,
                        "tags": "",
                    })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"TXT文件解析失败: {str(e)}")

    elif ext == "csv":
        # CSV格式：第一行标题列和内容列，后续行数据
        try:
            text = content_bytes.decode("utf-8")
            reader = csv.reader(io.StringIO(text))
            rows = list(reader)
            if len(rows) < 2:
                raise HTTPException(status_code=400, detail="CSV文件至少需要标题行和一行数据")
            # 读取标题行，查找标题列和内容列
            header = [h.strip().lower() for h in rows[0]]
            title_idx = None
            content_idx = None
            category_idx = None
            tags_idx = None
            for i, col_name in enumerate(header):
                if col_name in ("title", "标题", "名称"):
                    title_idx = i
                elif col_name in ("content", "内容", "正文"):
                    content_idx = i
                elif col_name in ("category", "分类", "类别"):
                    category_idx = i
                elif col_name in ("tags", "标签"):
                    tags_idx = i
            # 如果没有找到标题列和内容列，默认第一列为标题，第二列为内容
            if title_idx is None:
                title_idx = 0
            if content_idx is None:
                content_idx = 1 if len(header) > 1 else 0
            for row in rows[1:]:
                if not row:
                    continue
                title = row[title_idx].strip() if title_idx < len(row) else ""
                content = row[content_idx].strip() if content_idx < len(row) else ""
                if not title or not content:
                    continue
                knowledge_list.append({
                    "title": title[:255],
                    "content": content,
                    "category": row[category_idx].strip() if category_idx is not None and category_idx < len(row) else None,
                    "tags": row[tags_idx].strip() if tags_idx is not None and tags_idx < len(row) else "",
                })
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"CSV文件解析失败: {str(e)}")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: .{ext}，请上传 .json / .docx / .pdf / .txt / .csv 格式的文件"
        )

    if not knowledge_list:
        raise HTTPException(status_code=400, detail="未能从文件中解析出有效的知识条目")

    # 批量写入数据库
    created_items = []
    for item_data in knowledge_list:
        db_item = KnowledgeItem(**item_data)
        db.add(db_item)
        created_items.append(db_item)
    db.commit()
    for item in created_items:
        db.refresh(item)

    return created_items


@app.post("/api/knowledge/from-writing", response_model=KnowledgeItemResponse, summary="从写作文稿创建知识")
def create_knowledge_from_writing(
    data: dict,
    db: Session = Depends(get_db),
):
    """
    从指定写作文档中提取内容创建知识条目
    - **doc_id**: 写作文档ID
    - **title**: 知识标题
    - **content**: 知识内容（如不提供则使用写作文档的内容）
    - **category**: 分类（可选）
    - **tags**: 标签（可选）
    """
    doc_id = data.get("doc_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="doc_id 为必填参数")

    # 查找写作文档
    writing_doc = db.query(WritingDocument).filter(WritingDocument.id == doc_id).first()
    if writing_doc is None:
        raise HTTPException(status_code=404, detail="写作文档不存在")

    # 获取参数
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    category = data.get("category")
    tags = data.get("tags", "")

    # 如果未提供标题，使用写作文档标题
    if not title:
        title = writing_doc.title
    # 如果未提供内容，使用写作文档内容
    if not content:
        content = writing_doc.content

    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能同时为空")

    # 创建知识条目
    db_item = KnowledgeItem(
        title=title[:255],
        content=content,
        category=category,
        tags=tags,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


# ==================== 写作文档路由 ====================

@app.post("/api/writing", response_model=WritingDocumentResponse, summary="创建写作文档")
def create_writing_document(doc: WritingDocumentCreate, db: Session = Depends(get_db)):
    """
    创建一个新的写作文档
    - **title**: 文档标题（必填）
    - **content**: 文档内容
    - **referenced_knowledge_ids**: 引用的知识条目ID，逗号分隔
    - **status**: 状态，draft-草稿，published-已发布
    """
    db_doc = WritingDocument(**doc.model_dump())
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc


@app.get("/api/writing", response_model=List[WritingDocumentResponse], summary="获取文档列表")
def get_writing_documents(
    status: Optional[str] = Query(None, description="按状态筛选：draft/published"),
    db: Session = Depends(get_db),
):
    """
    获取写作文档列表，支持按状态筛选
    - **status**: 按状态筛选（draft-草稿，published-已发布）
    """
    query = db.query(WritingDocument)
    if status:
        query = query.filter(WritingDocument.status == status)
    docs = query.order_by(WritingDocument.created_at.desc()).all()
    return docs


@app.get("/api/writing/{doc_id}", response_model=WritingDocumentResponse, summary="获取单个文档")
def get_writing_document(doc_id: int, db: Session = Depends(get_db)):
    """根据ID获取单个写作文档"""
    db_doc = db.query(WritingDocument).filter(WritingDocument.id == doc_id).first()
    if db_doc is None:
        raise HTTPException(status_code=404, detail="写作文档不存在")
    return db_doc


@app.put("/api/writing/{doc_id}", response_model=WritingDocumentResponse, summary="更新文档")
def update_writing_document(doc_id: int, doc: WritingDocumentUpdate, db: Session = Depends(get_db)):
    """
    更新指定ID的写作文档
    只更新请求中提供的字段，未提供的字段保持不变
    """
    db_doc = db.query(WritingDocument).filter(WritingDocument.id == doc_id).first()
    if db_doc is None:
        raise HTTPException(status_code=404, detail="写作文档不存在")

    update_data = doc.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_doc, key, value)

    db.commit()
    db.refresh(db_doc)
    return db_doc


@app.delete("/api/writing/{doc_id}", summary="删除文档")
def delete_writing_document(doc_id: int, db: Session = Depends(get_db)):
    """删除指定ID的写作文档"""
    db_doc = db.query(WritingDocument).filter(WritingDocument.id == doc_id).first()
    if db_doc is None:
        raise HTTPException(status_code=404, detail="写作文档不存在")
    db.delete(db_doc)
    db.commit()
    return {"message": "写作文档已删除", "id": doc_id}


# ==================== 写作文档导入/导出路由 ====================

@app.get("/api/writing/{doc_id}/export", summary="导出单个写作文档")
def export_writing_document(
    doc_id: int,
    format: str = Query("docx", description="导出格式：docx"),
    db: Session = Depends(get_db),
):
    """
    导出单个写作文档
    - **doc_id**: 文档ID
    - **format**: 导出格式，目前支持 docx
    """
    db_doc = db.query(WritingDocument).filter(WritingDocument.id == doc_id).first()
    if db_doc is None:
        raise HTTPException(status_code=404, detail="写作文档不存在")

    if format == "docx":
        # 生成Word文档
        doc = Document()
        doc.add_heading(db_doc.title, level=1)
        # 按段落分割内容
        paragraphs = db_doc.content.split("\n")
        for para in paragraphs:
            if para.strip():
                doc.add_paragraph(para.strip())
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        # 使用文档标题作为文件名，替换非法字符
        safe_filename = re.sub(r'[\\/:*?"<>|]', '_', db_doc.title)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{url_quote(safe_filename)}.docx"},
        )
    else:
        raise HTTPException(status_code=400, detail=f"不支持的导出格式: {format}，目前仅支持 docx")


@app.post("/api/writing/import", response_model=WritingDocumentResponse, summary="从文件导入文档")
async def import_writing_document(
    file: UploadFile = File(..., description="上传文件，支持 .docx / .txt"),
    db: Session = Depends(get_db),
):
    """
    从文件导入写作文档，支持多种文件格式：
    - **DOCX**: 读取内容创建新文档
    - **TXT**: 读取内容创建新文档
    """
    content_bytes = await file.read()

    # 获取文件扩展名
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    doc_title = ""
    doc_content = ""

    if ext == "docx":
        # DOCX格式：读取内容
        try:
            doc = Document(io.BytesIO(content_bytes))
            paragraphs = []
            for para in doc.paragraphs:
                text = para.text.strip()
                if text:
                    paragraphs.append(text)
            if not paragraphs:
                raise HTTPException(status_code=400, detail="DOCX文件中没有有效内容")
            # 使用第一段作为标题，其余作为内容
            doc_title = paragraphs[0][:255]
            doc_content = "\n".join(paragraphs)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"DOCX文件解析失败: {str(e)}")

    elif ext == "txt":
        # TXT格式：读取内容
        try:
            text = content_bytes.decode("utf-8")
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            if not lines:
                raise HTTPException(status_code=400, detail="TXT文件中没有有效内容")
            # 使用第一行作为标题，其余作为内容
            doc_title = lines[0][:255]
            doc_content = "\n".join(lines)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"TXT文件解析失败: {str(e)}")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: .{ext}，请上传 .docx / .txt 格式的文件"
        )

    # 创建写作文档
    db_doc = WritingDocument(
        title=doc_title,
        content=doc_content,
        status="draft",
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc


# ==================== 问答记录路由 ====================

@app.post("/api/qa", response_model=QARecordResponse, summary="创建问答记录")
def create_qa_record(qa: QARecordCreate, db: Session = Depends(get_db)):
    """
    创建一个新的问答记录
    - **question**: 问题（必填）
    - **answer**: 回答
    - **referenced_knowledge_ids**: 引用的知识条目ID，逗号分隔
    """
    db_qa = QARecord(**qa.model_dump())
    db.add(db_qa)
    db.commit()
    db.refresh(db_qa)
    return db_qa


@app.get("/api/qa", response_model=List[QARecordResponse], summary="获取问答列表")
def get_qa_records(db: Session = Depends(get_db)):
    """获取所有问答记录列表"""
    records = db.query(QARecord).order_by(QARecord.created_at.desc()).all()
    return records


@app.get("/api/qa/{qa_id}", response_model=QARecordResponse, summary="获取单个问答记录")
def get_qa_record(qa_id: int, db: Session = Depends(get_db)):
    """根据ID获取单个问答记录"""
    db_qa = db.query(QARecord).filter(QARecord.id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="问答记录不存在")
    return db_qa


@app.put("/api/qa/{qa_id}", response_model=QARecordResponse, summary="更新问答记录")
def update_qa_record(qa_id: int, qa: QARecordUpdate, db: Session = Depends(get_db)):
    """
    更新指定ID的问答记录
    只更新请求中提供的字段，未提供的字段保持不变
    """
    db_qa = db.query(QARecord).filter(QARecord.id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="问答记录不存在")

    update_data = qa.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_qa, key, value)

    db.commit()
    db.refresh(db_qa)
    return db_qa


@app.delete("/api/qa/{qa_id}", summary="删除问答记录")
def delete_qa_record(qa_id: int, db: Session = Depends(get_db)):
    """删除指定ID的问答记录"""
    db_qa = db.query(QARecord).filter(QARecord.id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="问答记录不存在")
    db.delete(db_qa)
    db.commit()
    return {"message": "问答记录已删除", "id": qa_id}


# ==================== 全局搜索路由 ====================

@app.get("/api/search", response_model=List[SearchResult], summary="全局搜索")
def global_search(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    db: Session = Depends(get_db),
):
    """
    全局搜索知识库的标题和内容
    返回匹配的知识条目列表
    - **q**: 搜索关键词（必填）
    """
    results: List[SearchResult] = []

    # 在知识库中搜索标题和内容
    knowledge_items = db.query(KnowledgeItem).filter(
        or_(
            KnowledgeItem.title.contains(q),
            KnowledgeItem.content.contains(q),
        )
    ).order_by(KnowledgeItem.created_at.desc()).all()

    for item in knowledge_items:
        results.append(SearchResult(
            type="knowledge",
            id=item.id,
            title=item.title,
            content=item.content[:200] if len(item.content) > 200 else item.content,
            category=item.category,
            created_at=item.created_at,
        ))

    return results


# ==================== 智能问答路由（关键词匹配版） ====================

@app.post("/api/qa/smart-answer", summary="智能问答")
def smart_answer(
    request: SmartAnswerRequest,
    db: Session = Depends(get_db),
):
    """
    基于关键词匹配的智能问答
    - **question**: 问题（必填）

    实现逻辑：
    1. 对问题进行分词（按空格、标点分割为关键词列表）
    2. 在知识库中搜索包含任一关键词的知识条目
    3. 对匹配结果按匹配关键词数量排序
    4. 取top 5结果
    5. 组织回答返回
    """
    question = request.question.strip()

    # 第一步：对问题进行分词（按空格、标点分割为关键词列表）
    # 使用正则表达式分割：按空格、中文标点、英文标点分割
    keywords = re.split(r'[\s,，。.!！?？;；:：、\(\)（）\[\]【】\""\']+/', question)
    # 过滤空字符串和过短的词（单字词可能匹配过多）
    keywords = [kw.strip() for kw in keywords if len(kw.strip()) >= 2]
    # 如果过滤后没有关键词，尝试使用原始分割结果（保留单字）
    if not keywords:
        keywords = [kw.strip() for kw in re.split(r'[\s,，。.!！?？;；:：、\(\)（）\[\]【】\""\']+/', question) if kw.strip()]

    if not keywords:
        return {
            "answer": "抱歉，知识库中未找到与您的问题相关的内容。建议您在知识库中添加相关知识，或尝试使用不同的关键词提问。",
            "sources": [],
            "keywords": [],
        }

    # 第二步：在知识库中搜索包含任一关键词的知识条目
    all_items = db.query(KnowledgeItem).all()

    # 第三步：对每个知识条目计算匹配的关键词数量
    scored_items = []
    for item in all_items:
        match_count = 0
        search_text = (item.title + " " + item.content + " " + (item.category or "") + " " + (item.tags or "")).lower()
        for kw in keywords:
            if kw.lower() in search_text:
                match_count += 1
        if match_count > 0:
            scored_items.append((item, match_count))

    # 第四步：按匹配关键词数量排序，取top 5
    scored_items.sort(key=lambda x: x[1], reverse=True)
    top_items = scored_items[:5]

    # 第五步：组织回答
    if not top_items:
        return {
            "answer": "抱歉，知识库中未找到与您的问题相关的内容。建议您在知识库中添加相关知识，或尝试使用不同的关键词提问。",
            "sources": [],
            "keywords": keywords,
        }

    answer_parts = ["根据知识库检索，找到以下相关内容：\n"]
    sources = []
    for item, score in top_items:
        answer_parts.append(f"\n【来源：{item.title}】\n{item.content}\n")
        sources.append({"id": item.id, "title": item.title})

    return {
        "answer": "".join(answer_parts),
        "sources": sources,
        "keywords": keywords,
    }


# ==================== 核稿规则路由 ====================

@app.get("/api/proofread/rules", response_model=List[ProofreadRuleResponse], summary="获取所有核稿规则")
def get_proofread_rules(db: Session = Depends(get_db)):
    """获取所有核稿规则列表"""
    return db.query(ProofreadRule).order_by(ProofreadRule.is_builtin.desc(), ProofreadRule.id.asc()).all()

@app.post("/api/proofread/rules", response_model=ProofreadRuleResponse, summary="创建核稿规则")
def create_proofread_rule(rule: ProofreadRuleCreate, db: Session = Depends(get_db)):
    """创建自定义核稿规则"""
    db_rule = ProofreadRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.put("/api/proofread/rules/{rule_id}", response_model=ProofreadRuleResponse, summary="更新核稿规则")
def update_proofread_rule(rule_id: int, rule: ProofreadRuleCreate, db: Session = Depends(get_db)):
    """更新核稿规则"""
    db_rule = db.query(ProofreadRule).filter(ProofreadRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="核稿规则不存在")
    for key, value in rule.model_dump().items():
        setattr(db_rule, key, value)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.delete("/api/proofread/rules/{rule_id}", summary="删除核稿规则")
def delete_proofread_rule(rule_id: int, db: Session = Depends(get_db)):
    """删除核稿规则（不能删除预置规则）"""
    db_rule = db.query(ProofreadRule).filter(ProofreadRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="核稿规则不存在")
    if db_rule.is_builtin:
        raise HTTPException(status_code=400, detail="预置规则不能删除")
    db.delete(db_rule)
    db.commit()
    return {"message": "删除成功"}

@app.post("/api/proofread/check", summary="核稿检查")
def proofread_check(
    body: dict,
    db: Session = Depends(get_db),
):
    """
    对文稿内容进行核稿检查
    返回所有匹配的错误列表，包含位置信息
    """
    content = body.get("content", "")
    rules = db.query(ProofreadRule).filter(ProofreadRule.enabled == True).all()

    results = []
    for rule in rules:
        try:
            pattern = re.compile(rule.pattern)
        except re.error:
            continue

        for match in pattern.finditer(content):
            results.append({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "description": rule.description,
                "severity": rule.severity,
                "matched_text": match.group(),
                "start": match.start(),
                "end": match.end(),
                "line": content[:match.start()].count('\n') + 1,
            })

    # 按位置排序
    results.sort(key=lambda x: x["start"])

    return {"errors": results, "total": len(results)}


# ==================== 预置核稿规则初始化 ====================

def init_proofread_rules():
    """初始化预置核稿规则"""
    db = SessionLocal()
    try:
        existing = db.query(ProofreadRule).filter(ProofreadRule.is_builtin == True).count()
        if existing > 0:
            return

        builtin_rules = [
            {"name": "重复句号", "description": "连续出现多个句号", "pattern": "。{2,}", "severity": "error"},
            {"name": "重复逗号", "description": "连续出现多个逗号", "pattern": "，{2,}", "severity": "error"},
            {"name": "重复顿号", "description": "连续出现多个顿号", "pattern": "、{2,}", "severity": "error"},
            {"name": "多余空格", "description": "中文之间有多余空格", "pattern": "[\\u4e00-\\u9fff] +[\\u4e00-\\u9fff]", "severity": "warning"},
            {"name": "英文前后缺空格", "description": "中文与英文之间缺少空格", "pattern": "[\\u4e00-\\u9fff][a-zA-Z]|[a-zA-Z][\\u4e00-\\u9fff]", "severity": "info"},
            {"name": "重复的", "description": "出现重复的\"的\"", "pattern": "的的", "severity": "error"},
            {"name": "重复的了", "description": "出现重复的了", "pattern": "了了", "severity": "error"},
            {"name": "首行空格", "description": "段落首行有多余空格（建议使用缩进）", "pattern": "^ +", "severity": "info"},
            {"name": "全角数字", "description": "文中使用了全角数字", "pattern": "[０-９]", "severity": "warning"},
            {"name": "多余空行", "description": "连续出现多个空行", "pattern": "\n{3,}", "severity": "warning"},
        ]

        for r in builtin_rules:
            db_rule = ProofreadRule(
                name=r["name"],
                description=r["description"],
                pattern=r["pattern"],
                severity=r["severity"],
                is_builtin=True,
                enabled=True,
            )
            db.add(db_rule)
        db.commit()
    finally:
        db.close()


# ==================== 根路由 ====================



# ==================== 网页代理路由 ====================

@app.get("/api/proxy/web", summary="网页代理")
async def proxy_web(url: str = Query(..., description="要代理的网页URL")):
    """
    通过后端代理转发网页内容，去除X-Frame-Options等安全限制头，
    重写页面中的链接使其也通过代理加载，确保iframe可以正常嵌入显示。
    静态资源（图片、CSS、JS）直接使用原始URL，不经过代理，提升加载速度。
    """
    # 验证URL格式
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            raise HTTPException(status_code=400, detail="仅支持 http/https 协议")
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="无效的URL")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail="无效的URL")

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=20.0,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'identity',
            }
        ) as client:
            response = await client.get(url)

        content_type = response.headers.get('content-type', 'text/html')

        # 非HTML内容（图片、CSS、JS、字体等），直接转发，不走HTML解析
        if 'text/html' not in content_type:
            return Response(
                content=response.content,
                media_type=content_type,
                headers={
                    "X-Frame-Options": "ALLOWALL",
                    "Content-Security-Policy": "frame-ancestors *",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400",
                }
            )

        # HTML内容：重写导航链接，保留静态资源原始URL
        html_content = response.text
        soup = BeautifulSoup(html_content, 'html.parser')

        base_url = url
        parsed_base = urlparse(base_url)
        base_origin = f"{parsed_base.scheme}://{parsed_base.netloc}"

        def should_proxy(href):
            """判断链接是否需要代理（仅代理同站导航链接）"""
            if not href:
                return False
            href = href.strip()
            if href.startswith('#') or href.startswith('javascript:') or href.startswith('mailto:') or href.startswith('tel:'):
                return False
            # 协议相对路径 //cdn.xxx.com 不代理
            if href.startswith('//'):
                return False
            absolute = urljoin(base_url, href)
            parsed_href = urlparse(absolute)
            # 只代理同站点的HTML页面链接
            if parsed_href.netloc == parsed_base.netloc:
                return True
            # 外部链接也代理，确保在iframe内打开
            return True

        def make_proxy_url(target_url):
            """生成代理URL"""
            return f"/api/proxy/web?url={url_quote(target_url, safe='')}"

        # 1. 重写 <a> 标签 - 仅代理页面导航链接
        for a_tag in soup.find_all('a', href=True):
            original_href = a_tag['href']
            if not should_proxy(original_href):
                continue
            absolute_url = urljoin(base_url, original_href)
            a_tag['href'] = make_proxy_url(absolute_url)
            # 移除 target，确保在当前iframe中打开
            if 'target' in a_tag.attrs:
                del a_tag['target']

        # 2. 重写 <iframe> 标签
        for iframe_tag in soup.find_all('iframe', src=True):
            original_src = iframe_tag['src']
            if original_src.startswith('javascript:') or original_src.startswith('//'):
                continue
            absolute_url = urljoin(base_url, original_src)
            iframe_tag['src'] = make_proxy_url(absolute_url)

        # 3. 重写 <form> 标签 - 保留原始method，action通过代理
        for form_tag in soup.find_all('form'):
            action = form_tag.get('action', '')
            if action and not action.startswith('javascript:'):
                absolute_url = urljoin(base_url, action)
                form_tag['action'] = make_proxy_url(absolute_url)
            elif not action:
                form_tag['action'] = make_proxy_url(base_url)
            # 保留原始 method，不强制改为 GET

        # 4. 重写 <meta http-equiv="refresh"> 跳转
        for meta_tag in soup.find_all('meta', attrs={'http-equiv': 'refresh'}):
            content = meta_tag.get('content', '')
            # 格式: "5;url=http://example.com"
            match = re.search(r'url=(.+)', content, re.IGNORECASE)
            if match:
                redirect_url = match.group(1).strip().strip("'\"")
                absolute_url = urljoin(base_url, redirect_url)
                meta_tag['content'] = content[:match.start(1)] + make_proxy_url(absolute_url)

        # 5. 重写 <area> 标签（图片地图链接）
        for area_tag in soup.find_all('area', href=True):
            original_href = area_tag['href']
            if not should_proxy(original_href):
                continue
            absolute_url = urljoin(base_url, original_href)
            area_tag['href'] = make_proxy_url(absolute_url)

        # 注意：不重写 <link>(CSS)、<script>(JS)、<img>(图片) 的 src/href
        # 这些静态资源直接使用原始URL，不经过代理，大幅提升加载速度

        # 6. 移除可能阻止iframe加载的 <meta> 标签
        for meta_tag in soup.find_all('meta'):
            http_equiv = meta_tag.get('http-equiv', '').lower()
            if http_equiv == 'x-frame-options' or http_equiv == 'content-security-policy':
                meta_tag.decompose()

        # 7. 注入CSS修复样式（确保页面在iframe中正确显示）
        inject_style = soup.new_tag('style')
        inject_style.string = """
            /* 代理注入样式 - 确保页面在iframe中正确显示 */
            body { margin: 0 !important; padding: 0 !important; }
            /* 修复图片自适应 */
            img { max-width: 100% !important; height: auto !important; }
            /* 修复视频自适应 */
            video { max-width: 100% !important; height: auto !important; }
            /* 修复溢出 */
            html, body { overflow-x: hidden !important; }
            /* 修复固定定位元素 */
            [style*="position: fixed"], [style*="position:fixed"] {
                position: absolute !important;
            }
        """
        head = soup.find('head')
        if head:
            head.append(inject_style)

        html_content = str(soup)

        return Response(
            content=html_content,
            media_type='text/html; charset=utf-8',
            headers={
                "X-Frame-Options": "ALLOWALL",
                "Content-Security-Policy": "frame-ancestors *",
                "Access-Control-Allow-Origin": "*",
            }
        )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="网页加载超时，请稍后重试")
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="无法连接到目标网页")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"代理网页时出错: {str(e)}")


# ==================== 静态文件服务（生产模式） ====================

static_dir = os.path.join(os.path.dirname(__file__), "static")

@app.get("/", include_in_schema=False)
async def serve_root():
    """根路径：优先返回前端页面，否则返回API信息"""
    if os.path.isdir(static_dir):
        index_path = os.path.join(static_dir, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
    return {
        "name": "知识管理系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }

if os.path.isdir(static_dir):
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_static(full_path: str):
        """生产模式下提供前端静态文件"""
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # SPA 路由回退：返回 index.html
        index_path = os.path.join(static_dir, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="文件不存在")
