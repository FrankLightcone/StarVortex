import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.header import Header

# 配置信息（需修改为你的信息）
sender = 'lightconefrank@gmail.com'  # 发件人Gmail地址
password = 'bbub ogts cokw rieg'  # Gmail应用专用密码（见下方说明）
receiver = '2153554947@qq.com'  # 收件人地址
smtp_server = 'smtp.gmail.com'
port = 587  # TLS端口

# 1. 创建邮件对象
msg = MIMEMultipart()
msg['Subject'] = Header('Gmail测试邮件（Python）', 'utf-8')
msg['From'] = sender
msg['To'] = receiver

# 2. 添加邮件正文（HTML和纯文本双版本）
text_content = "这是纯文本内容。\n如果你的邮件客户端不支持HTML，会显示此内容。"
html_content = """
<html>
  <body>
    <h1 style="color: red;">HTML内容测试</h1>
    <p>这是一封来自 <b>Python+Gmail</b> 的测试邮件。</p>
    <p><a href="https://www.python.org">点击访问Python官网</a></p>
  </body>
</html>
"""

# 同时兼容HTML和纯文本的邮件
msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
msg.attach(MIMEText(html_content, 'html', 'utf-8'))

# 3. 添加附件（可选）
attachment_path = 'test.txt'  # 修改为你的文件路径
try:
    with open(attachment_path, 'rb') as f:
        attachment = MIMEApplication(f.read())
        attachment.add_header(
            'Content-Disposition',
            'attachment',
            filename=Header('测试附件.txt', 'utf-8').encode()
        )
        msg.attach(attachment)
except FileNotFoundError:
    print(f"警告: 附件文件 {attachment_path} 未找到，已跳过附件")

# 4. 发送邮件
try:
    # 连接Gmail服务器
    with smtplib.SMTP(smtp_server, port) as smtp:
        smtp.starttls()  # 启用TLS加密
        smtp.login(sender, password)
        smtp.sendmail(sender, [receiver], msg.as_string())
    print("邮件发送成功！")
except Exception as e:
    print(f"发送失败: {str(e)}")