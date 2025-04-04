/**
 * toast.js - 消息提示模块
 * 
 * 提供网页通知toast功能，用于向用户显示临时的提示信息。
 * 支持成功和错误两种不同类型的提示，并可自定义显示时长。
 * 
 * @module toast
 * 
 * 主要功能：
 * - 创建和显示临时浮动提示信息
 * - 支持成功(绿色)和错误(红色)两种提示类型
 * - 自动淡入淡出动画效果
 * - 定时自动消失
 * 
 * @function showToast
 *   显示一个toast通知
 *   @param {string} message - 通知消息内容
 *   @param {string} type - 通知类型，'error'或'success'，默认为'error'
 *   @param {number} duration - 显示时长（毫秒），默认为3000ms
 *   @returns {void}
 */

function showToast(message, type = 'error', duration = 3000) {
    // 获取Toast元素
    const toast = document.getElementById('toast');
    
    // 设置消息
    toast.textContent = message;
    
    // 设置颜色类型
    if (type === 'success') {
        toast.classList.remove('bg-red-500');
        toast.classList.add('bg-green-500');
    } else if (type === 'error') {
        toast.classList.remove('bg-green-500');
        toast.classList.add('bg-red-500');
    }
    
    // 显示Toast
    toast.classList.add('show');
    
    // 定时隐藏Toast
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}