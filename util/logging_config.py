"""
作业传输系统 - 增强日志配置

此模块提供增强的日志配置，便于调试和故障排除。
"""

import os
import logging
from logging.handlers import RotatingFileHandler

def setup_logging(app, log_level=logging.INFO):
    """
    设置应用程序的日志配置
    
    Args:
        app: Flask应用实例
        log_level: 日志级别，默认为INFO
    """
    # 确保日志目录存在
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    
    # 配置日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(module)s - %(funcName)s - %(message)s'
    )
    
    # 创建文件处理器 - 常规日志
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'app.log'),
        maxBytes=10485760,  # 10 MB
        backupCount=10
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    
    # 创建文件处理器 - 错误日志
    error_handler = RotatingFileHandler(
        os.path.join(log_dir, 'error.log'),
        maxBytes=10485760,  # 10 MB
        backupCount=10
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    
    # 创建控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    
    # 移除默认处理器
    if app.logger.handlers:
        app.logger.handlers.clear()
    
    # 添加处理器到Flask日志记录器
    app.logger.addHandler(file_handler)
    app.logger.addHandler(error_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(log_level)
    
    # 配置Werkzeug日志记录器（Flask的WSGI处理器）
    werkzeug_logger = logging.getLogger('werkzeug')
    if werkzeug_logger.handlers:
        werkzeug_logger.handlers.clear()
    werkzeug_logger.addHandler(file_handler)
    werkzeug_logger.addHandler(console_handler)
    werkzeug_logger.setLevel(log_level)
    
    # 配置SQLAlchemy日志记录器
    # sqlalchemy_logger = logging.getLogger('sqlalchemy.engine')
    # sqlalchemy_logger.addHandler(file_handler)
    # sqlalchemy_logger.setLevel(logging.WARNING)
    
    # 配置ROOT记录器
    root_logger = logging.getLogger()
    if root_logger.handlers:
        root_logger.handlers.clear()
    root_logger.addHandler(file_handler)
    root_logger.addHandler(error_handler)
    root_logger.addHandler(console_handler)
    root_logger.setLevel(log_level)

    # 强制统一所有模块 logger（如 blueprint 等）写入统一 handler
    for logger_name, logger_obj in logging.root.manager.loggerDict.items():
        if isinstance(logger_obj, logging.Logger):
            logger_obj.handlers.clear()
            logger_obj.addHandler(file_handler)
            logger_obj.addHandler(error_handler)
            logger_obj.addHandler(console_handler)
            logger_obj.setLevel(log_level)

    app.logger.info("日志系统初始化完成")

    return app