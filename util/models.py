import json
import logging
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from util.config import USERS_FILE, ADMIN_USERNAME, ADMIN_PASSWORD_HASH

class User(UserMixin):
    """用户类，扩展了 UserMixin 以支持 Flask-Login 功能"""
    
    def __init__(self, username, is_admin=False, name=None, email=None, student_id=None):
        self.id = username
        self.is_admin = is_admin
        self.name = name
        self.email = email
        self.student_id = student_id

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
    
    @staticmethod
    def load_user(user_id):
        """根据用户ID加载用户对象"""
        users = load_users()
        if user_id in users:
            user_data = users[user_id]
            return User(
                user_id, 
                user_data.get('is_admin', False),
                user_data.get('name'),
                user_data.get('email'),
                user_data.get('student_id')
            )
        elif user_id == ADMIN_USERNAME:
            return User(ADMIN_USERNAME, True)
        return None


def load_users():
    """加载用户数据"""
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_users(users):
    """保存用户数据"""
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def create_user(username, password, name=None, email=None, student_id=None, is_admin=False):
    """创建新用户"""
    users = load_users()
    
    # 创建用户数据
    users[username] = {
        'password': generate_password_hash(password),
        'is_admin': is_admin
    }
    
    # 添加可选字段
    if name:
        users[username]['name'] = name
    if email:
        users[username]['email'] = email
    if student_id:
        users[username]['student_id'] = student_id
    
    save_users(users)
    return True

def validate_user(username, password):
    """验证用户凭据"""
    logging.info(f'Validating user: {username}')
    
    # 检查是否是管理员
    if username == ADMIN_USERNAME:
        return check_password_hash(ADMIN_PASSWORD_HASH, password)
    
    # 检查普通用户
    users = load_users()
    if username in users:
        return check_password_hash(users[username]['password'], password)
    
    return False