import os
from werkzeug.security import generate_password_hash

# 应用程序基础配置
SECRET_KEY = 'your_secret_key_here'  # 请更换为复杂的密钥
UPLOAD_FOLDER = 'static/upload'
MAX_CONTENT_LENGTH = 256 * 1024 * 1024  # 256 MB 文件大小限制

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 
    'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 
    'mp3', 'mp4', 'csv', 'ppt', 'pptx'
}

# 管理员配置
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD_HASH = generate_password_hash('admin123')  # 生产环境中请修改

# 验证码设置
VERIFICATION_CODE_LENGTH = 6
VERIFICATION_CODE_EXPIRY = 300  # 5分钟，单位秒

# 发送邮件的配置
try:
    # 尝试导入实际配置文件
    from util.email_config import *
except ImportError:
    # 如果实际配置文件不存在，提供默认配置，但会导致发送邮件失败
    SMTP_SERVER = 'smtp.example.com'
    SMTP_PORT = 587
    SMTP_USERNAME = 'your_email@example.com'
    SMTP_PASSWORD = 'your_email_password'
    print("警告: 邮件配置文件不存在，请创建 util/email_config.py 文件并填写正确的邮件配置")

# 检查是否能够发送邮件
def check_email_config():
    """检查邮件配置是否有效"""
    return all([
        SMTP_SERVER != 'smtp.example.com',
        SMTP_USERNAME != 'your_email@example.com',
        SMTP_PASSWORD != 'your_email_password'
    ])

# 文件路径配置
USERS_FILE = 'users.json'
COURSE_CONFIG_FILE = 'course_config.json'
ASSIGNMENTS_FILE = 'assignments.json'

def allowed_file(filename):
    """检查文件扩展名是否允许上传"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS