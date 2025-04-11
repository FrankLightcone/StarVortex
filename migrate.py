#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
作业传输系统 - 数据结构迁移工具

该脚本用于将旧版数据结构迁移到新版数据结构。
主要迁移内容：
1. 将course_config.json从"课程包含班级"结构迁移到"班级包含课程"结构
2. 将文件系统的目录结构从 `upload/课程/作业/` 调整为 `upload/课程/班级/作业/`
3. 更新assignments.json中的作业记录，添加适用班级信息

使用方法:
$ python migrate_data.py

作者: System Admin
版本: 1.0
日期: 2025-04-11
"""

import json
import os
import shutil
import sys
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s: %(message)s',
    filename=f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'
)

# 文件路径
COURSE_CONFIG_FILE = 'course_config.json'
ASSIGNMENTS_FILE = 'assignments.json'
UPLOAD_FOLDER = 'static/upload'

def load_json_file(file_path):
    """加载JSON文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"文件不存在: {file_path}")
        print(f"错误: 文件 {file_path} 不存在")
        return None
    except json.JSONDecodeError:
        logging.error(f"文件格式错误: {file_path}")
        print(f"错误: 文件 {file_path} 不是有效的JSON格式")
        return None

def save_json_file(file_path, data):
    """保存JSON文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logging.error(f"保存文件失败: {file_path}, 错误: {str(e)}")
        print(f"错误: 保存文件 {file_path} 失败: {str(e)}")
        return False

def backup_file(file_path):
    """备份文件"""
    backup_path = f"{file_path}.bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    try:
        shutil.copy2(file_path, backup_path)
        logging.info(f"文件已备份: {file_path} -> {backup_path}")
        print(f"文件已备份: {file_path} -> {backup_path}")
        return True
    except Exception as e:
        logging.error(f"备份文件失败: {file_path}, 错误: {str(e)}")
        print(f"错误: 备份文件 {file_path} 失败: {str(e)}")
        return False

def migrate_course_config():
    """迁移课程配置文件"""
    print("\n===== 迁移课程配置文件 =====")
    logging.info("开始迁移课程配置文件")
    
    # 加载旧配置文件
    old_config = load_json_file(COURSE_CONFIG_FILE)
    if old_config is None:
        return False
    
    # 备份配置文件
    if not backup_file(COURSE_CONFIG_FILE):
        return False
    
    # 创建新配置结构
    new_config = {"classes": []}
    
    # 检查旧配置是否已经是新结构
    if "classes" in old_config:
        logging.info("配置文件已经是新结构，无需迁移")
        print("配置文件已经是新结构，无需迁移")
        return True
    
    # 从旧配置中提取课程和班级
    courses = old_config.get("courses", [])
    all_classes = set()
    
    # 收集所有班级
    for course in courses:
        for class_info in course.get("classes", []):
            all_classes.add(class_info["name"])
    
    # 为每个班级创建记录
    for class_name in all_classes:
        class_record = {
            "name": class_name,
            "description": "",  # 无法从旧结构获取描述
            "courses": []
        }
        
        # 添加该班级可访问的课程
        for course in courses:
            if any(c["name"] == class_name for c in course.get("classes", [])):
                class_record["courses"].append({
                    "name": course["name"],
                    "assignments": course.get("assignments", [])
                })
        
        new_config["classes"].append(class_record)
    
    # 保存新配置
    if save_json_file(COURSE_CONFIG_FILE, new_config):
        logging.info("课程配置文件迁移成功")
        print("课程配置文件迁移成功")
        return True
    return False

def migrate_file_structure():
    """迁移文件系统结构"""
    print("\n===== 迁移文件系统结构 =====")
    logging.info("开始迁移文件系统结构")
    
    # 检查上传目录是否存在
    if not os.path.exists(UPLOAD_FOLDER):
        logging.error(f"上传目录不存在: {UPLOAD_FOLDER}")
        print(f"错误: 上传目录 {UPLOAD_FOLDER} 不存在")
        return False
    
    # 加载当前课程配置
    config = load_json_file(COURSE_CONFIG_FILE)
    if config is None:
        return False
    
    # 获取新结构中的班级和课程关系
    class_course_map = {}
    for class_info in config.get("classes", []):
        class_name = class_info["name"]
        class_course_map[class_name] = [course["name"] for course in class_info.get("courses", [])]
    
    # 创建临时目录
    temp_dir = f"{UPLOAD_FOLDER}_temp"
    os.makedirs(temp_dir, exist_ok=True)
    
    # 遍历上传目录下的课程文件夹
    for course_name in os.listdir(UPLOAD_FOLDER):
        course_path = os.path.join(UPLOAD_FOLDER, course_name)
        if not os.path.isdir(course_path):
            continue
        
        # 创建新的课程目录
        new_course_path = os.path.join(temp_dir, course_name)
        os.makedirs(new_course_path, exist_ok=True)
        
        # 遍历该课程下的作业文件夹
        for assignment_name in os.listdir(course_path):
            assignment_path = os.path.join(course_path, assignment_name)
            if not os.path.isdir(assignment_path):
                continue
            
            # 确定哪些班级有这个课程
            for class_name, courses in class_course_map.items():
                if course_name in courses:
                    # 创建班级目录
                    class_path = os.path.join(new_course_path, class_name)
                    os.makedirs(class_path, exist_ok=True)
                    
                    # 创建作业目录
                    new_assignment_path = os.path.join(class_path, assignment_name)
                    
                    # 复制作业目录中的内容
                    try:
                        if not os.path.exists(new_assignment_path):
                            shutil.copytree(assignment_path, new_assignment_path)
                        logging.info(f"复制作业目录: {assignment_path} -> {new_assignment_path}")
                    except Exception as e:
                        logging.error(f"复制作业目录失败: {assignment_path} -> {new_assignment_path}, 错误: {str(e)}")
                        print(f"错误: 复制作业目录失败: {assignment_path} -> {new_assignment_path}, 错误: {str(e)}")
    
    # 备份并替换原目录
    try:
        backup_dir = f"{UPLOAD_FOLDER}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.move(UPLOAD_FOLDER, backup_dir)
        shutil.move(temp_dir, UPLOAD_FOLDER)
        logging.info(f"文件系统结构迁移成功. 原目录已备份到: {backup_dir}")
        print(f"文件系统结构迁移成功. 原目录已备份到: {backup_dir}")
        return True
    except Exception as e:
        logging.error(f"替换目录失败: {str(e)}")
        print(f"错误: 替换目录失败: {str(e)}")
        return False

def update_assignments_file():
    """更新作业配置文件"""
    print("\n===== 更新作业配置文件 =====")
    logging.info("开始更新作业配置文件")
    
    # 加载作业配置
    assignments = load_json_file(ASSIGNMENTS_FILE)
    if assignments is None:
        return False
    
    # 加载课程配置
    config = load_json_file(COURSE_CONFIG_FILE)
    if config is None:
        return False
    
    # 备份作业配置文件
    if not backup_file(ASSIGNMENTS_FILE):
        return False
    
    # 为每个作业添加适用班级信息
    updated = False
    for assignment in assignments:
        if "classNames" not in assignment:
            course_name = assignment.get("course")
            class_names = []
            
            # 找出哪些班级包含这个课程的这个作业
            for class_info in config.get("classes", []):
                for course_info in class_info.get("courses", []):
                    if course_info["name"] == course_name and assignment["name"] in course_info.get("assignments", []):
                        class_names.append(class_info["name"])
            
            # 添加班级信息
            assignment["classNames"] = class_names
            updated = True
    
    # 保存更新后的作业配置
    if save_json_file(ASSIGNMENTS_FILE, assignments):
        logging.info(f"作业配置文件更新成功{' (有更新)' if updated else ' (无变化)'}")
        print(f"作业配置文件更新成功{' (有更新)' if updated else ' (无变化)'}")
        return True
    return False

def main():
    """主函数"""
    print("===== 作业传输系统数据迁移工具 =====")
    print("该工具将迁移旧版数据结构到新版数据结构。\n")
    
    # 确认操作
    confirm = input("警告: 迁移过程将修改系统数据结构，建议先备份整个系统。确定要继续吗? (y/n): ")
    if confirm.lower() != 'y':
        print("操作已取消")
        return
    
    # 执行迁移
    steps = [
        ("1. 迁移课程配置文件", migrate_course_config),
        ("2. 更新作业配置文件", update_assignments_file),
        ("3. 迁移文件系统结构", migrate_file_structure)
    ]
    
    success_count = 0
    for step_name, step_func in steps:
        print(f"\n开始 {step_name}...")
        if step_func():
            success_count += 1
        else:
            print(f"错误: {step_name} 失败")
    
    # 总结
    print(f"\n===== 迁移完成 =====")
    print(f"成功: {success_count}/{len(steps)} 步骤")
    print(f"详细日志已保存")

if __name__ == "__main__":
    main()