#!/bin/bash
# 智能知识工作台 - Android APK 构建脚本
# 需要: Android Studio 或 Android SDK + Gradle

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/project"

echo "========================================"
echo "  智能知识工作台 - Android APK 构建"
echo "========================================"
echo ""

# 检查 Android SDK
if [ -z "$ANDROID_SDK_ROOT" ] && [ -z "$ANDROID_HOME" ]; then
    echo "[错误] 未找到 Android SDK"
    echo "请设置 ANDROID_SDK_ROOT 或 ANDROID_HOME 环境变量"
    echo "下载地址: https://developer.android.com/studio"
    exit 1
fi

# 创建 Android 项目结构
echo "[1/4] 创建 Android 项目..."
mkdir -p "$PROJECT_DIR/app/src/main/java/com/knowledgeworkstation/app"
mkdir -p "$PROJECT_DIR/app/src/main/res/layout"
mkdir -p "$PROJECT_DIR/app/src/main/res/values"
mkdir -p "$PROJECT_DIR/app/src/main/res/mipmap-hdpi"
mkdir -p "$PROJECT_DIR/app/src/main/res/mipmap-mdpi"
mkdir -p "$PROJECT_DIR/app/src/main/res/mipmap-xhdpi"
mkdir -p "$PROJECT_DIR/app/src/main/res/mipmap-xxhdpi"
mkdir -p "$PROJECT_DIR/app/src/main/res/mipmap-xxxhdpi"

# 复制源码
cp "$SCRIPT_DIR/build.gradle.kts" "$PROJECT_DIR/app/build.gradle.kts"
cp "$SCRIPT_DIR/AndroidManifest.xml" "$PROJECT_DIR/app/src/main/AndroidManifest.xml"
cp "$SCRIPT_DIR/MainActivity.java" "$PROJECT_DIR/app/src/main/java/com/knowledgeworkstation/app/MainActivity.java"
cp "$SCRIPT_DIR/activity_main.xml" "$PROJECT_DIR/app/src/main/res/layout/activity_main.xml"
cp "$SCRIPT_DIR/strings.xml" "$PROJECT_DIR/app/src/main/res/values/strings.xml"

# 创建项目级 build.gradle
cat > "$PROJECT_DIR/build.gradle.kts" << 'EOF'
plugins {
    id("com.android.application") version "8.2.0" apply false
}
EOF

# 创建 settings.gradle
cat > "$PROJECT_DIR/settings.gradle.kts" << 'EOF'
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "KnowledgeWorkstation"
include(":app")
EOF

# 创建 gradle wrapper
mkdir -p "$PROJECT_DIR/gradle/wrapper"
cat > "$PROJECT_DIR/gradle/wrapper/gradle-wrapper.properties" << 'EOF'
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

# 下载 gradle wrapper
echo "[2/4] 下载 Gradle Wrapper..."
cd "$PROJECT_DIR"
if ! [ -f "gradlew" ]; then
    # 使用系统 gradle 生成 wrapper
    if command -v gradle &> /dev/null; then
        gradle wrapper
    else
        echo "[警告] 未找到 gradle，尝试直接下载..."
        curl -L -o gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/v8.2.0/gradle/wrapper/gradle-wrapper.jar
        curl -L -o gradlew https://raw.githubusercontent.com/gradle/gradle/v8.2.0/gradlew
        chmod +x gradlew
    fi
fi

# 构建 APK
echo "[3/4] 构建 APK..."
./gradlew assembleRelease

echo "[4/4] 构建完成！"
echo ""
echo "输出文件:"
echo "  $PROJECT_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"
echo ""
echo "注意: 这是未签名的 APK，发布前需要签名:"
echo "  1. 生成密钥库: keytool -genkey -v -keystore mykey.keystore -alias myalias -keyalg RSA -validity 10000"
echo "  2. 签名 APK: jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore mykey.keystore app-release-unsigned.apk myalias"
echo ""
