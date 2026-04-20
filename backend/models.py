# -*- coding: utf-8 -*-
"""
数据库ORM模型
定义知识库、写作文档、问答记录三张核心数据表
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from database import Base


class KnowledgeItem(Base):
    """知识条目模型"""
    __tablename__ = "knowledge_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, comment="知识标题")
    content = Column(Text, nullable=False, comment="知识内容")
    category = Column(String(100), nullable=True, comment="分类（可选）")
    tags = Column(String(500), nullable=True, default="", comment="标签，逗号分隔")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")


class ProofreadRule(Base):
    """核稿规则模型"""
    __tablename__ = "proofread_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, comment="规则名称")
    description = Column(Text, comment="规则描述")
    pattern = Column(Text, nullable=False, comment="匹配模式（正则表达式）")
    severity = Column(String(20), default="warning", comment="严重程度：error/warning/info")
    is_builtin = Column(Boolean, default=False, comment="是否为预置规则")
    enabled = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")


class WritingDocument(Base):
    """写作文档模型"""
    __tablename__ = "writing_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, comment="文档标题")
    content = Column(Text, nullable=False, default="", comment="文档内容")
    referenced_knowledge_ids = Column(String(500), nullable=True, default="", comment="引用的知识条目ID，逗号分隔")
    status = Column(String(20), nullable=False, default="draft", comment="状态：draft-草稿，published-已发布")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")


class QARecord(Base):
    """问答记录模型"""
    __tablename__ = "qa_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question = Column(Text, nullable=False, comment="问题")
    answer = Column(Text, nullable=False, default="", comment="回答")
    referenced_knowledge_ids = Column(String(500), nullable=True, default="", comment="引用的知识条目ID，逗号分隔")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
