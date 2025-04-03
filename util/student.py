import os
import logging
import threading
from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from util.config import UPLOAD_FOLDER, allowed_file
from util.utils import load_course_config, compress_folder
from util.models import load_users

student_bp = Blueprint('student', __name__)

@student_bp.route('/', methods=['GET', 'POST'])
@login_required
def upload_file():
    """学生文件上传页面"""
    # 获取课程配置
    config = load_course_config()
    courses = [course['name'] for course in config['courses']]
    
    if request.method == 'POST':
        # 获取课程和作业名称
        course = request.form.get('course')
        assignment_name = request.form.get('assignment_name')
        
        # 检查课程和作业名称
        if not course or not assignment_name:
            return jsonify({'status': 'error', 'message': '请选择课程和作业名称'}), 400

        # 检查是否有文件
        if 'file' not in request.files:
            logging.warning('No file part in the request')
            return jsonify({'status': 'error', 'message': '没有选择文件'}), 400
        
        file = request.files['file']
        
        # 检查文件名
        if file.filename == '':
            logging.warning('No selected file')
            return jsonify({'status': 'error', 'message': '没有选择文件'}), 400
        
        # 检查文件类型
        if not allowed_file(file.filename):
            logging.warning(f'File type not allowed: {file.filename}')
            return jsonify({'status': 'error', 'message': '不支持的文件类型'}), 400
        
        try:
            # 安全处理原始文件名
            original_filename = secure_filename(file.filename)
            base, ext = os.path.splitext(original_filename)
            
            # 获取用户信息
            users = load_users()
            student_id = users[current_user.id]['student_id']
            
            # 创建课程和作业文件夹结构
            course_folder = os.path.join(UPLOAD_FOLDER, course)
            assignment_folder = os.path.join(course_folder, assignment_name)
            
            # 确保文件夹存在
            os.makedirs(assignment_folder, exist_ok=True)
            
            # 创建以学生信息命名的子文件夹
            student_folder_name = f"{student_id}_{current_user.id}"
            student_folder = os.path.join(assignment_folder, student_folder_name)
            os.makedirs(student_folder, exist_ok=True)
            
            # 保存文件到学生文件夹
            file_path = os.path.join(student_folder, original_filename)
            
            # 处理文件重名情况
            counter = 1
            while os.path.exists(file_path):
                new_filename = f"{base}_{counter}{ext}"
                file_path = os.path.join(student_folder, new_filename)
                counter += 1
            
            # 保存文件
            file.save(file_path)
            logging.info(f'File uploaded to: {file_path}')
            
            # 同时创建一个压缩文件
            zip_filename = f"{student_folder_name}.zip"
            zip_filepath = os.path.join(assignment_folder, zip_filename)
            
            # 启动线程压缩文件夹
            t = threading.Thread(
                target=compress_folder, 
                args=(student_folder, zip_filepath)
            )
            t.start()
            
            return jsonify({
                'status': 'success', 
                'message': '文件上传成功', 
                'filename': os.path.basename(file_path)
            }), 200
        
        except Exception as e:
            # 详细的错误日志
            logging.error(f'Upload error: {str(e)}')
            return jsonify({
                'status': 'error', 
                'message': f'文件上传失败: {str(e)}'
            }), 500
    
    return render_template('upload.html', courses=courses, course_config=config)