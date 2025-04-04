"""
作业传输系统 - 邮件服务配置

本文件包含系统发送邮件所需的SMTP服务器配置信息：
- SMTP_SERVER: SMTP服务器地址
- SMTP_PORT: SMTP服务器端口 (通常为25, 465或587)
- SMTP_USERNAME: SMTP登录用户名/邮箱地址
- SMTP_PASSWORD: SMTP登录密码或应用专用密码

注意：
1. 此文件包含敏感信息，不应被版本控制系统追踪
2. Gmail等服务可能需要使用应用专用密码
3. 请根据您的邮件服务提供商选择正确的端口和加密设置

作者: [您的名字]
版本: 1.0
日期: 2025-04-04
"""

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