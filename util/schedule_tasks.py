"""
作业传输系统 - 定时任务模块 (修复版)

此模块用于设置和管理系统的定时任务，包括：
- 每日截止日期检查和提醒
- 其他可能的定时维护任务

该模块使用APScheduler库来管理定时任务，可以方便地设置每天固定时间执行的任务。
此版本修复了重启应用程序时定时器不会重新配置的问题。

作者: [您的名字]
版本: 1.1
日期: 2025-04-13
"""

import logging
import os
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

from util.deadline_reminder import run_deadline_check

# 创建全局调度器实例
scheduler = None

def init_scheduler():
    """初始化调度器"""
    global scheduler
    
    # 如果调度器已存在且正在运行，先关闭它
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)
        logging.info("已关闭旧的调度器")
    
    # 创建新的调度器
    scheduler = BackgroundScheduler()
    logging.info("已初始化新的调度器")
    
    return scheduler

def scheduler_listener(event):
    """调度器事件监听器，用于记录任务执行情况"""
    if event.exception:
        logging.error(f"任务 '{event.job_id}' 执行出错: {event.exception}")
        logging.error(f"异常跟踪: {event.traceback}")
    else:
        logging.info(f"任务 '{event.job_id}' 执行成功，返回值: {event.retval}")

def setup_scheduler(app, reminder_hour=10, reminder_minute=0):
    """
    设置定时任务调度器
    
    Args:
        app: Flask应用实例
        reminder_hour (int): 定时提醒小时 (24小时制)
        reminder_minute (int): 定时提醒分钟
    """
    # 确保目录存在
    os.makedirs('logs', exist_ok=True)
    
    # 初始化调度器
    global scheduler
    scheduler = init_scheduler()
    
    try:
        # 添加监听器
        scheduler.add_listener(scheduler_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
        
        # 设置每天指定时间检查截止日期并发送提醒
        job = scheduler.add_job(
            run_deadline_check,
            trigger=CronTrigger(hour=reminder_hour, minute=reminder_minute),
            id='deadline_reminder',
            name='截止日期提醒',
            replace_existing=True,
            misfire_grace_time=3600  # 允许1小时的错过执行时间
        )
        
        logging.info(f"已设置截止日期提醒任务，将在每天 {reminder_hour:02d}:{reminder_minute:02d} 执行")
        
        # 这里可以添加其他定时任务
        
        # 启动调度器
        if not scheduler.running:
            scheduler.start()
            logging.info("定时任务调度器已启动")
        
        # 注册关闭函数，确保应用停止时调度器也停止
        @app.teardown_appcontext
        def shutdown_scheduler(exception=None):
            global scheduler
            if scheduler and scheduler.running:
                scheduler.shutdown()
                logging.info("定时任务调度器已关闭")
    
    except Exception as e:
        logging.error(f"设置定时任务失败: {e}")
        import traceback
        logging.error(traceback.format_exc())

def update_reminder_time(hour, minute=0):
    """
    更新截止日期提醒时间
    
    Args:
        hour (int): 小时 (24小时制)
        minute (int): 分钟
        
    Returns:
        bool: 是否成功更新
    """
    global scheduler
    
    if not scheduler or not scheduler.running:
        logging.error("调度器未运行，无法更新任务时间")
        return False
    
    try:
        # 移除旧的任务
        scheduler.remove_job('deadline_reminder')
        
        # 添加新的任务
        scheduler.add_job(
            run_deadline_check,
            trigger=CronTrigger(hour=hour, minute=minute),
            id='deadline_reminder',
            name='截止日期提醒',
            replace_existing=True,
            misfire_grace_time=3600  # 允许1小时的错过执行时间
        )
        
        logging.info(f"已更新截止日期提醒时间为 {hour:02d}:{minute:02d}")
        return True
    except Exception as e:
        logging.error(f"更新提醒时间失败: {e}")
        return False

def get_current_schedule():
    """
    获取当前定时任务的调度信息
    
    Returns:
        dict: 包含任务信息的字典
    """
    global scheduler
    
    if not scheduler or not scheduler.running:
        logging.warning("调度器未运行，无法获取任务信息")
        return {"status": "not_running"}
    
    try:
        job = scheduler.get_job('deadline_reminder')
        if not job:
            return {"status": "no_job"}
        
        # 获取下一次执行时间
        next_run = job.next_run_time
        
        # 分析触发器，获取执行时间
        trigger = job.trigger
        schedule_time = None
        
        if hasattr(trigger, 'fields'):
            for field in trigger.fields:
                if field.name == 'hour':
                    hour = field.expressions[0]
                if field.name == 'minute':
                    minute = field.expressions[0]
            schedule_time = f"{hour:02d}:{minute:02d}"
        
        return {
            "status": "running",
            "job_id": job.id,
            "next_run": next_run.strftime('%Y-%m-%d %H:%M:%S') if next_run else "未调度",
            "schedule_time": schedule_time
        }
    except Exception as e:
        logging.error(f"获取任务信息失败: {e}")
        return {"status": "error", "message": str(e)}

def immediate_check_deadlines():
    """立即执行一次截止日期检查（用于测试或手动触发）"""
    logging.info("手动触发截止日期检查")
    return run_deadline_check()