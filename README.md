# 作业传输系统

一个基于Flask的学生作业提交和管理系统，支持学生注册、文件上传和管理员审核功能。

## 功能特点

- 学生账户注册与登录（邮箱验证）
- 作业文件上传与管理
- 管理员控制面板
- 作业截止日期设置
- 文件批量下载
- 响应式界面设计

## 项目结构

```
作业传输系统/
├── main.py                   # 主应用程序入口
├── README.md                 # 项目说明文档
├── static/                   # 静态文件目录
│   ├── img/                  # 图片资源
│   └── upload/               # 上传文件存储目录
├── templates/                # HTML模板目录
│   ├── admin.html            # 管理员界面
│   ├── admin_login.html      # 管理员登录页面
│   ├── login.html            # 学生登录页面
│   ├── register.html         # 学生注册页面
│   └── upload.html           # 文件上传页面
└── util/                     # 工具模块目录
    ├── __init__.py           # 包初始化文件
    ├── admin.py              # 管理员功能模块
    ├── api.py                # API接口模块
    ├── auth.py               # 认证功能模块
    ├── config.py             # 配置参数模块
    ├── email_config.py       # 邮件配置（需自行配置）
    ├── models.py             # 数据模型模块
    ├── student.py            # 学生功能模块
    └── utils.py              # 通用工具函数
```

## 安装与配置

1. 克隆或下载项目代码
2. 安装依赖包：
   ```
   pip install flask flask-login werkzeug
   ```
3. 配置邮件服务：
   - 编辑 `util/email_config.py` 文件，填入有效的SMTP服务器信息

## 运行方法

1. 启动应用：
   ```
   python main.py
   ```
2. 访问以下链接：
   - 学生界面：http://localhost:10099/
   - 管理员界面：http://localhost:10099/admin

## 默认账户

- 管理员账户：
  - 用户名：admin
  - 密码：admin123（请在生产环境中修改）

## 数据文件

- `users.json`：用户数据
- `course_config.json`：课程配置
- `assignments.json`：作业信息

## 注意事项

1. 首次运行时会自动创建默认配置文件
2. 默认端口为10099，可在main.py中修改
3. 生产环境部署时，请修改默认密钥和管理员密码
4. 确保邮件配置正确，否则注册功能将无法使用