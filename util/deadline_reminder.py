"""
作业传输系统 - 截止日期提醒模块

此模块提供作业截止日期提醒功能，在作业截止前一天自动发送邮件提醒尚未提交作业的学生。
主要功能包括：
- 检查即将到期的作业
- 识别未提交作业的学生
- 发送HTML格式的提醒邮件

该模块设计为由主应用程序通过定时任务调用，每天检查一次所有作业。

作者: [您的名字]
版本: 1.0
日期: 2025-04-13
"""

import os
import json
import logging
import smtplib
import threading
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

from util.config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, UPLOAD_FOLDER
from util.models import load_users
from util.utils import load_course_config, load_assignments

# 已发送提醒记录文件
REMINDER_RECORD_FILE = 'data/reminder_records.json'

def load_reminder_records():
    """加载已发送提醒记录"""
    if os.path.exists(REMINDER_RECORD_FILE):
        try:
            with open(REMINDER_RECORD_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"加载提醒记录失败: {e}")
    
    return {}

def save_reminder_records(record):
    """保存提醒记录"""
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(REMINDER_RECORD_FILE), exist_ok=True)
        with open(REMINDER_RECORD_FILE, 'w', encoding='utf-8') as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"保存提醒记录失败: {e}")

def has_already_reminded(course, assignment, student_id, assignment_id):
    """检查是否已经发送过提醒"""
    records = load_reminder_records()
    
    if assignment_id not in records:
        return False
        
    assignment_record = records[assignment_id]
    return student_id in assignment_record.get('reminded_students', [])

def mark_as_reminded(course, assignment, student_id, assignment_id):
    """标记已经发送提醒"""
    records = load_reminder_records()
    
    if assignment_id not in records:
        records[assignment_id] = {
            'course': course,
            'assignment': assignment,
            'reminded_students': []
        }
    
    if student_id not in records[assignment_id]['reminded_students']:
        records[assignment_id]['reminded_students'].append(student_id)
    
    save_reminder_records(records)

def has_submitted(student_id, username, class_name, course, assignment):
    """检查学生是否已提交作业"""
    # 检查多种可能的路径结构
    possible_paths = [
        os.path.join(UPLOAD_FOLDER, class_name, course, assignment),  # 新结构: /班级/课程/作业/
        os.path.join(UPLOAD_FOLDER, course, class_name, assignment),  # 旧结构: /课程/班级/作业/
        os.path.join(UPLOAD_FOLDER, course, assignment)               # 最旧结构: /课程/作业/
    ]
    
    student_folder_pattern = f"{student_id}_{username}"
    
    for path in possible_paths:
        if not os.path.exists(path):
            continue
            
        # 查找匹配学生ID的文件夹
        student_folders = [
            f for f in os.listdir(path) 
            if os.path.isdir(os.path.join(path, f)) and 
            f.startswith(student_folder_pattern)
        ]
        
        if student_folders:
            return True
    
    return False

def generate_reminder_email(username, student_id, course, assignment, due_date_str):
    """生成截止日期提醒邮件的HTML内容"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>作业截止日期提醒</title>
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
                background-color: #f59e0b;
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
                color: #b45309;
            }}
            .warning {{
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 12px 15px;
                margin: 15px 0;
                font-weight: bold;
            }}
            .button {{
                display: inline-block;
                margin-top: 15px;
                padding: 10px 20px;
                background-color: #f59e0b;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
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
            <h2>⏰ 作业截止日期提醒 ⏰</h2>
        </div>
        <div class="content">
            <p>亲爱的 {username} 同学，您好：</p>
            
            <div class="warning">
                您有作业即将截止，请尽快完成并提交！
            </div>
            
            <p>系统检测到您尚未提交以下作业：</p>
            
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
                <span class="info-label">当前时间：</span> {now}
            </div>
            
            <p>请在截止日期前登录系统完成作业提交。如有任何问题，请联系您的任课教师。</p>
            
            <a href="http://172.16.244.156:10099/login" class="button">立即登录系统</a>
            
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

def send_reminder_email(email, username, student_id, course, assignment, due_date_str):
    """发送截止日期提醒邮件"""
    try:
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = formataddr(("Star Vortex", SMTP_USERNAME))
        msg['To'] = email
        msg['Subject'] = f'【重要提醒】作业即将截止 - {course} - {assignment}'
        
        # 生成HTML邮件内容
        html_content = generate_reminder_email(
            username, student_id, course, assignment, due_date_str
        )
        
        # 生成纯文本内容
        text_content = f"""
        【作业截止日期提醒】
        
        亲爱的 {username} 同学，您好：
        
        您有作业即将截止，请尽快完成并提交！
        
        系统检测到您尚未提交以下作业：
        
        学号：{student_id}
        课程：{course}
        作业：{assignment}
        截止日期：{due_date_str}
        当前时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        请在截止日期前登录系统完成作业提交。如有任何问题，请联系您的任课教师。
        
        登录地址：http://172.16.244.156:10099/login
        
        祝学习愉快！
        
        此邮件由系统自动发送，请勿回复。
        © 2025 作业提交系统 | 遥感科学与技术 | 中山大学
        """
        
        # 添加两种格式的内容
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        
        # 先添加纯文本格式，再添加HTML格式
        msg.attach(part1)
        msg.attach(part2)
        
        # 发送邮件
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [email], msg.as_string())
        
        logging.info(f'截止日期提醒邮件已发送至 {email} (学号: {student_id}, 课程: {course}, 作业: {assignment})')
        return True
    except Exception as e:
        logging.error(f'发送截止日期提醒邮件失败: {e}')
        return False

def check_upcoming_deadlines():
    """检查即将到期的作业并发送提醒"""
    logging.info("开始检查即将到期的作业...")
    
    try:
        # 加载所有作业
        assignments = load_assignments()
        # 加载所有用户
        users = load_users()
        # 加载课程配置
        config = load_course_config()
        
        # 获取当前日期
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        
        # 筛选出明天截止的作业
        upcoming_assignments = []
        for assignment in assignments:
            try:
                due_date = datetime.fromisoformat(assignment['dueDate'])
                # 判断作业是否在明天截止（忽略具体时间）
                if (due_date.year == tomorrow.year and 
                    due_date.month == tomorrow.month and 
                    due_date.day == tomorrow.day):
                    upcoming_assignments.append(assignment)
            except Exception as e:
                logging.error(f"解析作业截止日期出错: {e}, 作业: {assignment['course']} - {assignment['name']}")
        
        logging.info(f"找到 {len(upcoming_assignments)} 个明天截止的作业")
        
        # 处理每个即将到期的作业
        for assignment in upcoming_assignments:
            course = assignment['course']
            assignment_name = assignment['name']
            assignment_id = assignment['id']
            due_date = datetime.fromisoformat(assignment['dueDate'])
            due_date_str = due_date.strftime('%Y-%m-%d %H:%M')
            
            # 查找适用的班级
            applicable_classes = assignment.get('classNames', [])
            
            # 如果没有指定班级，从配置中查找所有包含该课程与作业的班级
            if not applicable_classes:
                for class_info in config.get('classes', []):
                    class_name = class_info['name']
                    for course_info in class_info.get('courses', []):
                        if (course_info['name'] == course and 
                            assignment_name in course_info.get('assignments', [])):
                            applicable_classes.append(class_name)
            
            logging.info(f"作业 '{course} - {assignment_name}' 适用班级: {applicable_classes}")
            
            # 遍历每个班级的所有学生
            for class_name in applicable_classes:
                # 筛选出该班级的学生
                class_students = []
                for username, user_data in users.items():
                    if (not user_data.get('is_admin', False) and 
                        user_data.get('class_name') == class_name):
                        class_students.append((username, user_data))
                
                logging.info(f"班级 '{class_name}' 有 {len(class_students)} 名学生")
                
                # 检查每个学生是否已提交
                for username, user_data in class_students:
                    student_id = user_data.get('student_id', '')
                    email = user_data.get('email', '')
                    
                    if not student_id or not email:
                        logging.warning(f"学生信息不完整: {username}")
                        continue
                    
                    # 检查是否已提交
                    if has_submitted(student_id, username, class_name, course, assignment_name):
                        logging.info(f"学生 {username} (学号: {student_id}) 已提交作业")
                        continue
                    
                    # 检查是否已发送提醒
                    if has_already_reminded(course, assignment_name, student_id, assignment_id):
                        logging.info(f"已向学生 {username} (学号: {student_id}) 发送过提醒")
                        continue
                    
                    logging.info(f"准备向学生 {username} (学号: {student_id}) 发送截止提醒")
                    
                    # 发送提醒邮件
                    if send_reminder_email(email, username, student_id, course, assignment_name, due_date_str):
                        # 标记为已提醒
                        mark_as_reminded(course, assignment_name, student_id, assignment_id)
                        logging.info(f"成功向学生 {username} (学号: {student_id}) 发送截止提醒")
                    else:
                        logging.error(f"向学生 {username} (学号: {student_id}) 发送截止提醒失败")
        
        logging.info("检查作业截止日期完成")
        return True
    
    except Exception as e:
        logging.error(f"检查截止日期出错: {e}")
        return False

def run_deadline_check():
    """启动截止日期检查（可由定时任务调用）"""
    try:
        # 创建线程执行检查，避免阻塞主线程
        reminder_thread = threading.Thread(target=check_upcoming_deadlines)
        reminder_thread.daemon = True
        reminder_thread.start()
        return True
    except Exception as e:
        logging.error(f"启动截止日期检查失败: {e}")
        return False