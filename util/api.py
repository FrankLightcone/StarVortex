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

from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_login import login_required, current_user

from util.utils import load_course_config
from util.config import UPLOAD_FOLDER

api_bp = Blueprint('api', __name__)

@api_bp.route('/get_assignments', methods=['GET'])
def get_assignments():
    """获取特定课程的作业列表API"""
    course = request.args.get('course')
    if not course:
        return jsonify({'assignments': []})
    
    config = load_course_config()
    for course_config in config['courses']:
        if course_config['name'] == course:
            return jsonify({'assignments': course_config['assignments']})
    
    return jsonify({'assignments': []})

@api_bp.route('/files/<filename>')
@login_required
def download_file(filename):
    """文件下载API"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@api_bp.route('/get_assignment_stats', methods=['GET'])
@login_required
def get_assignment_stats():
    """获取作业统计信息"""
    from util.student import get_assignment_stats
    return get_assignment_stats()

@api_bp.route('/get_my_submissions', methods=['GET'])
@login_required
def get_my_submissions():
    """获取当前用户的提交记录"""
    from util.student import get_my_submissions
    return get_my_submissions()

@api_bp.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    """更新用户个人资料"""
    from util.student import update_profile
    return update_profile()

@api_bp.route('/delete_submission/<course>/<assignment>', methods=['DELETE'])
@login_required
def delete_submission(course, assignment):
    """删除提交的作业"""
    from util.student import delete_submission
    return delete_submission(course, assignment)

@api_bp.route('/download_my_file/<course>/<assignment>/<filename>', methods=['GET'])
@login_required
def download_my_file(course, assignment, filename):
    """下载自己提交的文件"""
    from util.student import download_file
    return download_file(course, assignment, filename)