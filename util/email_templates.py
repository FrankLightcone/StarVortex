"""
作业传输系统 - 提交完成通知邮件模板

此文件包含提交完成通知邮件的HTML和纯文本模板，用于发送给学生。

作者: Frank
版本: 1.0
日期: 2025-04-09
"""

# HTML模板
SUBMISSION_HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>作业提交确认</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4f46e5;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9fafb;
            padding: 20px;
            border-radius: 0 0 5px 5px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: bold;
            color: #4f46e5;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th {
            background-color: #f3f4f6;
            padding: 10px;
            text-align: left;
        }
        td {
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }
        .status-note {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 10px 15px;
            margin: 15px 0;
        }
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
            <span class="info-label">截止日期：</span> {due_date}
        </div>
        <div class="info-item">
            <span class="info-label">提交时间：</span> {submit_time}
        </div>
        
        {status_note}
        
        <h3>提交的文件清单</h3>
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
                {files_list}
            </tbody>
        </table>
        
        <p>您可以随时登录系统查看提交状态。如有任何问题，请联系您的任课教师。</p>
        <p>祝学习愉快！</p>
    </div>
    <div class="footer">
        <p>此邮件由系统自动发送，请勿回复。</p>
        <p>&copy; {year} 作业提交系统 | 遥感科学与技术 | 中山大学</p>
    </div>
</body>
</html>
"""

# 纯文本模板
SUBMISSION_TEXT_TEMPLATE = """
亲爱的 {username} 同学，您好：

系统已经收到您的作业提交。以下是提交详情：

学号：{student_id}
课程：{course}
作业：{assignment}
截止日期：{due_date}
提交时间：{submit_time}

{status_note}

提交的文件清单：
{files_list}

您可以随时登录系统查看提交状态。如有任何问题，请联系您的任课教师。

祝学习愉快！

此邮件由系统自动发送，请勿回复。
© {year} 作业提交系统 | 遥感科学与技术 | 中山大学
"""