#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将PNG图像转换为macOS .icns图标文件的脚本
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

def convert_to_icns(png_file):
    """
    将PNG图像转换为.icns文件
    
    参数:
    png_file (str): PNG图像文件路径
    
    返回:
    str: 生成的.icns文件路径或None（如果转换失败）
    """
    if not os.path.exists(png_file):
        print(f"错误: 找不到文件 {png_file}")
        return None
    
    # 获取不带扩展名的文件名
    file_name = Path(png_file).stem
    icns_file = f"{file_name}.icns"
    iconset_folder = f"{file_name}.iconset"
    
    # 创建临时iconset文件夹
    if os.path.exists(iconset_folder):
        shutil.rmtree(iconset_folder)
    os.makedirs(iconset_folder)
    
    try:
        # 生成不同尺寸的图标
        sizes = [16, 32, 128, 256, 512]
        for size in sizes:
            # 1x 分辨率
            subprocess.run([
                "sips", 
                "-z", str(size), str(size), 
                png_file, 
                "--out", f"{iconset_folder}/icon_{size}x{size}.png"
            ], check=True)
            
            # 2x 分辨率 (Retina)
            if size * 2 <= 1024:  # 确保不超过1024x1024
                subprocess.run([
                    "sips", 
                    "-z", str(size * 2), str(size * 2), 
                    png_file, 
                    "--out", f"{iconset_folder}/icon_{size}x{size}@2x.png"
                ], check=True)
        
        # 使用iconutil将iconset转换为icns
        subprocess.run(["iconutil", "-c", "icns", iconset_folder], check=True)
        
        print(f"成功创建图标: {icns_file}")
        return icns_file
    
    except subprocess.CalledProcessError as e:
        print(f"转换过程中出错: {e}")
        return None
    
    finally:
        # 清理临时文件夹
        if os.path.exists(iconset_folder):
            shutil.rmtree(iconset_folder)

def main():
    if len(sys.argv) < 2:
        print("用法: python convert_icon.py <png文件路径>")
        return
    
    png_file = sys.argv[1]
    convert_to_icns(png_file)

if __name__ == "__main__":
    main()