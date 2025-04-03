/**
 * 显示Toast通知
 * @param {string} message - 通知消息内容
 * @param {string} type - 通知类型，'error'或'success'
 * @param {number} duration - 显示时长（毫秒）
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