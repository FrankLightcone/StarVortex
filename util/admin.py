"""
作业传输系统 - 管理员功能模块

本模块处理管理员相关的功能，包括：
- 作业管理（创建、编辑、删除）
- 查看学生提交情况
- 下载学生提交的文件
- 查看系统统计信息

该模块定义了以下路由：
- /dashboard: 管理员控制面板
- /assignments: 获取/创建作业
- /assignments/<assignment_id>: 更新/删除作业
- /submissions: 获取作业提交情况
- /file/<course>/<assignment>/<folder>/<filename>: 提供文件下载
- /download: 下载单个学生提交或整个作业的所有提交

作者: Frank
版本: 1.0
日期: 2025-04-04
"""

import json
import os
import io
import xlsxwriter
import shutil
import logging
import datetime
from datetime import timedelta
import zipfile
from flask import Blueprint, render_template, request, jsonify, send_from_directory, send_file, redirect, url_for
from flask_login import current_user

from util.auth import admin_required
from util.utils import (
    load_course_config, load_assignments, save_assignments,
    compress_folder, format_file_size
)
from util.config import UPLOAD_FOLDER, ADMIN_USERNAME, COURSE_CONFIG_FILE
from util.models import load_users

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/dashboard')
@admin_required
def dashboard():
    """管理员控制面板"""
    # 增加日志记录，帮助调试
    logging.info(f"Admin dashboard accessed by: {current_user.id}")
    
    # 获取课程配置
    course_config = load_course_config()
    
    # 提取所有班级
    classes = set()

    for class_info in course_config.get('classes', []):
        class_name = class_info.get('name', '')
        classes.add(class_name)
    
    # 转换为列表
    classes = list(classes)
    
    return render_template('admin.html', 
                          classes=classes,
                          course_config=course_config, 
                          admin_name=ADMIN_USERNAME)

@admin_bp.route('/get_courses_by_class', methods=['GET'])
@admin_required
def get_courses_by_class():
    """根据班级获取课程列表"""
    class_name = request.args.get('class_name')
    course_config = load_course_config()

    # 如果班级为all，则返回所有课程
    if class_name == 'all':
        logging.info("获取所有课程")
        courses = set()
        for class_info in course_config.get('classes', []):
            for course in class_info.get('courses', []):
                courses.add(course['name'])
        
        # 转换为列表
        courses = list(courses)

        return jsonify({'courses': courses})
    
    # 查找对应班级的课程
    courses = []
    for class_info in course_config.get('classes', []):
        if class_info.get('name') == class_name:
            courses = [course['name'] for course in class_info.get('courses', [])]
            break
    
    return jsonify({'courses': courses})

@admin_bp.route('/get_assignments_by_class_and_course', methods=['GET'])
@admin_required
def get_assignments_by_class_and_course():
    """根据班级和课程获取作业列表"""
    class_name = request.args.get('class_name')
    course_name = request.args.get('course')
    
    # 获取所有作业
    assignments = load_assignments()
    logging.info(f"获取作业列表: 班级={class_name}, 课程={course_name}")
    
    # 筛选出符合条件的作业
    filtered_assignments = [
        assignment for assignment in assignments 
        if assignment['course'] == course_name and class_name in assignment.get('classNames', [])
    ]

    # 修改为作业名称返回
    filtered_assignments = [
        {'id': assignment['id'], 'name': assignment['name']}
        for assignment in filtered_assignments
    ]
    
    return jsonify({'assignments': filtered_assignments})

@admin_bp.route('/')  # 添加根路由重定向
@admin_required
def admin_root():
    """管理员根路由 - 重定向到dashboard"""
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/assignments', methods=['GET'])
@admin_required
def get_assignments_admin():
    """获取所有作业 - 支持多种文件结构"""
    assignments = load_assignments()
    
    # 计算每个作业的提交数量 - 考虑多种路径结构
    for assignment in assignments:
        course = assignment['course']
        assignment_name = assignment['name']
        
        # 查找适用的班级
        class_names = assignment.get('classNames', [])
        
        # 如果没有指定班级，则尝试从配置中查找
        if not class_names:
            config = load_course_config()
            for class_info in config.get('classes', []):
                for course_info in class_info.get('courses', []):
                    if course_info['name'] == course and assignment_name in course_info.get('assignments', []):
                        class_names.append(class_info['name'])
        
        # 确保班级列表无重复
        class_names = list(set(class_names))
        logging.debug(f"作业适用班级: {course}/{assignment_name} -> {class_names}")
        
        # 初始化提交计数
        submission_count = 0
        
        # 检查所有班级的提交
        for class_name in class_names:
            # 检查多种可能的文件路径
            possible_paths = [
                os.path.join(UPLOAD_FOLDER, class_name, course, assignment_name),  # 新结构: /班级/课程/作业/
                os.path.join(UPLOAD_FOLDER, course, class_name, assignment_name),  # 旧结构: /课程/班级/作业/
                os.path.join(UPLOAD_FOLDER, course, assignment_name)               # 最旧结构: /课程/作业/
            ]
            
            # 检查所有可能的路径
            for path in possible_paths:
                if os.path.exists(path):
                    student_folders = [f for f in os.listdir(path) 
                                     if os.path.isdir(os.path.join(path, f)) 
                                     and not f.endswith('.zip')]
                    submission_count += len(student_folders)
        
        # 更新作业对象
        assignment['submissionCount'] = submission_count
            
        # 根据截止日期计算状态
        due_date = datetime.datetime.fromisoformat(assignment['dueDate'])
        assignment['status'] = 'expired' if due_date < datetime.datetime.now() else 'active'
    
    return jsonify({'assignments': assignments})

@admin_bp.route('/assignments', methods=['POST'])
@admin_required
def create_assignment():
    """创建新作业"""
    data = request.json
    assignments = load_assignments()
    
    # 生成新的作业ID
    new_id = str(max([int(a['id']) for a in assignments], default=0) + 1)
    
    # 获取班级和课程信息
    course = data['course']
    class_names = data.get('classNames', [])
    
    if not class_names:
        return jsonify({'status': 'error', 'message': '请选择至少一个班级'}), 400
    
    # 创建新作业对象
    new_assignment = {
        'id': new_id,
        'course': course,
        'name': data['name'],
        'dueDate': data['dueDate'],
        'description': data.get('description', ''),
        'advancedSettings': data.get('advancedSettings', None),
        'classNames': class_names,  # 存储适用的班级
        'createdAt': datetime.datetime.now().isoformat()
    }
    
    # 添加到作业列表并保存
    assignments.append(new_assignment)
    save_assignments(assignments)
    
    # 更新课程配置 - 为每个选中的班级添加该作业
    config = load_course_config()
    for class_info in config.get('classes', []):
        if class_info['name'] in class_names:
            for course_info in class_info.get('courses', []):
                if course_info['name'] == course and data['name'] not in course_info['assignments']:
                    course_info['assignments'].append(data['name'])
    
    # 保存更新后的课程配置
    with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    return jsonify({'status': 'success', 'assignment': new_assignment})

@admin_bp.route('/assignments/<assignment_id>', methods=['PUT'])
@admin_required
def update_assignment(assignment_id):
    """更新现有作业"""
    data = request.json
    assignments = load_assignments()
    
    # 查找对应ID的作业
    for i, assignment in enumerate(assignments):
        if assignment['id'] == assignment_id:
            # 更新作业
            assignments[i]['course'] = data['course']
            assignments[i]['name'] = data['name']
            assignments[i]['dueDate'] = data['dueDate']
            assignments[i]['description'] = data.get('description', '')
            assignments[i]['advancedSettings'] = data.get('advancedSettings', None)  # 更新高级设置
            assignments[i]['updatedAt'] = datetime.datetime.now().isoformat()
            
            # 保存更改
            save_assignments(assignments)
            return jsonify({'status': 'success', 'assignment': assignments[i]})
    
    return jsonify({'status': 'error', 'message': '作业不存在'}), 404

@admin_bp.route('/assignments/<assignment_id>', methods=['DELETE'])
@admin_required
def delete_assignment(assignment_id):
    """删除作业"""
    assignments = load_assignments()
    
    # 查找对应ID的作业
    for i, assignment in enumerate(assignments):
        if assignment['id'] == assignment_id:
            course = assignment['course']
            name = assignment['name']
            
            # 从列表中移除
            deleted = assignments.pop(i)
            save_assignments(assignments)
            
            # 更新课程配置
            course_config = load_course_config()
            for course_item in course_config['courses']:
                if course_item['name'] == course and name in course_item['assignments']:
                    course_item['assignments'].remove(name)
            
            with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
                import json
                json.dump(course_config, f, ensure_ascii=False, indent=2)
            
            # 可选：删除作业目录
            assignment_dir = os.path.join(UPLOAD_FOLDER, course, name)
            if os.path.exists(assignment_dir):
                shutil.rmtree(assignment_dir)
            
            return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error', 'message': '作业不存在'}), 404

@admin_bp.route('/submissions', methods=['GET'])
@admin_required
def get_submissions():
    """获取作业提交情况 - 支持多种文件结构"""
    course = request.args.get('course')
    class_name = request.args.get('class_name')  # 新增班级参数
    assignment = request.args.get('assignment')
    
    if not course or not class_name or not assignment:
        return jsonify({'submissions': [], 'stats': None})
    
    # 添加调试日志
    logging.info(f"管理员查询提交情况: 课程={course}, 班级={class_name}, 作业={assignment}")
    
    # 获取作业详情
    from util.utils import load_assignments
    assignments = load_assignments()
    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment), None)
    logging.info(f"作业对象: {assignment_obj}")
    
    # 如果作业不存在于assignments.json但存在于course_config中，创建默认作业对象
    if not assignment_obj:
        course_config = load_course_config()
        for class_info in course_config.get('classes', []):
            if class_info['name'] == class_name:
                for course_info in class_info.get('courses', []):
                    if course_info['name'] == course and assignment in course_info.get('assignments', []):
                        # 创建默认作业对象
                        assignment_obj = {
                            'id': f"{course}_{assignment}",
                            'course': course,
                            'name': assignment,
                            'dueDate': (datetime.now() + timedelta(days=7)).isoformat(),
                            'description': '',
                            'createdAt': datetime.now().isoformat()
                        }
                        break
        
        if not assignment_obj:
            return jsonify({'status': 'error', 'message': '作业不存在'}), 404
    
    # 格式化截止日期
    due_date = datetime.datetime.fromisoformat(assignment_obj['dueDate'])
    due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
    
    # 检查多种可能的文件路径
    possible_paths = [
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment),  # 新结构: /班级/课程/作业/
    ]
    
    submissions = []
    assignment_paths = []
    
    # 检查所有可能的路径
    for path in possible_paths:
        if os.path.exists(path) and os.path.isdir(path):
            assignment_paths.append(path)
            logging.info(f"找到有效路径: {path}")
    
    # 整合所有路径下的提交
    student_folders_all = []
    for assignment_path in assignment_paths:
        student_folders = [f for f in os.listdir(assignment_path) 
                          if os.path.isdir(os.path.join(assignment_path, f)) 
                          and not f.endswith('.zip')]
        for folder in student_folders:
            student_folders_all.append((folder, assignment_path))
    
    # 获取所有用户，统计学生数量
    users = load_users()
    # 获取指定班级的学生
    class_students = [user for username, user in users.items() 
                     if not user.get('is_admin', False) 
                     and user.get('class_name') == class_name]
    student_count = len(class_students)

    if not assignment_paths:
        logging.warning(f"未找到作业路径: 课程={course}, 班级={class_name}, 作业={assignment}")
        return jsonify({'submissions': [], 'stats': {
            'totalStudents': student_count,
            'submittedCount': 0,
            'submissionRate': "0%",
            'dueDateStr': due_date_str,
            'className': class_name
        }})
    
    # 处理所有找到的学生文件夹
    for folder, assignment_path in student_folders_all:
        # 文件夹名称格式: student_id_name
        parts = folder.split('_', 1)
        if len(parts) < 2:
            continue
                
        student_id = parts[0]
        student_name = parts[1]
        folder_path = os.path.join(assignment_path, folder)
        
        # 获取文件夹中的文件
        files = []
        latest_time = None
        
        for file in os.listdir(folder_path):
            file_path = os.path.join(folder_path, file)
            if os.path.isfile(file_path):
                file_size = os.path.getsize(file_path)
                file_time = os.path.getmtime(file_path)
                file_datetime = datetime.datetime.fromtimestamp(file_time)
                
                if latest_time is None or file_time > latest_time:
                    latest_time = file_time
                
                files.append({
                    'name': file,
                    'size': format_file_size(file_size),
                    'uploadTime': file_datetime.isoformat(),
                    'path': f"/admin/file/{course}/{class_name}/{assignment}/{folder}/{file}"
                })
        
        submission_time = datetime.datetime.fromtimestamp(latest_time) if latest_time else datetime.now()
        
        # 按上传时间排序文件，最新的在前
        files.sort(key=lambda x: x['uploadTime'], reverse=True)
        
        submissions.append({
            'studentId': student_id,
            'studentName': student_name,
            'class': class_name,
            'submissionTime': submission_time.isoformat(),
            'fileCount': len(files),
            'files': files
        })
    
    # 按提交时间排序，最新的在前
    submissions.sort(key=lambda x: x['submissionTime'], reverse=True)
    
    # 统计信息 - 使用去重后的学生ID计算
    submitted_students = set(s['studentId'] for s in submissions)
    submission_count = len(submitted_students)
    submission_rate = f"{(submission_count / student_count * 100):.1f}%" if student_count > 0 else "0%"
    
    stats = {
        'totalStudents': student_count,
        'submittedCount': submission_count,
        'submissionRate': submission_rate,
        'dueDateStr': due_date_str,
        'className': class_name
    }
    
    return jsonify({'submissions': submissions, 'stats': stats})

@admin_bp.route('/file/<course>/<class_name>/<assignment>/<folder>/<filename>')
@admin_required
def serve_file(course, class_name, assignment, folder, filename):
    """提供文件下载 - 支持多种文件结构"""
    # 检查多种可能的文件路径
    possible_paths = [
        # 新结构: /班级/课程/作业/
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment, folder, filename),
        # 旧结构: /课程/班级/作业/
        os.path.join(UPLOAD_FOLDER, course, class_name, assignment, folder, filename),
        # 最旧结构: /课程/作业/
        os.path.join(UPLOAD_FOLDER, course, assignment, folder, filename)
    ]
    
    # 尝试所有可能的路径
    for file_path in possible_paths:
        if os.path.exists(file_path):
            directory = os.path.dirname(file_path)
            return send_from_directory(directory, filename)
    
    return "文件不存在", 404

@admin_bp.route('/download', methods=['GET'])
@admin_required
def download_submissions():
    """下载单个学生提交的文件或整个作业的所有提交 - 支持多种文件结构"""
    course = request.args.get('course')
    class_name = request.args.get('class_name')  # 新增班级参数
    assignment = request.args.get('assignment')
    student = request.args.get('student')
    
    if not course or not class_name or not assignment:
        return "缺少参数", 400
    
    # 检查多种可能的文件路径
    possible_paths = [
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment),  # 新结构: /班级/课程/作业/
        os.path.join(UPLOAD_FOLDER, course, class_name, assignment),  # 旧结构: /课程/班级/作业/
        os.path.join(UPLOAD_FOLDER, course, assignment)               # 最旧结构: /课程/作业/
    ]
    
    # 查找存在的有效路径
    valid_paths = [path for path in possible_paths if os.path.exists(path)]
    
    if not valid_paths:
        return "作业未找到", 404
    
    # 临时目录用于准备下载
    temp_dir = os.path.join(UPLOAD_FOLDER, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    if student:
        # 下载单个学生的提交
        student_folders = []
        for path in valid_paths:
            folders = [f for f in os.listdir(path) 
                     if os.path.isdir(os.path.join(path, f)) 
                     and f.startswith(student)]
            if folders:
                student_folders.append((folders[0], path))
        
        if not student_folders:
            return "学生提交未找到", 404
        
        # 使用找到的第一个文件夹
        student_folder, assignment_path = student_folders[0]
        student_path = os.path.join(assignment_path, student_folder)
        
        # 创建zip文件
        zip_filename = f"{course}_{class_name}_{assignment}_{student_folder}_{timestamp}.zip"
        zip_path = os.path.join(temp_dir, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(student_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, student_path)
                    zipf.write(file_path, arcname=arcname)
        
        # 提供zip文件下载
        return send_from_directory(temp_dir, zip_filename, as_attachment=True)
    else:
        # 下载所有提交
        # 创建包含所有提交的新zip文件
        zip_filename = f"{course}_{class_name}_{assignment}_all_{timestamp}.zip"
        zip_path = os.path.join(temp_dir, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 遍历所有有效路径下的学生文件夹
            for path in valid_paths:
                student_folders = [f for f in os.listdir(path) 
                                 if os.path.isdir(os.path.join(path, f)) 
                                 and not f.endswith('.zip')]
                
                for folder in student_folders:
                    folder_path = os.path.join(path, folder)
                    
                    for root, _, files in os.walk(folder_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            # 使用学生文件夹作为zip中的顶层目录
                            arcname = os.path.join(folder, os.path.relpath(file_path, folder_path))
                            zipf.write(file_path, arcname=arcname)
        
        # 提供zip文件下载
        return send_from_directory(temp_dir, zip_filename, as_attachment=True)

#region 导出作业提交统计为Excel文件
@admin_bp.route('/export-stats')
@admin_required
def export_stats():
    """导出作业提交统计为Excel文件"""
    course = request.args.get('course')
    class_name = request.args.get('class_name')  # 新增班级参数
    assignment = request.args.get('assignment')
    
    if not course or not class_name or not assignment:
        return jsonify({'status': 'error', 'message': '缺少课程、班级或作业名称参数'}), 400
    
    # 获取作业详情
    assignment_obj = next((a for a in load_assignments() if a['course'] == course and a['name'] == assignment), None)
    if not assignment_obj:
        return jsonify({'status': 'error', 'message': '作业不存在'}), 404
    
    # 获取所有学生信息 - 筛选特定班级的学生
    users = load_users()
    students = [
        {'username': username, 'name': info.get('name', ''), 'student_id': info.get('student_id', ''), 
         'email': info.get('email', ''), 'class_name': info.get('class_name', '')} 
        for username, info in users.items() 
        if not info.get('is_admin', False) and info.get('class_name') == class_name  # 只包含指定班级
    ]
    
    # 创建内存中的Excel文件
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet(f"{class_name}提交统计")
    
    # 添加标题样式
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#4B5563',
        'color': 'white',
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
        'text_wrap': True
    })
    
    # 添加单元格样式
    cell_format = workbook.add_format({
        'border': 1,
        'align': 'center',
        'valign': 'vcenter'
    })
    
    # 添加日期格式
    date_format = workbook.add_format({
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
        'num_format': 'yyyy-mm-dd hh:mm:ss'
    })
    
    # 添加未提交样式(红色)
    not_submitted_format = workbook.add_format({
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
        'color': 'red',
        'bold': True
    })
    
    # 添加提交样式(绿色)
    submitted_format = workbook.add_format({
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
        'color': 'green',
        'bold': True
    })
    
    # 添加逾期提交样式(橙色)
    late_format = workbook.add_format({
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
        'color': 'orange',
        'bold': True
    })

    # 表头增加班级字段
    headers = ['序号', '学号', '姓名', '班级', '邮箱', '提交时间', '提交状态', '文件数量', '文件大小(总计)']
    for col, header in enumerate(headers):
        worksheet.write(0, col, header, header_format)
    
    # 设置列宽
    worksheet.set_column(0, 0, 5)    # 序号
    worksheet.set_column(1, 1, 12)   # 学号
    worksheet.set_column(2, 2, 12)   # 姓名
    worksheet.set_column(3, 3, 20)   # 班级
    worksheet.set_column(4, 4, 25)   # 邮箱
    worksheet.set_column(5, 5, 18)   # 提交时间
    worksheet.set_column(6, 6, 10)   # 提交状态
    worksheet.set_column(7, 7, 10)   # 文件数量
    worksheet.set_column(8, 8, 15)   # 文件大小
    
    # 获取提交情况 - 修改文件路径包含班级
    assignment_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment)
    submissions = {}
    
    if os.path.exists(assignment_path):
        for folder in os.listdir(assignment_path):
            folder_path = os.path.join(assignment_path, folder)
            if os.path.isdir(folder_path) and not folder.endswith('.zip'):
                # 文件夹名称格式: student_id_username
                parts = folder.split('_', 1)
                if len(parts) < 2:
                    continue
                    
                student_id = parts[0]
                username = parts[1]
                
                # 获取文件列表和总大小
                files = []
                total_size = 0
                latest_time = None
                
                for file in os.listdir(folder_path):
                    file_path = os.path.join(folder_path, file)
                    if os.path.isfile(file_path):
                        file_size = os.path.getsize(file_path)
                        file_time = os.path.getmtime(file_path)
                        
                        if latest_time is None or file_time > latest_time:
                            latest_time = file_time
                        
                        total_size += file_size
                        files.append({
                            'name': file,
                            'size': file_size,
                            'time': file_time
                        })
                
                # 记录提交信息
                submissions[username] = {
                    'student_id': student_id,
                    'files': files,
                    'file_count': len(files),
                    'total_size': total_size,
                    'latest_time': latest_time
                }
    
    # 获取截止时间
    due_date = datetime.datetime.fromisoformat(assignment_obj['dueDate'])
    
    # 填充数据
    for row, student in enumerate(students, 1):
        username = student['username']
        submission = submissions.get(username)
        
        worksheet.write(row, 0, row, cell_format)                              # 序号
        worksheet.write(row, 1, student['student_id'], cell_format)            # 学号
        worksheet.write(row, 2, student['name'], cell_format)                  # 姓名
        worksheet.write(row, 3, student['class_name'], cell_format)            # 班级
        worksheet.write(row, 4, student['email'], cell_format)                 # 邮箱
        
        if submission:
            # 有提交记录
            submission_time = datetime.datetime.fromtimestamp(submission['latest_time'])
            worksheet.write_datetime(row, 5, submission_time, date_format)      # 提交时间
            
            # 判断是否逾期提交
            if submission_time > due_date:
                worksheet.write(row, 6, "逾期提交", late_format)                 # 提交状态
            else:
                worksheet.write(row, 6, "已提交", submitted_format)              # 提交状态
                
            worksheet.write(row, 7, submission['file_count'], cell_format)      # 文件数量
            worksheet.write(row, 8, format_file_size(submission['total_size']), cell_format)  # 文件大小
        else:
            # 无提交记录
            worksheet.write(row, 5, "未提交", cell_format)                       # 提交时间
            worksheet.write(row, 6, "未提交", not_submitted_format)              # 提交状态
            worksheet.write(row, 7, 0, cell_format)                             # 文件数量
            worksheet.write(row, 8, "0 B", cell_format)                         # 文件大小
    
    # 添加统计信息
    summary_row = len(students) + 2
    bold_format = workbook.add_format({'bold': True, 'align': 'right'})
    
    worksheet.write(summary_row, 0, "统计信息:", bold_format)
    worksheet.write(summary_row, 1, "总人数:", bold_format)
    worksheet.write(summary_row, 2, len(students), cell_format)
    
    worksheet.write(summary_row + 1, 1, "已提交:", bold_format)
    worksheet.write(summary_row + 1, 2, len(submissions), cell_format)
    
    worksheet.write(summary_row + 2, 1, "提交率:", bold_format)
    submission_rate = f"{(len(submissions) / len(students) * 100) if len(students) > 0 else 0:.1f}%"
    worksheet.write(summary_row + 2, 2, submission_rate, cell_format)
    
    worksheet.write(summary_row + 3, 1, "逾期提交:", bold_format)
    late_count = sum(1 for username, data in submissions.items() 
                   if datetime.datetime.fromtimestamp(data['latest_time']) > due_date)
    worksheet.write(summary_row + 3, 2, late_count, cell_format)
    
    # 关闭工作簿并获取输出
    workbook.close()
    output.seek(0)
    
    # 生成文件名
    filename = f"{course}_{class_name}_{assignment}_提交统计_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    # 发送文件
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

#region 管理班级
@admin_bp.route('/classes', methods=['GET'])
@admin_required
def get_all_classes():
    """获取所有班级列表"""
    config = load_course_config()
    all_classes = []
    
    for class_info in config.get('classes', []):
        # 提取该班级的所有课程
        courses = [course['name'] for course in class_info.get('courses', [])]
        
        all_classes.append({
            'name': class_info.get('name', ''),
            'description': class_info.get('description', ''),
            'courses': courses
        })
    
    return jsonify({'classes': all_classes})

@admin_bp.route('/classes', methods=['POST'])
@admin_required
def add_class():
    """添加新班级"""
    data = request.json
    course_name = data.get('course')
    class_name = data.get('name')
    description = data.get('description', '')
    
    if not course_name or not class_name:
        return jsonify({'status': 'error', 'message': '课程名称和班级名称不能为空'}), 400
    
    config = load_course_config()
    
    # 检查课程是否存在
    course_found = False
    for course in config['courses']:
        if course['name'] == course_name:
            course_found = True
            
            # 确保classes字段存在
            if 'classes' not in course:
                course['classes'] = []
                
            # 检查班级是否已存在
            for existing_class in course['classes']:
                if existing_class['name'] == class_name:
                    return jsonify({'status': 'error', 'message': '该班级已存在'}), 400
            
            # 添加新班级
            course['classes'].append({
                'name': class_name,
                'description': description
            })
            break
    
    if not course_found:
        return jsonify({'status': 'error', 'message': '课程不存在'}), 404
    
    # 保存更改
    with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    return jsonify({
        'status': 'success', 
        'message': f'班级 {class_name} 已添加到课程 {course_name}',
        'class': {
            'course': course_name,
            'name': class_name,
            'description': description
        }
    })

@admin_bp.route('/classes/<course>/<class_name>', methods=['PUT'])
@admin_required
def update_class(course, class_name):
    """更新班级信息"""
    data = request.json
    new_name = data.get('name')
    new_description = data.get('description')
    
    if not new_name:
        return jsonify({'status': 'error', 'message': '班级名称不能为空'}), 400
    
    config = load_course_config()
    
    # 查找班级并更新
    for course_item in config['courses']:
        if course_item['name'] == course and 'classes' in course_item:
            for class_item in course_item['classes']:
                if class_item['name'] == class_name:
                    # 检查新名称是否与其他班级冲突
                    if new_name != class_name and any(c['name'] == new_name for c in course_item['classes']):
                        return jsonify({'status': 'error', 'message': '班级名称已存在'}), 400
                    
                    # 更新班级信息
                    class_item['name'] = new_name
                    class_item['description'] = new_description
                    
                    # 保存更改
                    with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
                        json.dump(config, f, ensure_ascii=False, indent=2)
                    
                    return jsonify({
                        'status': 'success', 
                        'message': '班级信息已更新',
                        'class': {
                            'course': course,
                            'name': new_name,
                            'description': new_description
                        }
                    })
    
    return jsonify({'status': 'error', 'message': '班级不存在'}), 404

@admin_bp.route('/classes/<course>/<class_name>', methods=['DELETE'])
@admin_required
def delete_class(course, class_name):
    """删除班级"""
    config = load_course_config()
    
    # 查找班级
    for course_item in config['courses']:
        if course_item['name'] == course and 'classes' in course_item:
            for i, class_item in enumerate(course_item['classes']):
                if class_item['name'] == class_name:
                    # 从列表中删除班级
                    course_item['classes'].pop(i)
                    
                    # 保存更改
                    with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
                        json.dump(config, f, ensure_ascii=False, indent=2)
                    
                    return jsonify({
                        'status': 'success', 
                        'message': f'班级 {class_name} 已从课程 {course} 中删除'
                    })
    
    return jsonify({'status': 'error', 'message': '班级不存在'}), 404

@admin_bp.route('/class_students/<class_name>', methods=['GET'])
@admin_required
def get_class_students(class_name):
    """获取班级学生列表"""
    if not class_name:
        return jsonify({'status': 'error', 'message': '班级名称不能为空'}), 400
    
    # 加载所有用户
    users = load_users()
    
    # 筛选该班级的学生
    students = []
    for username, user_data in users.items():
        if not user_data.get('is_admin', False) and user_data.get('class_name') == class_name:
            students.append({
                'username': username,
                'name': user_data.get('name', username),
                'student_id': user_data.get('student_id', ''),
                'email': user_data.get('email', '')
            })
    
    # 按学号排序
    students.sort(key=lambda x: x['student_id'])
    
    return jsonify({
        'status': 'success',
        'class_name': class_name,
        'student_count': len(students),
        'students': students
    })

@admin_bp.route('/class_courses/<class_name>', methods=['GET'])
@admin_required
def get_class_courses(class_name):
    """获取班级的课程列表"""
    config = load_course_config()
    
    for class_info in config.get('classes', []):
        if class_info['name'] == class_name:
            courses = [course['name'] for course in class_info.get('courses', [])]
            return jsonify({
                'status': 'success',
                'class_name': class_name,
                'courses': courses
            })
    
    return jsonify({
        'status': 'error',
        'message': '班级不存在'
    }), 404