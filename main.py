"""
作业传输系统 - 主程序入口

本文件是整个应用程序的启动点，负责创建Flask应用实例、配置应用和注册蓝图。
主要功能包括：
- 初始化Flask应用及其配置
- 设置Flask-Login用于用户认证
- 注册各功能模块的蓝图
- 确保必要的目录和配置文件存在
- 启动Web服务器

作者: Frank
版本: 1.0
日期: 2025-04-04
"""

import os
import logging
from flask import Flask
from flask_login import LoginManager

# 导入模块
from util.config import SECRET_KEY, UPLOAD_FOLDER, MAX_CONTENT_LENGTH
from util.models import User
from util.auth import auth_bp
from util.student import student_bp
from util.admin import admin_bp
from util.api import api_bp

# 配置日志
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s: %(message)s',
    filename='file_upload.log',  # 将日志写入文件
    filemode='a',  # 追加模式
    encoding="utf-8"
)

def create_app():
    app = Flask(__name__)
    
    # 配置应用
    app.secret_key = SECRET_KEY
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    app.config['APP_ALREADY_STARTED'] = False  # 用于标记应用是否已经启动
    
    # 确保上传目录存在
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # 初始化 Login Manager
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.load_user(user_id)
    
    # 注册蓝图
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(api_bp)
    
    # 应用启动前，确保配置文件存在
    @app.before_request
    def initialize_app():
        if not app.config['APP_ALREADY_STARTED']:
            # 在第一个请求时执行代码
            app.config['APP_ALREADY_STARTED'] = True
            # 确保上传目录存在
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            
            # 初始化所需的文件
            from util.utils import load_course_config
            from util.models import save_users
            
            # 加载课程配置
            load_course_config()
            
            # 确保用户数据文件存在
            if not os.path.exists('users.json'):
                save_users({})
    
    return app

if __name__ == '__main__':
    app = create_app()
    # 注意：为局域网访问，host设置为'0.0.0.0'
    app.run(host='0.0.0.0', port=10099, debug=True)