#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
更新版本信息脚本

该脚本用于更新版本信息文件(version_info.json)，以便发布新版本时使用。
主要功能：
- 自动计算更新包的MD5值
- 更新版本信息文件
- 支持指定版本、最低版本和发布说明
- 支持多平台更新包

使用方法：
python update_version.py --version 1.3.7 --notes "修复了一些bug，添加了自动更新功能" --min-version 1.3.0

参数说明：
--version: 新版本号
--notes: 发布说明
--min-version: 最低支持的版本(如果不指定，使用当前版本)
--windows-file: Windows平台更新包文件名(默认为"hw_desktop-setup-{version}.exe")
--macos-file: macOS平台更新包文件名(默认为"hw_desktop-{version}.dmg") 
--linux-file: Linux平台更新包文件名(默认为"hw_desktop-{version}.AppImage")
--updates-dir: 更新包目录(默认为"static/updates")
--force: 强制覆盖更新包文件

作者: Frank
版本: 1.0
日期: 2025-04-08
"""

import os
import sys
import json
import argparse
import hashlib
import shutil
from datetime import datetime

def calculate_md5(file_path):
    """计算文件的MD5值"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='更新版本信息文件')
    parser.add_argument('--version', required=True, help='新版本号，例如: 1.3.7')
    parser.add_argument('--notes', default='', help='发布说明')
    parser.add_argument('--min-version', help='最低支持的版本，低于此版本需要强制更新')
    parser.add_argument('--windows-file', help='Windows平台更新包文件名')
    parser.add_argument('--macos-file', help='macOS平台更新包文件名')
    parser.add_argument('--linux-file', help='Linux平台更新包文件名')
    parser.add_argument('--updates-dir', default='static/updates', help='更新包目录')
    parser.add_argument('--force', action='store_true', help='强制覆盖更新包文件')
    
    return parser.parse_args()

def load_version_info(updates_dir):
    """加载版本信息文件"""
    version_file = os.path.join(updates_dir, 'version_info.json')
    
    if not os.path.exists(version_file):
        # 创建默认版本信息文件
        default_version = {
            "windows": {
                "version": "1.3.6",
                "filename": "hw_desktop-setup-1.3.6.exe",
                "md5": "",
                "releaseNotes": "初始版本",
                "releaseDate": datetime.now().strftime('%Y-%m-%d'),
                "minVersion": "1.0.0"
            },
            "macos": {
                "version": "1.3.6",
                "filename": "hw_desktop-1.3.6.dmg",
                "md5": "",
                "releaseNotes": "初始版本",
                "releaseDate": datetime.now().strftime('%Y-%m-%d'),
                "minVersion": "1.0.0"
            },
            "linux": {
                "version": "1.3.6",
                "filename": "hw_desktop-1.3.6.AppImage",
                "md5": "",
                "releaseNotes": "初始版本",
                "releaseDate": datetime.now().strftime('%Y-%m-%d'),
                "minVersion": "1.0.0"
            }
        }
        
        # 确保目录存在
        os.makedirs(updates_dir, exist_ok=True)
        
        # 保存默认版本信息
        with open(version_file, 'w', encoding='utf-8') as f:
            json.dump(default_version, f, ensure_ascii=False, indent=2)
        
        return default_version
    
    # 加载现有版本信息
    with open(version_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def update_version_info(
    version_info,
    version,
    release_notes,
    min_version,
    windows_file,
    macos_file,
    linux_file,
    updates_dir,
    force
):
    """更新版本信息"""
    # 当前日期
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 如果没有指定最低版本，使用当前版本
    if not min_version:
        min_version = version
    
    # 更新Windows平台信息
    if not windows_file:
        windows_file = f"hw_desktop-setup-{version}.exe"
    
    windows_path = os.path.join(updates_dir, windows_file)
    if os.path.exists(windows_path):
        windows_md5 = calculate_md5(windows_path)
        version_info["windows"] = {
            "version": version,
            "filename": windows_file,
            "md5": windows_md5,
            "releaseNotes": release_notes,
            "releaseDate": today,
            "minVersion": min_version
        }
        print(f"✅ 已更新Windows平台版本信息，MD5: {windows_md5}")
    else:
        print(f"⚠️ 找不到Windows平台更新包文件: {windows_path}")
    
    # 更新macOS平台信息
    if not macos_file:
        macos_file = f"hw_desktop-{version}.dmg"
    
    macos_path = os.path.join(updates_dir, macos_file)
    if os.path.exists(macos_path):
        macos_md5 = calculate_md5(macos_path)
        version_info["macos"] = {
            "version": version,
            "filename": macos_file,
            "md5": macos_md5,
            "releaseNotes": release_notes,
            "releaseDate": today,
            "minVersion": min_version
        }
        print(f"✅ 已更新macOS平台版本信息，MD5: {macos_md5}")
    else:
        print(f"⚠️ 找不到macOS平台更新包文件: {macos_path}")
    
    # 更新Linux平台信息
    if not linux_file:
        linux_file = f"hw_desktop-{version}.AppImage"
    
    linux_path = os.path.join(updates_dir, linux_file)
    if os.path.exists(linux_path):
        linux_md5 = calculate_md5(linux_path)
        version_info["linux"] = {
            "version": version,
            "filename": linux_file,
            "md5": linux_md5,
            "releaseNotes": release_notes,
            "releaseDate": today,
            "minVersion": min_version
        }
        print(f"✅ 已更新Linux平台版本信息，MD5: {linux_md5}")
    else:
        print(f"⚠️ 找不到Linux平台更新包文件: {linux_path}")
    
    return version_info

def save_version_info(version_info, updates_dir):
    """保存版本信息文件"""
    version_file = os.path.join(updates_dir, 'version_info.json')
    
    # 备份原文件
    if os.path.exists(version_file):
        backup_file = f"{version_file}.bak"
        shutil.copy2(version_file, backup_file)
        print(f"📦 已备份原版本信息文件到: {backup_file}")
    
    # 保存新版本信息
    with open(version_file, 'w', encoding='utf-8') as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 已保存版本信息文件到: {version_file}")

def main():
    """主函数"""
    args = parse_arguments()
    
    # 加载版本信息
    version_info = load_version_info(args.updates_dir)
    
    # 更新版本信息
    version_info = update_version_info(
        version_info,
        args.version,
        args.notes,
        args.min_version,
        args.windows_file,
        args.macos_file,
        args.linux_file,
        args.updates_dir,
        args.force
    )
    
    # 保存版本信息
    save_version_info(version_info, args.updates_dir)
    
    print("\n🚀 版本信息更新完成!")
    print(f"📝 版本号: {args.version}")
    if args.min_version:
        print(f"🔒 最低支持版本: {args.min_version}")
    if args.notes:
        print(f"📋 发布说明: {args.notes}")

if __name__ == "__main__":
    main()