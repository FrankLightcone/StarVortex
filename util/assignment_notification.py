"""
作业传输系统 - 作业发布通知模块

本模块负责在管理员发布作业后，向相关班级的所有学生发送通知邮件。
主要功能包括：
- 构建作业发布通知邮件（HTML和纯文本格式）
- 发送邮件给相关班级的所有学生
- 记录通知发送状态

作者: [您的名字]
版本: 1.0
日期: 2025-04-21
"""

import os
import smtplib
import logging
import threading
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from util.config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
from util.models import load_users
from util.utils import load_course_config

# HTML邮件模板
ASSIGNMENT_NOTIFICATION_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>新作业发布通知</title>
    <style>
        body {{
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f7f7f7;
            margin: 0;
            padding: 0;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #4f46e5, #3b82f6);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }}
        .header h2 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
        }}
        .header p {{
            margin: 5px 0 0;
            font-size: 16px;
            opacity: 0.9;
        }}
        .content {{
            padding: 30px 20px;
        }}
        .assignment-details {{
            background-color: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }}
        .detail-item {{
            margin-bottom: 10px;
        }}
        .detail-label {{
            font-weight: bold;
            color: #4f46e5;
            margin-right: 5px;
        }}
        .due-date {{
            background-color: #fef3c7;
            border-radius: 4px;
            padding: 8px 12px;
            margin: 15px 0;
            font-weight: bold;
            color: #b45309;
            display: inline-block;
        }}
        .button-container {{
            margin: 25px 0;
            text-align: center;
        }}
        .button {{
            display: inline-block;
            background-color: #4f46e5;
            color: white !important; /* 强制使用白色，覆盖链接默认颜色 */
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            transition: background-color 0.2s;
        }}
        .button:hover {{
            background-color: #4338ca;
        }}
        .description {{
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            border: 1px solid #e5e7eb;
        }}
        .footer {{
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📚 新作业发布通知</h2>
            <p>课程: {course_name}</p>
        </div>
        
        <div class="content">
            <p>亲爱的 {student_name} 同学，您好：</p>
            
            <p>您的课程 <strong>{course_name}</strong> 有一个新作业已发布：</p>
            
            <div class="assignment-details">
                <div class="detail-item">
                    <span class="detail-label">作业名称:</span> {assignment_name}
                </div>
                <div class="detail-item">
                    <span class="detail-label">班级:</span> {class_name}
                </div>
                <div class="detail-item">
                    <span class="detail-label">发布时间:</span> {publish_time}
                </div>
            </div>
            
            <div class="due-date">
                📅 截止日期: {due_date}
            </div>
            
            <div class="description">
                <p><strong>作业描述:</strong></p>
                <p>{description}</p>
            </div>
            
            <div class="button-container">
                <a href="http://172.16.244.156:10099/login" class="button">立即前往查看</a>
            </div>
            
            <p>请在截止日期前完成作业提交。如有任何问题，请联系管理员或学习委员。</p>
            
            <p>祝学习愉快！</p>
        </div>
        
        <div class="footer">
            <p>&copy; {year} 作业提交系统 | 遥感科学与技术 | 中山大学</p>
            <p>此邮件由系统自动发送，请勿直接回复。</p>
        </div>
    </div>
</body>
</html>
"""

# 纯文本邮件模板
ASSIGNMENT_NOTIFICATION_TEXT = """
【新作业发布通知】

亲爱的 {student_name} 同学，您好：

您的课程 {course_name} 有一个新作业已发布：

- 作业名称: {assignment_name}
- 班级: {class_name}
- 发布时间: {publish_time}
- 截止日期: {due_date}

作业描述:
{description}

请在截止日期前登录系统完成作业提交。
立即前往提交: http://172.16.244.156:10099/login

如有任何问题，请联系您的任课教师。

祝学习愉快！

---
© {year} 作业提交系统 | 遥感科学与技术 | 中山大学
此邮件由系统自动发送，请勿直接回复。
"""

def send_assignment_notification_email(email, student_name, course_name, assignment_name, 
                                       class_name, due_date, description):
    """
    发送作业发布通知邮件
    
    Args:
        email (str): 接收邮件的地址
        student_name (str): 学生姓名
        course_name (str): 课程名称
        assignment_name (str): 作业名称
        class_name (str): 班级名称
        due_date (str): 截止日期
        description (str): 作业描述
        
    Returns:
        bool: 是否发送成功
    """
    try:
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        msg['Subject'] = f'【新作业通知】{course_name} - {assignment_name}'
        
        # 当前时间
        now = datetime.now().strftime('%Y-%m-%d %H:%M')
        current_year = datetime.now().year
        
        # 生成HTML邮件内容
        html_content = ASSIGNMENT_NOTIFICATION_HTML.format(
            student_name=student_name,
            course_name=course_name,
            assignment_name=assignment_name,
            class_name=class_name,
            publish_time=now,
            due_date=due_date,
            description=description or "暂无详细描述",
            year=current_year
        )
        
        # 生成纯文本内容
        text_content = ASSIGNMENT_NOTIFICATION_TEXT.format(
            student_name=student_name,
            course_name=course_name,
            assignment_name=assignment_name,
            class_name=class_name,
            publish_time=now,
            due_date=due_date,
            description=description or "暂无详细描述",
            year=current_year
        )
        
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
        
        logging.info(f'作业发布通知邮件已发送至 {email} (学生: {student_name}, 课程: {course_name}, 作业: {assignment_name})')
        return True
    except Exception as e:
        logging.error(f'发送作业发布通知邮件失败: {e}')
        return False

def notify_class_of_new_assignment(class_name, course_name, assignment_name, due_date, description=None):
    """
    向班级中的所有学生发送作业发布通知
    
    Args:
        class_name (str): 班级名称
        course_name (str): 课程名称
        assignment_name (str): 作业名称
        due_date (str): 截止日期，格式化后的字符串
        description (str, optional): 作业描述
        
    Returns:
        tuple: (success_count, failed_count, total_students)
    """
    # 加载所有用户
    users = load_users()
    
    # 筛选该班级的学生
    class_students = []
    for username, user_data in users.items():
        if not user_data.get('is_admin', False) and user_data.get('class_name') == class_name:
            class_students.append((username, user_data))
    
    logging.info(f"班级 '{class_name}' 有 {len(class_students)} 名学生")
    
    # 发送通知统计
    success_count = 0
    failed_count = 0
    
    # 为每个学生发送通知
    for username, user_data in class_students:
        email = user_data.get('email')
        
        # 检查邮箱
        if not email:
            logging.warning(f"学生 {username} 没有邮箱，无法发送通知")
            failed_count += 1
            continue
        
        # 发送通知
        success = send_assignment_notification_email(
            email=email,
            student_name=username,
            course_name=course_name,
            assignment_name=assignment_name,
            class_name=class_name,
            due_date=due_date,
            description=description
        )
        
        if success:
            success_count += 1
        else:
            failed_count += 1
    
    return success_count, failed_count, len(class_students)

def send_assignment_notifications(assignment_data):
    """
    发送作业发布通知主函数，适用于新创建的作业
    
    Args:
        assignment_data (dict): 作业数据，包含课程名、作业名、班级等信息
        
    Returns:
        bool: 是否成功启动通知线程
    """
    try:
        # 提取作业信息
        course_name = assignment_data.get('course')
        assignment_name = assignment_data.get('name')
        class_names = assignment_data.get('classNames', [])
        description = assignment_data.get('description', '')
        
        # 格式化截止日期
        due_date = datetime.fromisoformat(assignment_data.get('dueDate')).strftime('%Y-%m-%d %H:%M')
        
        # 创建单独的线程发送邮件，避免阻塞主线程
        def send_notifications_thread():
            stats = {}
            logging.info(f"开始为作业 '{course_name} - {assignment_name}' 发送通知到 {len(class_names)} 个班级")
            
            for class_name in class_names:
                success, failed, total = notify_class_of_new_assignment(
                    class_name=class_name,
                    course_name=course_name,
                    assignment_name=assignment_name,
                    due_date=due_date,
                    description=description
                )
                
                stats[class_name] = {
                    'success': success,
                    'failed': failed,
                    'total': total
                }
                
                logging.info(f"班级 '{class_name}' 通知发送完成: 成功 {success}/{total}, 失败 {failed}/{total}")
            
            total_success = sum(s['success'] for s in stats.values())
            total_failed = sum(s['failed'] for s in stats.values())
            total_students = sum(s['total'] for s in stats.values())
            
            logging.info(f"作业 '{course_name} - {assignment_name}' 通知发送完成: 成功 {total_success}/{total_students}, 失败 {total_failed}/{total_students}")
        
        # 启动通知线程
        notification_thread = threading.Thread(target=send_notifications_thread)
        notification_thread.daemon = True
        notification_thread.start()
        
        logging.info(f"作业通知线程已启动: 作业 '{course_name} - {assignment_name}'")
        return True
    
    except Exception as e:
        logging.error(f"启动作业通知线程失败: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return False