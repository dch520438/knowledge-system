# -*- coding: utf-8 -*-
"""
智能知识工作台 - 打包入口
用于 PyInstaller 打包为独立可执行文件
"""

import os
import sys
import subprocess
import webbrowser
import time
import threading

# 确定资源路径（支持开发和打包后两种模式）
def get_resource_path(relative_path):
    """获取资源文件路径，兼容开发模式和 PyInstaller 打包后"""
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller 打包后的临时目录
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def get_data_dir():
    """获取数据存储目录（打包后使用用户目录，避免权限问题）"""
    if hasattr(sys, '_MEIPASS'):
        # 打包后使用用户数据目录
        data_dir = os.path.join(os.path.expanduser('~'), '.knowledge-workstation', 'data')
        os.makedirs(data_dir, exist_ok=True)
        return data_dir
    # 开发模式使用当前目录
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    os.makedirs(data_dir, exist_ok=True)
    return data_dir

# 设置环境变量
os.environ['DATA_DIR'] = get_data_dir()

# 确保数据目录存在
data_dir = get_data_dir()
os.makedirs(data_dir, exist_ok=True)

# 将后端目录加入路径
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# 导入 FastAPI 应用
from main import app
import uvicorn

def open_browser():
    """延迟打开浏览器"""
    time.sleep(3)
    webbrowser.open('http://localhost:8000')

def main():
    """主入口函数"""
    print("=" * 40)
    print("  智能知识工作台")
    print("=" * 40)
    print(f"数据目录: {data_dir}")
    print("启动服务中，请稍候...")
    print("")

    # 在新线程中打开浏览器
    threading.Thread(target=open_browser, daemon=True).start()

    # 启动 Uvicorn 服务
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

if __name__ == "__main__":
    main()
