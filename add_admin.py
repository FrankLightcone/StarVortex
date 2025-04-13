#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
作业传输系统 - 管理员添加工具

该脚本用于通过控制台添加新的管理员账户。
管理员账户信息将保存在admin.json文件中，并包含可管理的班级信息。

使用方法:
python add_admin.py <用户名> <班级1,班级2,...> [密码]

参数:
  用户名: 必填，新管理员的用户名
  班级列表: 必填，逗号分隔的班级名称列表，表示该管理员可管理的班级
  密码: 可选，新管理员的密码，默认为"admin123"

示例:
  python add_admin.py teacherA "2023级遥感1班,2023级遥感2班"
  python add_admin.py teacherB "2023级遥感1班" mypassword
"""

import os
import sys
import json
from werkzeug.security import generate_password_hash

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
            print(f"警告: admin.json 文件格式错误，将创建新文件")
            return {}
    return {}

def save_admins(admins):
    """
    保存管理员数据
    
    Args:
        admins (dict): 管理员数据字典
    """
    with open(ADMIN_FILE, 'w', encoding='utf-8') as f:
        json.dump(admins, f, ensure_ascii=False, indent=2)

def get_all_classes():
    """
    获取所有班级列表
    
    Returns:
        list: 班级名称列表
    """
    # 尝试从course_config.json文件获取班级信息
    if os.path.exists('course_config.json'):
        try:
            with open('course_config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
                return [class_info['name'] for class_info in config.get('classes', [])]
        except Exception as e:
            print(f"警告: 获取班级列表出错: {e}")
    
    return []

def add_admin(username, managed_classes, password="admin123"):
    """
    添加管理员账户
    
    Args:
        username (str): 管理员用户名
        managed_classes (list): 管理的班级列表
        password (str): 管理员密码，默认为"admin123"
    
    Returns:
        bool: 添加是否成功
    """
    admins = load_admins()
    
    # 检查用户名是否已存在
    if username in admins:
        print(f"错误: 管理员 '{username}' 已存在")
        return False
    
    # 获取所有班级列表
    all_classes = get_all_classes()
    if all_classes:
        # 验证指定的班级是否存在
        invalid_classes = [cls for cls in managed_classes if cls not in all_classes]
        if invalid_classes:
            print(f"警告: 以下班级不存在: {', '.join(invalid_classes)}")
            print(f"可用的班级: {', '.join(all_classes)}")
            confirm = input("是否仍要继续添加? (y/n): ")
            if confirm.lower() != 'y':
                return False
    
    # 创建管理员用户
    admin_user = {
        'username': username,
        'password': generate_password_hash(password),
        'managed_classes': managed_classes
    }
    
    # 添加到管理员列表
    admins[username] = admin_user
    
    # 保存管理员列表
    save_admins(admins)
    print(f"管理员 '{username}' 已成功添加")
    print(f"可管理的班级: {', '.join(managed_classes)}")
    print(f"密码: {password}")
    return True

def main():
    """主函数，处理命令行参数"""
    if len(sys.argv) < 3:
        print("错误: 请提供管理员用户名和管理的班级列表")
        print("用法: python add_admin.py <用户名> <班级1,班级2,...> [密码]")
        sys.exit(1)
    
    username = sys.argv[1]
    managed_classes = sys.argv[2].split(',')
    # 移除列表中的空白元素
    managed_classes = [cls.strip() for cls in managed_classes if cls.strip()]
    
    if not managed_classes:
        print("错误: 至少需要指定一个班级")
        sys.exit(1)
    
    password = sys.argv[3] if len(sys.argv) > 3 else "admin123"
    
    add_admin(username, managed_classes, password)

if __name__ == "__main__":
    main()