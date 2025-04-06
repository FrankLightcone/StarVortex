# -*- coding: utf-8 -*-
"""
macOS平台PySide6应用打包脚本
"""
import os
import sys
import shutil
import subprocess

# 应用名称
APP_NAME = "HomeworkSubmit"

# 图标文件名 (确保icon.icns文件存在于当前目录)
ICON_NAME = "icon.icns"

# 主Python文件名
MAIN_PY = "desktop.py"

def create_spec_file():
    """创建自定义spec文件"""
    spec_content = f"""# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['{MAIN_PY}'],
    pathex=[],
    binaries=[],
    datas=[
        ('loading.html', '.'),  # 打包loading.html
        ('{ICON_NAME}', '.'),   # 打包图标文件
        ('config.json', '.'),   # 如果有配置文件也打包
    ],
    hiddenimports=['PySide6.QtCore', 'PySide6.QtGui', 'PySide6.QtWidgets', 'PySide6.QtWebEngineWidgets', 'PySide6.QtNetwork'],
    hookspath=[],
    hooksconfig={{}},
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
    [],
    exclude_binaries=True,
    name='{APP_NAME}',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=True,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='{ICON_NAME}',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='{APP_NAME}',
)

# macOS特有的bundle配置
app = BUNDLE(
    coll,
    name='{APP_NAME}.app',
    icon='{ICON_NAME}',
    bundle_identifier='com.yourcompany.{APP_NAME.lower()}',
    info_plist={{
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
        'NSPrincipalClass': 'NSApplication',
        'NSHighResolutionCapable': True,
        'CFBundleDisplayName': '{APP_NAME}',
        'CFBundleExecutable': '{APP_NAME}',
        'CFBundleName': '{APP_NAME}',
    }},
)
"""
    
    with open(f"{APP_NAME}_macos.spec", "w", encoding="utf-8") as f:
        f.write(spec_content)
    
    print(f"已创建spec文件: {APP_NAME}_macos.spec")

def build_app():
    """构建macOS应用"""
    print("开始构建macOS应用...")
    
    # 检查文件是否存在
    required_files = [MAIN_PY, 'loading.html']
    for file in required_files:
        if not os.path.exists(file):
            print(f"错误: 找不到文件 {file}")
            return False
    
    # 检查图标文件，提示转换方法
    if not os.path.exists(ICON_NAME):
        print(f"警告: 找不到图标文件 {ICON_NAME}")
        print("提示: 在macOS上，您需要将图标转换为.icns格式")
        print("您可以使用以下命令创建.icns文件:")
        print("  1. 准备一个1024x1024像素的PNG图像")
        print("  2. 创建一个名为'icon.iconset'的文件夹")
        print("  3. 使用sips命令创建不同尺寸的图标:")
        print("     mkdir icon.iconset")
        print("     sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png")
        print("     sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png")
        print("     sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png")
        print("     sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png")
        print("     sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png")
        print("     sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png")
        print("     sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png")
        print("     sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png")
        print("     sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png")
        print("     sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png")
        print("  4. 使用iconutil命令创建.icns文件:")
        print("     iconutil -c icns icon.iconset")
        
        # 使用默认图标继续
        print("继续使用PyInstaller默认图标构建...")
    
    # 安装必要的依赖
    print("确保PyInstaller已安装...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
    
    # 创建spec文件
    create_spec_file()
    
    # 运行PyInstaller
    print("运行PyInstaller构建应用...")
    subprocess.run(["pyinstaller", f"{APP_NAME}_macos.spec"], check=True)
    
    print(f"构建完成! 应用位于 dist/{APP_NAME}.app 目录")
    return True

if __name__ == "__main__":
    build_app()