"""
作业传输系统 - 数据模型模块

本模块定义系统的数据模型和数据持久化操作，主要功能包括：
- 定义用户类(User)以支持Flask-Login
- 用户数据的加载和保存
- 用户创建与验证
- 用户资料更新

User类提供以下功能：
- 支持Flask-Login的用户认证接口
- 区分普通用户和管理员
- 提供用户资料加载与更新方法

作者: Frank
版本: 1.0
日期: 2025-04-04
"""

import json
import logging
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from util.config import USERS_FILE, ADMIN_USERNAME, ADMIN_PASSWORD_HASH

class User(UserMixin):
    """用户类，扩展了 UserMixin 以支持 Flask-Login 功能"""
    
    def __init__(self, username, is_admin=False, name=None, email=None, student_id=None, class_name=None, managed_classes=None):
        self.id = username
        self.is_admin = is_admin
        self.name = name
        self.email = email
        self.student_id = student_id
        self.class_name = class_name  # 学生所在班级
        self.managed_classes = managed_classes or []  # 管理员管理的班级列表，仅用于管理员

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
    
    def can_manage_class(self, class_name):
        """
        检查管理员是否有权限管理某个班级
        
        Args:
            class_name (str): 班级名称
        
        Returns:
            bool: 是否有权限
        """
        if not self.is_admin:
            return False
        
        # 内置管理员(从config导入的)可以管理所有班级
        from util.config import ADMIN_USERNAME
        if self.id == ADMIN_USERNAME:
            return True
        
        # 其他管理员只能管理被分配的班级
        return class_name in self.managed_classes
    
    @staticmethod
    def load_user(user_id):
        """根据用户ID加载用户对象"""
        from util.config import ADMIN_USERNAME
        from util.admin_auth import get_admin_managed_classes
        
        # 检查是否是内置管理员
        if user_id == ADMIN_USERNAME:
            # 内置管理员可以管理所有班级
            admin = User(ADMIN_USERNAME, True)
            admin.managed_classes = []  # 空列表表示可以管理所有班级
            return admin
            
        # 检查是否是自定义管理员
        from util.admin_auth import load_admins
        admins = load_admins()
        if user_id in admins:
            admin = User(user_id, True)
            admin.managed_classes = admins[user_id].get('managed_classes', [])
            return admin
        
        # 普通用户
        users = load_users()
        if user_id in users:
            user_data = users[user_id]
            return User(
                user_id, 
                user_data.get('is_admin', False),
                user_data.get('name'),
                user_data.get('email'),
                user_data.get('student_id'),
                user_data.get('class_name')
            )
        
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

# 在User类中添加一个方法
def update_profile(self, new_username=None, new_password=None):
    """更新用户资料"""
    users = load_users()
    if new_username and new_username != self.id:
        # 检查用户名是否已存在
        if new_username in users:
            return False, "用户名已存在"
            
        # 复制用户数据到新用户名
        users[new_username] = users[self.id].copy()
        # 删除旧用户数据
        del users[self.id]
        # 更新当前对象的ID
        self.id = new_username
    
    if new_password:
        # 更新密码
        users[self.id]['password'] = generate_password_hash(new_password)
    
    save_users(users)
    return True, "更新成功"