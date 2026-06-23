# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 打包配置文件 - Windows
生成独立的 KnowledgeWorkstation.exe
"""

import sys
import os

# 项目根目录
project_root = os.path.abspath(os.path.join(SPECPATH, '..', '..'))
backend_dir = os.path.join(project_root, 'backend')
frontend_dist = os.path.join(backend_dir, 'static')

# 确保前端已构建
if not os.path.exists(os.path.join(frontend_dist, 'index.html')):
    print("错误: 前端未构建。请先运行 npm run build 并复制到 backend/static")
    sys.exit(1)

block_cipher = None

# 收集所有后端 Python 文件
backend_files = []
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith('.py') or file.endswith('.txt') or file.endswith('.db'):
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(os.path.dirname(full_path), backend_dir)
            backend_files.append((full_path, rel_path))

# 收集前端静态文件
static_files = []
if os.path.exists(frontend_dist):
    for root, dirs, files in os.walk(frontend_dist):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(os.path.dirname(full_path), backend_dir)
            static_files.append((full_path, rel_path))

# 合并所有资源
all_datas = backend_files + static_files

# 添加模板文件
templates_dir = os.path.join(project_root, 'templates')
if os.path.exists(templates_dir):
    for root, dirs, files in os.walk(templates_dir):
        for file in files:
            full_path = os.path.join(root, file)
            all_datas.append((full_path, 'templates'))

a = Analysis(
    [os.path.join(backend_dir, 'main_entry.py')],
    pathex=[backend_dir, project_root],
    binaries=[],
    datas=all_datas,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops.auto',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets.auto',
        'fastapi',
        'starlette',
        'pydantic',
        'sqlalchemy',
        'sqlalchemy.ext.declarative',
        'docx',
        'docx.shared',
        'docx.enum.text',
        'docx.oxml.ns',
        'bs4',
        'httpx',
        'pdfplumber',
        'h11',
        'httptools',
        'python_multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='KnowledgeWorkstation',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(SPECPATH, 'icon.ico') if os.path.exists(os.path.join(SPECPATH, 'icon.ico')) else None,
)
