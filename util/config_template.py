#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
配置文件模板
请基于此模板创建 config.py 文件并填写正确的参数
"""
from werkzeug.security import generate_password_hash, check_password_hash

# SMTP服务器配置（用于发送验证邮件）
SMTP_SERVER = 'smtp.example.com'  # SMTP服务器地址
SMTP_PORT = 587  # SMTP服务器端口
SMTP_USERNAME = 'your_email@example.com'  # 邮箱用户名
SMTP_PASSWORD = 'your_password'  # 邮箱密码

# 文件存储配置
UPLOAD_FOLDER = 'static/upload'  # 文件上传目录
MAX_CONTENT_LENGTH = 256 * 1024 * 1024  # 最大文件大小限制 (256MB)

# 应用配置
SECRET_KEY = 'your_secret_key_here'  # Flask应用密钥，请修改为随机字符串
DEBUG = True  # 是否开启调试模式
PORT = 10099  # 应用运行端口

# Add the following configuration constants
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD_HASH = generate_password_hash('admin123')  # Change this in production!