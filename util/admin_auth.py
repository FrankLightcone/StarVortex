"""
作业传输系统 - 管理员认证模块

本模块提供管理员认证功能，支持两种类型的管理员：
1. 系统内置管理员（通过config.py定义的ADMIN_USERNAME）
2. 自定义管理员（通过admin.json文件定义，每个管理员可以管理特定的班级）

主要功能：
- 验证管理员身份
- 加载管理员信息
- 更新管理员密码
- 验证管理员对特定班级的权限
"""

import os
import json
import logging
from werkzeug.security import check_password_hash, generate_password_hash

from util.config import ADMIN_USERNAME, ADMIN_PASSWORD_HASH

# 管理员文件路径
ADMIN_FILE = 'admin.json'

def load_admins():
    """
    加载管理员数据
    
    Returns:
        dict: 管理员数据字典
    """
    if os.path.exists(ADMIN_FILE):
        try:
            with open(ADMIN_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            logging.error(f"admin.json 文件格式错误")
            return {}
        except Exception as e:
            logging.error(f"加载管理员数据出错: {e}")
            return {}
    return {}

def save_admins(admins):
    """
    保存管理员数据
    
    Args:
        admins (dict): 管理员数据字典
    """
    try:
        with open(ADMIN_FILE, 'w', encoding='utf-8') as f:
            json.dump(admins, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logging.error(f"保存管理员数据出错: {e}")
        return False

def validate_admin(username, password):
    """
    验证管理员凭据
    
    Args:
        username (str): 管理员用户名
        password (str): 管理员密码
    
    Returns:
        bool: 验证是否成功
    """
    # 首先检查是否是内置管理员
    if username == ADMIN_USERNAME:
        return check_password_hash(ADMIN_PASSWORD_HASH, password)
    
    # 检查是否是自定义管理员
    admins = load_admins()
    if username in admins:
        return check_password_hash(admins[username]['password'], password)
    
    return False

def get_admin_managed_classes(username):
    """
    获取管理员可管理的班级列表
    
    Args:
        username (str): 管理员用户名
    
    Returns:
        list: 管理员可管理的班级列表，内置管理员返回所有班级
    """
    # 如果是内置管理员，返回所有班级
    if username == ADMIN_USERNAME:
        from util.utils import load_course_config
        config = load_course_config()
        return [class_info['name'] for class_info in config.get('classes', [])]
    
    # 如果是自定义管理员，返回其管理的班级
    admins = load_admins()
    if username in admins:
        return admins[username].get('managed_classes', [])
    
    return []

def check_admin_class_permission(username, class_name):
    """
    检查管理员是否有权限管理某个班级
    
    Args:
        username (str): 管理员用户名
        class_name (str): 班级名称
    
    Returns:
        bool: 是否有权限
    """
    # 内置管理员可以管理所有班级
    if username == ADMIN_USERNAME:
        return True
    
    # 自定义管理员只能管理指定的班级
    managed_classes = get_admin_managed_classes(username)
    return class_name in managed_classes

def change_admin_password(username, current_password, new_password):
    """
    修改管理员密码
    
    Args:
        username (str): 管理员用户名
        current_password (str): 当前密码
        new_password (str): 新密码
    
    Returns:
        tuple: (bool, str) - (是否成功, 消息)
    """
    # 内置管理员不能通过此方法修改密码
    if username == ADMIN_USERNAME:
        if not check_password_hash(ADMIN_PASSWORD_HASH, current_password):
            return False, "当前密码不正确"
        return False, "系统内置管理员密码需通过配置文件修改"
    
    # 验证自定义管理员
    admins = load_admins()
    if username not in admins:
        return False, "管理员不存在"
    
    # 验证当前密码
    if not check_password_hash(admins[username]['password'], current_password):
        return False, "当前密码不正确"
    
    # 更新密码
    admins[username]['password'] = generate_password_hash(new_password)
    
    # 保存管理员数据
    if not save_admins(admins):
        return False, "保存密码时出错"
    
    return True, "密码已成功更新"