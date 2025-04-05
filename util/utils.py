"""
作业传输系统 - 通用工具函数模块

本模块提供系统中各个组件共用的工具函数，包括：
- 邮件发送功能
- 验证码生成和管理
- 文件压缩与处理
- 文件大小格式化
- 课程配置和作业数据的加载与保存

module包含以下主要组件：
- 验证码临时存储字典
- 邮件发送函数
- 文件压缩函数
- 配置文件处理函数

作者: Frank
版本: 1.1
日期: 2025-04-04
"""

import os
import json
import logging
import zipfile
import smtplib
import random
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from util.config import (
    SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
    COURSE_CONFIG_FILE, ASSIGNMENTS_FILE, VERIFICATION_CODE_LENGTH
)

# 验证码存储 (内存字典，重启后会清空)
verification_codes = {}
# 新增：用于密码重置的验证码存储（键为邮箱，值为包含验证码和过期时间的字典）
reset_codes = {}

def send_verification_email(email, code):
    """
    发送注册验证码邮件
    
    Args:
        email (str): 接收邮件的地址
        code (str): 注册验证码
        
    Returns:
        bool: 邮件发送是否成功
    """
    try:
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = '作业提交系统 - 注册验证码'

        # 纯文本邮件内容（兼容不支持HTML的邮件客户端）
        with open(r'util\email_content\verification_txt.txt', 'r', encoding='utf-8') as f:
            text_content = f.read()
        # 替换验证码占位符
        text_content = text_content.format(code=code)
        
        # HTML邮件内容
        with open(r'util\email_content\verification_html.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        # 替换验证码占位符
        html_content = html_content.format(code=code, year=datetime.datetime.now().year)
        
        # 添加两种格式的内容
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        
        # 先添加纯文本格式，再添加HTML格式
        # （邮件客户端会优先显示后添加的HTML格式，不支持HTML的客户端则显示纯文本）
        msg.attach(part1)
        msg.attach(part2)

        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [email], msg.as_string())
        
        logging.info(f'Verification email sent to {email}')
        return True
    except Exception as e:
        logging.error(f'Email sending error: {e}')
        return False

def send_reset_password_email(email, code):
    """
    发送密码重置验证码邮件
    
    Args:
        email (str): 接收邮件的地址
        code (str): 重置密码验证码
        
    Returns:
        bool: 邮件发送是否成功
    """
    try:
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = '作业提交系统 - 密码重置验证码'

        # 纯文本邮件内容（兼容不支持HTML的邮件客户端）
        with open(r'util\email_content\reset_password_txt.txt', 'r', encoding='utf-8') as f:
            text_content = f.read()
        text_content = text_content.format(code=code)
        
        # HTML邮件内容
        with open(r'util\email_content\reset_password_html.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        # 替换验证码占位符
        html_content = html_content.format(code=code, year=datetime.datetime.now().year)
        
        # 添加两种格式的内容
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        
        # 先添加纯文本格式，再添加HTML格式
        # （邮件客户端会优先显示后添加的HTML格式，不支持HTML的客户端则显示纯文本）
        msg.attach(part1)
        msg.attach(part2)

        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [email], msg.as_string())
        
        logging.info(f'Reset password email sent to {email}')
        return True
    except Exception as e:
        logging.error(f'Error sending reset password email to {email}: {e}')
        return False

def generate_verification_code():
    """生成数字验证码"""
    return ''.join([str(random.randint(0, 9)) for _ in range(VERIFICATION_CODE_LENGTH)])

def compress_folder(folder_path, zip_filepath):
    """将文件夹压缩为zip文件"""
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
        return True
    except Exception as e:
        logging.error(f'Error compressing folder {folder_path}: {e}')
        return False

def compress_file(original_filepath, zip_filepath):
    """压缩单个文件为zip文件"""
    try:
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 将文件压缩到 zip 中，arcname 用于在压缩包内存储的文件名
            zipf.write(original_filepath, arcname=os.path.basename(original_filepath))
        logging.info(f'File compressed to zip: {zip_filepath}')
        
        # 压缩成功后删除原始文件
        os.remove(original_filepath)
        return True
    except Exception as e:
        logging.error(f'Error compressing file {original_filepath}: {e}')
        return False

def format_file_size(size_bytes):
    """格式化文件大小显示"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

def load_course_config():
    """加载课程配置"""
    try:
        with open(COURSE_CONFIG_FILE, 'r', encoding='utf-8') as f:
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
        with open(COURSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, ensure_ascii=False, indent=2)
        return default_config

def load_assignments():
    """加载作业列表"""
    try:
        with open(ASSIGNMENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_assignments(assignments):
    """保存作业列表"""
    with open(ASSIGNMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(assignments, f, ensure_ascii=False, indent=2)