#!/bin/bash
# 智能知识工作台 - 麒麟/国产 Linux 安装包构建脚本
# 支持构建: deb 包、AppImage、RPM 包

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
VERSION="1.0.0"
ARCH="amd64"

echo "========================================"
echo "  智能知识工作台 - 麒麟 Linux 打包"
echo "========================================"
echo ""

# 检查依赖
check_deps() {
    local deps=("python3" "pip3" "npm" "dpkg-deb")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            echo "[警告] 未找到 $dep"
        fi
    done
}

check_deps

# 清理并创建构建目录
echo "[1/6] 准备构建目录..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 安装后端依赖
echo "[2/6] 安装后端依赖..."
cd "$PROJECT_ROOT/backend"
pip3 install -r requirements.txt --user -q 2>/dev/null || pip3 install -r requirements.txt -q

# 构建前端
echo "[3/6] 构建前端..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build

# 复制静态文件到后端
cd "$PROJECT_ROOT"
rm -rf backend/static
cp -r frontend/dist backend/static

# ==================== 构建 deb 包 ====================
build_deb() {
    echo "[4/6] 构建 deb 安装包..."
    
    DEB_DIR="$BUILD_DIR/knowledge-workstation_${VERSION}_${ARCH}"
    mkdir -p "$DEB_DIR/DEBIAN"
    mkdir -p "$DEB_DIR/opt/knowledge-workstation"
    mkdir -p "$DEB_DIR/usr/share/applications"
    mkdir -p "$DEB_DIR/usr/share/icons/hicolor/256x256/apps"
    mkdir -p "$DEB_DIR/usr/bin"
    
    # 复制应用文件
    cp -r backend "$DEB_DIR/opt/knowledge-workstation/"
    cp -r templates "$DEB_DIR/opt/knowledge-workstation/" 2>/dev/null || true
    cp start.sh "$DEB_DIR/opt/knowledge-workstation/"
    
    # 创建启动脚本
    cat > "$DEB_DIR/usr/bin/knowledge-workstation" << 'EOF'
#!/bin/bash
# 智能知识工作台启动脚本
cd /opt/knowledge-workstation
exec ./start.sh "$@"
EOF
    chmod +x "$DEB_DIR/usr/bin/knowledge-workstation"
    
    # 创建桌面文件
    cat > "$DEB_DIR/usr/share/applications/knowledge-workstation.desktop" << EOF
[Desktop Entry]
Name=智能知识工作台
Name[zh_CN]=智能知识工作台
Comment=集成知识库管理、智能写作、核稿检查、智能问答的综合工作平台
Exec=/usr/bin/knowledge-workstation
Icon=knowledge-workstation
Type=Application
Categories=Office;Education;
Terminal=false
StartupNotify=true
EOF
    
    # 创建控制文件
    cat > "$DEB_DIR/DEBIAN/control" << EOF
Package: knowledge-workstation
Version: $VERSION
Section: office
Priority: optional
Architecture: $ARCH
Depends: python3 (>= 3.8), python3-pip, nodejs (>= 16) | node (>= 16)
Maintainer: Knowledge Workstation Team
Description: 智能知识工作台
 集成知识库管理、智能写作、核稿检查、
 智能问答和大模型辅助的综合工作平台。
EOF
    
    # 创建 postinst 脚本
    cat > "$DEB_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# 安装 Python 依赖
cd /opt/knowledge-workstation/backend
pip3 install -r requirements.txt --break-system-packages -q 2>/dev/null || pip3 install -r requirements.txt -q 2>/dev/null || true

# 确保数据目录存在
mkdir -p /opt/knowledge-workstation/backend/data
chmod 755 /opt/knowledge-workstation/backend/data

echo "智能知识工作台安装完成！"
echo "在终端运行: knowledge-workstation"
echo "或在应用菜单中查找: 智能知识工作台"
EOF
    chmod +x "$DEB_DIR/DEBIAN/postinst"
    
    # 创建 prerm 脚本
    cat > "$DEB_DIR/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e

# 停止可能运行的服务
pkill -f "uvicorn main:app" 2>/dev/null || true

echo "正在卸载智能知识工作台..."
EOF
    chmod +x "$DEB_DIR/DEBIAN/prerm"
    
    # 构建 deb 包
    dpkg-deb --build "$DEB_DIR"
    mv "$BUILD_DIR/knowledge-workstation_${VERSION}_${ARCH}.deb" "$BUILD_DIR/"
    
    echo "  deb 包构建完成: $BUILD_DIR/knowledge-workstation_${VERSION}_${ARCH}.deb"
}

# ==================== 构建 AppImage ====================
build_appimage() {
    echo "[5/6] 构建 AppImage..."
    
    APPIMAGE_DIR="$BUILD_DIR/AppImage"
    mkdir -p "$APPIMAGE_DIR/usr/bin"
    mkdir -p "$APPIMAGE_DIR/usr/share/applications"
    mkdir -p "$APPIMAGE_DIR/usr/share/icons/hicolor/256x256/apps"
    
    # 复制应用文件
    cp -r "$PROJECT_ROOT/backend" "$APPIMAGE_DIR/usr/bin/"
    cp -r "$PROJECT_ROOT/templates" "$APPIMAGE_DIR/usr/bin/" 2>/dev/null || true
    
    # 创建 AppRun 脚本
    cat > "$APPIMAGE_DIR/AppRun" << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="$HERE/usr/bin:$PATH"
export PYTHONPATH="$HERE/usr/bin/backend:$PYTHONPATH"

cd "$HERE/usr/bin/backend"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
EOF
    chmod +x "$APPIMAGE_DIR/AppRun"
    
    # 创建桌面文件
    cat > "$APPIMAGE_DIR/usr/share/applications/knowledge-workstation.desktop" << EOF
[Desktop Entry]
Name=智能知识工作台
Exec=AppRun
Icon=knowledge-workstation
Type=Application
Categories=Office;Education;
Terminal=true
EOF
    
    # 复制桌面文件到根
    cp "$APPIMAGE_DIR/usr/share/applications/knowledge-workstation.desktop" "$APPIMAGE_DIR/knowledge-workstation.desktop"
    
    # 下载 appimagetool（如果不存在）
    if [ ! -f "$BUILD_DIR/appimagetool-x86_64.AppImage" ]; then
        echo "  下载 appimagetool..."
        wget -q "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" -O "$BUILD_DIR/appimagetool-x86_64.AppImage" || {
            echo "  [跳过] 无法下载 appimagetool，跳过 AppImage 构建"
            return 1
        }
        chmod +x "$BUILD_DIR/appimagetool-x86_64.AppImage"
    fi
    
    # 构建 AppImage
    ARCH=x86_64 "$BUILD_DIR/appimagetool-x86_64.AppImage" "$APPIMAGE_DIR" "$BUILD_DIR/KnowledgeWorkstation-x86_64.AppImage" 2>/dev/null || {
        echo "  [跳过] AppImage 构建失败，可能需要 FUSE 支持"
        return 1
    }
    
    echo "  AppImage 构建完成: $BUILD_DIR/KnowledgeWorkstation-x86_64.AppImage"
}

# ==================== 构建 RPM 包 ====================
build_rpm() {
    echo "[6/6] 构建 RPM 安装包..."
    
    if ! command -v rpmbuild &> /dev/null; then
        echo "  [跳过] 未找到 rpmbuild，跳过 RPM 构建"
        echo "  安装方法: sudo yum install rpm-build 或 sudo apt-get install rpm"
        return 1
    fi
    
    RPMBUILD_DIR="$BUILD_DIR/rpmbuild"
    mkdir -p "$RPMBUILD_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
    
    # 创建源码 tarball
    tar czf "$RPMBUILD_DIR/SOURCES/knowledge-workstation-$VERSION.tar.gz" \
        -C "$PROJECT_ROOT" backend templates start.sh README.md
    
    # 创建 spec 文件
    cat > "$RPMBUILD_DIR/SPECS/knowledge-workstation.spec" << EOF
Name:           knowledge-workstation
Version:        $VERSION
Release:        1%{?dist}
Summary:        智能知识工作台
License:        MIT
Source0:        knowledge-workstation-$VERSION.tar.gz
BuildArch:      noarch
Requires:       python3 >= 3.8, python3-pip

%description
集成知识库管理、智能写作、核稿检查、
智能问答和大模型辅助的综合工作平台。

%prep
%setup -q

%install
mkdir -p %{buildroot}/opt/knowledge-workstation
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications

cp -r backend templates %{buildroot}/opt/knowledge-workstation/
cp start.sh %{buildroot}/opt/knowledge-workstation/

cat > %{buildroot}/usr/bin/knowledge-workstation << 'SCRIPTEOF'
#!/bin/bash
cd /opt/knowledge-workstation
exec ./start.sh "\$@"
SCRIPTEOF
chmod +x %{buildroot}/usr/bin/knowledge-workstation

cat > %{buildroot}/usr/share/applications/knowledge-workstation.desktop << 'DESKEOF'
[Desktop Entry]
Name=智能知识工作台
Exec=/usr/bin/knowledge-workstation
Icon=knowledge-workstation
Type=Application
Categories=Office;Education;
Terminal=false
DESKEOF

%post
cd /opt/knowledge-workstation/backend
pip3 install -r requirements.txt -q 2>/dev/null || true
mkdir -p /opt/knowledge-workstation/backend/data

%preun
pkill -f "uvicorn main:app" 2>/dev/null || true

%files
/opt/knowledge-workstation/
/usr/bin/knowledge-workstation
/usr/share/applications/knowledge-workstation.desktop

%changelog
* $(date +"%a %b %d %Y") Knowledge Workstation Team - $VERSION-1
- 初始版本发布
EOF
    
    # 构建 RPM
    rpmbuild --define "_topdir $RPMBUILD_DIR" -ba "$RPMBUILD_DIR/SPECS/knowledge-workstation.spec"
    
    # 复制生成的 RPM
    find "$RPMBUILD_DIR/RPMS" -name "*.rpm" -exec cp {} "$BUILD_DIR/" \;
    
    echo "  RPM 构建完成"
}

# 执行构建
build_deb
build_appimage || true
build_rpm || true

# 完成
echo ""
echo "========================================"
echo "  构建完成！"
echo "========================================"
echo ""
echo "输出文件:"
for f in "$BUILD_DIR"/*.{deb,rpm,AppImage} 2>/dev/null; do
    if [ -f "$f" ]; then
        echo "  $(basename "$f")"
    fi
done
echo ""
echo "安装说明:"
echo "  deb 包: sudo dpkg -i knowledge-workstation_${VERSION}_${ARCH}.deb"
echo "  RPM 包: sudo rpm -ivh knowledge-workstation-${VERSION}-1.*.rpm"
echo "  AppImage: chmod +x KnowledgeWorkstation-x86_64.AppImage && ./KnowledgeWorkstation-x86_64.AppImage"
echo ""
