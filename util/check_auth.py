#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
作业传输系统 - 目录检查工具

这个脚本检查确保所有必要的目录存在，并具有正确的写入权限。
运行此脚本来确保上传目录被正确创建。

使用方法：
$ python check_auth.py
"""

import os
import sys
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s: %(message)s'
)

# 必要的目录列表
REQUIRED_DIRS = [
    'static',
    'static/upload',
    'static/img',
    'static/css',
    'static/js',
    'static/upload/temp',  # 临时文件目录
    'templates',
    'util'
]

def check_and_create_directories():
    """检查并创建必要的目录结构"""
    print("开始检查必要的目录...")
    
    current_dir = os.getcwd()
    print(f"当前工作目录: {current_dir}")
    
    for directory in REQUIRED_DIRS:
        dir_path = os.path.join(current_dir, directory)
        
        # 检查目录是否存在
        if not os.path.exists(dir_path):
            try:
                os.makedirs(dir_path)
                print(f"✅ 目录已创建: {directory}")
            except Exception as e:
                print(f"❌ 无法创建目录 {directory}: {str(e)}")
                continue
        else:
            print(f"✓ 目录已存在: {directory}")
        
        # 检查目录权限
        try:
            test_file = os.path.join(dir_path, '.permission_test')
            with open(test_file, 'w') as f:
                f.write('test')
            os.remove(test_file)
            print(f"✓ 目录 {directory} 有写入权限")
        except Exception as e:
            print(f"❌ 目录 {directory} 没有写入权限: {str(e)}")
            print(f"  请运行: chmod -R 755 {dir_path}")
    
    print("\n所有目录检查完成。")

if __name__ == "__main__":
    check_and_create_directories()