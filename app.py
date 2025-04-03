import os
import json
import logging
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from flask import Flask, render_template, request, redirect, url_for, send_from_directory, jsonify
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import threading
import zipfile

import datetime
import shutil
from functools import wraps

# Add the following configuration constants
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD_HASH = generate_password_hash('admin123')  # Change this in production!

# 配置日志
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s: %(message)s',
    filename='file_upload.log',  # 将日志写入文件
    filemode='a',  # 追加模式
    encoding="utf-8"
)

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # 请更换为复杂的密钥
UPLOAD_FOLDER = 'static/upload'
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 
    'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 
    'mp3', 'mp4', 'csv', 'ppt', 'pptx'
}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 256 * 1024 * 1024  # 256 MB 文件大小限制

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 用户管理 (保持不变)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# 邮件配置
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USERNAME = 'lightconefrank@gmail.com'  # 替换为您的Gmail
SMTP_PASSWORD = 'bbub ogts cokw rieg'     # 使用应用专用密码

# 验证码存储
verification_codes = {}

def send_verification_email(email, code):
    try:
        # 创建邮件
        msg = MIMEMultipart()
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = '学生作业系统 - 注册验证码'

        body = f'您的验证码是：{code}\n请在5分钟内完成注册。'
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [email], msg.as_string())
        
        return True
    except Exception as e:
        logging.error(f'Email sending error: {e}')
        return False

@app.route('/send_verify_code', methods=['POST'])
def send_verify_code():
    data = request.json
    email = data.get('email')
    name = data.get('name')
    student_id = data.get('student_id')

    if not all([email, name, student_id]):
        return jsonify({'status': 'error', 'message': '信息不完整'})

    # 检查用户是否已存在
    users = load_users()
    print(users)
    if any(user.get('email') == email or user.get('student_id') == student_id for user in users.values()):
        return jsonify({'status': 'error', 'message': '邮箱或学号已被注册'})

    # 生成6位数字验证码
    code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    # 存储验证码，5分钟有效
    verification_codes[email] = {
        'code': code,
        'name': name,
        'student_id': student_id
    }

    # 发送验证码
    if send_verification_email(email, code):
        return jsonify({'status': 'success', 'message': '验证码已发送'})
    else:
        return jsonify({'status': 'error', 'message': '验证码发送失败'})

# Add this class to extend User with role support
class User(UserMixin):
    def __init__(self, username, is_admin=False):
        self.id = username
        self.is_admin = is_admin

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return self.id

def load_users():
    try:
        with open('users.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_users(users):
    with open('users.json', 'w') as f:
        json.dump(users, f)

def create_user(username, password):
    users = load_users()
    users[username] = generate_password_hash(password)
    save_users(users)

def validate_user(username, password):
    logging.info(f'Validating user: {username}')
    logging.info(f'Password: {password}')
    users = load_users()
    return (username in users) and check_password_hash(users[username]['password'], password)

# Update the load_user function
@login_manager.user_loader
def load_user(user_id):
    users = load_users()
    if user_id in users:
        return User(user_id, users[user_id].get('is_admin', False))
    elif user_id == ADMIN_USERNAME:
        return User(ADMIN_USERNAME, True)
    return None

# Load and save assignments functionality
def load_assignments():
    try:
        with open('assignments.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_assignments(assignments):
    with open('assignments.json', 'w', encoding='utf-8') as f:
        json.dump(assignments, f, ensure_ascii=False, indent=2)

# Admin required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

# Admin login route
@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    if current_user.is_authenticated and current_user.is_admin:
        return redirect(url_for('admin_dashboard'))
        
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
            user = User(ADMIN_USERNAME, True)
            login_user(user)
            return redirect(url_for('admin_dashboard'))
        
        return render_template('admin_login.html', error='用户名或密码错误')
    
    return render_template('admin_login.html')

# Admin dashboard route
@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    # 获取课程配置
    course_config = load_course_config()
    courses = [course['name'] for course in course_config['courses']]
    
    return render_template('admin.html', 
                          courses=courses, 
                          course_config=course_config, 
                          admin_name=ADMIN_USERNAME)


# API routes for admin functionality

# Get all assignments
@app.route('/admin/assignments', methods=['GET'])
@admin_required
def get_assignments():
    assignments = load_assignments()
    
    # Calculate submission count for each assignment
    for assignment in assignments:
        course = assignment['course']
        assignment_name = assignment['name']
        
        # Create path to assignment directory
        assignment_path = os.path.join(app.config['UPLOAD_FOLDER'], course, assignment_name)
        
        # Count student folders if the directory exists
        if os.path.exists(assignment_path):
            student_folders = [f for f in os.listdir(assignment_path) 
                              if os.path.isdir(os.path.join(assignment_path, f)) 
                              and not f.endswith('.zip')]
            assignment['submissionCount'] = len(student_folders)
        else:
            assignment['submissionCount'] = 0
            
        # Calculate status based on due date
        due_date = datetime.datetime.fromisoformat(assignment['dueDate'])
        assignment['status'] = 'expired' if due_date < datetime.datetime.now() else 'active'
    
    return jsonify({'assignments': assignments})

# Create new assignment
@app.route('/admin/assignments', methods=['POST'])
@admin_required
def create_assignment():
    data = request.json
    assignments = load_assignments()
    
    # Generate new ID
    new_id = str(max([int(a['id']) for a in assignments], default=0) + 1)
    
    # Create new assignment object
    new_assignment = {
        'id': new_id,
        'course': data['course'],
        'name': data['name'],
        'dueDate': data['dueDate'],
        'description': data.get('description', ''),
        'createdAt': datetime.datetime.now().isoformat()
    }
    
    # Add to assignments and save
    assignments.append(new_assignment)
    save_assignments(assignments)
    
    # Update course config if this is a new assignment for a course
    course_config = load_course_config()
    for course in course_config['courses']:
        if course['name'] == data['course'] and data['name'] not in course['assignments']:
            course['assignments'].append(data['name'])
    
    # Save updated course config
    with open('course_config.json', 'w', encoding='utf-8') as f:
        json.dump(course_config, f, ensure_ascii=False, indent=2)
    
    return jsonify({'status': 'success', 'assignment': new_assignment})

# Update existing assignment
@app.route('/admin/assignments/<assignment_id>', methods=['PUT'])
@admin_required
def update_assignment(assignment_id):
    data = request.json
    assignments = load_assignments()
    
    # Find assignment by ID
    for i, assignment in enumerate(assignments):
        if assignment['id'] == assignment_id:
            # Update assignment
            assignments[i]['course'] = data['course']
            assignments[i]['name'] = data['name']
            assignments[i]['dueDate'] = data['dueDate']
            assignments[i]['description'] = data.get('description', '')
            assignments[i]['updatedAt'] = datetime.datetime.now().isoformat()
            
            # Save changes
            save_assignments(assignments)
            return jsonify({'status': 'success', 'assignment': assignments[i]})
    
    return jsonify({'status': 'error', 'message': '作业不存在'}), 404

# Delete assignment
@app.route('/admin/assignments/<assignment_id>', methods=['DELETE'])
@admin_required
def delete_assignment(assignment_id):
    assignments = load_assignments()
    
    # Find assignment by ID
    for i, assignment in enumerate(assignments):
        if assignment['id'] == assignment_id:
            course = assignment['course']
            name = assignment['name']
            
            # Remove assignment from list
            deleted = assignments.pop(i)
            save_assignments(assignments)
            
            # Update course config
            course_config = load_course_config()
            for course_item in course_config['courses']:
                if course_item['name'] == course and name in course_item['assignments']:
                    course_item['assignments'].remove(name)
            
            with open('course_config.json', 'w', encoding='utf-8') as f:
                json.dump(course_config, f, ensure_ascii=False, indent=2)
            
            # Optionally: Delete assignment directory
            assignment_dir = os.path.join(app.config['UPLOAD_FOLDER'], course, name)
            if os.path.exists(assignment_dir):
                shutil.rmtree(assignment_dir)
            
            return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error', 'message': '作业不存在'}), 404

@app.route('/admin/submissions', methods=['GET'])
@admin_required
def get_submissions():
    course = request.args.get('course')
    assignment = request.args.get('assignment')
    
    if not course or not assignment:
        return jsonify({'submissions': [], 'stats': None})
    
    # Get assignment details
    assignments = load_assignments()
    assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment), None)
    
    # If assignment doesn't exist in assignments.json but does exist in course_config, create a default assignment object
    if not assignment_obj:
        course_config = load_course_config()
        for course_item in course_config['courses']:
            if course_item['name'] == course and assignment in course_item['assignments']:
                # Create a default assignment object
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
    
    # Format due date for display
    due_date = datetime.datetime.fromisoformat(assignment_obj['dueDate'])
    due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
    
    # Create path to assignment directory
    assignment_path = os.path.join(app.config['UPLOAD_FOLDER'], course, assignment)
    
    # Get all users for student count
    users = load_users()
    student_count = sum(1 for user in users.values() if not user.get('is_admin', False))
    
    submissions = []
    
    # Check if the assignment directory exists
    if os.path.exists(assignment_path):
        # Get student folders
        student_folders = [f for f in os.listdir(assignment_path) 
                          if os.path.isdir(os.path.join(assignment_path, f)) 
                          and not f.endswith('.zip')]
        
        for folder in student_folders:
            # Folder name format: student_id_name
            parts = folder.split('_', 1)
            if len(parts) < 2:
                continue
                
            student_id = parts[0]
            student_name = parts[1]
            folder_path = os.path.join(assignment_path, folder)
            
            # Get files in the folder
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
            
            # Sort files by upload time, newest first
            files.sort(key=lambda x: x['uploadTime'], reverse=True)
            
            submissions.append({
                'studentId': student_id,
                'studentName': student_name,
                'submissionTime': submission_time.isoformat(),
                'fileCount': len(files),
                'files': files
            })
        
        # Sort submissions by submission time, newest first
        submissions.sort(key=lambda x: x['submissionTime'], reverse=True)
    
    # Calculate statistics
    submission_count = len(submissions)
    submission_rate = f"{(submission_count / student_count * 100):.1f}%" if student_count > 0 else "0%"
    
    stats = {
        'totalStudents': student_count,
        'submittedCount': submission_count,
        'submissionRate': submission_rate,
        'dueDateStr': due_date_str
    }
    
    return jsonify({'submissions': submissions, 'stats': stats})

# Helper function to format file size
def format_file_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

# Serve individual file
@app.route('/admin/file/<course>/<assignment>/<folder>/<filename>')
@admin_required
def serve_file(course, assignment, folder, filename):
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], course, assignment, folder, filename)
    directory = os.path.join(app.config['UPLOAD_FOLDER'], course, assignment, folder)
    
    if not os.path.exists(file_path):
        return "文件不存在", 404
    
    return send_from_directory(directory, filename)

# Download single student submission or all submissions for an assignment
@app.route('/admin/download')
@admin_required
def download_submissions():
    course = request.args.get('course')
    assignment = request.args.get('assignment')
    student = request.args.get('student')
    
    if not course or not assignment:
        return "Missing parameters", 400
    
    assignment_path = os.path.join(app.config['UPLOAD_FOLDER'], course, assignment)
    
    if not os.path.exists(assignment_path):
        return "Assignment not found", 404
    
    # Temporary directory for preparing the download
    temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    
    if student:
        # Download single student submission
        student_folders = [f for f in os.listdir(assignment_path) 
                          if os.path.isdir(os.path.join(assignment_path, f)) 
                          and f.startswith(student)]
        
        if not student_folders:
            return "Student submission not found", 404
        
        student_folder = student_folders[0]
        student_path = os.path.join(assignment_path, student_folder)
        
        # Create zip file
        zip_filename = f"{course}_{assignment}_{student_folder}_{timestamp}.zip"
        zip_path = os.path.join(temp_dir, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(student_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, student_path)
                    zipf.write(file_path, arcname=arcname)
        
        # Serve the zip file
        return send_from_directory(temp_dir, zip_filename, as_attachment=True, 
                                  attachment_filename=zip_filename)
    else:
        # Download all submissions
        # Check if a combined zip already exists and is recent (less than 1 hour old)
        existing_zips = [f for f in os.listdir(assignment_path) 
                         if f.endswith('.zip') and f.startswith(f"{course}_{assignment}_all_")]
        
        if existing_zips:
            # Get the most recent zip
            most_recent = max(existing_zips, key=lambda f: os.path.getmtime(os.path.join(assignment_path, f)))
            most_recent_path = os.path.join(assignment_path, most_recent)
            
            # Check if it's less than 1 hour old
            mtime = os.path.getmtime(most_recent_path)
            if (datetime.datetime.now() - datetime.datetime.fromtimestamp(mtime)).total_seconds() < 3600:
                # Serve the existing zip
                return send_from_directory(assignment_path, most_recent, as_attachment=True)
        
        # Create a new zip file with all submissions
        zip_filename = f"{course}_{assignment}_all_{timestamp}.zip"
        zip_path = os.path.join(assignment_path, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Get all student folders
            student_folders = [f for f in os.listdir(assignment_path) 
                              if os.path.isdir(os.path.join(assignment_path, f)) 
                              and not f.endswith('.zip')]
            
            for folder in student_folders:
                folder_path = os.path.join(assignment_path, folder)
                
                for root, _, files in os.walk(folder_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Use student folder as the top-level directory in the zip
                        arcname = os.path.join(folder, os.path.relpath(file_path, folder_path))
                        zipf.write(file_path, arcname=arcname)
        
        # Serve the zip file
        return send_from_directory(assignment_path, zip_filename, as_attachment=True)

# Create a simple admin login template
@app.route('/admin_login_template')
def admin_login_template():
    return render_template('admin_login.html')


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if validate_user(username, password):
            user = User(username)
            login_user(user)
            return redirect(url_for('upload_file'))
        return '登录失败，请检查用户名和密码'
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# 压缩文件的函数
def compress_file(original_filepath, zip_filepath):
    try:
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 将文件压缩到 zip 中，arcname 用于在压缩包内存储的文件名
            zipf.write(original_filepath, arcname=os.path.basename(original_filepath))
        logging.info(f'File compressed to zip: {zip_filepath}')
        os.remove(original_filepath)
    except Exception as e:
        logging.error(f'Error compressing file {original_filepath}: {e}')


@app.route('/', methods=['GET', 'POST'])
@login_required
def upload_file():
    # 获取课程列表
    courses = ['GNSS', 'DIP', '地理学原理', '误差理论']
    
    if request.method == 'POST':
        # 获取课程和作业名称
        course = request.form.get('course')
        assignment_name = request.form.get('assignment_name')
        
        # 检查课程和作业名称
        if not course or not assignment_name:
            return jsonify({'status': 'error', 'message': '请选择课程并输入作业名称'}), 400

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
            student_id = load_users()[current_user.id]['student_id']
            # 将用户ID、课程和作业名称加入文件名
            filename = f"{student_id}_{current_user.id}_{course}_{assignment_name}{ext}"
            
            # 确保文件名唯一
            counter = 1
            upload_folder = app.config['UPLOAD_FOLDER']
            file_path = os.path.join(upload_folder, filename)
            while os.path.exists(file_path):
                filename = f"{current_user.id}_{course}_{assignment_name}_{base}_{counter}{ext}"
                file_path = os.path.join(upload_folder, filename)
                counter += 1
            
            # 保存文件
            file.save(file_path)
            logging.info(f'File uploaded successfully: {filename}')

            # 如果文件不是 zip 文件，则在新线程中压缩它
            if ext.lower() != '.zip':
                # 构造新的 zip 文件名，注意这里可以修改为你希望的命名格式，
                # 比如将后缀改为 .zip
                zip_filename = f"{student_id}_{current_user.id}_{course}_{assignment_name}.zip"
                zip_filepath = os.path.join(upload_folder, zip_filename)
                t = threading.Thread(target=compress_file, args=(file_path, zip_filepath))
                t.start()
            
            return jsonify({
                'status': 'success', 
                'message': '文件上传成功', 
                'filename': filename
            }), 200
        
        except Exception as e:
            # 详细的错误日志
            logging.error(f'Upload error: {str(e)}')
            return jsonify({
                'status': 'error', 
                'message': f'文件上传失败: {str(e)}'
            }), 500
    
    return render_template('upload.html', courses=courses)


@app.route('/files/<filename>')
@login_required
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/register', methods=['GET'])
def show_register():
    return render_template('register.html')

@app.route('/register', methods=['POST'], strict_slashes=False)
def register():
    data = request.json
    email = data.get('email')
    verify_code = data.get('verify_code')
    password = data.get('password')

    # 验证码校验
    if email not in verification_codes:
        return jsonify({'status': 'error', 'message': '验证码已过期'})

    stored_info = verification_codes[email]
    if stored_info['code'] != verify_code:
        return jsonify({'status': 'error', 'message': '验证码错误'})

    # 提取信息
    name = stored_info['name']
    student_id = stored_info['student_id']

    # 加载现有用户
    users = load_users()

    # 创建新用户
    new_user = {
        'name': name,
        'email': email,
        'student_id': student_id,
        'password': generate_password_hash(password)
    }

    # 以姓名为用户名
    users[name] = new_user

    # 保存用户
    save_users(users)

    # 清除验证码
    del verification_codes[email]

    return jsonify({'status': 'success', 'message': '注册成功'})

if __name__ == '__main__':
    # 注意：为局域网访问，host设置为'0.0.0.0'
    app.run(host='0.0.0.0', port=5000, debug=True)