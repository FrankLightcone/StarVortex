document.addEventListener('DOMContentLoaded', function() {
    // 获取登录表单元素
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);

            fetch('/login', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.redirected) {
                    // 登录成功，跳转页面
                    window.location.href = response.url;
                } else {
                    // 登录失败，显示Toast
                    showToast('登录失败，请检查用户名和密码', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('网络错误，请稍后重试', 'error');
            });
        });
    }
});