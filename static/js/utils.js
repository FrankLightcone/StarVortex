/**
 * utils.js - 通用工具函数模块
 * 
 * 提供系统中使用的通用实用函数，如格式化文件大小、日期时间格式化等辅助功能。
 * 
 * @module utils
 * 
 * 主要功能：
 * - 文件大小格式化（从字节转为人类可读格式）
 * - 日期时间格式化
 * 
 * @function formatFileSize
 *   将文件大小（字节）转换为可读格式（B, KB, MB, GB）
 *   @param {number} bytes - 文件大小（字节）
 *   @returns {string} - 格式化后的大小字符串，如"2.5 MB"
 * 
 * @function formatDateTime
 *   将日期时间格式化为本地字符串
 *   @param {string|Date} dateTime - 日期时间对象或字符串
 *   @returns {string} - 格式化后的日期时间字符串，如"2025-04-01 14:30"
 */

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的大小字符串
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 格式化日期时间为本地字符串
 * @param {string|Date} dateTime - 日期时间
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(dateTime) {
    const date = new Date(dateTime);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}