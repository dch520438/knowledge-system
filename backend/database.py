# -*- coding: utf-8 -*-
"""
数据库配置模块
使用SQLAlchemy连接SQLite数据库，提供数据库会话管理
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 数据库文件路径
DATABASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATABASE_DIR, exist_ok=True)
DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'knowledge_system.db')}"

# 创建数据库引擎
# check_same_thread=False 允许SQLite在多线程环境下使用
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基类，所有ORM模型都继承自此类
Base = declarative_base()


def get_db():
    """
    数据库会话依赖注入函数
    用作FastAPI路由的Depends参数，自动管理数据库会话的生命周期
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
