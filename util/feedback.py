"""
作业传输系统 - 用户反馈模块

本模块处理用户反馈的收集和发送，支持文字内容和图片附件。
主要功能包括：
- 处理用户反馈表单提交
- 构建反馈邮件（支持HTML格式）
- 将反馈内容发送到指定邮箱
- 保存附件图片

作者: Frank
版本: 1.0
日期: 2025-04-13
"""

import os
import logging
import base64
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage

from util.config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
from util.models import load_users

# 创建Blueprint
feedback_bp = Blueprint('feedback', __name__)

# 反馈接收邮箱
FEEDBACK_EMAIL = "threebody.beihai@qq.com"

# 保存上传图片的目录
FEEDBACK_IMG_DIR = 'data/feedback_images'

# 确保图片保存目录存在
os.makedirs(FEEDBACK_IMG_DIR, exist_ok=True)

@feedback_bp.route('/send_feedback', methods=['POST'])
@login_required
def send_feedback():
    """处理用户反馈提交"""
    try:
        # 获取表单数据
        content = request.form.get('content', '').strip()
        
        # 验证内容
        if not content:
            return jsonify({'status': 'error', 'message': '反馈内容不能为空'}), 400
        
        # 获取用户信息
        user_id = current_user.id
        users = load_users()
        user_data = users.get(user_id, {})
        student_id = user_data.get('student_id', '')
        email = user_data.get('email', '')
        class_name = user_data.get('class_name', '')
        
        # 构建用户信息
        user_info = {
            'name': user_id,
            'student_id': student_id,
            'email': email,
            'class_name': class_name,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # 处理上传的图片
        image_file = None
        image_path = None
        
        if 'image' in request.files and request.files['image'].filename:
            image = request.files['image']
            
            # 生成唯一文件名
            ext = os.path.splitext(image.filename)[1].lower()
            image_filename = f"{uuid.uuid4().hex}{ext}"
            
            # 保存图片
            image_path = os.path.join(FEEDBACK_IMG_DIR, image_filename)
            image.save(image_path)
            
            # 打开图片文件用于邮件附件
            with open(image_path, 'rb') as f:
                image_file = f.read()
        
        # 发送反馈
        send_feedback_email(user_info, content, image_file)
        
        return jsonify({'status': 'success', 'message': '反馈已成功提交'})
    
    except Exception as e:
        logging.error(f"发送反馈失败: {e}")
        return jsonify({'status': 'error', 'message': f'提交失败: {str(e)}'}), 500

def send_feedback_email(user_info, content, image_file=None):
    """
    发送反馈邮件
    
    Args:
        user_info (dict): 用户信息
        content (str): 反馈内容
        image_file (bytes, optional): 图片文件二进制数据
    
    Returns:
        bool: 发送是否成功
    """
    try:
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USERNAME
        msg['To'] = FEEDBACK_EMAIL
        msg['Subject'] = f'用户反馈: {user_info["name"]} - {user_info["student_id"]}'
        
        # 构建HTML内容
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>用户反馈</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #4f46e5;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: #f9fafb;
                    padding: 20px;
                    border-radius: 0 0 5px 5px;
                    border: 1px solid #e5e7eb;
                    border-top: none;
                }}
                .info-item {{
                    margin-bottom: 10px;
                }}
                .info-label {{
                    font-weight: bold;
                    color: #4f46e5;
                }}
                .feedback-content {{
                    background-color: white;
                    padding: 15px;
                    border-radius: 5px;
                    border: 1px solid #e5e7eb;
                    margin-bottom: 20px;
                }}
                .image-container {{
                    margin-top: 20px;
                }}
                .image-container img {{
                    max-width: 100%;
                    max-height: 500px;
                    border-radius: 5px;
                }}
                .footer {{
                    margin-top: 30px;
                    text-align: center;
                    color: #6b7280;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>用户反馈</h2>
            </div>
            <div class="content">
                <h3>用户信息</h3>
                <div class="info-item">
                    <span class="info-label">姓名：</span> {user_info['name']}
                </div>
                <div class="info-item">
                    <span class="info-label">学号：</span> {user_info['student_id']}
                </div>
                <div class="info-item">
                    <span class="info-label">邮箱：</span> {user_info['email']}
                </div>
                <div class="info-item">
                    <span class="info-label">班级：</span> {user_info['class_name']}
                </div>
                <div class="info-item">
                    <span class="info-label">提交时间：</span> {user_info['timestamp']}
                </div>
                
                <h3>反馈内容</h3>
                <div class="feedback-content">
                    {content.replace('\n', '<br>')}
                </div>
                
                {('<div class="image-container"><h3>附件截图</h3><img src="cid:feedback_image"></div>') if image_file else ''}
            </div>
            <div class="footer">
                <p>此邮件由系统自动发送，可直接回复至发件人邮箱地址。</p>
                <p>&copy; 2025 作业提交系统 | 遥感科学与技术 | 中山大学</p>
            </div>
        </body>
        </html>
        """
        
        # 创建纯文本
        text_content = f"""
        用户反馈

        用户信息：
        姓名：{user_info['name']}
        学号：{user_info['student_id']}
        邮箱：{user_info['email']}
        班级：{user_info['class_name']}
        提交时间：{user_info['timestamp']}

        反馈内容：
        {content}

        此邮件由系统自动发送，可直接回复至发件人邮箱地址。
        """
        
        # 添加邮件正文
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part1)
        msg.attach(part2)
        
        # 添加图片附件（如果有）
        if image_file:
            image = MIMEImage(image_file)
            image.add_header('Content-ID', '<feedback_image>')
            image.add_header('Content-Disposition', 'inline')
            msg.attach(image)
        
        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [FEEDBACK_EMAIL], msg.as_string())
        
        logging.info(f'用户反馈已发送至 {FEEDBACK_EMAIL} (用户: {user_info["name"]}, 学号: {user_info["student_id"]})')
        return True
    except Exception as e:
        logging.error(f'发送反馈邮件失败: {e}')
        return False