# -*- coding: utf-8 -*-
"""
智能知识工作台 - 打包入口（无控制台窗口模式）
用于 PyInstaller 打包为独立可执行文件
"""

import os
import sys
import io
import webbrowser
import time
import threading
import logging

# 确定资源路径（支持开发和打包后两种模式）
def get_resource_path(relative_path):
    """获取资源文件路径，兼容开发模式和 PyInstaller 打包后"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def get_data_dir():
    """获取数据存储目录（打包后使用用户目录，避免权限问题）"""
    if hasattr(sys, '_MEIPASS'):
        data_dir = os.path.join(os.path.expanduser('~'), '.knowledge-workstation', 'data')
        os.makedirs(data_dir, exist_ok=True)
        return data_dir
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    os.makedirs(data_dir, exist_ok=True)
    return data_dir

def get_log_dir():
    """获取日志目录"""
    if hasattr(sys, '_MEIPASS'):
        log_dir = os.path.join(os.path.expanduser('~'), '.knowledge-workstation', 'logs')
    else:
        log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    return log_dir

# 设置环境变量
os.environ['DATA_DIR'] = get_data_dir()

# 确保数据目录存在
data_dir = get_data_dir()
os.makedirs(data_dir, exist_ok=True)

# 将后端目录加入路径
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# 配置日志输出到文件（无控制台窗口时，日志写入文件）
log_dir = get_log_dir()
log_file = os.path.join(log_dir, 'server.log')

# 配置 uvicorn 日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
    ]
)
logger = logging.getLogger(__name__)

# 导入 FastAPI 应用
from main import app
import uvicorn

def open_browser():
    """延迟打开浏览器"""
    time.sleep(3)
    try:
        webbrowser.open('http://localhost:8000')
    except Exception:
        pass

def main():
    """主入口函数"""
    logger.info("=" * 40)
    logger.info("  智能知识工作台")
    logger.info("=" * 40)
    logger.info("数据目录: %s", data_dir)
    logger.info("日志文件: %s", log_file)
    logger.info("启动服务中，请稍候...")

    # 在新线程中打开浏览器
    threading.Thread(target=open_browser, daemon=True).start()

    # 启动 Uvicorn 服务（日志写入文件）
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)
    # 配置日志处理器：写入文件
    config.setup_event_loop()
    server.run()

if __name__ == "__main__":
    main()
