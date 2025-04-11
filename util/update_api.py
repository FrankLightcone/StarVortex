"""
作业提交系统 - 应用更新API模块

本模块提供桌面客户端自动更新所需的API接口，包括：
- 版本检查API：提供最新版本信息
- 更新包下载：提供最新版本的安装包下载

作者: Frank
版本: 1.0
日期: 2025-04-08
"""

import os
import json
import hashlib
from flask import Blueprint, jsonify, send_from_directory, current_app, request
import datetime

update_api_bp = Blueprint('update_api', __name__)

# 更新包存储目录
UPDATES_DIR = 'static/updates'

# 确保更新目录存在
def ensure_updates_dir():
    os.makedirs(UPDATES_DIR, exist_ok=True)
    
    # 如果版本信息文件不存在，创建默认版本文件
    version_file = os.path.join(UPDATES_DIR, 'version_info.json')
    if not os.path.exists(version_file):
        default_version = {
            "windows": {
                "version": "1.3.6",
                "filename": "hw_desktop-setup-1.3.6.exe",
                "md5": "",  # 初始为空，需手动计算或由构建脚本填充
                "releaseNotes": "初始版本",
                "releaseDate": "2025-04-08",
                "minVersion": "1.0.0"  # 最低支持的版本
            },
            "macos": {
                "version": "1.3.6",
                "filename": "hw_desktop-1.3.6.dmg",
                "md5": "",
                "releaseNotes": "初始版本",
                "releaseDate": "2025-04-08",
                "minVersion": "1.0.0"
            },
            "linux": {
                "version": "1.3.6",
                "filename": "hw_desktop-1.3.6.AppImage",
                "md5": "",
                "releaseNotes": "初始版本",
                "releaseDate": "2025-04-08",
                "minVersion": "1.0.0"
            }
        }
        
        with open(version_file, 'w', encoding='utf-8') as f:
            json.dump(default_version, f, ensure_ascii=False, indent=2)

# 获取版本信息
def get_version_info():
    version_file = os.path.join(UPDATES_DIR, 'version_info.json')
    
    if os.path.exists(version_file):
        with open(version_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

# 计算文件MD5
def calculate_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

# 初始化更新路由时调用
@update_api_bp.before_app_request
def initialize_updates():
    ensure_updates_dir()
    
    # 检查更新文件的MD5是否已计算
    version_info = get_version_info()
    updated = False
    
    for platform in version_info:
        filename = version_info[platform].get('filename')
        if filename and not version_info[platform].get('md5'):
            file_path = os.path.join(UPDATES_DIR, filename)
            if os.path.exists(file_path):
                version_info[platform]['md5'] = calculate_md5(file_path)
                updated = True
    
    # 如果有更新，保存版本信息
    if updated:
        version_file = os.path.join(UPDATES_DIR, 'version_info.json')
        with open(version_file, 'w', encoding='utf-8') as f:
            json.dump(version_info, f, ensure_ascii=False, indent=2)

@update_api_bp.route('/check_update', methods=['GET'])
def check_update():
    """检查是否有新版本可用"""
    platform = request.args.get('platform', 'windows')
    current_version = request.args.get('version', '1.0.0')
    
    # 获取版本信息
    version_info = get_version_info()
    
    if platform not in version_info:
        return jsonify({
            'status': 'error',
            'message': f'不支持的平台: {platform}'
        }), 400
    
    platform_info = version_info[platform]
    latest_version = platform_info.get('version', '1.0.0')
    
    # 比较版本号
    from packaging import version
    has_update = version.parse(latest_version) > version.parse(current_version)
    
    # 检查是否低于最低支持版本
    min_version = platform_info.get('minVersion', '1.0.0')
    force_update = version.parse(current_version) < version.parse(min_version)
    
    return jsonify({
        'status': 'success',
        'hasUpdate': has_update or force_update,
        'forceUpdate': force_update,
        'latestVersion': latest_version,
        'releaseNotes': platform_info.get('releaseNotes', ''),
        'releaseDate': platform_info.get('releaseDate', ''),
        'filename': platform_info.get('filename', ''),
        'md5': platform_info.get('md5', '')
    })

@update_api_bp.route('/download/<filename>', methods=['GET'])
def download_update(filename):
    """下载更新包"""
    return send_from_directory(UPDATES_DIR, filename, as_attachment=True)

# 上传新版本API (需要管理员验证，这里简化处理)
@update_api_bp.route('/upload_version', methods=['POST'])
def upload_version():
    """上传新版本信息和文件 (仅限管理员)"""
    # 这里应该添加管理员验证
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': '没有文件被上传'}), 400
    
    file = request.files['file']
    platform = request.form.get('platform', 'windows')
    version = request.form.get('version', '')
    release_notes = request.form.get('releaseNotes', '')
    min_version = request.form.get('minVersion', '')
    
    if not file.filename or not version:
        return jsonify({'status': 'error', 'message': '缺少必要参数'}), 400
    
    # 保存文件
    filename = file.filename
    file_path = os.path.join(UPDATES_DIR, filename)
    file.save(file_path)
    
    # 计算MD5
    md5 = calculate_md5(file_path)
    
    # 更新版本信息
    version_info = get_version_info()
    
    if platform not in version_info:
        version_info[platform] = {}
    
    version_info[platform].update({
        'version': version,
        'filename': filename,
        'md5': md5,
        'releaseNotes': release_notes,
        'releaseDate': datetime.datetime.now().strftime('%Y-%m-%d'),
        'minVersion': min_version if min_version else version_info[platform].get('minVersion', '1.0.0')
    })
    
    # 保存版本信息
    version_file = os.path.join(UPDATES_DIR, 'version_info.json')
    with open(version_file, 'w', encoding='utf-8') as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)
    
    return jsonify({
        'status': 'success',
        'message': '新版本已上传',
        'version': version,
        'filename': filename,
        'md5': md5
    })