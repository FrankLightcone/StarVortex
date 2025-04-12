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
            logging.info(f'表单数据: {dict(request.form)}')
            logging.info(f'文件: {list(request.files.keys())}')
            
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
            
            # 检查文件数量限制 - 检查两种可能的路径结构
            if settings.get('maxFileCount'):
                # 尝试两种文件夹结构
                # 1. 新结构: /班级/课程/作业/
                folder_paths = [
                    os.path.join(UPLOAD_FOLDER, class_name, course, assignment_name),  # 新结构
                    os.path.join(UPLOAD_FOLDER, course, class_name, assignment_name),  # 旧结构
                    os.path.join(UPLOAD_FOLDER, course, assignment_name)               # 最旧结构
                ]
                
                student_folder_name = f"{student_id}_{current_user.id}"
                student_folder = None
                
                # 查找已存在的学生文件夹
                for path in folder_paths:
                    if os.path.exists(path):
                        potential_folders = [f for f in os.listdir(path) 
                                           if os.path.isdir(os.path.join(path, f)) 
                                           and f.startswith(student_folder_name)]
                        if potential_folders:
                            student_folder = os.path.join(path, potential_folders[0])
                            break
                
                # 检查文件数量
                if student_folder and os.path.exists(student_folder):
                    existing_files = [f for f in os.listdir(student_folder) if os.path.isfile(os.path.join(student_folder, f))]
                    if len(existing_files) >= settings.get('maxFileCount', 10):
                        logging.warning(f'文件数量超过限制: {len(existing_files)} >= {settings.get("maxFileCount", 10)}')
                        return jsonify({'status': 'error', 'message': f'已达到最大文件数量限制 ({settings.get("maxFileCount", 10)} 个文件)'}), 400
            
            # 强制使用新结构
            is_success, file_path = upload_file_new_structure(file, course, user_info['user_class_name'], assignment_name, student_id, current_user.id)
            
            if not is_success:
                logging.warning(f'文件上传失败: {file_path}')
                return jsonify({'status': 'error', 'message': f'文件上传失败: {file_path}'}), 500
            
            # 记录今日上传量
            update_daily_upload_record(student_id, file_size)

            try:
                import time

                def delayed_notification(user_id, course, assignment_name, student_folder):
                    time.sleep(5)  # 等待5秒，确保文件上传完成
                    process_submission_notification(user_id, course, assignment_name, student_folder)

                # 使用新的文件结构路径
                student_folder = os.path.join(UPLOAD_FOLDER, class_name, course, assignment_name, f"{student_id}_{current_user.id}")
                
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
    """获取当前用户的所有提交记录 - 适应混合文件结构"""
    course_filter = request.args.get('course', '')
    
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    class_name = users[current_user.id].get('class_name', '')
    
    # 如果没有班级，设置默认班级
    if not class_name:
        class_name = "默认班级"
        logging.warning(f"用户 {current_user.id} 没有班级，使用默认班级")
    
    submissions = []
    
    # 添加调试日志
    logging.info(f"正在查找用户 {current_user.id} (学号: {student_id}, 班级: {class_name}) 的提交记录")
    logging.info(f"上传目录路径: {UPLOAD_FOLDER}")
    
    # 定义所有可能的路径结构模式
    path_patterns = [
        # 模式1: 新结构 - /upload/班级/课程/作业/
        lambda course, class_name: 
            os.path.join(UPLOAD_FOLDER, class_name, course),
        
        # 模式2: 旧结构 - /upload/课程/班级/作业/
        lambda course, class_name: 
            os.path.join(UPLOAD_FOLDER, course, class_name),
        
        # 模式3: 最旧结构 - /upload/课程/作业/
        lambda course, class_name: 
            os.path.join(UPLOAD_FOLDER, course)
    ]
    
    # 遍历所有可能的课程（从课程配置或上传目录中获取）
    courses_to_check = []
    
    # 如果有指定课程筛选，则只检查该课程
    if course_filter:
        courses_to_check.append(course_filter)
    else:
        # 从上传目录中查找所有可能的课程
        try:
            # 首先检查新结构 - /upload/班级/*/
            class_dir = os.path.join(UPLOAD_FOLDER, class_name)
            if os.path.exists(class_dir) and os.path.isdir(class_dir):
                for item in os.listdir(class_dir):
                    if os.path.isdir(os.path.join(class_dir, item)):
                        courses_to_check.append(item)
            
            # 然后检查旧结构和直接课程目录
            for item in os.listdir(UPLOAD_FOLDER):
                if os.path.isdir(os.path.join(UPLOAD_FOLDER, item)) and item != class_name:
                    courses_to_check.append(item)
        except Exception as e:
            logging.error(f"查找课程目录时出错: {e}")
    
    # 确保课程列表无重复
    courses_to_check = list(set(courses_to_check))
    logging.info(f"将检查以下课程: {courses_to_check}")
    
    # 遍历所有课程
    for course in courses_to_check:
        # 检查所有可能的路径模式
        for get_path in path_patterns:
            course_path = get_path(course, class_name)
            logging.debug(f"检查路径: {course_path}")
            
            if not os.path.exists(course_path) or not os.path.isdir(course_path):
                continue
            
            # 模式1和2: 路径已经包含课程层级，直接查找作业
            for assignment_name in os.listdir(course_path):
                assignment_path = os.path.join(course_path, assignment_name)
                if not os.path.isdir(assignment_path):
                    continue
                
                # 查找与当前用户匹配的文件夹
                student_folder_pattern = f"{student_id}_{current_user.id}"
                student_folders = [f for f in os.listdir(assignment_path) 
                                if os.path.isdir(os.path.join(assignment_path, f)) 
                                and f.startswith(student_folder_pattern)]
                
                if student_folders:
                    student_folder = student_folders[0]
                    student_folder_path = os.path.join(assignment_path, student_folder)
                    
                    logging.info(f"找到提交: 课程={course}, 作业={assignment_name}, 路径={student_folder_path}")
                    
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
                                'path': f"/download/{course}/{assignment_name}/{file}"
                            })
                    
                    if not files:
                        continue
                    
                    # 获取作业详情
                    from util.utils import load_assignments
                    assignments = load_assignments()
                    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment_name), None)
                    
                    due_date = None
                    if assignment_obj:
                        due_date = assignment_obj['dueDate']
                    
                    submission_time = datetime.fromtimestamp(latest_time) if latest_time else datetime.now()
                    
                    # 判断是否逾期提交
                    submission_status = "已提交"
                    if due_date and submission_time > datetime.fromisoformat(due_date):
                        submission_status = "逾期提交"
                    
                    # 检查是否已添加此提交记录（避免重复）
                    if not any(s['course'] == course and s['assignmentName'] == assignment_name for s in submissions):
                        submissions.append({
                            'course': course,
                            'assignmentName': assignment_name,
                            'submissionTime': submission_time.isoformat(),
                            'status': submission_status,
                            'fileCount': len(files),
                            'files': files,
                            'dueDate': due_date
                        })
    
    # 按提交时间排序
    submissions.sort(key=lambda x: x['submissionTime'], reverse=True)
    logging.info(f"找到 {len(submissions)} 条提交记录")
    
    return jsonify({'submissions': submissions})

@student_bp.route('/assignment_stats', methods=['GET'])
@login_required
@student_required
def get_assignment_stats():
    """获取作业的统计信息 - 适应多种文件结构"""
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
        class_name = "默认班级"
    
    # 获取作业详情
    from util.utils import load_assignments
    assignments = load_assignments()
    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment_name), None)
    
    if not assignment_obj:
        return jsonify({'status': 'error', 'message': '作业不存在'}), 404
    
    # 格式化截止日期
    due_date = datetime.fromisoformat(assignment_obj['dueDate'])
    due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
    
    # 定义可能的文件路径模式
    possible_paths = [
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment_name),  # 新结构: /班级/课程/作业/
        os.path.join(UPLOAD_FOLDER, course, class_name, assignment_name),  # 旧结构: /课程/班级/作业/
        os.path.join(UPLOAD_FOLDER, course, assignment_name)               # 最旧结构: /课程/作业/
    ]
    
    # 获取同班级学生数量
    class_students = [username for username, user in users.items() 
                     if not user.get('is_admin', False) and user.get('class_name') == class_name]
    student_count = len(class_students)
    
    # 检查作业目录是否存在
    submission_count = 0
    has_submitted = False
    
    # 检查所有可能的路径
    for assignment_path in possible_paths:
        logging.debug(f"检查路径: {assignment_path}")
        
        if not os.path.exists(assignment_path):
            continue
            
        # 获取学生文件夹
        student_folders = [f for f in os.listdir(assignment_path) 
                         if os.path.isdir(os.path.join(assignment_path, f)) 
                         and not f.endswith('.zip')]
        
        submission_count += len(student_folders)
        
        # 检查当前用户是否已提交
        student_folder_pattern = f"{student_id}_{current_user.id}"
        if any(f.startswith(student_folder_pattern) for f in student_folders):
            has_submitted = True
    
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

# 修改delete_submission函数以适应新的文件结构
@student_bp.route('/submission/<course>/<assignment>', methods=['DELETE'])
@login_required
@student_required
def delete_submission(course, assignment):
    """删除提交的作业 - 适应新的文件结构"""
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    class_name = users[current_user.id].get('class_name', '')
    
    if not class_name:
        class_name = "默认班级"
    
    # 尝试三种文件结构
    possible_paths = [
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment),  # 新结构
        os.path.join(UPLOAD_FOLDER, course, class_name, assignment),  # 旧结构
        os.path.join(UPLOAD_FOLDER, course, assignment)               # 最旧结构
    ]
    
    # 查找该用户的文件夹
    student_folder_pattern = f"{student_id}_{current_user.id}"
    
    for assignment_path in possible_paths:
        if not os.path.exists(assignment_path):
            continue
            
        student_folders = [f for f in os.listdir(assignment_path) 
                         if os.path.isdir(os.path.join(assignment_path, f)) 
                         and f.startswith(student_folder_pattern)]
        
        if student_folders:
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
    
    return jsonify({'status': 'error', 'message': '提交记录不存在'}), 404
    
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
    
# 修改download_file函数以适应新的文件结构
@student_bp.route('/download/<course>/<assignment>/<filename>')
@login_required
@student_required
def download_file(course, assignment, filename):
    """下载自己提交的文件 - 适应新的文件结构"""
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    class_name = users[current_user.id].get('class_name', '')
    
    if not class_name:
        class_name = "默认班级"
    
    # 构建文件夹路径 - 使用新结构
    student_folder_pattern = f"{student_id}_{current_user.id}"
    
    # 新结构: /upload/班级/课程/作业/
    assignment_path = os.path.join(UPLOAD_FOLDER, class_name, course, assignment)
    
    # 如果新结构路径不存在，尝试使用旧结构
    if not os.path.exists(assignment_path):
        # 旧结构: /upload/课程/班级/作业/
        assignment_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment)
        
        # 如果旧结构也不存在，再尝试最旧的结构
        if not os.path.exists(assignment_path):
            # 最旧结构: /upload/课程/作业/
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

# 修改download_all_files函数以适应新的文件结构
@student_bp.route('/download_all/<course>/<assignment>')
@login_required
@student_required
def download_all_files(course, assignment):
    """下载该学生提交的所有文件 - 适应新的文件结构"""
    # 获取用户信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    class_name = users[current_user.id].get('class_name', '')
    
    if not class_name:
        class_name = "默认班级"
    
    # 尝试三种文件结构
    possible_paths = [
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment),  # 新结构
        os.path.join(UPLOAD_FOLDER, course, class_name, assignment),  # 旧结构
        os.path.join(UPLOAD_FOLDER, course, assignment)               # 最旧结构
    ]
    
    # 查找该用户的文件夹
    student_folder_pattern = f"{student_id}_{current_user.id}"
    
    for assignment_path in possible_paths:
        if not os.path.exists(assignment_path):
            continue
            
        student_folders = [f for f in os.listdir(assignment_path) 
                         if os.path.isdir(os.path.join(assignment_path, f)) 
                         and f.startswith(student_folder_pattern)]
        
        if student_folders:
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
    
    return "提交记录不存在", 404

def upload_file_new_structure(file, course, class_name, assignment_name, student_id, username):
    """
    上传文件到指定路径，使用新的目录结构：上传文件夹/班级/课程/作业
    
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
        
        # 创建新的文件夹结构：班级/课程/作业
        class_folder = os.path.join(UPLOAD_FOLDER, class_name)
        course_folder = os.path.join(class_folder, course)
        assignment_folder = os.path.join(course_folder, assignment_name)
        
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
        logging.info(f"文件已上传到新结构路径: {file_path}")
        
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
        logging.error(f"文件上传错误: {str(e)}")
        return False, str(e)
    
def get_courses_for_class(class_name):
    """获取班级可用的课程列表"""
    config = load_course_config()
    
    # 查找班级的课程
    for class_info in config.get('classes', []):
        if class_info['name'] == class_name:
            return [course['name'] for course in class_info.get('courses', [])]
    
    return []