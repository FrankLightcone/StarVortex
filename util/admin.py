# ----------------- 管理员功能模块 -----------------

import os
import shutil
import datetime
import zipfile
from flask import Blueprint, render_template, request, jsonify, send_from_directory
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
    courses = [course['name'] for course in course_config['courses']]
    
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
    
    # 创建新作业对象
    new_assignment = {
        'id': new_id,
        'course': data['course'],
        'name': data['name'],
        'dueDate': data['dueDate'],
        'description': data.get('description', ''),
        'createdAt': datetime.datetime.now().isoformat()
    }
    
    # 添加到作业列表并保存
    assignments.append(new_assignment)
    save_assignments(assignments)
    
    # 如果这是课程的新作业，更新课程配置
    course_config = load_course_config()
    for course in course_config['courses']:
        if course['name'] == data['course'] and data['name'] not in course['assignments']:
            course['assignments'].append(data['name'])
    
    # 保存更新后的课程配置
    with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
        import json
        json.dump(course_config, f, ensure_ascii=False, indent=2)
    
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
    assignment = request.args.get('assignment')
    
    if not course or not assignment:
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
    
    # 创建作业目录路径
    assignment_path = os.path.join(UPLOAD_FOLDER, course, assignment)
    
    # 获取所有用户，统计学生数量
    users = load_users()
    student_count = sum(1 for user in users.values() if not user.get('is_admin', False))
    
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
                        'path': f"/admin/file/{course}/{assignment}/{folder}/{file}"
                    })
            
            submission_time = datetime.datetime.fromtimestamp(latest_time) if latest_time else datetime.datetime.now()
            
            # 按上传时间排序文件，最新的在前
            files.sort(key=lambda x: x['uploadTime'], reverse=True)
            
            submissions.append({
                'studentId': student_id,
                'studentName': student_name,
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
        'dueDateStr': due_date_str
    }
    
    return jsonify({'submissions': submissions, 'stats': stats})

@admin_bp.route('/file/<course>/<assignment>/<folder>/<filename>')
@admin_required
def serve_file(course, assignment, folder, filename):
    """提供文件下载"""
    file_path = os.path.join(UPLOAD_FOLDER, course, assignment, folder, filename)
    directory = os.path.join(UPLOAD_FOLDER, course, assignment, folder)
    
    if not os.path.exists(file_path):
        return "文件不存在", 404
    
    return send_from_directory(directory, filename)

@admin_bp.route('/download')
@admin_required
def download_submissions():
    """下载单个学生提交的文件或整个作业的所有提交"""
    course = request.args.get('course')
    assignment = request.args.get('assignment')
    student = request.args.get('student')
    
    if not course or not assignment:
        return "Missing parameters", 400
    
    assignment_path = os.path.join(UPLOAD_FOLDER, course, assignment)
    
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
        zip_filename = f"{course}_{assignment}_{student_folder}_{timestamp}.zip"
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
                         if f.endswith('.zip') and f.startswith(f"{course}_{assignment}_all_")]
        
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
        zip_filename = f"{course}_{assignment}_all_{timestamp}.zip"
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