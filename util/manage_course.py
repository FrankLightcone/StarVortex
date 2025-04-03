#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
课程和作业管理工具
用于添加、修改、删除课程和作业配置
"""

import json
import os
import sys

CONFIG_FILE = '../course_config.json'

def clear_screen():
    """清空终端屏幕"""
    os.system('cls' if os.name == 'nt' else 'clear')

def load_config():
    """加载配置文件"""
    if not os.path.exists(CONFIG_FILE):
        return {
            "courses": []
        }
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载配置文件出错: {e}")
        return {"courses": []}

def save_config(config):
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        print("配置已保存")
    except Exception as e:
        print(f"保存配置文件出错: {e}")

def list_courses(config):
    """列出所有课程"""
    clear_screen()
    print("\n==== 课程列表 ====\n")
    
    if not config["courses"]:
        print("暂无课程")
        return
    
    for i, course in enumerate(config["courses"], 1):
        name = course["name"]
        assignment_count = len(course.get("assignments", []))
        print(f"{i}. {name} (作业数量: {assignment_count})")

def add_course(config):
    """添加新课程"""
    clear_screen()
    print("\n==== 添加课程 ====\n")
    
    name = input("请输入课程名称: ").strip()
    
    if not name:
        print("课程名称不能为空")
        return
    
    # 检查是否已存在
    for course in config["courses"]:
        if course["name"] == name:
            print("课程已存在")
            return
    
    # 添加新课程
    config["courses"].append({
        "name": name,
        "assignments": []
    })
    
    save_config(config)
    print(f"课程 '{name}' 已添加")

def manage_course(config):
    """管理指定课程"""
    clear_screen()
    list_courses(config)
    
    if not config["courses"]:
        return
    
    choice = input("\n请选择要管理的课程编号 (输入 0 返回): ")
    
    try:
        choice = int(choice)
        if choice == 0:
            return
        
        if 1 <= choice <= len(config["courses"]):
            course = config["courses"][choice - 1]
            course_menu(config, course)
        else:
            print("无效的选择")
    except ValueError:
        print("请输入数字")

def course_menu(config, course):
    """课程管理菜单"""
    while True:
        clear_screen()
        print(f"\n==== 管理课程: {course['name']} ====\n")
        print("1. 查看所有作业")
        print("2. 添加作业")
        print("3. 删除作业")
        print("4. 修改课程名称")
        print("5. 删除课程")
        print("0. 返回上级菜单")
        
        choice = input("\n请选择操作: ")
        
        if choice == "1":
            list_assignments(course)
            input("\n按任意键继续...")
        elif choice == "2":
            add_assignment(config, course)
        elif choice == "3":
            delete_assignment(config, course)
        elif choice == "4":
            rename_course(config, course)
        elif choice == "5":
            if delete_course(config, course):
                break
        elif choice == "0":
            break
        else:
            print("无效的选择")

def list_assignments(course):
    """列出课程的所有作业"""
    print(f"\n==== {course['name']} 的作业列表 ====\n")
    
    assignments = course.get("assignments", [])
    if not assignments:
        print("暂无作业")
        return
    
    for i, assignment in enumerate(assignments, 1):
        print(f"{i}. {assignment}")

def add_assignment(config, course):
    """添加作业到课程"""
    clear_screen()
    print(f"\n==== 为 {course['name']} 添加作业 ====\n")
    
    name = input("请输入作业名称: ").strip()
    
    if not name:
        print("作业名称不能为空")
        return
    
    # 检查是否已存在
    if name in course.get("assignments", []):
        print("作业已存在")
        return
    
    # 添加作业
    if "assignments" not in course:
        course["assignments"] = []
    
    course["assignments"].append(name)
    save_config(config)
    print(f"作业 '{name}' 已添加到 '{course['name']}'")

def delete_assignment(config, course):
    """从课程中删除作业"""
    clear_screen()
    list_assignments(course)
    
    assignments = course.get("assignments", [])
    if not assignments:
        return
    
    choice = input("\n请选择要删除的作业编号 (输入 0 返回): ")
    
    try:
        choice = int(choice)
        if choice == 0:
            return
        
        if 1 <= choice <= len(assignments):
            assignment = assignments[choice - 1]
            confirm = input(f"确定要删除作业 '{assignment}' 吗? (y/n): ")
            
            if confirm.lower() == 'y':
                assignments.pop(choice - 1)
                save_config(config)
                print(f"作业 '{assignment}' 已删除")
        else:
            print("无效的选择")
    except ValueError:
        print("请输入数字")

def rename_course(config, course):
    """重命名课程"""
    clear_screen()
    print(f"\n==== 重命名课程: {course['name']} ====\n")
    
    name = input("请输入新的课程名称: ").strip()
    
    if not name:
        print("课程名称不能为空")
        return
    
    # 检查是否与其他课程重名
    for other_course in config["courses"]:
        if other_course != course and other_course["name"] == name:
            print("课程名称已存在")
            return
    
    old_name = course["name"]
    course["name"] = name
    save_config(config)
    print(f"课程已从 '{old_name}' 重命名为 '{name}'")

def delete_course(config, course):
    """删除课程"""
    clear_screen()
    print(f"\n==== 删除课程: {course['name']} ====\n")
    
    confirm = input(f"确定要删除课程 '{course['name']}' 及其所有作业吗? (y/n): ")
    
    if confirm.lower() == 'y':
        config["courses"].remove(course)
        save_config(config)
        print(f"课程 '{course['name']}' 已删除")
        return True
    
    return False

def main_menu():
    """主菜单"""
    while True:
        clear_screen()
        config = load_config()
        
        print("\n==== 课程管理工具 ====\n")
        print("1. 查看所有课程")
        print("2. 添加课程")
        print("3. 管理课程")
        print("0. 退出程序")
        
        choice = input("\n请选择操作: ")
        
        if choice == "1":
            list_courses(config)
            input("\n按任意键继续...")
        elif choice == "2":
            add_course(config)
        elif choice == "3":
            manage_course(config)
        elif choice == "0":
            print("再见!")
            break
        else:
            print("无效的选择")

if __name__ == "__main__":
    main_menu()