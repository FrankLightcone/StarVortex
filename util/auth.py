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
版本: 1.1
日期: 2025-04-04
"""

import logging
from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from functools import wraps

from util.models import User, validate_user, load_users, save_users
from util.utils import verification_codes, send_verification_email, generate_verification_code, reset_codes, send_reset_password_email, get_all_classes
from util.config import ADMIN_USERNAME, ADMIN_PASSWORD_HASH
# 导入新增的管理员认证模块
from util.admin_auth import validate_admin, get_admin_managed_classes, check_admin_class_permission

from werkzeug.security import generate_password_hash, check_password_hash
from util.email_config import SMTP_TEST_USERNAME

import random
import string
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

# 管理员权限校验装饰器，增加debug信息
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 添加调试日志
        logging.info(f"Admin check: authenticated={current_user.is_authenticated}, is_admin={getattr(current_user, 'is_admin', False)}")
        
        if not current_user.is_authenticated or not current_user.is_admin:
            logging.warning(f"Unauthorized access attempt to admin area: {request.path}")
            return redirect(url_for('auth.admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def class_permission_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 确保用户是已认证的管理员
        if not current_user.is_authenticated or not current_user.is_admin:
            logging.warning(f"Unauthorized access attempt to admin area: {request.path}")
            return redirect(url_for('auth.admin_login'))
        
        # 获取请求中的班级名称
        class_name = request.args.get('class_name') or kwargs.get('class_name')
        
        # 如果请求中没有班级名称，则直接允许访问
        if not class_name:
            return f(*args, **kwargs)
        
        # 验证班级权限
        if check_admin_class_permission(current_user.id, class_name):
            return f(*args, **kwargs)
        else:
            logging.warning(f"Admin {current_user.id} attempted to access unauthorized class: {class_name}")
            return jsonify({
                'status': 'error', 
                'message': f'您没有权限管理班级 "{class_name}"'
            }), 403
    
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
    # 获取班级信息
    classes = get_all_classes()
    if not classes:
        logging.error("No classes available for registration")
        return render_template('register.html', error='没有可用的班级信息，请联系管理员')
    # 传递班级信息到模板
    return render_template('register.html', classes=classes)

@auth_bp.route('/register', methods=['POST'])
def register():
    """处理注册请求"""
    data = request.json
    email = data.get('email')
    verify_code = data.get('verify_code')
    password = data.get('password')
    class_name = data.get('class_name')  # 新增班级字段

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
        'password': generate_password_hash(password),
        'class_name': class_name  # 保存班级信息
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
    class_name = data.get('class_name')  # 新增班级字段

    if not all([email, name, student_id, class_name]):  # 增加班级检查
        return jsonify({'status': 'error', 'message': '信息不完整'})

    # 将发送邮箱号定位测试邮箱白名单，可多次注册
    test_emails = SMTP_TEST_USERNAME
    
    # 如果不是测试邮箱，则检查是否已被注册、是否符合邮箱格式
    if email not in test_emails:
        # 检查用户是否已存在
        users = load_users()
        if any(user.get('email') == email or user.get('student_id') == student_id for user in users.values()):
            return jsonify({'status': 'error', 'message': '邮箱或学号已被注册'})
    
        if not (email.endswith('@mail2.sysu.edu.cn') or email.endswith('@mail.sysu.edu.cn')):
            return jsonify({'status': 'error', 'message': '请使用 mail2.sysu.edu.cn 或 mail.sysu.edu.cn 邮箱进行注册'})

    # 生成6位数字验证码
    code = generate_verification_code()
    
    # 存储验证码，5分钟有效
    verification_codes[email] = {
        'code': code,
        'name': name,
        'student_id': student_id,
        'class_name': class_name  # 存储班级信息
    }

    # 发送验证码
    if send_verification_email(email, code):
        return jsonify({'status': 'success', 'message': '验证码已发送'})
    else:
        return jsonify({'status': 'error', 'message': '验证码发送失败'})

@auth_bp.route('/admin', methods=['GET', 'POST'])
def admin_login():
    """管理员登录页面"""
    # 检查用户是否已经登录并且是管理员
    if current_user.is_authenticated and current_user.is_admin:
        # 调试日志
        logging.info(f"Admin already logged in: {current_user.id}, is_admin={current_user.is_admin}")
        # 确保重定向的URL是正确的
        return redirect('/admin/dashboard')  # 直接使用硬编码路径而不是url_for
        
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        logging.info(f"Admin login attempt: {username}")
        
        # 使用新的管理员验证函数
        if validate_admin(username, password):
            # 获取管理员可管理的班级
            managed_classes = get_admin_managed_classes(username)
            
            # 创建管理员用户实例，并存储可管理的班级
            user = User(username, True)
            user.managed_classes = managed_classes  # 添加可管理班级属性
            
            logging.info(f"Admin login successful: {user.id}, is_admin={user.is_admin}, managed_classes={managed_classes}")
            
            # 登录用户
            login_user(user)
            
            # 确保是否加载各种属性正确
            if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
                logging.error(f"Admin flag not set correctly after login: {current_user}")
            
            # 确保重定向的URL是正确的
            return redirect('/admin/dashboard')  # 直接使用硬编码路径
        
        logging.warning(f"Admin login failed: {username}")
        return render_template('admin_login.html', error='用户名或密码错误')
    
    return render_template('admin_login.html')

@auth_bp.route('/reset_password', methods=['GET'])
def show_reset_password():
    """显示重置密码页面"""
    return render_template('reset_password.html')

@auth_bp.route('/send_reset_code', methods=['POST'])
def send_reset_code():
    """发送密码重置验证码"""
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'status': 'error', 'message': '邮箱地址不能为空'})
    
    # 检查邮箱是否存在
    users = load_users()
    user_found = False
    for username, user_info in users.items():
        if user_info.get('email') == email:
            user_found = True
            break
    
    if not user_found:
        return jsonify({'status': 'error', 'message': '该邮箱未注册'})
    
    # 生成8位随机验证码（数字和大写字母组合）
    code_characters = string.ascii_uppercase + string.digits
    reset_code = ''.join(random.choice(code_characters) for _ in range(8))
    
    # 存储验证码，5分钟有效期
    expiry_time = datetime.now() + timedelta(minutes=5)
    reset_codes[email] = {
        'code': reset_code,
        'expiry': expiry_time
    }
    
    # 使用工具函数发送验证码邮件
    if send_reset_password_email(email, reset_code):
        return jsonify({'status': 'success', 'message': '验证码已发送'})
    else:
        return jsonify({'status': 'error', 'message': '发送验证码失败，请稍后重试'})

@auth_bp.route('/verify_reset_code', methods=['POST'])
def verify_reset_code():
    """验证密码重置验证码"""
    data = request.json
    email = data.get('email')
    code = data.get('code')
    
    if not email or not code:
        return jsonify({'status': 'error', 'message': '参数不完整'})
    
    # 检查验证码是否存在
    if email not in reset_codes:
        return jsonify({'status': 'error', 'message': '验证码已过期或不存在'})
    
    reset_info = reset_codes[email]
    
    # 检查验证码是否过期
    if datetime.now() > reset_info['expiry']:
        # 删除过期验证码
        del reset_codes[email]
        return jsonify({'status': 'error', 'message': '验证码已过期'})
    
    # 检查验证码是否正确
    if reset_info['code'] != code:
        return jsonify({'status': 'error', 'message': '验证码错误'})
    
    # 验证通过
    return jsonify({'status': 'success', 'message': '验证成功'})

@auth_bp.route('/reset_password', methods=['POST'])
def reset_password():
    """重置密码"""
    data = request.json
    email = data.get('email')
    code = data.get('code')
    password = data.get('password')
    
    if not email or not code or not password:
        return jsonify({'status': 'error', 'message': '参数不完整'})
    
    # 检查验证码是否存在
    if email not in reset_codes:
        return jsonify({'status': 'error', 'message': '验证码已过期或不存在'})
    
    reset_info = reset_codes[email]
    
    # 检查验证码是否过期
    if datetime.now() > reset_info['expiry']:
        # 删除过期验证码
        del reset_codes[email]
        return jsonify({'status': 'error', 'message': '验证码已过期'})
    
    # 检查验证码是否正确
    if reset_info['code'] != code:
        return jsonify({'status': 'error', 'message': '验证码错误'})
    
    # 查找对应邮箱的用户
    users = load_users()
    user_updated = False
    
    for username, user_info in users.items():
        if user_info.get('email') == email:
            # 更新用户密码
            users[username]['password'] = generate_password_hash(password)
            user_updated = True
            break
    
    if not user_updated:
        return jsonify({'status': 'error', 'message': '用户不存在'})
    
    # 保存更新后的用户信息
    save_users(users)
    
    # 删除验证码
    del reset_codes[email]
    
    return jsonify({'status': 'success', 'message': '密码重置成功'})