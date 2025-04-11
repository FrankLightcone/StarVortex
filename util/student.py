"""
作业传输系统 - 学生功能模块

本模块处理学生相关的功能，主要包括：
- 文件上传与管理
- 查看个人提交记录
- 获取作业统计信息
- 删除已提交作业
- 更新个人资料
- 下载已提交文件

该模块定义了以下路由：
- /: 学生文件上传页面
- /my_submissions: 获取当前用户提交记录
- /assignment_stats: 获取作业统计信息
- /submission/<course>/<assignment>: 删除提交记录
- /update_profile: 更新用户个人资料
- /download/<course>/<assignment>/<filename>: 下载文件

作者: Frank
版本: 1.0
日期: 2025-04-04
"""

import os
import logging
import threading
import zipfile
from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from util.config import UPLOAD_FOLDER, allowed_file
from util.utils import load_course_config, compress_folder, format_file_size, load_assignments
from util.models import load_users, save_users
from util.api import get_default_settings
from util.submission_notification import process_submission_notification

import json
from datetime import datetime, date
from werkzeug.security import check_password_hash, generate_password_hash
from flask import jsonify, request, redirect, url_for, send_from_directory


student_bp = Blueprint('student', __name__)

# 学生权限检查装饰器
def student_required(f):
    """确保只有学生用户可以访问特定路由"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_admin:
            # 管理员用户重定向到管理员界面
            return redirect(url_for('admin.dashboard'))
        return f(*args, **kwargs)
    return decorated_function

# 安全处理文件名但保留中文字符
def safe_filename(filename):
    """生成安全的文件名同时保留中文字符"""
    # 替换危险字符
    filename = filename.replace('/', '_').replace('\\', '_')
    filename = filename.replace(':', '_').replace('*', '_')
    filename = filename.replace('?', '_').replace('"', '_')
    filename = filename.replace('<', '_').replace('>', '_')
    filename = filename.replace('|', '_').replace('\0', '_')
    
    # 去除前后空格
    return filename.strip()

@student_bp.route('/', methods=['GET', 'POST'])
@login_required
@student_required
def upload_file():
    """学生文件上传页面"""
    # 获取用户信息
    users = load_users()
    user_data = users.get(current_user.id, {})
    user_class_name = user_data.get('class_name', '')
    
    # 设置默认班级（如果用户没有班级）
    if not user_class_name:
        user_class_name = "默认班级"
        # 可以选择更新用户信息来添加班级
        user_data['class_name'] = user_class_name
        users[current_user.id] = user_data
        save_users(users)  # 保存更改
        logging.warning(f"用户 {current_user.id} 没有班级，已分配默认班级")
    
    # 获取班级可用的课程列表
    courses = get_courses_for_class(user_class_name)
    
    # 如果没有课程，尝试从配置中获取所有课程
    if not courses:
        config = load_course_config()
        all_courses = set()
        for class_info in config.get('classes', []):
            for course_info in class_info.get('courses', []):
                all_courses.add(course_info['name'])
        courses = list(all_courses)
        logging.warning(f"班级 {user_class_name} 没有可用课程，使用所有课程")
    
    # 用户信息字典
    user_info = {
        'user_name': current_user.id,
        'user_email': user_data.get('email', ''),
        'user_student_id': user_data.get('student_id', ''),
        'user_class_name': user_class_name
    }
    
    if request.method == 'POST':
        try:
            # 获取课程和作业名称
            course = request.form.get('course')
            assignment_name = request.form.get('assignment_name')
            
            # 获取班级名称 - 从用户数据中获取而不是表单
            class_name = user_data.get('class_name', '')
            
            # 添加日志以调试请求内容
            logging.info(f'POST请求: course={course}, class_name={class_name}, assignment={assignment_name}')
            
            # 检查课程和作业名称
            if not course or not assignment_name:
                logging.warning('缺少课程或作业名称')
                return jsonify({'status': 'error', 'message': '请选择课程和作业名称'}), 400
                
            # 检查班级
            if not class_name:
                logging.warning('用户没有分配班级')
                return jsonify({'status': 'error', 'message': '您的账号未分配班级，请联系管理员'}), 400

            # 检查是否有文件
            if 'file' not in request.files:
                logging.warning('No file part in the request')
                return jsonify({'status': 'error', 'message': '没有选择文件'}), 400
            
            file = request.files['file']
            
            # 检查文件名
            if file.filename == '':
                logging.warning('No selected file')
                return jsonify({'status': 'error', 'message': '没有选择文件'}), 400
            
            # 获取作业设置
            assignments = load_assignments()
            assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment_name), None)
            
            # 使用默认或自定义设置
            settings = assignment_obj.get('advancedSettings', get_default_settings()) if assignment_obj else get_default_settings()
            
            # 检查文件扩展名是否在允许列表中
            file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
            
            if settings.get('allowedTypes') and file_extension not in settings.get('allowedTypes', []):
                allowed_types = ', '.join(settings.get('allowedTypes', []))
                logging.warning(f'不支持的文件类型: {file_extension}, 允许的类型: {allowed_types}')
                return jsonify({'status': 'error', 'message': f'不支持的文件类型，允许的类型: {allowed_types}'}), 400
            
            # 检查文件大小
            max_size = settings.get('maxFileSize', 256)
            unit = settings.get('fileSizeUnit', 'MB')
            max_size_bytes = max_size * (1024 * 1024 * 1024 if unit == 'GB' else 1024 * 1024)
            
            # 获取文件大小（不读取整个文件）
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)  # 重置文件指针
            
            if file_size > max_size_bytes:
                size_limit = f"{max_size} {unit}"
                logging.warning(f'文件超过大小限制: {file_size} > {max_size_bytes} ({size_limit})')
                return jsonify({'status': 'error', 'message': f'文件超过大小限制 ({size_limit})'}), 400
            
            # 检查每日上传限额
            student_id = users[current_user.id].get('student_id', '')
            
            if settings.get('dailyQuota'):
                daily_quota_bytes = settings.get('dailyQuota', 1) * 1024 * 1024 * 1024  # GB to bytes
                
                # 获取今日上传总量
                today = date.today()
                today_uploads = get_today_upload_size(student_id, today)
                
                # 检查是否超过限额
                if today_uploads + file_size > daily_quota_bytes:
                    logging.warning(f'超过每日上传限额: {today_uploads + file_size} > {daily_quota_bytes}')
                    return jsonify({'status': 'error', 'message': f'超过每日上传限额 ({settings.get("dailyQuota", 1)} GB)'}), 400
            
            # 检查文件数量限制
            if settings.get('maxFileCount'):
                # 创建课程和作业文件夹结构
                course_folder = os.path.join(UPLOAD_FOLDER, course)
                assignment_folder = os.path.join(course_folder, assignment_name)
                
                # 确保文件夹存在
                os.makedirs(assignment_folder, exist_ok=True)
                
                # 创建以学生信息命名的子文件夹
                student_folder_name = f"{student_id}_{current_user.id}"
                student_folder = os.path.join(assignment_folder, student_folder_name)
                
                # 检查文件数量
                if os.path.exists(student_folder):
                    existing_files = [f for f in os.listdir(student_folder) if os.path.isfile(os.path.join(student_folder, f))]
                    if len(existing_files) >= settings.get('maxFileCount', 10):
                        logging.warning(f'文件数量超过限制: {len(existing_files)} >= {settings.get("maxFileCount", 10)}')
                        return jsonify({'status': 'error', 'message': f'已达到最大文件数量限制 ({settings.get("maxFileCount", 10)} 个文件)'}), 400
            
            is_success, file_path = upload_file_with_class(file, course, user_info['user_class_name'], assignment_name, student_id, current_user.id)
            
            if not is_success:
                logging.warning(f'文件上传失败: {file_path}')
                return jsonify({'status': 'error', 'message': f'文件上传失败: {file_path}'}), 500
            
            # 记录今日上传量
            update_daily_upload_record(student_id, file_size)

            try:
                import time

                def delayed_notification(user_id, course, assignment_name, student_folder):
                    time.sleep(30)  # 等待30秒，确保文件上传完成
                    process_submission_notification(user_id, course, assignment_name, student_folder)

                # 从外部取出变量作为参数传入线程
                user_id = current_user.id
                notification_thread = threading.Thread(
                    target=delayed_notification,
                    args=(user_id, course, assignment_name, student_folder)
                )
                notification_thread.daemon = True
                notification_thread.start()
                logging.info(f'Started delayed notification thread for {user_id}')
            except Exception as e:
                logging.error(f'Failed to start notification thread: {str(e)}')

            
            return jsonify({
                'status': 'success', 
                'message': '文件上传成功', 
                'filename': os.path.basename(file_path)
            }), 200
        
        except Exception as e:
            # 详细的错误日志
            import traceback
            error_traceback = traceback.format_exc()
            logging.error(f'Upload error: {str(e)}')
            logging.error(f'Error traceback: {error_traceback}')
            return jsonify({
                'status': 'error', 
                'message': f'文件上传失败: {str(e)}'
            }), 500
    
    # GET请求返回页面
    return render_template('upload.html', courses=courses, **user_info)

# 添加用于跟踪每日上传量的函数
def get_today_upload_size(student_id, date):
    """获取学生当天的上传总量"""
    upload_record_file = 'daily_uploads.json'
    date_str = date.strftime('%Y-%m-%d')
    
    try:
        # 加载记录
        if os.path.exists(upload_record_file):
            with open(upload_record_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        else:
            records = {}
        
        # 获取学生记录
        student_records = records.get(student_id, {})
        return student_records.get(date_str, 0)
    except Exception as e:
        logging.error(f'Error getting upload record: {str(e)}')
        return 0

def update_daily_upload_record(student_id, file_size):
    """更新学生当天的上传记录"""
    upload_record_file = 'daily_uploads.json'
    date_str = date.today().strftime('%Y-%m-%d')
    
    try:
        # 加载记录
        if os.path.exists(upload_record_file):
            with open(upload_record_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        else:
            records = {}
        
        # 更新学生记录
        if student_id not in records:
            records[student_id] = {}
        
        if date_str not in records[student_id]:
            records[student_id][date_str] = 0
        
        records[student_id][date_str] += file_size
        
        # 保存记录
        with open(upload_record_file, 'w', encoding='utf-8') as f:
            json.dump(records, f)
    except Exception as e:
        logging.error(f'Error updating upload record: {str(e)}')

@student_bp.route('/my_submissions', methods=['GET'])
@login_required
@student_required
def get_my_submissions():
    """获取当前用户的所有提交记录"""
    course_filter = request.args.get('course', '')
    
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    
    submissions = []
    
    # 遍历上传目录查找该用户的提交
    for course_name in os.listdir(UPLOAD_FOLDER):
        # 如果有课程筛选，则只查找该课程
        if course_filter and course_filter != course_name:
            continue
            
        course_path = os.path.join(UPLOAD_FOLDER, course_name)
        if not os.path.isdir(course_path):
            continue
            
        for assignment_name in os.listdir(course_path):
            assignment_path = os.path.join(course_path, assignment_name)
            if not os.path.isdir(assignment_path):
                continue
                
            # 查找与当前用户匹配的文件夹
            student_folder_pattern = f"{student_id}_{current_user.id}"
            student_folders = [f for f in os.listdir(assignment_path) 
                             if os.path.isdir(os.path.join(assignment_path, f)) 
                             and f.startswith(student_folder_pattern)]
            
            if not student_folders:
                continue
                
            student_folder = student_folders[0]
            student_folder_path = os.path.join(assignment_path, student_folder)
            
            # 获取该文件夹中的文件
            files = []
            latest_time = None
            
            for file in os.listdir(student_folder_path):
                file_path = os.path.join(student_folder_path, file)
                if os.path.isfile(file_path):
                    file_size = os.path.getsize(file_path)
                    file_time = os.path.getmtime(file_path)
                    file_datetime = datetime.fromtimestamp(file_time)
                    
                    if latest_time is None or file_time > latest_time:
                        latest_time = file_time
                    
                    files.append({
                        'name': file,
                        'size': format_file_size(file_size),
                        'uploadTime': file_datetime.isoformat(),
                        'path': f"/files/{course_name}/{assignment_name}/{student_folder}/{file}"
                    })
            
            if not files:
                continue
                
            # 获取作业详情
            from util.utils import load_assignments
            assignments = load_assignments()
            assignment_obj = next((a for a in assignments if a['course'] == course_name and a['name'] == assignment_name), None)
            
            due_date = None
            if assignment_obj:
                due_date = assignment_obj['dueDate']
            
            submission_time = datetime.fromtimestamp(latest_time) if latest_time else datetime.now()
            
            # 判断是否逾期提交
            submission_status = "已提交"
            if due_date and submission_time > datetime.fromisoformat(due_date):
                submission_status = "逾期提交"
            
            submissions.append({
                'course': course_name,
                'assignmentName': assignment_name,
                'submissionTime': submission_time.isoformat(),
                'status': submission_status,
                'fileCount': len(files),
                'files': files,
                'dueDate': due_date
            })
    
    # 按提交时间排序
    submissions.sort(key=lambda x: x['submissionTime'], reverse=True)
    
    return jsonify({'submissions': submissions})

@student_bp.route('/assignment_stats', methods=['GET'])
@login_required
@student_required
def get_assignment_stats():
    """获取作业的统计信息"""
    course = request.args.get('course')
    assignment_name = request.args.get('assignment')
    
    if not course or not assignment_name:
        return jsonify({'status': 'error', 'message': '缺少课程或作业名称参数'}), 400
    
    # 获取用户班级
    users = load_users()
    user_data = users[current_user.id]
    student_id = user_data['student_id']
    class_name = user_data.get('class_name', '')
    
    if not class_name:
        return jsonify({'status': 'error', 'message': '您的账号未关联班级，请联系管理员'}), 400
    
    # 获取作业详情
    from util.utils import load_assignments
    assignments = load_assignments()
    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment_name), None)
    
    if not assignment_obj:
        return jsonify({'status': 'error', 'message': '作业不存在'}), 404
    
    # 格式化截止日期
    due_date = datetime.fromisoformat(assignment_obj['dueDate'])
    due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
    
    # 创建作业目录路径 - 包含班级层级
    assignment_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment_name)
    
    # 获取同班级学生数量
    class_students = [username for username, user in users.items() 
                     if not user.get('is_admin', False) and user.get('class_name') == class_name]
    student_count = len(class_students)
    
    # 检查作业目录是否存在
    submission_count = 0
    has_submitted = False
    
    if os.path.exists(assignment_path):
        # 获取学生文件夹
        student_folders = [f for f in os.listdir(assignment_path) 
                         if os.path.isdir(os.path.join(assignment_path, f)) 
                         and not f.endswith('.zip')]
        
        submission_count = len(student_folders)
        
        # 检查当前用户是否已提交
        student_folder_pattern = f"{student_id}_{current_user.id}"
        has_submitted = any(f.startswith(student_folder_pattern) for f in student_folders)
    
    # 计算提交率
    submission_rate = f"{(submission_count / student_count * 100):.1f}%" if student_count > 0 else "0%"
    
    # 检查作业状态
    now = datetime.now()
    is_expired = due_date < now
    status = "已截止" if is_expired else "进行中"
    
    stats = {
        'dueDate': due_date_str,
        'submissionCount': f"{submission_count}/{student_count} ({submission_rate})",
        'status': status,
        'hasSubmitted': has_submitted,
        'mySubmission': "已提交" if has_submitted else "未提交"
    }
    
    return jsonify({'stats': stats})

@student_bp.route('/submission/<course>/<assignment>', methods=['DELETE'])
@login_required
@student_required
def delete_submission(course, assignment):
    """删除提交的作业"""
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    
    # 构建作业文件夹路径
    assignment_path = os.path.join(UPLOAD_FOLDER, course, assignment)
    
    # 查找该用户的文件夹
    student_folder_pattern = f"{student_id}_{current_user.id}"
    student_folders = [f for f in os.listdir(assignment_path) 
                     if os.path.isdir(os.path.join(assignment_path, f)) 
                     and f.startswith(student_folder_pattern)]
    
    if not student_folders:
        return jsonify({'status': 'error', 'message': '提交记录不存在'}), 404
    
    student_folder = student_folders[0]
    student_folder_path = os.path.join(assignment_path, student_folder)
    
    try:
        # 删除文件夹
        import shutil
        shutil.rmtree(student_folder_path)
        
        # 删除zip文件（如果存在）
        zip_file = os.path.join(assignment_path, f"{student_folder}.zip")
        if os.path.exists(zip_file):
            os.remove(zip_file)
        
        return jsonify({'status': 'success', 'message': '提交已删除'})
    except Exception as e:
        logging.error(f'Error deleting submission: {str(e)}')
        return jsonify({'status': 'error', 'message': f'删除失败: {str(e)}'}), 500
    
@student_bp.route('/update_profile', methods=['POST'])
@login_required
@student_required
def update_profile():
    """更新用户个人资料"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        current_password = data.get('currentPassword', '')
        new_password = data.get('newPassword', '')
        
        if not name:
            return jsonify({'status': 'error', 'message': '姓名不能为空'}), 400
        
        # 获取当前用户信息
        users = load_users()
        user_data = users.get(current_user.id)
        
        if not user_data:
            return jsonify({'status': 'error', 'message': '用户不存在'}), 404
        
        changes_made = False
        
        # 检查是否需要更新姓名
        if name != current_user.id:
            # 检查新姓名是否已存在
            if name in users and name != current_user.id:
                return jsonify({'status': 'error', 'message': '该姓名已被使用'}), 400
            
            # 创建新的用户记录
            users[name] = user_data.copy()
            
            # 删除旧的用户记录
            del users[current_user.id]
            
            changes_made = True
        
        # 检查是否需要更新密码
        if current_password and new_password:
            # 验证当前密码
            if not check_password_hash(user_data['password'], current_password):
                return jsonify({'status': 'error', 'message': '当前密码不正确'}), 400
            
            # 更新密码
            users[name]['password'] = generate_password_hash(new_password)
            changes_made = True
        
        if changes_made:
            # 保存更改
            save_users(users)
            
            # 如果更新了姓名，需要重新登录
            if name != current_user.id:
                return jsonify({
                    'status': 'success', 
                    'message': '个人资料已更新，需要重新登录',
                    'requireRelogin': True
                })
            else:
                return jsonify({
                    'status': 'success', 
                    'message': '个人资料已更新',
                    'requireRelogin': False
                })
        else:
            return jsonify({'status': 'success', 'message': '没有更改'})
            
    except Exception as e:
        logging.error(f'Error updating profile: {str(e)}')
        return jsonify({'status': 'error', 'message': f'更新失败: {str(e)}'}), 500
    
@student_bp.route('/download/<course>/<assignment>/<filename>')
@login_required
@student_required
def download_file(course, assignment, filename):
    """下载自己提交的文件"""
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    
    # 构建文件夹路径
    student_folder_pattern = f"{student_id}_{current_user.id}"
    assignment_path = os.path.join(UPLOAD_FOLDER, course, assignment)
    
    # 查找该用户的文件夹
    student_folders = [f for f in os.listdir(assignment_path) 
                     if os.path.isdir(os.path.join(assignment_path, f)) 
                     and f.startswith(student_folder_pattern)]
    
    if not student_folders:
        return "文件不存在", 404
    
    student_folder = student_folders[0]
    file_path = os.path.join(assignment_path, student_folder, filename)
    
    if not os.path.exists(file_path):
        return "文件不存在", 404
    
    # 提供文件下载
    return send_from_directory(os.path.join(assignment_path, student_folder), filename, as_attachment=True)

@student_bp.route('/download_all/<course>/<assignment>')
@login_required
@student_required
def download_all_files(course, assignment):
    """下载该学生提交的所有文件"""
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    
    # 构建作业文件夹路径
    student_folder_pattern = f"{student_id}_{current_user.id}"
    assignment_path = os.path.join(UPLOAD_FOLDER, course, assignment)
    
    # 查找该用户的文件夹
    student_folders = [f for f in os.listdir(assignment_path) 
                     if os.path.isdir(os.path.join(assignment_path, f)) 
                     and f.startswith(student_folder_pattern)]
    
    if not student_folders:
        return "提交记录不存在", 404
    
    student_folder = student_folders[0]
    student_folder_path = os.path.join(assignment_path, student_folder)
    
    # 创建临时目录用于准备下载
    temp_dir = os.path.join(UPLOAD_FOLDER, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    # 创建zip文件名
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    zip_filename = f"{course}_{assignment}_{student_id}_{timestamp}.zip"
    zip_path = os.path.join(temp_dir, zip_filename)
    
    # 创建zip文件
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(student_folder_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, student_folder_path)
                    zipf.write(file_path, arcname=arcname)
        
        # 提供zip文件下载
        return send_from_directory(temp_dir, zip_filename, as_attachment=True)
    except Exception as e:
        logging.error(f'Error creating zip file: {str(e)}')
        return f"创建压缩文件失败: {str(e)}", 500

def upload_file_with_class(file, course, class_name, assignment_name, student_id, username):
    """
    上传文件到指定路径，包含班级层级
    
    Args:
        file: 上传的文件对象
        course: 课程名称
        class_name: 班级名称
        assignment_name: 作业名称
        student_id: 学生ID
        username: 用户名
    
    Returns:
        (bool, str): (是否成功, 消息或文件路径)
    """
    try:
        # 安全处理原始文件名
        original_filename = safe_filename(file.filename)
        
        # 创建课程、班级、作业文件夹结构
        course_folder = os.path.join(UPLOAD_FOLDER, course)
        class_folder = os.path.join(course_folder, class_name)
        assignment_folder = os.path.join(class_folder, assignment_name)
        
        # 确保文件夹存在
        os.makedirs(assignment_folder, exist_ok=True)
        
        # 创建以学生信息命名的子文件夹
        student_folder_name = f"{student_id}_{username}"
        student_folder = os.path.join(assignment_folder, student_folder_name)
        os.makedirs(student_folder, exist_ok=True)
        
        # 生成文件路径
        file_path = os.path.join(student_folder, original_filename)
        
        # 处理文件重名
        counter = 1
        base, ext = os.path.splitext(original_filename)
        while os.path.exists(file_path):
            new_filename = f"{base}_{counter}{ext}"
            file_path = os.path.join(student_folder, new_filename)
            counter += 1
        
        # 保存文件
        file.save(file_path)
        
        # 创建ZIP文件
        zip_filename = f"{student_folder_name}.zip"
        zip_filepath = os.path.join(assignment_folder, zip_filename)
        
        # 启动线程压缩文件夹
        t = threading.Thread(
            target=compress_folder,
            args=(student_folder, zip_filepath)
        )
        t.daemon = True
        t.start()
        
        return True, file_path
    except Exception as e:
        return False, str(e)
    
def get_courses_for_class(class_name):
    """获取班级可用的课程列表"""
    config = load_course_config()
    
    # 查找班级的课程
    for class_info in config.get('classes', []):
        if class_info['name'] == class_name:
            return [course['name'] for course in class_info.get('courses', [])]
    
    return []