"""
作业传输系统 - 通知系统模块

本模块提供系统通知功能，主要包括：
- 从Markdown文件加载系统通知
- 解析通知元数据（类型、优先级、是否自动弹出）
- 提供通知列表和通知内容API
- 记录用户已读状态

通知文件使用Markdown格式，文件开头包含YAML格式的元数据:
---
title: 通知标题
type: update|tip|notice  # 通知类型：更新、提示、通知
priority: high|medium|low  # 优先级：高、中、低
auto_popup: true|false  # 是否自动弹出
popup_start_date: 2025-04-15  # 自动弹出开始日期
popup_end_date: 2025-04-20  # 自动弹出结束日期
---
正文内容...

作者: [您的名字]
版本: 1.0
日期: 2025-04-15
"""

import os
import re
import json
import logging
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user

# 创建蓝图
notification_bp = Blueprint('notification', __name__)

# 通知文件目录
NOTIFICATIONS_DIR = 'notifications'

# 用户已读记录文件
USER_READ_RECORDS_FILE = 'data/notification_read_records.json'

# 确保目录存在
os.makedirs(NOTIFICATIONS_DIR, exist_ok=True)
os.makedirs('data', exist_ok=True)

# 元数据正则表达式
META_PATTERN = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)

# 已读记录缓存
_read_records_cache = None
_last_read_records_load_time = None

def parse_notification_file(file_path):
    """
    解析通知文件，提取元数据和内容
    
    Args:
        file_path (str): 通知文件路径
        
    Returns:
        dict: 包含通知信息的字典，如果解析失败则返回None
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取元数据
        meta_match = META_PATTERN.match(content)
        if not meta_match:
            logging.warning(f"通知文件格式错误，缺少元数据: {file_path}")
            return None
        
        meta_text = meta_match.group(1)
        body_text = content[meta_match.end():]
        
        # 解析元数据
        metadata = {}
        for line in meta_text.strip().split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                metadata[key.strip()] = value.strip()
        
        # 生成通知ID
        file_name = os.path.basename(file_path)
        notification_id = os.path.splitext(file_name)[0]
        
        # 创建通知对象
        notification = {
            'id': notification_id,
            'title': metadata.get('title', '未命名通知'),
            'type': metadata.get('type', 'notice'),  # 默认为通知类型
            'priority': metadata.get('priority', 'medium'),  # 默认为中优先级
            'date': metadata.get('date', datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()),
            'autoPopup': metadata.get('auto_popup', 'false').lower() == 'true',
            'popupStartDate': metadata.get('popup_start_date', ''),
            'popupEndDate': metadata.get('popup_end_date', ''),
            'preview': get_preview(body_text),
            'file_path': file_path
        }
        
        return notification
    except Exception as e:
        logging.error(f"解析通知文件出错: {file_path}, 错误: {e}")
        return None

def get_preview(content, max_length=100):
    """
    获取内容预览
    
    Args:
        content (str): 完整内容
        max_length (int): 预览最大长度
        
    Returns:
        str: 预览文本
    """
    # 移除Markdown标记
    text = re.sub(r'!\[.*?\]\(.*?\)', '', content)  # 移除图片
    text = re.sub(r'\[([^\]]+)\]\(.*?\)', r'\1', text)  # 将链接替换为链接文本
    text = re.sub(r'#{1,6}\s+', '', text)  # 移除标题标记
    text = re.sub(r'(\*\*|__)(.*?)\1', r'\2', text)  # 移除粗体
    text = re.sub(r'(\*|_)(.*?)\1', r'\2', text)  # 移除斜体
    text = re.sub(r'~~(.*?)~~', r'\1', text)  # 移除删除线
    text = re.sub(r'`{1,3}.*?`{1,3}', '', text, flags=re.DOTALL)  # 移除代码块
    text = re.sub(r'>\s*(.*?)\n', r'\1 ', text)  # 移除引用
    text = re.sub(r'- ', '', text)  # 移除列表项标记
    text = re.sub(r'\d+\. ', '', text)  # 移除有序列表标记
    
    # 清理多余空白字符
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 截断到指定长度
    if len(text) > max_length:
        return text[:max_length] + '...'
    return text

def load_notifications():
    """
    加载所有通知
    
    Returns:
        list: 通知列表
    """
    notifications = []
    
    # 确保通知目录存在
    if not os.path.exists(NOTIFICATIONS_DIR):
        os.makedirs(NOTIFICATIONS_DIR)
        # 创建示例通知
        create_sample_notifications()
    
    # 遍历通知目录加载通知
    for file_name in os.listdir(NOTIFICATIONS_DIR):
        if file_name.endswith('.md'):
            file_path = os.path.join(NOTIFICATIONS_DIR, file_name)
            notification = parse_notification_file(file_path)
            if notification:
                notifications.append(notification)
    
    # 按日期降序排序
    notifications.sort(key=lambda x: x['date'], reverse=True)
    
    return notifications

def create_sample_notifications():
    """创建示例通知"""
    sample_notifications = [
        {
            'file_name': 'welcome.md',
            'title': '欢迎使用通知系统',
            'type': 'notice',
            'priority': 'medium',
            'auto_popup': 'true',
            'popup_start_date': '2025-04-01',
            'popup_end_date': '2025-12-31',
            'content': """
欢迎使用作业传输系统的通知功能！

这是一个示例通知，用于演示通知系统的基本功能。通知系统支持以下特性：

- **多种通知类型**：更新、提示、通知
- **优先级标记**：高、中、低
- **Markdown格式**：支持所有常用的Markdown语法
- **自动弹出**：重要通知可以设置自动弹出

您可以在右下角看到通知按钮，点击它可以查看所有通知。未读通知会有蓝色标记，高优先级通知会有"重要"标签。

祝您使用愉快！
"""
        },
        {
            'file_name': 'system_update.md',
            'title': '系统更新公告',
            'type': 'update',
            'priority': 'high',
            'auto_popup': 'true',
            'popup_start_date': '2025-04-15',
            'popup_end_date': '2025-04-20',
            'content': """
# 系统更新公告

我们很高兴地宣布，作业传输系统已经更新到最新版本！此次更新带来了以下改进：

1. **全新的通知系统**：现在您可以接收系统通知和重要提醒
2. **性能优化**：显著提升了文件上传和下载速度
3. **界面改进**：更加直观的用户界面，提升用户体验
4. **Bug修复**：修复了已知的问题和缺陷

如有任何问题或建议，请随时反馈给我们。

感谢您的使用！
"""
        },
        {
            'file_name': 'submission_tip.md',
            'title': '提交作业的小技巧',
            'type': 'tip',
            'priority': 'low',
            'auto_popup': 'false',
            'content': """
# 提交作业的小技巧

为了帮助您更高效地使用作业传输系统，这里有一些实用的小技巧：

## 文件命名规范

建议使用以下格式命名文件：`学号_姓名_作业名称`，例如：`12345678_张三_实验一`

## 批量上传

您可以一次性选择多个文件进行上传，或者使用拖放功能将文件拖放到上传区域。

## 定期备份

建议在本地保留作业文件的备份，以防意外情况发生。

## 查看提交历史

您可以在"我的提交"标签页中查看所有已提交的作业，并可以下载或替换之前的提交。

祝您学习愉快！
"""
        }
    ]
    
    for sample in sample_notifications:
        file_path = os.path.join(NOTIFICATIONS_DIR, sample['file_name'])
        
        # 构建元数据部分
        metadata = [
            "---",
            f"title: {sample['title']}",
            f"type: {sample['type']}",
            f"priority: {sample['priority']}",
            f"auto_popup: {sample.get('auto_popup', 'false')}",
        ]
        
        # 添加可选元数据
        if 'popup_start_date' in sample:
            metadata.append(f"popup_start_date: {sample['popup_start_date']}")
        if 'popup_end_date' in sample:
            metadata.append(f"popup_end_date: {sample['popup_end_date']}")
        
        metadata.append("---")
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(metadata) + '\n\n' + sample['content'].strip())

def load_read_records():
    """
    加载用户已读记录
    
    Returns:
        dict: 用户已读记录
    """
    global _read_records_cache, _last_read_records_load_time
    
    # 如果缓存有效，直接使用缓存
    current_time = datetime.now()
    if _read_records_cache is not None and _last_read_records_load_time is not None:
        # 缓存5分钟
        if (current_time - _last_read_records_load_time).total_seconds() < 300:
            return _read_records_cache
    
    # 加载记录文件
    if os.path.exists(USER_READ_RECORDS_FILE):
        try:
            with open(USER_READ_RECORDS_FILE, 'r', encoding='utf-8') as f:
                records = json.load(f)
            
            # 更新缓存
            _read_records_cache = records
            _last_read_records_load_time = current_time
            
            return records
        except Exception as e:
            logging.error(f"加载用户已读记录失败: {e}")
    
    # 如果文件不存在或加载失败，返回空记录
    _read_records_cache = {}
    _last_read_records_load_time = current_time
    return {}

def save_read_records(records):
    """
    保存用户已读记录
    
    Args:
        records (dict): 用户已读记录
    """
    global _read_records_cache, _last_read_records_load_time
    
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(USER_READ_RECORDS_FILE), exist_ok=True)
        
        # 保存记录
        with open(USER_READ_RECORDS_FILE, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        # 更新缓存
        _read_records_cache = records
        _last_read_records_load_time = datetime.now()
    except Exception as e:
        logging.error(f"保存用户已读记录失败: {e}")

def is_notification_read(user_id, notification_id):
    """
    检查用户是否已读通知
    
    Args:
        user_id (str): 用户ID
        notification_id (str): 通知ID
        
    Returns:
        bool: 是否已读
    """
    records = load_read_records()
    
    # 检查用户是否在记录中
    if user_id not in records:
        return False
    
    # 检查通知是否已读
    return notification_id in records[user_id]['read_notifications']

def mark_notification_read(user_id, notification_id):
    """
    标记通知为已读
    
    Args:
        user_id (str): 用户ID
        notification_id (str): 通知ID
    """
    records = load_read_records()
    
    # 确保用户在记录中
    if user_id not in records:
        records[user_id] = {
            'read_notifications': [],
            'last_access': datetime.now().isoformat()
        }
    
    # 如果通知未读，标记为已读
    if notification_id not in records[user_id]['read_notifications']:
        records[user_id]['read_notifications'].append(notification_id)
        records[user_id]['last_access'] = datetime.now().isoformat()
        
        # 保存记录
        save_read_records(records)

def mark_all_notifications_read(user_id):
    """
    标记所有通知为已读
    
    Args:
        user_id (str): 用户ID
    """
    # 获取所有通知
    notifications = load_notifications()
    notification_ids = [notification['id'] for notification in notifications]
    
    # 加载用户记录
    records = load_read_records()
    
    # 确保用户在记录中
    if user_id not in records:
        records[user_id] = {
            'read_notifications': [],
            'last_access': datetime.now().isoformat()
        }
    
    # 标记所有通知为已读
    records[user_id]['read_notifications'] = notification_ids
    records[user_id]['last_access'] = datetime.now().isoformat()
    
    # 保存记录
    save_read_records(records)

@notification_bp.route('/get_notifications', methods=['GET'])
@login_required
def get_notifications():
    """获取通知列表API"""
    try:
        # 加载所有通知
        notifications = load_notifications()
        
        # 获取用户ID
        user_id = current_user.id
        
        # 添加已读标记
        for notification in notifications:
            notification['read'] = is_notification_read(user_id, notification['id'])
            
            # 移除文件路径（不需要发送给前端）
            if 'file_path' in notification:
                del notification['file_path']
        
        return jsonify({'status': 'success', 'notifications': notifications})
    except Exception as e:
        logging.error(f"获取通知列表出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

@notification_bp.route('/get_notification_content/<notification_id>', methods=['GET'])
@login_required
def get_notification_content(notification_id):
    """获取通知内容API"""
    try:
        # 加载所有通知
        notifications = load_notifications()
        
        # 查找指定ID的通知
        notification = next((n for n in notifications if n['id'] == notification_id), None)
        
        if not notification:
            return jsonify({'status': 'error', 'message': '通知不存在'})
        
        # 读取通知内容
        with open(notification['file_path'], 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取元数据和正文
        meta_match = META_PATTERN.match(content)
        if meta_match:
            content = content[meta_match.end():]
        
        # 标记通知为已读
        mark_notification_read(current_user.id, notification_id)
        
        return jsonify({'status': 'success', 'content': content})
    except Exception as e:
        logging.error(f"获取通知内容出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

@notification_bp.route('/mark_notification_read', methods=['POST'])
@login_required
def mark_notification_read_api():
    """标记通知为已读API"""
    try:
        data = request.json
        notification_id = data.get('notificationId')
        
        if not notification_id:
            return jsonify({'status': 'error', 'message': '缺少通知ID'})
        
        # 标记为已读
        mark_notification_read(current_user.id, notification_id)
        
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"标记通知为已读出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

@notification_bp.route('/mark_all_notifications_read', methods=['POST'])
@login_required
def mark_all_notifications_read_api():
    """标记所有通知为已读API"""
    try:
        # 标记所有通知为已读
        mark_all_notifications_read(current_user.id)
        
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"标记所有通知为已读出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

# ===== 管理员功能 =====

@notification_bp.route('/admin/notifications', methods=['GET'])
@login_required
def admin_get_notifications():
    """管理员获取通知列表"""
    # 检查是否为管理员
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '无权限访问'}), 403
    
    try:
        # 加载所有通知
        notifications = load_notifications()
        
        return jsonify({'status': 'success', 'notifications': notifications})
    except Exception as e:
        logging.error(f"管理员获取通知列表出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

@notification_bp.route('/admin/notifications/<notification_id>', methods=['GET'])
@login_required
def admin_get_notification(notification_id):
    """管理员获取通知详情"""
    # 检查是否为管理员
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '无权限访问'}), 403
    
    try:
        # 加载所有通知
        notifications = load_notifications()
        
        # 查找指定ID的通知
        notification = next((n for n in notifications if n['id'] == notification_id), None)
        
        if not notification:
            return jsonify({'status': 'error', 'message': '通知不存在'})
        
        # 读取通知内容
        with open(notification['file_path'], 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 将完整内容（包括元数据）返回给管理员
        return jsonify({'status': 'success', 'notification': notification, 'content': content})
    except Exception as e:
        logging.error(f"管理员获取通知详情出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

@notification_bp.route('/admin/notifications', methods=['POST'])
@login_required
def admin_create_notification():
    """管理员创建新通知"""
    # 检查是否为管理员
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '无权限访问'}), 403
    
    try:
        data = request.json
        
        # 验证必需字段
        required_fields = ['title', 'type', 'priority', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({'status': 'error', 'message': f'缺少必需字段: {field}'}), 400
        
        # 生成唯一ID/文件名
        notification_id = f"{data['type']}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        file_name = f"{notification_id}.md"
        file_path = os.path.join(NOTIFICATIONS_DIR, file_name)
        
        # 构建元数据
        metadata = [
            "---",
            f"title: {data['title']}",
            f"type: {data['type']}",
            f"priority: {data['priority']}",
        ]
        
        # 添加可选元数据
        if 'auto_popup' in data:
            metadata.append(f"auto_popup: {str(data['auto_popup']).lower()}")
        if 'popup_start_date' in data:
            metadata.append(f"popup_start_date: {data['popup_start_date']}")
        if 'popup_end_date' in data:
            metadata.append(f"popup_end_date: {data['popup_end_date']}")
        
        # 添加日期元数据
        metadata.append(f"date: {datetime.now().isoformat()}")
        metadata.append("---")
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(metadata) + '\n\n' + data['content'])
        
        return jsonify({
            'status': 'success', 
            'message': '通知创建成功',
            'notification_id': notification_id
        })
    except Exception as e:
        logging.error(f"管理员创建通知出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@notification_bp.route('/admin/notifications/<notification_id>', methods=['PUT'])
@login_required
def admin_update_notification(notification_id):
    """管理员更新通知"""
    # 检查是否为管理员
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '无权限访问'}), 403
    
    try:
        data = request.json
        
        # 验证必需字段
        required_fields = ['title', 'type', 'priority', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({'status': 'error', 'message': f'缺少必需字段: {field}'}), 400
        
        # 查找通知文件
        file_path = None
        for file_name in os.listdir(NOTIFICATIONS_DIR):
            if file_name.startswith(f"{notification_id}.") or os.path.splitext(file_name)[0] == notification_id:
                file_path = os.path.join(NOTIFICATIONS_DIR, file_name)
                break
        
        if not file_path:
            return jsonify({'status': 'error', 'message': '通知不存在'}), 404
        
        # 构建元数据
        metadata = [
            "---",
            f"title: {data['title']}",
            f"type: {data['type']}",
            f"priority: {data['priority']}",
        ]
        
        # 添加可选元数据
        if 'auto_popup' in data:
            metadata.append(f"auto_popup: {str(data['auto_popup']).lower()}")
        if 'popup_start_date' in data:
            metadata.append(f"popup_start_date: {data['popup_start_date']}")
        if 'popup_end_date' in data:
            metadata.append(f"popup_end_date: {data['popup_end_date']}")
        
        # 添加日期元数据
        metadata.append(f"date: {datetime.now().isoformat()}")
        metadata.append("---")
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(metadata) + '\n\n' + data['content'])
        
        return jsonify({'status': 'success', 'message': '通知更新成功'})
    except Exception as e:
        logging.error(f"管理员更新通知出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@notification_bp.route('/admin/notifications/<notification_id>', methods=['DELETE'])
@login_required
def admin_delete_notification(notification_id):
    """管理员删除通知"""
    # 检查是否为管理员
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '无权限访问'}), 403
    
    try:
        # 查找通知文件
        file_path = None
        for file_name in os.listdir(NOTIFICATIONS_DIR):
            if file_name.startswith(f"{notification_id}.") or os.path.splitext(file_name)[0] == notification_id:
                file_path = os.path.join(NOTIFICATIONS_DIR, file_name)
                break
        
        if not file_path:
            return jsonify({'status': 'error', 'message': '通知不存在'}), 404
        
        # 删除文件
        os.remove(file_path)
        
        return jsonify({'status': 'success', 'message': '通知删除成功'})
    except Exception as e:
        logging.error(f"管理员删除通知出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@notification_bp.route('/admin/read_stats', methods=['GET'])
@login_required
def admin_get_read_stats():
    """管理员获取通知阅读统计"""
    # 检查是否为管理员
    if not current_user.is_admin:
        return jsonify({'status': 'error', 'message': '无权限访问'}), 403
    
    try:
        # 加载所有通知
        notifications = load_notifications()
        
        # 加载用户记录
        read_records = load_read_records()
        
        # 加载用户信息
        from util.models import load_users
        users = load_users()
        
        # 统计每个通知的阅读情况
        stats = []
        for notification in notifications:
            notification_id = notification['id']
            
            # 计算阅读人数
            read_count = 0
            for user_id, record in read_records.items():
                if notification_id in record.get('read_notifications', []):
                    read_count += 1
            
            # 计算总用户数（非管理员）
            total_users = sum(1 for user_data in users.values() if not user_data.get('is_admin', False))
            
            # 计算阅读比例
            read_rate = f"{(read_count / total_users * 100) if total_users > 0 else 0:.1f}%"
            
            stats.append({
                'id': notification_id,
                'title': notification['title'],
                'type': notification['type'],
                'priority': notification['priority'],
                'date': notification['date'],
                'read_count': read_count,
                'total_users': total_users,
                'read_rate': read_rate
            })
        
        return jsonify({'status': 'success', 'stats': stats})
    except Exception as e:
        logging.error(f"管理员获取阅读统计出错: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# 集成到主应用程序的函数
def init_app(app):
    """将通知系统集成到Flask应用程序"""
    # 注册蓝图
    app.register_blueprint(notification_bp, url_prefix='')
    
    # 添加静态文件
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    if os.path.exists(static_dir):
        app.static_folder = static_dir
    
    # 确保通知目录存在
    if not os.path.exists(NOTIFICATIONS_DIR):
        os.makedirs(NOTIFICATIONS_DIR)
        # 创建示例通知
        create_sample_notifications()
    
    # 确保数据目录存在
    os.makedirs('data', exist_ok=True)
    
    # 添加Jinja2过滤器，用于在模板中判断是否有未读通知
    @app.template_filter('has_unread_notifications')
    def has_unread_notifications_filter(user_id):
        if not user_id:
            return False
        
        # 加载通知和用户记录
        notifications = load_notifications()
        read_records = load_read_records()
        
        # 检查用户记录
        if user_id not in read_records:
            return len(notifications) > 0
        
        # 检查是否有未读通知
        read_notifications = read_records[user_id].get('read_notifications', [])
        for notification in notifications:
            if notification['id'] not in read_notifications:
                return True
        
        return False
    
    # 添加Jinja2过滤器，用于在模板中获取未读通知数量
    @app.template_filter('unread_notification_count')
    def unread_notification_count_filter(user_id):
        if not user_id:
            return 0
        
        # 加载通知和用户记录
        notifications = load_notifications()
        read_records = load_read_records()
        
        # 检查用户记录
        if user_id not in read_records:
            return len(notifications)
        
        # 计算未读通知数量
        read_notifications = read_records[user_id].get('read_notifications', [])
        unread_count = 0
        for notification in notifications:
            if notification['id'] not in read_notifications:
                unread_count += 1
        
        return unread_count
    
    logging.info("通知系统已初始化")