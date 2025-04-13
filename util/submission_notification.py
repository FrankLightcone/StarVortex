"""
作业传输系统 - 提交完成通知模块 (修复版)

本模块为作业传输系统提供提交完成通知功能，
修复了多文件上传时发送多封邮件的问题，
确保整个提交完成后只发送一封确认邮件。

作者: Frank
版本: 1.1
日期: 2025-04-09
"""

import os
import json
import hashlib
import logging
import smtplib
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from util.config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
from util.models import load_users

# 存储提交记录的文件
SUBMISSIONS_RECORD_FILE = 'data/submissions_record.json'

# 提交冷却时间(秒) - 在此时间内多次上传只会发送一封邮件
SUBMISSION_COOLDOWN = 120  # 两分钟

def calculate_md5(file_path):
    """
    计算文件的MD5校验和
    
    Args:
        file_path (str): 文件路径
        
    Returns:
        str: MD5校验和
    """
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def calculate_folder_md5(folder_path):
    """
    计算文件夹中所有文件的MD5校验和
    
    Args:
        folder_path (str): 文件夹路径
        
    Returns:
        str: 所有文件MD5校验和的组合值
    """
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return ""
    
    files_md5 = []
    for root, _, files in os.walk(folder_path):
        for file in sorted(files):  # 排序以确保一致性
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path):
                file_md5 = calculate_md5(file_path)
                files_md5.append(f"{file}:{file_md5}")
    
    # 将所有文件的MD5组合起来，再计算一个总的MD5值
    combined = ",".join(files_md5)
    folder_md5 = hashlib.md5(combined.encode()).hexdigest()
    return folder_md5

def load_submissions_record():
    """
    加载提交记录
    
    Returns:
        dict: 提交记录字典
    """
    if os.path.exists(SUBMISSIONS_RECORD_FILE):
        try:
            with open(SUBMISSIONS_RECORD_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"加载提交记录失败: {e}")
    
    return {}

def save_submissions_record(record):
    """
    保存提交记录
    
    Args:
        record (dict): 提交记录字典
    """
    try:
        with open(SUBMISSIONS_RECORD_FILE, 'w', encoding='utf-8') as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"保存提交记录失败: {e}")

def check_submission_changed(student_id, username, course, assignment, folder_path):
    """
    检查提交是否有变化
    
    Args:
        student_id (str): 学生ID
        username (str): 用户名
        course (str): 课程名
        assignment (str): 作业名
        folder_path (str): 文件夹路径
        
    Returns:
        bool: 是否有变化
    """
    # 计算当前提交的MD5
    current_md5 = calculate_folder_md5(folder_path)
    if not current_md5:
        return False
    
    # 加载历史记录
    records = load_submissions_record()
    
    # 查找该学生、该作业的记录
    student_key = f"{student_id}_{username}"
    if student_key not in records:
        records[student_key] = {}
    
    assignment_key = f"{course}_{assignment}"
    if assignment_key not in records[student_key]:
        records[student_key][assignment_key] = {
            "md5": "", 
            "notified": False,
            "last_upload_time": 0,
            "notification_cooldown": 0
        }
    
    # 更新上传时间
    current_time = time.time()
    records[student_key][assignment_key]["last_upload_time"] = current_time
    
    # 检查MD5是否变化
    previous_md5 = records[student_key][assignment_key]["md5"]
    has_changed = previous_md5 != current_md5
    
    if has_changed:
        # 更新记录
        records[student_key][assignment_key]["md5"] = current_md5
        
        # 只在冷却期过后才重置通知状态
        last_notification = records[student_key][assignment_key].get("notification_cooldown", 0)
        if current_time - last_notification > SUBMISSION_COOLDOWN:
            records[student_key][assignment_key]["notified"] = False
    
    save_submissions_record(records)
    
    return has_changed

def should_send_notification(student_id, username, course, assignment):
    """
    检查是否应该发送通知
    
    Args:
        student_id (str): 学生ID
        username (str): 用户名
        course (str): 课程名
        assignment (str): 作业名
        
    Returns:
        bool: 是否应该发送通知
    """
    # 加载记录
    records = load_submissions_record()
    
    # 查找该学生、该作业的记录
    student_key = f"{student_id}_{username}"
    if student_key not in records:
        return False
    
    assignment_key = f"{course}_{assignment}"
    if assignment_key not in records[student_key]:
        return False
    
    # 检查是否已通知
    if records[student_key][assignment_key]["notified"]:
        return False
    
    # 检查是否在冷却期内
    current_time = time.time()
    last_upload = records[student_key][assignment_key]["last_upload_time"]
    
    # 如果距离上次上传时间小于5秒，说明仍在上传中，不发送通知
    if current_time - last_upload < 5:
        return False
    
    return True

def mark_as_notified(student_id, username, course, assignment):
    """
    标记为已通知
    
    Args:
        student_id (str): 学生ID
        username (str): 用户名
        course (str): 课程名
        assignment (str): 作业名
    """
    # 加载记录
    records = load_submissions_record()
    
    # 查找该学生、该作业的记录
    student_key = f"{student_id}_{username}"
    if student_key not in records:
        return
    
    assignment_key = f"{course}_{assignment}"
    if assignment_key not in records[student_key]:
        return
    
    # 标记为已通知，并记录通知时间
    records[student_key][assignment_key]["notified"] = True
    records[student_key][assignment_key]["notification_cooldown"] = time.time()
    save_submissions_record(records)

def get_submission_files_info(folder_path):
    """
    获取提交文件的信息
    
    Args:
        folder_path (str): 文件夹路径
        
    Returns:
        list: 文件信息列表
    """
    files_info = []
    
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return files_info
    
    for file in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file)
        if os.path.isfile(file_path):
            # 获取文件大小
            size_bytes = os.path.getsize(file_path)
            # 格式化文件大小
            if size_bytes < 1024:
                size_str = f"{size_bytes} B"
            elif size_bytes < 1024 * 1024:
                size_str = f"{size_bytes / 1024:.1f} KB"
            elif size_bytes < 1024 * 1024 * 1024:
                size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
            else:
                size_str = f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
            
            # 获取修改时间
            mtime = os.path.getmtime(file_path)
            mtime_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            
            files_info.append({
                "name": file,
                "size": size_str,
                "time": mtime_str
            })
    
    # 按修改时间逆序排序
    files_info.sort(key=lambda x: x["time"], reverse=True)
    
    return files_info

def generate_submission_email(username, student_id, course, assignment, due_date_str, files_info):
    """
    生成提交完成通知邮件
    
    Args:
        username (str): 用户名
        student_id (str): 学生ID
        course (str): 课程名
        assignment (str): 作业名
        due_date_str (str): 截止日期字符串
        files_info (list): 文件信息列表
        
    Returns:
        str: 邮件HTML内容
    """
    # 生成文件列表HTML
    files_html = ""
    for idx, file in enumerate(files_info, 1):
        files_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{idx}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{file['name']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{file['size']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{file['time']}</td>
        </tr>
        """
    
    # 当前时间
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 邮件HTML模板
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>作业提交确认</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
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
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            th {{
                background-color: #f3f4f6;
                padding: 10px;
                text-align: left;
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
            <h2>作业提交确认</h2>
        </div>
        <div class="content">
            <p>亲爱的 {username} 同学，您好：</p>
            <p>系统已经收到您的作业提交。以下是提交详情：</p>
            
            <div class="info-item">
                <span class="info-label">学号：</span> {student_id}
            </div>
            <div class="info-item">
                <span class="info-label">课程：</span> {course}
            </div>
            <div class="info-item">
                <span class="info-label">作业：</span> {assignment}
            </div>
            <div class="info-item">
                <span class="info-label">截止日期：</span> {due_date_str}
            </div>
            <div class="info-item">
                <span class="info-label">提交时间：</span> {now}
            </div>
            
            <h3>提交的文件清单（共 {len(files_info)} 个文件）</h3>
            <table>
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>文件名</th>
                        <th>大小</th>
                        <th>上传时间</th>
                    </tr>
                </thead>
                <tbody>
                    {files_html}
                </tbody>
            </table>
            
            <p>您可以随时登录系统查看提交状态。如有任何问题，请联系您的任课教师。</p>
            <p>祝学习愉快！</p>
        </div>
        <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>&copy; 2025 作业提交系统 | 遥感科学与技术 | 中山大学</p>
        </div>
    </body>
    </html>
    """
    
    return html

def send_submission_notification(email, username, student_id, course, assignment, due_date_str, files_info):
    """
    发送提交完成通知邮件
    
    Args:
        email (str): 接收邮件的地址
        username (str): 用户名
        student_id (str): 学生ID
        course (str): 课程名
        assignment (str): 作业名
        due_date_str (str): 截止日期字符串
        files_info (list): 文件信息列表
        
    Returns:
        bool: 是否发送成功
    """
    try:
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = f'作业提交确认 - {course} - {assignment}'
        
        # 生成HTML邮件内容
        html_content = generate_submission_email(
            username, student_id, course, assignment, due_date_str, files_info
        )
        
        # 生成纯文本内容
        text_content = f"""
        亲爱的 {username} 同学，您好：
        
        系统已经收到您的作业提交。以下是提交详情：
        
        学号：{student_id}
        课程：{course}
        作业：{assignment}
        截止日期：{due_date_str}
        提交时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        提交的文件清单（共 {len(files_info)} 个文件）：
        """
        
        for idx, file in enumerate(files_info, 1):
            text_content += f"\n{idx}. {file['name']} ({file['size']}) - {file['time']}"
        
        text_content += """
        
        您可以随时登录系统查看提交状态。如有任何问题，请联系您的任课教师。
        
        祝学习愉快！
        
        此邮件由系统自动发送，请勿回复。
        © 2025 作业提交系统 | 遥感科学与技术 | 中山大学
        """
        
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
        
        logging.info(f'提交通知邮件已发送至 {email} (学号: {student_id}, 课程: {course}, 作业: {assignment})')
        return True
    except Exception as e:
        logging.error(f'发送提交通知邮件失败: {e}')
        return False

def process_submission_notification(username, course, assignment, student_folder):
    """
    处理提交通知
    
    Args:
        username (str): 用户名
        course (str): 课程名
        assignment (str): 作业名
        student_folder (str): 学生文件夹路径
    """
    from util.utils import load_assignments
    
    try:
        # 加载用户信息
        users = load_users()
        if username not in users:
            logging.error(f"找不到用户: {username}")
            return
        
        user_data = users[username]
        student_id = user_data.get('student_id', '')
        email = user_data.get('email', '')
        
        if not student_id or not email:
            logging.error(f"用户信息不完整: {username}")
            return
        
        # 检查提交是否有变化
        has_changed = check_submission_changed(student_id, username, course, assignment, student_folder)
        logging.info(f"提交检查: 用户={username}, 课程={course}, 作业={assignment}, 有变化={has_changed}")
        
        # 延迟处理，等待所有文件上传完成
        # 这样可以确保在短时间内上传多个文件时，只发送一封邮件
        time.sleep(10)  # 等待10秒，确保文件上传完成
        
        # 再次检查是否应该发送通知，避免同时启动多个通知线程
        if not should_send_notification(student_id, username, course, assignment) or not has_changed:
            logging.info(f"不需要发送通知: {username} (学号: {student_id}, 课程: {course}, 作业: {assignment})")
            return
        
        # 获取作业详情
        assignments = load_assignments()
        assignment_obj = next((a for a in assignments if a['course'] == course and a['name'] == assignment), None)
        
        # 获取截止日期
        due_date_str = "未设置"
        if assignment_obj and 'dueDate' in assignment_obj:
            due_date = datetime.fromisoformat(assignment_obj['dueDate'])
            due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
        
        # 获取文件信息
        files_info = get_submission_files_info(student_folder)
        
        if not files_info:
            logging.warning(f"文件夹为空，不发送通知: {student_folder}")
            return
        
        logging.info(f"准备发送通知: {username} (学号: {student_id}, 课程: {course}, 作业: {assignment}), 文件数: {len(files_info)}")
        
        # 发送通知
        if send_submission_notification(email, username, student_id, course, assignment, due_date_str, files_info):
            # 标记为已通知
            mark_as_notified(student_id, username, course, assignment)
            logging.info(f"提交通知邮件发送成功: {username} (学号: {student_id}, 课程: {course}, 作业: {assignment})")
    
    except Exception as e:
        logging.error(f"处理提交通知失败: {e}")