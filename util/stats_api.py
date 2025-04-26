"""
作业传输系统 - 提交统计API

提供基于时间的作业提交统计数据，为前端图表提供数据支持。
主要功能：
- 获取特定作业在过去7天的每日提交数量
- 获取作业的提交趋势和统计数据

作者: Frank
版本: 1.0
日期: 2025-04-27
"""

import os
import json
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from util.models import load_users
from util.utils import load_course_config

# 创建蓝图
stats_api_bp = Blueprint('stats_api', __name__)

@stats_api_bp.route('/api/assignment_submission_stats', methods=['GET'])
@login_required
def get_assignment_submission_stats():
    """获取特定作业的提交统计数据（单班级）"""
    try:
        # 获取查询参数
        course     = request.args.get('course', '')
        assignment = request.args.get('assignment', '')
        class_name = request.args.get('class_name', '')
        
        # 验参
        if not course or not assignment:
            return jsonify({'status':'error','message':'缺少必要参数：课程和作业名称'}), 400
        
        # 如果未指定班级，取当前用户所属班级
        if not class_name and not current_user.is_admin:
            users_data = load_users()
            user_data  = users_data.get(current_user.id, {})
            class_name = user_data.get('class_name', '')
        
        # 管理员未指定班级时走全班级统计接口
        if not class_name and current_user.is_admin:
            return get_all_classes_stats(course, assignment)
        
        # 收集提交数据
        from util.config import UPLOAD_FOLDER
        assignment_path = os.path.join(UPLOAD_FOLDER, class_name, course, assignment)
        if not os.path.exists(assignment_path):
            # 旧结构兼容
            assignment_path = os.path.join(UPLOAD_FOLDER, course, class_name, assignment)
            if not os.path.exists(assignment_path):
                return jsonify({'status':'success','data': generate_empty_stats()}), 200
        
        stats = collect_submission_stats(assignment_path)
        
        # —— 新增：计算并注入 totalStudents —— 
        users_data = load_users()
        stats['totalStudents'] = sum(
            1 for u in users_data.values()
            if u.get('class_name') == class_name
        )
        
        return jsonify({'status':'success','data': stats}), 200

    except Exception as e:
        logging.error(f"获取作业提交统计数据出错: {e}")
        return jsonify({'status':'error','message':str(e)}), 500

def get_all_classes_stats(course, assignment):
    """获取所有班级的特定作业统计数据（仅管理员）"""
    if not current_user.is_admin:
        return jsonify({'status':'error','message':'权限不足'}), 403
    try:
        # 准备合并结构
        config = load_course_config()
        classes = [c['name'] for c in config.get('classes', [])]
        
        combined = generate_empty_stats()
        # 确保有 totalStudents 字段
        combined['totalStudents'] = 0

        users_data = load_users()
        from util.config import UPLOAD_FOLDER
        
        for cls in classes:
            # 统计此班级人数
            class_size = sum(1 for u in users_data.values() if u.get('class_name') == cls)
            combined['totalStudents'] += class_size

            # 统计提交数据
            assignment_path = os.path.join(UPLOAD_FOLDER, cls, course, assignment)
            if not os.path.exists(assignment_path):
                assignment_path = os.path.join(UPLOAD_FOLDER, course, cls, assignment)
                if not os.path.exists(assignment_path):
                    continue

            stats = collect_submission_stats(assignment_path)
            # 合并 dailySubmissions
            for i, day in enumerate(stats['dailySubmissions']):
                combined['dailySubmissions'][i]['count'] += day['count']
            # 合并总提交和与昨对比
            combined['totalSubmissions']      += stats['totalSubmissions']
            combined['comparedToYesterday']   += stats['comparedToYesterday']
        # 重新计算趋势百分比
        yesterday_sub = next(
            (d['count'] for d in combined['dailySubmissions'] if d['day']=='yesterday'),
            0
        )
        if yesterday_sub > 0:
            combined['trendPercentage'] = round(
                (combined['comparedToYesterday'] / yesterday_sub) * 100, 1
            )
        
        return jsonify({'status':'success','data': combined}), 200

    except Exception as e:
        logging.error(f"获取所有班级统计数据出错: {e}")
        return jsonify({'status':'error','message':str(e)}), 500

def collect_submission_stats(assignment_path):
    """收集作业提交统计数据"""
    # 初始化统计结果
    stats = generate_empty_stats()
    
    # 如果路径不存在，返回空数据
    if not os.path.exists(assignment_path):
        return stats
    
    # 获取所有学生提交文件夹
    student_folders = [f for f in os.listdir(assignment_path) 
                    if os.path.isdir(os.path.join(assignment_path, f)) 
                    and not f.endswith('.zip')]
    
    # 获取每个提交的时间
    submission_times = []
    for folder in student_folders:
        folder_path = os.path.join(assignment_path, folder)
        
        # 获取文件夹修改时间作为提交时间
        submission_time = datetime.fromtimestamp(os.path.getmtime(folder_path))
        submission_times.append(submission_time)
    
    # 总提交数
    stats['totalSubmissions'] = len(submission_times)
    
    # 今天和昨天的日期
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    
    # 计算今天和昨天的提交数量
    today_submissions = sum(1 for t in submission_times if t >= today)
    yesterday_submissions = sum(1 for t in submission_times if t >= yesterday and t < today)
    
    # 计算与昨天相比的增长
    stats['comparedToYesterday'] = today_submissions - yesterday_submissions
    
    # 计算趋势百分比
    if yesterday_submissions > 0:
        stats['trendPercentage'] = round((stats['comparedToYesterday'] / yesterday_submissions) * 100, 1)
    
    # 计算过去7天每天的提交数量
    for i in range(14, -1, -1):
        day_date = today - timedelta(days=i)
        next_day = day_date + timedelta(days=1)
        
        # 统计当天的提交数量
        day_submissions = sum(1 for t in submission_times if t >= day_date and t < next_day)
        
        # 根据日期确定星期几名称
        day_name = day_date.strftime('%A').lower()
        
        # 特殊处理今天和昨天
        if i == 0:
            day_name = 'today'
        elif i == 1:
            day_name = 'yesterday'
        
        # 添加到每日统计
        stats['dailySubmissions'].append({
            'date': day_date.strftime('%Y-%m-%d'),
            'day': day_name,
            'count': day_submissions
        })
    
    return stats

def generate_empty_stats():
    """生成空的统计数据结构"""
    return {
        'totalSubmissions': 0,
        'comparedToYesterday': 0,
        'trendPercentage': 0,
        'totalStudents': 0,          # 新增
        'dailySubmissions': []
    }

# 注册蓝图到Flask应用
def init_app(app):
    app.register_blueprint(stats_api_bp)
    logging.info("提交统计API已初始化")