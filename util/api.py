from flask import Blueprint, request, jsonify, send_from_directory
from flask_login import login_required

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