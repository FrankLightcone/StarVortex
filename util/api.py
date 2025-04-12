"""
作业传输系统 - API接口模块

本模块提供系统的REST API接口，用于客户端与服务器间的数据交互。
主要功能包括：
- 获取课程作业列表
- 文件下载API
- 作业统计信息API
- 学生提交记录API
- 用户资料更新API
- 删除提交记录API

这些API接口主要供前端JavaScript调用，实现无刷新的用户体验。

作者: Frank
版本: 1.0
日期: 2025-04-04
"""

import os
import logging
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, send_from_directory, current_app, redirect, url_for
from flask_login import login_required, current_user

from util.config import UPLOAD_FOLDER
from util.utils import load_course_config, load_assignments

from util.models import load_users, save_users

api_bp = Blueprint('api', __name__)

@api_bp.route('/get_assignments', methods=['GET'])
def get_assignments():
    """获取特定课程的作业列表API"""
    course = request.args.get('course')
    
    # 如果用户已登录，则使用用户的班级
    class_name = ''
    if current_user.is_authenticated:
        users = load_users()
        user_data = users.get(current_user.id, {})
        class_name = user_data.get('class_name', '')
        
        # 设置默认班级（如果用户没有班级）
        if not class_name:
            class_name = "默认班级"
            user_data['class_name'] = class_name
            users[current_user.id] = user_data
            save_users(users)  # 保存更改
            logging.warning(f"用户 {current_user.id} 没有班级，已分配默认班级")
    else:
        # 如果未登录，从参数获取班级（管理员页面可能使用）
        class_name = request.args.get('class_name', '')
    
    if not course:
        return jsonify({'assignments': []})
    
    # 如果没有班级信息，尝试使用默认班级
    if not class_name:
        class_name = "默认班级"
    
    config = load_course_config()
    
    # 根据班级和课程查找作业列表
    for class_info in config.get('classes', []):
        if class_info['name'] == class_name:
            for course_info in class_info.get('courses', []):
                if course_info['name'] == course:
                    return jsonify({'assignments': course_info.get('assignments', [])})
    
    # 如果找不到指定班级或课程，尝试在所有班级中查找
    all_assignments = []
    for class_info in config.get('classes', []):
        for course_info in class_info.get('courses', []):
            if course_info['name'] == course:
                all_assignments.extend(course_info.get('assignments', []))
    
    # 去重
    all_assignments = list(set(all_assignments))
    
    return jsonify({'assignments': all_assignments})

@api_bp.route('/files/<filename>')
@login_required
def download_file(filename):
    """文件下载API"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@api_bp.route('/get_assignment_stats', methods=['GET'])
@login_required
def get_assignment_stats():
    """获取作业统计信息"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Admin users cannot access student API endpoints'}), 403
        
    from util.student import get_assignment_stats
    return get_assignment_stats()

@api_bp.route('/get_my_submissions', methods=['GET'])
@login_required
def get_my_submissions():
    """获取当前用户的提交记录"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Admin users cannot access student API endpoints'}), 403
        
    from util.student import get_my_submissions
    return get_my_submissions()

@api_bp.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    """更新用户个人资料"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Admin users cannot update student profiles'}), 403
        
    from util.student import update_profile
    return update_profile()

@api_bp.route('/delete_submission/<course>/<assignment>', methods=['DELETE'])
@login_required
def delete_submission(course, assignment):
    """删除提交的作业"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Admin users cannot delete student submissions'}), 403
        
    from util.student import delete_submission
    return delete_submission(course, assignment)

@api_bp.route('/download/<course>/<assignment>/<filename>', methods=['GET'])
@login_required
def download_my_file(course, assignment, filename):
    """下载自己提交的文件"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return redirect(url_for('admin.dashboard'))
        
    from util.student import download_file
    return download_file(course, assignment, filename)

@api_bp.route('/download_all/<course>/<assignment>', methods=['GET'])
@login_required
def download_all_files(course, assignment):
    """下载所有提交文件"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return redirect(url_for('admin.dashboard'))
        
    from util.student import download_all_files
    return download_all_files(course, assignment)

@api_bp.route('/all_assignments', methods=['GET'])
@login_required
def all_assignments():
    """获取所有课程作业及其提交状态"""
    # 检查当前用户是否为管理员，如果是则不允许访问
    if current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Admin users cannot access student API endpoints'}), 403
    
    # 获取当前用户的学号和班级信息
    users = load_users()
    student_id = users[current_user.id]['student_id']
    class_name = users[current_user.id].get('class_name', '')
    
    # 设置默认班级（如果用户没有班级）
    if not class_name:
        class_name = "默认班级"
        users[current_user.id]['class_name'] = class_name
        save_users(users)  # 保存更改
        logging.warning(f"用户 {current_user.id} 没有班级，已分配默认班级")
    
    # 获取所有作业信息
    assignments_data = load_assignments()
    
    # 获取课程配置
    config = load_course_config()
    
    # 用于存储完整的作业列表
    all_assignments = []
    
    # 找到该学生所在班级的课程列表
    student_courses = []
    class_found = False
    
    for class_info in config.get('classes', []):
        if class_info['name'] == class_name:
            class_found = True
            # 遍历该班级的所有课程和作业
            for course_info in class_info.get('courses', []):
                course_name = course_info['name']
                
                # 遍历该课程的所有作业
                for assignment_name in course_info.get('assignments', []):
                    # 从assignments.json中查找匹配的作业详情
                    assignment_detail = next((a for a in assignments_data if a['course'] == course_name and a['name'] == assignment_name), None)
                    
                    # 如果没有找到，创建默认详情
                    if not assignment_detail:
                        # 默认截止日期为一周后
                        default_due_date = (datetime.now() + timedelta(days=7)).isoformat()
                        assignment_detail = {
                            'course': course_name,
                            'name': assignment_name,
                            'dueDate': default_due_date,
                            'description': ''
                        }
                    
                    # 检查截止状态
                    due_date = datetime.fromisoformat(assignment_detail['dueDate'])
                    is_expired = due_date < datetime.now()
                    
                    # 构建作业目录路径 - 包含班级层级
                    assignment_path = os.path.join(UPLOAD_FOLDER, class_name, course_name, assignment_name)
                    
                    # 检查目录是否存在，如果不存在则创建
                    if not os.path.exists(assignment_path):
                        os.makedirs(assignment_path, exist_ok=True)
                    
                    # 检查当前用户是否已提交
                    has_submitted = False

                    # 调试输出
                    logging.info(f"检查提交状态: {assignment_path}, 学号: {student_id}, 用户ID: {current_user.id}")
                    
                    if os.path.exists(assignment_path):
                        # 查找匹配学生ID的文件夹
                        student_folder_pattern = f"{student_id}_{current_user.id}"
                        has_submitted = any(
                            os.path.isdir(os.path.join(assignment_path, f)) and 
                            f.startswith(student_folder_pattern) 
                            for f in os.listdir(assignment_path) 
                            if os.path.isdir(os.path.join(assignment_path, f))
                        )
                    
                    # 获取提交人数
                    submission_count = 0
                    if os.path.exists(assignment_path):
                        submission_count = len([
                            f for f in os.listdir(assignment_path) 
                            if os.path.isdir(os.path.join(assignment_path, f)) and 
                            not f.endswith('.zip')
                        ])
                    
                    # 添加到完整列表
                    all_assignments.append({
                        'id': assignment_detail.get('id', f"{course_name}_{assignment_name}"),
                        'course': course_name,
                        'name': assignment_name,
                        'dueDate': assignment_detail['dueDate'],
                        'description': assignment_detail.get('description', ''),
                        'isExpired': is_expired,
                        'hasSubmitted': has_submitted,
                        'submissionCount': submission_count
                    })
    
    # 如果找不到班级，记录警告
    if not class_found:
        logging.warning(f"找不到班级: {class_name}")
        # 返回空作业列表
        return jsonify({'assignments': []})
    
    return jsonify({'assignments': all_assignments})

@api_bp.route('/get_assignment_settings')
@login_required
def get_assignment_settings():
    """获取作业的高级设置"""
    # 检查当前用户是否为管理员
    if current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Admin users cannot access student API endpoints'}), 403
        
    course = request.args.get('course')
    assignment = request.args.get('assignment')
    
    if not course or not assignment:
        return jsonify({'settings': get_default_settings()})
    
    # 获取作业信息
    assignments = load_assignments()
    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment), None)
    
    if not assignment_obj:
        return jsonify({'settings': get_default_settings()})
    
    # 获取高级设置，如果不存在则使用默认设置
    settings = assignment_obj.get('advancedSettings', get_default_settings())
    
    return jsonify({'settings': settings})

def get_default_settings():
    """获取默认的高级设置"""
    return {
        'maxFileCount': 10,
        'maxFileSize': 256,
        'fileSizeUnit': 'MB',
        'dailyQuota': 1,
        'allowedTypes': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar', 'txt', 'csv'],
        'enableGrading': False,
        'enableFeedback': False
    }

@api_bp.route('/get_classes', methods=['GET'])
def get_classes():
    """获取班级列表API"""
    course = request.args.get('course', '')
    
    config = load_course_config()
    classes = []
    
    # 如果指定了课程，获取所有包含该课程的班级
    if course:
        for class_info in config.get('classes', []):
            if any(c['name'] == course for c in class_info.get('courses', [])):
                classes.append({
                    'name': class_info['name'],
                    'description': class_info.get('description', '')
                })
    else:
        # 否则获取所有班级
        classes = [
            {'name': c['name'], 'description': c.get('description', '')}
            for c in config.get('classes', [])
        ]
    
    return jsonify({'classes': classes})