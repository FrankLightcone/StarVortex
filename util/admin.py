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
import datetime
import zipfile
from flask import Blueprint, render_template, request, jsonify, send_from_directory, send_file
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
    # 获取课程配置
    course_config = load_course_config()
    
    # 提取所有课程 - 修复部分
    courses = set()  # 使用集合避免重复
    for class_info in course_config.get('classes', []):
        for course_info in class_info.get('courses', []):
            courses.add(course_info['name'])
    
    # 转换为列表
    courses = list(courses)
    
    return render_template('admin.html', 
                          courses=courses, 
                          course_config=course_config, 
                          admin_name=ADMIN_USERNAME)

@admin_bp.route('/assignments', methods=['GET'])
@admin_required
def get_assignments_admin():
    """获取所有作业"""
    assignments = load_assignments()
    
    # 计算每个作业的提交数量
    for assignment in assignments:
        course = assignment['course']
        assignment_name = assignment['name']
        
        # 创建作业目录路径
        assignment_path = os.path.join(UPLOAD_FOLDER, course, assignment_name)
        
        # 计算学生文件夹数量
        if os.path.exists(assignment_path):
            student_folders = [f for f in os.listdir(assignment_path) 
                              if os.path.isdir(os.path.join(assignment_path, f)) 
                              and not f.endswith('.zip')]
            assignment['submissionCount'] = len(student_folders)
        else:
            assignment['submissionCount'] = 0
            
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
    """获取作业提交情况"""
    course = request.args.get('course')
    class_name = request.args.get('class_name')  # 新增班级参数
    assignment = request.args.get('assignment')
    
    if not course or not class_name or not assignment:
        return jsonify({'submissions': [], 'stats': None})
    
    # 获取作业详情
    assignments = load_assignments()
    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment), None)
    
    # 如果作业不存在于assignments.json但存在于course_config中，创建默认作业对象
    if not assignment_obj:
        course_config = load_course_config()
        for course_item in course_config['courses']:
            if course_item['name'] == course and assignment in course_item['assignments']:
                # 创建默认作业对象
                assignment_obj = {
                    'id': f"{course}_{assignment}",
                    'course': course,
                    'name': assignment,
                    'dueDate': (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat(),
                    'description': '',
                    'createdAt': datetime.datetime.now().isoformat()
                }
                break
        
        if not assignment_obj:
            return jsonify({'status': 'error', 'message': '作业不存在'}), 404
    
    # 格式化截止日期
    due_date = datetime.datetime.fromisoformat(assignment_obj['dueDate'])
    due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
    
    # 创建作业目录路径 - 修改为包含班级
    assignment_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment)
    
    # 获取所有用户，统计学生数量
    users = load_users()
    # 这里可以优化为只统计该班级的学生
    class_students = [user for username, user in users.items() 
                     if not user.get('is_admin', False) 
                     and user.get('class_name') == class_name]
    student_count = len(class_students)
    
    submissions = []
    
    # 检查作业目录是否存在
    if os.path.exists(assignment_path):
        # 获取学生文件夹
        student_folders = [f for f in os.listdir(assignment_path) 
                          if os.path.isdir(os.path.join(assignment_path, f)) 
                          and not f.endswith('.zip')]
        
        for folder in student_folders:
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
                        'path': f"/admin/file/{course}/{class_name}/{assignment}/{folder}/{file}"  # 修改文件路径
                    })
            
            submission_time = datetime.datetime.fromtimestamp(latest_time) if latest_time else datetime.datetime.now()
            
            # 按上传时间排序文件，最新的在前
            files.sort(key=lambda x: x['uploadTime'], reverse=True)
            
            submissions.append({
                'studentId': student_id,
                'studentName': student_name,
                'class': class_name,  # 增加班级信息
                'submissionTime': submission_time.isoformat(),
                'fileCount': len(files),
                'files': files
            })
        
        # 按提交时间排序，最新的在前
        submissions.sort(key=lambda x: x['submissionTime'], reverse=True)
    
    # 计算统计信息
    submission_count = len(submissions)
    submission_rate = f"{(submission_count / student_count * 100):.1f}%" if student_count > 0 else "0%"
    
    stats = {
        'totalStudents': student_count,
        'submittedCount': submission_count,
        'submissionRate': submission_rate,
        'dueDateStr': due_date_str,
        'className': class_name  # 增加班级信息
    }
    
    return jsonify({'submissions': submissions, 'stats': stats})

@admin_bp.route('/file/<course>/<class_name>/<assignment>/<folder>/<filename>')
@admin_required
def serve_file(course, class_name, assignment, folder, filename):
    """提供文件下载 - 支持班级层级"""
    file_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment, folder, filename)
    directory = os.path.join(UPLOAD_FOLDER, course, class_name, assignment, folder)
    
    if not os.path.exists(file_path):
        return "文件不存在", 404
    
    return send_from_directory(directory, filename)

@admin_bp.route('/download')
@admin_required
def download_submissions():
    """下载单个学生提交的文件或整个作业的所有提交"""
    course = request.args.get('course')
    class_name = request.args.get('class_name')  # 新增班级参数
    assignment = request.args.get('assignment')
    student = request.args.get('student')
    
    if not course or not class_name or not assignment:
        return "Missing parameters", 400
    
    assignment_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment)
    
    if not os.path.exists(assignment_path):
        return "Assignment not found", 404
    
    # 临时目录用于准备下载
    temp_dir = os.path.join(UPLOAD_FOLDER, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    
    if student:
        # 下载单个学生的提交
        student_folders = [f for f in os.listdir(assignment_path) 
                          if os.path.isdir(os.path.join(assignment_path, f)) 
                          and f.startswith(student)]
        
        if not student_folders:
            return "Student submission not found", 404
        
        student_folder = student_folders[0]
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
        # 检查是否存在未过期的合并zip文件（小于1小时）
        existing_zips = [f for f in os.listdir(assignment_path) 
                         if f.endswith('.zip') and f.startswith(f"{course}_{class_name}_{assignment}_all_")]
        
        if existing_zips:
            # 获取最新的zip文件
            most_recent = max(existing_zips, key=lambda f: os.path.getmtime(os.path.join(assignment_path, f)))
            most_recent_path = os.path.join(assignment_path, most_recent)
            
            # 检查是否在1小时内创建的
            mtime = os.path.getmtime(most_recent_path)
            if (datetime.datetime.now() - datetime.datetime.fromtimestamp(mtime)).total_seconds() < 3600:
                # 提供现有zip文件
                return send_from_directory(assignment_path, most_recent, as_attachment=True)
        
        # 创建包含所有提交的新zip文件
        zip_filename = f"{course}_{class_name}_{assignment}_all_{timestamp}.zip"
        zip_path = os.path.join(assignment_path, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 获取所有学生文件夹
            student_folders = [f for f in os.listdir(assignment_path) 
                              if os.path.isdir(os.path.join(assignment_path, f)) 
                              and not f.endswith('.zip')]
            
            for folder in student_folders:
                folder_path = os.path.join(assignment_path, folder)
                
                for root, _, files in os.walk(folder_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # 使用学生文件夹作为zip中的顶层目录
                        arcname = os.path.join(folder, os.path.relpath(file_path, folder_path))
                        zipf.write(file_path, arcname=arcname)
        
        # 提供zip文件下载
        return send_from_directory(assignment_path, zip_filename, as_attachment=True)

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