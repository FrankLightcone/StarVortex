"""
Update to main.py to include the new submission notification module
"""

# 现有导入部分不变
import os
import logging
from flask import Flask, request
from flask_login import LoginManager

# 导入模块
from util.config import SECRET_KEY, UPLOAD_FOLDER, MAX_CONTENT_LENGTH
from util.models import User
from util.auth import auth_bp
from util.student import student_bp
from util.admin import admin_bp
from util.api import api_bp
from util.logging_config import setup_logging  # 导入我们的增强日志配置
from util.update_api import update_api_bp # 导入更新API模块

def create_app():
    app = Flask(__name__)
    
    # 配置应用
    app.secret_key = SECRET_KEY
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    app.config['APP_ALREADY_STARTED'] = False  # 用于标记应用是否已经启动
    app.config['ENABLE_SUBMISSION_NOTIFICATIONS'] = True  # 添加提交通知配置选项
    
    # 设置增强的日志配置
    setup_logging(app, log_level=logging.INFO)  # 开发时使用DEBUG级别
    
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
    app.register_blueprint(update_api_bp, url_prefix='/api/update')
    
    # 添加请求日志中间件
    @app.before_request
    def log_request_info():
        app.logger.debug('Headers: %s', dict(request.headers))
        # 优雅之处理请求体日志，避免二进制文件内容污染日志
        raw_data = request.get_data()
        if raw_data:
            try:
                text = raw_data.decode('utf-8')
                # 只截取前 500 个字符
                snippet = text[:500] + ('...' if len(text) > 500 else '')
                app.logger.debug('Body: (text, %d bytes): %s', len(raw_data), snippet)
            except UnicodeDecodeError:
                app.logger.debug('Body: <binary data: %d bytes>', len(raw_data))
        app.logger.debug('Request: %s %s', request.method, request.path)
        if request.form:
            app.logger.debug('Form data: %s', dict(request.form))
        if request.files:
            app.logger.debug('Files: %s', request.files.keys())
    
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
                
            # 确保提交记录文件存在
            if not os.path.exists('data/submissions_record.json'):
                with open('data/submissions_record.json', 'w', encoding='utf-8') as f:
                    f.write('{}')
            
            app.logger.info("应用程序初始化完成")
    
    # 全局错误处理
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error('Server Error: %s', error)
        return '服务器内部错误，请查看日志文件了解详情', 500
    
    @app.errorhandler(404)
    def not_found_error(error):
        app.logger.warning('Page not found: %s', request.path)
        return '页面未找到', 404
    
    return app

if __name__ == '__main__':
    app = create_app()
    # 注意：为局域网访问，host设置为'0.0.0.0'
    app.run(host='0.0.0.0', port=10086, debug=False)