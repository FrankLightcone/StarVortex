#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动发送功能更新邮件通知脚本

该脚本用于向指定用户发送功能更新通知邮件，包含HTML格式的邮件内容。
使用方法：
python send_feature_email.py --recipient user@example.com --name "用户姓名"

选项：
  --recipient, -r  接收者邮箱地址（必需）
  --name, -n       接收者姓名，用于个性化邮件内容（可选，默认"用户"）
  --sender, -s     发送者邮箱（可选，默认使用配置中的值）
  --sender-name    发送者姓名（可选，默认使用配置中的值）
  --config, -c     配置文件路径（可选，默认"email_config.json"）
  --template, -t   HTML模板文件路径（可选，默认"remember_me_template.html"）
"""

import argparse
import json
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

# 默认配置
DEFAULT_CONFIG = {
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "lightconefrank@gmail.com",
    "sender_name": "Ruijie Fan",
    "password": "bbub ogts cokw rieg",
    "use_tls": True
}

# HTML模板内容（如果模板文件不存在）
DEFAULT_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>功能更新通知：登录页面增加"记住密码"功能</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f7f7f7;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 650px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .header h1 {
            color: #4f46e5;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .section {
            margin-bottom: 25px;
        }
        .section h2 {
            color: #4f46e5;
            font-size: 18px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #eee;
        }
        .feature-box {
            background-color: #f0f7ff;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
        }
        .code-box {
            background-color: #f5f5f5;
            border-left: 4px solid #4f46e5;
            padding: 15px;
            margin: 15px 0;
            font-family: monospace;
            white-space: pre-wrap;
            font-size: 13px;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        .footer {
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            font-size: 12px;
            color: #999;
        }
        .signature {
            margin-top: 30px;
        }
        .checkbox-demo {
            display: flex;
            align-items: center;
            margin: 20px 0;
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        .checkbox-style {
            width: 16px;
            height: 16px;
            border: 1px solid rgba(79, 70, 229, 0.5);
            border-radius: 3px;
            background: white;
            margin-right: 10px;
            position: relative;
        }
        .checkbox-style.checked {
            background-color: #4f46e5;
            border-color: #4f46e5;
        }
        .checkbox-style.checked::after {
            content: '✓';
            position: absolute;
            top: -3px;
            left: 1px;
            font-size: 14px;
            color: white;
            font-weight: bold;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #4f46e5;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin-top: 10px;
        }
        .btn:hover {
            background-color: #4338ca;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>功能更新通知：登录页面增加"记住密码"功能</h1>
            <p>作业提交系统功能升级</p>
        </div>
        
        <div class="content">
            <p>尊敬的 {{recipient_name}}，</p>
            
            <p>我很高兴地通知您，根据用户反馈和我们的功能开发计划，我已经完成了"记住密码"功能的实现并已部署到作业提交系统中。</p>
            
            <div class="section">
                <h2>功能说明</h2>
                <ul>
                    <li><strong>功能名称</strong>：记住密码（Remember Me）</li>
                    <li><strong>实施日期</strong>：2025年4月21日</li>
                    <li><strong>功能位置</strong>：登录页面</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>实现内容</h2>
                <p>该功能在登录界面中增加了"记住我的账号"选项，提供以下便利：</p>
                <ol>
                    <li><strong>自动填充</strong>：勾选该选项后登录成功，用户下次访问系统时将自动填充用户名和密码</li>
                    <li><strong>简化登录流程</strong>：减少用户重复输入凭据的操作，提高系统使用体验</li>
                    <li><strong>安全存储</strong>：使用基本编码技术（Base64）存储密码，为保存的密码提供基础保护</li>
                </ol>
            </div>
            
            <div class="section">
                <h2>界面展示</h2>
                <p>复选框已添加到登录表单中，位于密码输入框下方，UI设计符合系统整体风格：</p>
                
                <div class="checkbox-demo">
                    <div class="checkbox-style"></div>
                    <span>默认状态</span>
                </div>
                
                <div class="checkbox-demo">
                    <div class="checkbox-style checked"></div>
                    <span>选中状态 - 紫色背景，白色对勾</span>
                </div>
                
                <p>复选框包含以下交互效果：</p>
                <ul>
                    <li>悬停效果：背景色加深，边框更明显</li>
                    <li>选中效果：紫色背景，白色对勾标记</li>
                    <li>聚焦效果：紫色阴影提示框</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>技术详情</h2>
                <p>我们使用以下技术实现了记住密码功能：</p>
                <ul>
                    <li>使用浏览器本地存储（localStorage）安全保存用户凭据</li>
                    <li>实现了自动填充和记住状态的持久化</li>
                    <li>添加了相应的样式，确保复选框与整体UI风格一致</li>
                </ul>
                
                <div class="code-box">/* 记住密码复选框样式 */
input[type="checkbox"] {
    cursor: pointer;
    position: relative;
    width: 16px;
    height: 16px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    outline: none;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.3s ease;
}

input[type="checkbox"]:checked {
    background-color: #4f46e5;
    border-color: #4f46e5;
}

input[type="checkbox"]:checked::before {
    content: '✓';
    position: absolute;
    top: -3px;
    left: 1px;
    font-size: 14px;
    color: white;
    font-weight: bold;
}</div>
            </div>
            
            <div class="section">
                <h2>后续计划</h2>
                <p>此功能现已上线，您可以访问系统验证体验。我计划在后续版本中考虑以下改进：</p>
                <ul>
                    <li>增加记住凭据的有效期设置</li>
                    <li>提供更高级的加密方式存储凭据</li>
                    <li>增加自动登录选项，进一步简化用户操作</li>
                </ul>
                
                <a href="http://作业提交系统地址/login" class="btn">立即体验新功能</a>
            </div>
            
            <div class="signature">
                <p>请您查看并给予反馈。如有任何问题或建议，请随时与我联系。</p>
                <p>祝好，</p>
                <p>
                    {{sender_name}}<br>
                    系统开发工程师<br>
                    邮箱：{{sender_email}}<br>
                    日期：2025年4月21日
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2025 作业提交系统 | 遥感科学与技术 | 中山大学</p>
        </div>
    </div>
</body>
</html>"""

def load_config(config_file):
    """加载配置文件，如果不存在则创建默认配置"""
    if not os.path.exists(config_file):
        # 创建默认配置文件
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=4)
        print(f"已创建默认配置文件: {config_file}")
        print("请编辑配置文件，填入正确的SMTP服务器信息后重新运行程序。")
        sys.exit(1)
    
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_template(template_file):
    """加载HTML模板文件，如果不存在则使用默认模板"""
    if not os.path.exists(template_file):
        # 创建默认模板文件
        with open(template_file, 'w', encoding='utf-8') as f:
            f.write(DEFAULT_HTML_TEMPLATE)
        print(f"已创建默认HTML模板文件: {template_file}")
    
    with open(template_file, 'r', encoding='utf-8') as f:
        return f.read()

def replace_placeholders(html_content, recipient_name, sender_name, sender_email):
    """替换HTML模板中的占位符"""
    return html_content.replace(
        "{{recipient_name}}", recipient_name
    ).replace(
        "{{sender_name}}", sender_name
    ).replace(
        "{{sender_email}}", sender_email
    )

def send_email(config, recipient_email, recipient_name, sender_name, html_content):
    """发送HTML格式的邮件"""
    # 创建MIMEMultipart对象
    msg = MIMEMultipart()
    msg['From'] = formataddr((sender_name, config['sender_email']))
    msg['To'] = formataddr((recipient_name, recipient_email))
    msg['Subject'] = "功能更新通知：登录页面增加‘记住密码’功能"
    
    # 添加HTML内容
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))
    
    try:
        # 连接SMTP服务器
        if config['use_tls']:
            server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(config['smtp_server'], config['smtp_port'])
        
        # 登录
        server.login(config['sender_email'], config['password'])
        
        # 发送邮件
        server.sendmail(config['sender_email'], recipient_email, msg.as_string())
        
        # 关闭连接
        server.quit()
        
        return True, "邮件发送成功"
    except Exception as e:
        return False, f"邮件发送失败: {str(e)}"

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='发送功能更新通知邮件')
    parser.add_argument('-r', '--recipient', required=True, help='接收者邮箱地址')
    parser.add_argument('-n', '--name', default='用户', help='接收者姓名')
    parser.add_argument('-s', '--sender', help='发送者邮箱，默认使用配置文件中的设置')
    parser.add_argument('--sender-name', help='发送者姓名，默认使用配置文件中的设置')
    parser.add_argument('-c', '--config', default='email_config.json', help='配置文件路径')
    parser.add_argument('-t', '--template', default='remember_me_template.html', help='HTML模板文件路径')
    
    args = parser.parse_args()
    
    # 加载配置
    config = load_config(args.config)
    
    # 加载HTML模板
    html_template = load_template(args.template)
    
    # 替换发送者信息（如果命令行参数有提供）
    sender_email = args.sender if args.sender else config['sender_email']
    sender_name = args.sender_name if args.sender_name else config['sender_name']
    
    # 更新配置中的发送者邮箱（如果有变化）
    if args.sender:
        config['sender_email'] = args.sender
    
    # 替换模板中的占位符
    html_content = replace_placeholders(
        html_template, 
        args.name, 
        sender_name, 
        sender_email
    )
    
    # 发送邮件
    success, message = send_email(
        config, 
        args.recipient, 
        args.name, 
        sender_name, 
        html_content
    )
    
    if success:
        print(f"✅ {message}")
        print(f"收件人: {args.name} <{args.recipient}>")
    else:
        print(f"❌ {message}")
        sys.exit(1)

if __name__ == "__main__":
    main()