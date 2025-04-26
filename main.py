"""
更新main.py以集成作业截止日期提醒功能

在原有main.py的基础上，添加以下更新：
1. 导入定时任务调度器模块
2. 在应用初始化时设置定时任务
3. 确保数据目录存在

注意：这不是一个独立的文件，而是展示了需要对main.py进行的修改。
"""

# 修改导入部分，添加定时任务模块
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
from util.schedule_tasks import setup_scheduler, get_current_schedule
from util.feedback import feedback_bp
from util.notification import notification_bp, init_app as init_notification_app
from util.materials import materials_bp, init_app as init_materials
from util.stats_api import stats_api_bp, init_app as init_stats_api


def create_app():
    app = Flask(__name__)
    
    # 配置应用
    app.secret_key = SECRET_KEY
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    # 删除APP_ALREADY_STARTED标志，我们不再需要它
    app.config['ENABLE_SUBMISSION_NOTIFICATIONS'] = True
    app.config['ENABLE_DEADLINE_REMINDERS'] = True
    app.config['REMINDER_HOUR'] = 18  # 默认为18点，可在配置文件中修改
    app.config['REMINDER_MINUTE'] = 0  # 0分
    
    # 设置增强的日志配置
    setup_logging(app, log_level=logging.INFO)  # 开发时使用DEBUG级别
    
    # 确保上传目录存在
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # 确保数据目录存在
    os.makedirs('data', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    
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
    app.register_blueprint(feedback_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(materials_bp)  # 添加课程资料蓝图
    app.register_blueprint(stats_api_bp)  # 添加统计API蓝图

    # 初始化通知系统
    init_notification_app(app)
    init_materials(app)  # 初始化课程资料模块
    init_stats_api(app)  # 初始化统计API模块
    
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
    @app.before_first_request
    def initialize_app():
        """在第一个请求到达前初始化应用"""
        try:
            # 确保上传目录存在
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            
            # 初始化所需的文件
            from util.utils import load_course_config
            from util.models import save_users
            
            # 加载课程配置
            load_course_config()
            
            # 确保用户数据文件存在
            if not os.path.exists('data/users.json'):
                save_users({})
                
            # 确保提交记录文件存在
            os.makedirs('data', exist_ok=True)
            if not os.path.exists('data/submissions_record.json'):
                with open('data/submissions_record.json', 'w', encoding='utf-8') as f:
                    f.write('{}')
            
            app.logger.info("应用程序初始化完成")
        except Exception as e:
            app.logger.error(f"应用程序初始化失败: {e}")
            import traceback
            app.logger.error(traceback.format_exc())
    
    # 设置定时任务 - 我们直接在应用启动时设置，而不是等待第一个请求
    if app.config.get('ENABLE_DEADLINE_REMINDERS', True):
        try:
            reminder_hour = app.config.get('REMINDER_HOUR', 10)
            reminder_minute = app.config.get('REMINDER_MINUTE', 0)
            setup_scheduler(app, reminder_hour, reminder_minute)
            app.logger.info(f"截止日期提醒功能已启用，设置为每天 {reminder_hour:02d}:{reminder_minute:02d}")
        except Exception as e:
            app.logger.error(f"设置截止日期提醒功能失败: {e}")
            import traceback
            app.logger.error(traceback.format_exc())
    
    # Remove or modify the teardown function
    # Instead of completely removing, let's modify it to only clean resources
    # but not shut down the scheduler
    @app.teardown_appcontext
    def clean_resources(exception=None):
        # Don't shut down scheduler here
        pass
    
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
    app.run(host='0.0.0.0', port=10099, debug=False)