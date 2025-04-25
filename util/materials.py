"""
作业传输系统 - 课程资料模块

本模块提供课程资料相关的API接口，实现课程资料的列表获取和下载功能。
资料存储结构：static/materials/{班级}/{课程}/{文件}
主要功能包括：
- 获取所有可用课程
- 获取课程资料列表
- 按班级和课程获取资料
- 下载和预览资料文件

作者: Frank
版本: 1.0
日期: 2025-04-25
"""

import os
import json
import logging
import mimetypes
import datetime
from flask import Blueprint, request, jsonify, send_from_directory, safe_join, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from util.models import load_users
from util.utils import format_file_size, load_course_config
from util.student import safe_filename

# 创建蓝图
materials_bp = Blueprint('materials', __name__)

# 材料存储目录
MATERIALS_DIR = 'static/materials'

# 确保目录存在
os.makedirs(MATERIALS_DIR, exist_ok=True)

@materials_bp.route('/get_courses', methods=['GET'])
@login_required
def get_courses():
    """获取所有可用课程名称"""
    try:
        # 获取用户班级
        users = load_users()
        user_data = users.get(current_user.id, {})
        class_name = user_data.get('class_name', '')
        
        if not class_name:
            return jsonify({'status': 'error', 'message': '无法确定用户班级', 'courses': []}), 400
        
        # 查找班级目录
        class_path = os.path.join(MATERIALS_DIR, class_name)
        
        # 如果班级目录不存在，尝试从课程配置中获取课程
        if not os.path.exists(class_path):
            courses = get_courses_from_config(class_name)
            return jsonify({'status': 'success', 'courses': courses})
        
        # 从目录中获取课程列表
        courses = [d for d in os.listdir(class_path) 
                  if os.path.isdir(os.path.join(class_path, d))]
        
        # 如果目录为空，尝试从课程配置中获取课程
        if not courses:
            courses = get_courses_from_config(class_name)
        
        return jsonify({'status': 'success', 'courses': courses})
    
    except Exception as e:
        logging.error(f"获取课程列表出错: {e}")
        return jsonify({'status': 'error', 'message': str(e), 'courses': []}), 500

def get_courses_from_config(class_name):
    """从课程配置中获取指定班级的课程列表"""
    try:
        config = load_course_config()
        
        # 查找指定班级
        for class_info in config.get('classes', []):
            if class_info['name'] == class_name:
                # 返回该班级的所有课程名称
                return [course['name'] for course in class_info.get('courses', [])]
        
        return []
    except Exception as e:
        logging.error(f"从配置获取课程列表出错: {e}")
        return []

@materials_bp.route('/get_course_materials', methods=['GET'])
@login_required
def get_course_materials():
    """获取课程资料列表"""
    try:
        # 获取查询参数
        course_name = request.args.get('course', '')
        
        # 获取用户班级
        users = load_users()
        user_data = users.get(current_user.id, {})
        class_name = user_data.get('class_name', '')
        
        if not class_name:
            return jsonify({'status': 'error', 'message': '无法确定用户班级', 'courses': []}), 400
        
        # 查找班级目录
        class_path = os.path.join(MATERIALS_DIR, class_name)
        
        # 如果班级目录不存在，创建一个空目录
        if not os.path.exists(class_path):
            os.makedirs(class_path, exist_ok=True)
        
        # 获取班级下所有课程
        courses = []
        course_dirs = [d for d in os.listdir(class_path) 
                      if os.path.isdir(os.path.join(class_path, d))]
        
        # 如果指定了课程名称，过滤结果
        if course_name:
            if course_name in course_dirs:
                course_dirs = [course_name]
            else:
                return jsonify({'status': 'success', 'courses': []})
        
        # 处理每个课程
        for course_dir in course_dirs:
            course_path = os.path.join(class_path, course_dir)
            
            # 获取课程资料文件
            files = []
            for file_name in os.listdir(course_path):
                file_path = os.path.join(course_path, file_name)
                if os.path.isfile(file_path):
                    # 获取文件信息
                    file_stat = os.stat(file_path)
                    files.append({
                        'file_name': file_name,
                        'file_size': file_stat.st_size,
                        'upload_date': datetime.datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                        'file_path': os.path.join(class_name, course_dir, file_name)
                    })
            
            # 获取课程介绍信息（如果存在）
            description = ""
            meta_file = os.path.join(course_path, 'meta.json')
            if os.path.exists(meta_file):
                try:
                    with open(meta_file, 'r', encoding='utf-8') as f:
                        meta_data = json.load(f)
                        description = meta_data.get('description', '')
                except Exception as e:
                    logging.error(f"读取课程元数据失败: {e}")
            
            # 创建课程对象
            course = {
                'name': course_dir,
                'description': description,
                'file_count': max(len(files) - 1, 0),  # 减去meta.json文件
                'last_updated': max([f['upload_date'] for f in files], default=None) if files else None,
                'type': '课程资料',
                'cover_image': f'/static/img/course/{course_dir}.png',  # 默认封面图
            }
            
            courses.append(course)
        
        return jsonify({'status': 'success', 'courses': courses})
    
    except Exception as e:
        logging.error(f"获取课程资料列表出错: {e}")
        return jsonify({'status': 'error', 'message': str(e), 'courses': []}), 500

@materials_bp.route('/get_course_assets_by_name_and_class', methods=['GET'])
@login_required
def get_course_assets_by_name_and_class():
    """按课程名称和班级获取资料列表"""
    try:
        # 获取查询参数
        course_name = request.args.get('course', '')
        class_name = request.args.get('class_name', '')
        
        # 如果没有提供班级名称，使用当前用户的班级
        if not class_name:
            users = load_users()
            user_data = users.get(current_user.id, {})
            class_name = user_data.get('class_name', '')
        
        if not course_name or not class_name:
            return jsonify({'status': 'error', 'message': '缺少课程名称或班级名称', 'assets': []}), 400
        
        # 构建课程目录路径
        course_path = os.path.join(MATERIALS_DIR, class_name, course_name)
        
        # 如果目录不存在，返回空列表
        if not os.path.exists(course_path):
            return jsonify({'status': 'success', 'assets': []})
        
        # 获取资料列表
        assets = []
        for file_name in os.listdir(course_path):
            file_path = os.path.join(course_path, file_name)
            if os.path.isfile(file_path) and file_name != 'meta.json':  # 排除元数据文件
                # 获取文件信息
                file_stat = os.stat(file_path)
                assets.append({
                    'id': f"{class_name}_{course_name}_{file_name}",  # 生成唯一ID
                    'file_name': file_name,
                    'file_size': file_stat.st_size,
                    'upload_date': datetime.datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                    'file_path': os.path.join(class_name, course_name, file_name),
                    'course_name': course_name,
                    'class_name': class_name
                })
        
        # 按上传日期排序，最新的在前
        assets.sort(key=lambda x: x['upload_date'], reverse=True)
        
        return jsonify({'status': 'success', 'assets': assets})
    
    except Exception as e:
        logging.error(f"获取课程资料出错: {e}")
        return jsonify({'status': 'error', 'message': str(e), 'assets': []}), 500

@materials_bp.route('/download_asset', methods=['GET'])
@login_required
def download_asset():
    """下载资料文件"""
    try:
        # 获取查询参数
        file_name = request.args.get('file_name', '')
        course_name = request.args.get('course', '')
        class_name = request.args.get('class_name', '')
        
        # 如果没有提供班级名称，使用当前用户的班级
        if not class_name:
            users = load_users()
            user_data = users.get(current_user.id, {})
            class_name = user_data.get('class_name', '')
        
        if not file_name or not course_name or not class_name:
            return jsonify({'status': 'error', 'message': '缺少必要参数'}), 400
        
        # 安全处理文件名
        file_name = safe_filename(file_name)
        
        # 构建文件路径
        file_path = os.path.join(MATERIALS_DIR, class_name, course_name, file_name)
        
        # 检查文件是否存在
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({'status': 'error', 'message': '文件不存在'}), 404
        
        # 提供文件下载
        return send_file(
            file_path,
            as_attachment=True,
            download_name=file_name
        )
    
    except Exception as e:
        logging.error(f"下载资料文件出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@materials_bp.route('/preview_asset', methods=['GET'])
@login_required
def preview_asset():
    """预览资料文件"""
    try:
        # 获取查询参数
        file_path = request.args.get('file_path', '')
        file_name = request.args.get('file_name', '')
        
        if not file_path:
            return jsonify({'status': 'error', 'message': '缺少文件路径'}), 400
        
        # 构建完整文件路径
        full_path = os.path.join(MATERIALS_DIR, file_path)
        
        # 安全检查：确保路径在材料目录下
        if not os.path.abspath(full_path).startswith(os.path.abspath(MATERIALS_DIR)):
            return jsonify({'status': 'error', 'message': '无效的文件路径'}), 403
        
        # 检查文件是否存在
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return jsonify({'status': 'error', 'message': '文件不存在'}), 404
        
        # 获取文件MIME类型
        content_type, _ = mimetypes.guess_type(full_path)
        
        # 以内联方式提供文件（预览模式）
        return send_file(
            full_path,
            as_attachment=False,
            mimetype=content_type,
            download_name=file_name if file_name else os.path.basename(full_path)
        )
    
    except Exception as e:
        logging.error(f"预览资料文件出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# 用于管理员上传课程资料的API
@materials_bp.route('/admin/upload_course_material', methods=['POST'])
@login_required
def upload_course_material():
    """管理员上传课程资料"""
    # 检查用户权限
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '需要管理员权限'}), 403
    
    try:
        # 获取表单数据
        class_name = request.form.get('class_name', '')
        course_name = request.form.get('course_name', '')
        description = request.form.get('description', '')
        
        # 检查必要参数
        if not class_name or not course_name:
            return jsonify({'status': 'error', 'message': '班级名称和课程名称不能为空'}), 400
        
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': '未上传文件'}), 400
        
        file = request.files['file']
        
        # 检查文件名
        if file.filename == '':
            return jsonify({'status': 'error', 'message': '文件名为空'}), 400
        
        # 安全处理文件名
        filename = safe_filename(file.filename)
        
        # 构建保存路径
        save_dir = os.path.join(MATERIALS_DIR, class_name, course_name)
        
        # 确保目录存在
        os.makedirs(save_dir, exist_ok=True)
        
        # 保存文件
        file_path = os.path.join(save_dir, filename)
        file.save(file_path)
        
        # 更新课程描述（如果提供）
        if description:
            meta_file = os.path.join(save_dir, 'meta.json')
            
            meta_data = {}
            if os.path.exists(meta_file):
                try:
                    with open(meta_file, 'r', encoding='utf-8') as f:
                        meta_data = json.load(f)
                except Exception as e:
                    logging.error(f"读取课程元数据失败: {e}")
            
            meta_data['description'] = description
            
            with open(meta_file, 'w', encoding='utf-8') as f:
                json.dump(meta_data, f, ensure_ascii=False, indent=2)
        
        # 获取文件信息
        file_stat = os.stat(file_path)
        
        return jsonify({
            'status': 'success',
            'message': '文件上传成功',
            'file': {
                'name': filename,
                'size': file_stat.st_size,
                'formatted_size': format_file_size(file_stat.st_size),
                'path': os.path.join(class_name, course_name, filename),
                'upload_date': datetime.datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            }
        })
    
    except Exception as e:
        logging.error(f"上传课程资料出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# 删除课程资料
@materials_bp.route('/admin/delete_course_material', methods=['DELETE'])
@login_required
def delete_course_material():
    """管理员删除课程资料"""
    # 检查用户权限
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '需要管理员权限'}), 403
    
    try:
        # 获取参数
        file_path = request.args.get('file_path', '')
        
        if not file_path:
            return jsonify({'status': 'error', 'message': '缺少文件路径'}), 400
        
        # 构建完整文件路径
        full_path = os.path.join(MATERIALS_DIR, file_path)
        
        # 安全检查：确保路径在材料目录下
        if not os.path.abspath(full_path).startswith(os.path.abspath(MATERIALS_DIR)):
            return jsonify({'status': 'error', 'message': '无效的文件路径'}), 403
        
        # 检查文件是否存在
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return jsonify({'status': 'error', 'message': '文件不存在'}), 404
        
        # 删除文件
        os.remove(full_path)
        
        return jsonify({'status': 'success', 'message': '文件已删除'})
    
    except Exception as e:
        logging.error(f"删除课程资料出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# 注册蓝图的函数，用于在app.py中集成
def init_app(app):
    """将课程资料模块集成到Flask应用"""
    app.register_blueprint(materials_bp)
    logging.info("课程资料模块已初始化")