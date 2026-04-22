# -*- coding: utf-8 -*-
"""
Pydantic数据模型
用于API请求参数验证和响应数据序列化
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ==================== 知识条目 Schema ====================

class KnowledgeItemCreate(BaseModel):
    """创建知识条目的请求模型"""
    title: str = Field(..., min_length=1, max_length=255, description="知识标题")
    content: str = Field(..., min_length=1, description="知识内容")
    category: Optional[str] = Field(None, max_length=100, description="分类")
    tags: Optional[str] = Field("", max_length=500, description="标签，逗号分隔")


class KnowledgeItemUpdate(BaseModel):
    """更新知识条目的请求模型（所有字段可选）"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="知识标题")
    content: Optional[str] = Field(None, min_length=1, description="知识内容")
    category: Optional[str] = Field(None, max_length=100, description="分类")
    tags: Optional[str] = Field(None, max_length=500, description="标签，逗号分隔")


class KnowledgeItemResponse(BaseModel):
    """知识条目的响应模型"""
    id: int
    title: str
    content: str
    category: Optional[str] = None
    tags: Optional[str] = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 写作文档 Schema ====================

class WritingDocumentCreate(BaseModel):
    """创建写作文档的请求模型"""
    title: str = Field(..., min_length=1, max_length=255, description="文档标题")
    content: str = Field("", description="文档内容")
    referenced_knowledge_ids: Optional[str] = Field("", description="引用的知识条目ID，逗号分隔")
    status: Optional[str] = Field("draft", description="状态：draft-草稿，published-已发布")


class WritingDocumentUpdate(BaseModel):
    """更新写作文档的请求模型（所有字段可选）"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="文档标题")
    content: Optional[str] = Field(None, description="文档内容")
    referenced_knowledge_ids: Optional[str] = Field(None, description="引用的知识条目ID，逗号分隔")
    status: Optional[str] = Field(None, description="状态：draft-草稿，published-已发布")


class WritingDocumentResponse(BaseModel):
    """写作文档的响应模型"""
    id: int
    title: str
    content: str
    referenced_knowledge_ids: Optional[str] = ""
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 问答记录 Schema ====================

class QARecordCreate(BaseModel):
    """创建问答记录的请求模型"""
    question: str = Field(..., min_length=1, description="问题")
    answer: str = Field("", description="回答")
    referenced_knowledge_ids: Optional[str] = Field("", description="引用的知识条目ID，逗号分隔")


class QARecordUpdate(BaseModel):
    """更新问答记录的请求模型（所有字段可选）"""
    question: Optional[str] = Field(None, min_length=1, description="问题")
    answer: Optional[str] = Field(None, description="回答")
    referenced_knowledge_ids: Optional[str] = Field(None, description="引用的知识条目ID，逗号分隔")


class QARecordResponse(BaseModel):
    """问答记录的响应模型"""
    id: int
    question: str
    answer: str
    referenced_knowledge_ids: Optional[str] = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 通用搜索结果 Schema ====================

class SearchResult(BaseModel):
    """通用搜索结果模型"""
    type: str = Field(..., description="结果类型：knowledge/writing/qa")
    id: int = Field(..., description="记录ID")
    title: str = Field(..., description="标题或摘要")
    content: str = Field("", description="内容摘要")
    category: Optional[str] = Field(None, description="分类（仅知识条目）")
    created_at: Optional[datetime] = Field(None, description="创建时间")


# ==================== 批量操作 Schema ====================

class BatchKnowledgeCreate(BaseModel):
    """批量创建知识条目"""
    items: List[KnowledgeItemCreate]


# ==================== 智能问答 Schema ====================

class SmartAnswerRequest(BaseModel):
    """智能问答请求"""
    question: str = Field(..., min_length=1, description="问题")


# ==================== 核稿规则 Schema ====================

class ProofreadRuleCreate(BaseModel):
    """创建核稿规则的请求模型"""
    name: str = Field(..., min_length=1, max_length=255, description="规则名称")
    description: str = Field("", description="规则描述")
    pattern: str = Field(..., min_length=1, description="匹配模式（正则表达式）")
    severity: str = Field("warning", description="严重程度：error/warning/info")
    enabled: bool = Field(True, description="是否启用")


class ProofreadRuleResponse(BaseModel):
    """核稿规则的响应模型"""
    id: int
    name: str
    description: str = ""
    pattern: str
    severity: str = "warning"
    is_builtin: bool = False
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==================== 大模型配置 Schema ====================

class LLMConfigCreate(BaseModel):
    name: str
    provider: str
    api_base: str
    api_key: str = ""
    model: str
    is_active: bool = False
    max_tokens: int = 2048
    temperature: float = 0.7

class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    is_active: Optional[bool] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None

class LLMConfigResponse(BaseModel):
    id: int
    name: str
    provider: str
    api_base: str
    api_key: str = ""
    model: str
    is_active: bool
    max_tokens: int
    temperature: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class LLMChatRequest(BaseModel):
    messages: list  # [{"role": "user/system/assistant", "content": "..."}]
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None

class LLMChatResponse(BaseModel):
    content: str
    model: str
    provider: str

class LLMQARequest(BaseModel):
    question: str

class LLMWritingRequest(BaseModel):
    action: str  # polish/continue/summarize/expand
    content: str
    instruction: str = ""

class LLMKnowledgeRequest(BaseModel):
    action: str  # extract/classify/summarize
    content: str

class LLMProofreadRequest(BaseModel):
    content: str
