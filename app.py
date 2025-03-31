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

app.config['APP_ALREADY_STARTED'] = False  # 用于标记应用是否已经启动

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 用户管理 (保持不变)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

try:
    # 尝试导入实际配置文件
    from util.config import *
except ImportError:
    # 如果实际配置文件不存在，提示用户创建
    print("警告: 配置文件不存在，请基于config_template.py创建config.py文件并填写正确的配置信息")
    # 可选: 退出程序
    import sys
    sys.exit(1)

# 验证码存储
verification_codes = {}

# 添加配置文件读取函数
def load_course_config():
    try:
        with open('course_config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # 默认配置
        default_config = {
            "courses": [
                {
                    "name": "GNSS",
                    "assignments": ["实验1", "实验2", "大作业"]
                },
                {
                    "name": "DIP",
                    "assignments": ["实验1", "实验2", "实验3", "期末大作业"]
                },
                {
                    "name": "地理学原理",
                    "assignments": ["作业1", "作业2", "期中论文", "期末论文"]
                },
                {
                    "name": "误差理论",
                    "assignments": ["作业1", "作业2", "作业3", "期末报告"]
                }
            ]
        }
        # 创建默认配置文件
        with open('course_config.json', 'w', encoding='utf-8') as f:
            json.dump(default_config, f, ensure_ascii=False, indent=2)
        return default_config
    
# 新增压缩文件夹的函数
def compress_folder(folder_path, zip_filepath):
    try:
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 遍历文件夹
            for root, _, files in os.walk(folder_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    # 计算相对路径，保留文件夹结构
                    arcname = os.path.relpath(file_path, os.path.dirname(folder_path))
                    zipf.write(file_path, arcname=arcname)
        logging.info(f'Folder compressed to zip: {zip_filepath}')
    except Exception as e:
        logging.error(f'Error compressing folder {folder_path}: {e}')

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

class User(UserMixin):
    def __init__(self, username):
        self.id = username

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

@login_manager.user_loader
def load_user(user_id):
    return User(user_id) if user_id in load_users() else None

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


# 修改上传路由
@app.route('/', methods=['GET', 'POST'])
@login_required
def upload_file():
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
            student_id = load_users()[current_user.id]['student_id']
            
            # 创建课程和作业文件夹结构
            course_folder = os.path.join(app.config['UPLOAD_FOLDER'], course)
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

# 应用启动前，确保课程配置文件存在
@app.before_request
def initialize_app():
    if not app.config['APP_ALREADY_STARTED']:
        # 在第一个请求时执行代码
        app.config['APP_ALREADY_STARTED'] = True
        # 确保上传目录存在
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # 加载课程配置
        load_course_config()
        
        # 确保用户数据文件存在
        if not os.path.exists('users.json'):
            save_users({})

# 新增API端点，用于获取特定课程的作业列表
@app.route('/get_assignments', methods=['GET'])
def get_assignments():
    course = request.args.get('course')
    if not course:
        return jsonify({'assignments': []})
    
    config = load_course_config()
    for course_config in config['courses']:
        if course_config['name'] == course:
            return jsonify({'assignments': course_config['assignments']})
    
    return jsonify({'assignments': []})

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
    app.run(host='0.0.0.0', port=10099, debug=True)