# 作业提交系统

这是一个简单的作业提交系统，允许学生注册账号、登录并提交作业文件。

## 系统特性

- 用户注册与登录功能
- 邮箱验证码注册
- 按课程和作业分类上传文件
- 文件队列管理
- 上传进度实时显示
- 文件自动压缩
- 课程与作业配置管理

## 安装与配置

1. 克隆代码库:
```bash
git clone https://github.com/your-username/assignment-system.git
cd assignment-system
```

2. 安装依赖:
```bash
pip install -r requirements.txt
```

3. 配置系统:
```bash
# 复制配置模板
cp util/config_template.py util/config.py

# 编辑配置文件
nano util/config.py  # 或使用任何文本编辑器
```

4. 配置课程和作业:
```bash
# 运行课程管理工具
python manage_courses.py
```

5. 启动应用:
```bash
python app.py
```

应用将在 http://localhost:10099 上运行。

## 文件结构

- `app.py`: 主应用程序
- `manage_courses.py`: 课程管理工具
- `course_config.json`: 课程与作业配置
- `users.json`: 用户数据
- `util/config.py`: 系统配置
- `templates/`: HTML模板
  - `login.html`: 登录页面
  - `register.html`: 注册页面
  - `upload.html`: 文件上传页面
- `static/`: 静态资源
  - `img/`: 图片资源
  - `upload/`: 上传文件存储目录

## 系统工作流程

1. 学生通过邮箱验证注册账号
2. 登录系统
3. 选择课程和作业
4. 选择要上传的文件（可以选择多个）
5. 点击"开始上传"按钮提交文件
6. 系统自动创建文件夹结构并保存文件
7. 系统自动将学生提交的文件打包为ZIP文件

## 文件存储结构

```
static/upload/
├── 课程1/
│   ├── 作业1/
│   │   ├── 学号_姓名/
│   │   │   ├── 文件1
│   │   │   └── 文件2
│   │   └── 学号_姓名.zip
│   └── 作业2/
└── 课程2/
    └── ...
```

## 管理课程与作业

使用课程管理工具可以:

- 添加新课程
- 修改课程名称
- 删除课程
- 为课程添加作业
- 删除作业

```bash
python manage_courses.py
```

## 注意事项

- 确保邮箱服务器配置正确，否则无法发送验证码
- 请定期备份 `users.json` 和 `course_config.json` 文件
- 在生产环境中部署时，建议修改 `SECRET_KEY` 为随机字符串，并关闭调试模式