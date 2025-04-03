# 邮件服务器配置
# 此文件包含发送邮件所需的配置信息
# 在实际部署时，请替换为真实的SMTP服务器信息

# SMTP服务器地址
SMTP_SERVER = 'smtp.example.com'

# SMTP服务器端口
# 常见端口: 
# - 25: 未加密
# - 465: SSL加密
# - 587: TLS加密(推荐)
SMTP_PORT = 587

# SMTP登录用户名（通常是邮箱地址）
SMTP_USERNAME = 'your_email@example.com'

# SMTP登录密码
# 注意: 对于Gmail等服务，可能需要使用应用专用密码
SMTP_PASSWORD = 'your_email_password'