"""
作业传输系统 - 用户认证模块

本模块负责处理用户认证相关的所有功能，包括：
- 学生登录与注销
- 管理员登录验证
- 新用户注册及邮箱验证
- 生成和验证验证码
- 权限控制装饰器(admin_required)

该模块定义了以下路由：
- /login: 学生登录页面
- /logout: 用户注销
- /register: 学生注册
- /send_verify_code: 发送验证码
- /admin: 管理员登录

作者: Frank
版本: 1.0
日期: 2025-04-04
"""

import logging
from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from functools import wraps

from util.models import User, validate_user, load_users, save_users
from util.utils import verification_codes, send_verification_email, generate_verification_code
from util.config import ADMIN_USERNAME, ADMIN_PASSWORD_HASH

from werkzeug.security import generate_password_hash, check_password_hash
from util.email_config import SMTP_USERNAME

auth_bp = Blueprint('auth', __name__)

# 管理员权限校验装饰器
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return redirect(url_for('auth.admin_login'))
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """学生登录页面"""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if validate_user(username, password):
            # 创建用户对象并登录
            user = User.load_user(username)
            login_user(user)
            return redirect(url_for('student.upload_file'))
        
        # 登录失败
        return render_template('login.html', error='登录失败，请检查用户名和密码')
    
    # GET 请求
    return render_template('login.html')

@auth_bp.route('/logout')
@login_required
def logout():
    """注销用户"""
    logout_user()
    return redirect(url_for('auth.login'))

@auth_bp.route('/register', methods=['GET'])
def show_register():
    """显示注册页面"""
    return render_template('register.html')

@auth_bp.route('/register', methods=['POST'])
def register():
    """处理注册请求"""
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

    # 检查用户是否已存在
    if name in users:
        return jsonify({'status': 'error', 'message': '用户名已存在'})

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

@auth_bp.route('/send_verify_code', methods=['POST'])
def send_verify_code():
    """发送验证码"""
    data = request.json
    email = data.get('email')
    name = data.get('name')
    student_id = data.get('student_id')

    if not all([email, name, student_id]):
        return jsonify({'status': 'error', 'message': '信息不完整'})

    # 将发送邮箱号定位测试邮箱白名单，可多次注册
    test_emails = [SMTP_USERNAME]
    
    # 如果不是测试邮箱，则检查是否已被注册
    if email not in test_emails:
        # 检查用户是否已存在
        users = load_users()
        if any(user.get('email') == email or user.get('student_id') == student_id for user in users.values()):
            return jsonify({'status': 'error', 'message': '邮箱或学号已被注册'})

    # 生成6位数字验证码
    code = generate_verification_code()
    
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

@auth_bp.route('/admin', methods=['GET', 'POST'])
def admin_login():
    """管理员登录页面"""
    if current_user.is_authenticated and current_user.is_admin:
        return redirect(url_for('admin.dashboard'))
        
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
            user = User(ADMIN_USERNAME, True)
            login_user(user)
            return redirect(url_for('admin.dashboard'))
        
        return render_template('admin_login.html', error='用户名或密码错误')
    
    return render_template('admin_login.html')