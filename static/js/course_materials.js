/**
 * course_materials.js - 课程资料模块
 * 
 * 处理课程资料的展示和交互，包括资料列表获取、过滤和查看详情。
 * 集成到主界面的标签页系统中，提供课程资料的访问功能。
 * 
 * @module course_materials
 * 
 * 主要功能：
 * - 加载课程资料列表
 * - 按课程筛选资料
 * - 查看资料详情和下载
 * - 与主界面标签页系统集成
 */

document.addEventListener('DOMContentLoaded', function() {
    const tabButton = document.getElementById('tabMaterials');
    // 添加课程资料标签页到标签页导航
    addMaterialsTabButton();

    // 获取DOM元素
    const materialsCourseFilter = document.getElementById('materialsCourseFilter');
    const courseCardContainer = document.getElementById('courseCardContainer');
    const materialsLoading = document.getElementById('materialsLoading');
    const materialsEmpty = document.getElementById('materialsEmpty');
    
    // 模态框相关元素
    const courseAssetsModal = document.getElementById('courseAssetsModal');
    const courseAssetsTitle = document.getElementById('courseAssetsTitle');
    const courseAssetsDescription = document.getElementById('courseAssetsDescription');
    const courseAssetsList = document.getElementById('courseAssetsList');

    let currentPage = 1;
    const pageSize = 5; // 每页显示多少条
    let allAssets = []; // 保存完整资料列表

    
    // 初始化Flowbite模态框
    initFlowbiteModal();
    
    // 初始加载课程列表
    loadCoursesList();
    
    // 课程筛选变化事件
    if (materialsCourseFilter) {
        materialsCourseFilter.addEventListener('change', function() {
            filterCoursesByName(this.value);
        });
    }
    
    /**
     * 添加课程资料标签页按钮
     */
    function addMaterialsTabButton() {
        // 获取标签页容器
        const tabNav = document.querySelector('.tab-nav');
        if (!tabNav) return;
        
        // // 创建新的标签页按钮
        // const tabButton = document.createElement('button');
        // tabButton.id = 'tabMaterials';
        // tabButton.className = 'tab-button';
        // tabButton.innerHTML = '<i class="fas fa-book mr-2"></i>课程资料';
        
        // // 添加到导航中
        // tabNav.appendChild(tabButton);
        if (!tabButton) {
            console.error('标签页按钮不存在');
            return;
        }
        
        // 添加点击事件
        tabButton.addEventListener('click', function() {
            // 获取所有标签按钮和内容
            const allTabButtons = document.querySelectorAll('.tab-button');
            const allTabContents = document.querySelectorAll('.tab-content');
            
            // 移除所有活动状态
            allTabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.classList.remove('text-blue-600', 'border-blue-500');
                btn.classList.add('text-gray-500', 'border-transparent');
            });
            
            allTabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // 设置当前标签为活动状态
            tabButton.classList.add('active');
            tabButton.classList.add('text-blue-600', 'border-blue-500');
            tabButton.classList.remove('text-gray-500', 'border-transparent');
            
            // 显示课程资料内容
            const materialsTab = document.getElementById('materialsTab');
            if (materialsTab) {
                materialsTab.classList.add('active');
                // 加载课程资料
                loadMaterials();
            }
        });
    }
    
    /**
     * 初始化Flowbite模态框
     */
    function initFlowbiteModal() {
        // Close modal buttons
        const closeModalBtns = document.querySelectorAll('[data-modal-hide="courseAssetsModal"]');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                hideModal(courseAssetsModal);
            });
        });
        
        // Clicking backdrop to close
        courseAssetsModal?.addEventListener('click', function(e) {
            if (e.target === courseAssetsModal) {
                hideModal(courseAssetsModal);
            }
        });
    
        // Optional: ESC key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && courseAssetsModal && 
                !courseAssetsModal.classList.contains('hidden')) {
                hideModal(courseAssetsModal);
            }
        });
    }
    
    /**
     * Shows modal with proper animation and accessibility
     * @param {HTMLElement} modal - Modal element
     */
    function showModal(modal) {
        if (!modal) return;
        
        // Remove aria-hidden when showing
        modal.removeAttribute('aria-hidden');
        
        // Make modal visible but with opacity 0
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.opacity = '0';
        
        // Force browser reflow for animation
        void modal.offsetWidth;
        
        // Start animation
        modal.style.opacity = '1';
        modal.classList.add('show');
        
        // Lock background scrolling
        document.body.style.overflow = 'hidden';
    }

    /**
     * Hides modal with proper animation and accessibility
     * @param {HTMLElement} modal - Modal element
     */
    function hideModal(modal) {
        if (!modal) return;
        
        // Start animation
        modal.classList.remove('show');
        modal.style.opacity = '0';
        
        // Wait for animation to complete
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            
            // Add aria-hidden when hidden
            modal.setAttribute('aria-hidden', 'true');
            
            // Restore scrolling
            document.body.style.overflow = '';
        }, 300);
    }
    
    /**
     * 加载课程列表
     */
    function loadCoursesList() {
        // 显示加载状态
        if (materialsLoading) {
            materialsLoading.classList.remove('hidden');
        }
        if (courseCardContainer) {
            courseCardContainer.classList.add('hidden');
        }
        if (materialsEmpty) {
            materialsEmpty.classList.add('hidden');
        }
        
        // 从服务器获取课程列表
        fetch('/get_courses')
            .then(response => response.json())
            .then(data => {
                // 清空课程筛选下拉框
                if (materialsCourseFilter) {
                    materialsCourseFilter.innerHTML = '<option value="">选择课程</option>';
                    
                    // 添加课程选项
                    if (data.courses && data.courses.length > 0) {
                        data.courses.forEach(course => {
                            const option = document.createElement('option');
                            option.value = course;
                            option.textContent = course;
                            materialsCourseFilter.appendChild(option);
                        });
                    }
                }
                
                // 加载所有课程资料
                loadMaterials();
            })
            .catch(error => {
                console.error('加载课程列表失败:', error);
                // 隐藏加载状态
                if (materialsLoading) {
                    materialsLoading.classList.add('hidden');
                }
                
                // 显示空状态
                if (materialsEmpty) {
                    materialsEmpty.classList.remove('hidden');
                }
            });
    }
    
    /**
     * 加载课程资料
     * @param {string} courseName - 可选，指定课程名称进行筛选
     */
    function loadMaterials(courseName = '') {
        // 显示加载状态
        if (materialsLoading) {
            materialsLoading.classList.remove('hidden');
        }
        if (courseCardContainer) {
            courseCardContainer.classList.add('hidden');
        }
        if (materialsEmpty) {
            materialsEmpty.classList.add('hidden');
        }
        
        // 构建API URL
        let url = '/get_course_materials';
        if (courseName) {
            url += `?course=${encodeURIComponent(courseName)}`;
        }
        
        // 从服务器获取课程资料
        fetch(url)
            .then(response => response.json())
            .then(data => {
                // 隐藏加载状态
                if (materialsLoading) {
                    materialsLoading.classList.add('hidden');
                }
                
                // 检查是否有课程资料
                if (!data.courses || data.courses.length === 0) {
                    if (materialsEmpty) {
                        materialsEmpty.classList.remove('hidden');
                    }
                    return;
                }
                
                // 渲染课程卡片
                renderCourseCards(data.courses);
                
                // 显示课程容器
                if (courseCardContainer) {
                    courseCardContainer.classList.remove('hidden');
                }
            })
            .catch(error => {
                console.error('加载课程资料失败:', error);
                // 隐藏加载状态
                if (materialsLoading) {
                    materialsLoading.classList.add('hidden');
                }
                
                // 显示空状态
                if (materialsEmpty) {
                    materialsEmpty.classList.remove('hidden');
                }
            });
    }
    
    /**
     * 按课程名称筛选
     * @param {string} courseName - 课程名称
     */
    function filterCoursesByName(courseName) {
        loadMaterials(courseName);
    }
    
    /**
     * 渲染课程卡片
     * @param {Array} courses - 课程数据数组
     */
    function renderCourseCards(courses) {
        if (!courseCardContainer) return;
        
        // 清空容器
        courseCardContainer.innerHTML = '';
        
        // 添加课程卡片
        courses.forEach(course => {
            const card = createCourseCard(course);
            courseCardContainer.appendChild(card);
        });
    }
    
    /**
     * 创建课程卡片
     * @param {Object} course - 课程对象
     * @returns {HTMLElement} - 课程卡片元素
     */
    function createCourseCard(course) {
        // 创建卡片容器
        const card = document.createElement('div');
        card.className = 'bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 overflow-hidden transition-transform transform hover:-translate-y-1 hover:shadow-md';
        
        // 设置卡片封面图
        const coverImageUrl = course.cover_image || getDefaultCoverImage(course.name);
        
        // 格式化资料数量
        const fileCount = course.file_count || 0;
        const fileCountText = `${fileCount} 个资料`;
        
        // 格式化更新时间
        const lastUpdated = course.last_updated ? 
            new Date(course.last_updated).toLocaleDateString('zh-CN') : 
            '暂无更新';
        
        // 卡片内容
        card.innerHTML = `
            <div class="relative overflow-hidden" style="height: 160px;">
                <img class="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 transform hover:scale-110" 
                     src="${coverImageUrl}" 
                     alt="${course.name}" />
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-4">
                    <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-sm">${course.type || '课程资料'}</span>
                </div>
            </div>
            <div class="p-5">
                <h5 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white line-clamp-1">${course.name}</h5>
                <p class="mt-2 text-gray-600 text-sm line-clamp-3">${course.description || '暂无描述信息'}</p>
                
                <div class="flex items-center mt-4 mb-4">
                    <svg class="w-4 h-4 text-gray-500 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span class="text-sm text-gray-600">${fileCountText}</span>
                    
                    <svg class="w-4 h-4 text-gray-500 ml-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-sm text-gray-600">更新于 ${lastUpdated}</span>
                </div>
                
                <button type="button" class="view-assets-btn text-white bg-blue-500 hover:bg-blue-650 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center w-full justify-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    查看资料
                </button>
            </div>
        `;
        
        // 添加查看资料按钮点击事件
        const viewAssetsBtn = card.querySelector('.view-assets-btn');
        if (viewAssetsBtn) {
            viewAssetsBtn.addEventListener('click', () => {
                openCourseAssetsModal(course);
            });
        }
        
        return card;
    }
    
    /**
     * 获取默认课程封面图
     * @param {string} courseName - 课程名称
     * @returns {string} - 封面图URL
     */
    function getDefaultCoverImage(courseName) {
        // 根据课程名生成一个伪随机数，用于选择默认封面
        let hash = 0;
        if (courseName) {
            for (let i = 0; i < courseName.length; i++) {
                hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
            }
        }
        
        // 默认封面图列表
        const defaultCovers = [
            '/static/img/course_covers/default1.jpg',
            '/static/img/course_covers/default2.jpg',
            '/static/img/course_covers/default3.jpg',
            '/static/img/course_covers/default4.jpg',
            '/static/img/course_covers/default5.jpg'
        ];
        
        // 如果没有默认封面图，返回占位图
        if (defaultCovers.length === 0) {
            return `https://via.placeholder.com/400x200/3b82f6/ffffff?text=${encodeURIComponent(courseName || '课程资料')}`;
        }
        
        // 选择一个封面
        const index = Math.abs(hash) % defaultCovers.length;
        return defaultCovers[index];
    }
    
    /**
     * 打开课程资料模态框
     * @param {Object} course - 课程对象
     */
    function openCourseAssetsModal(course) {
        if (!courseAssetsModal || !courseAssetsTitle || !courseAssetsDescription || !courseAssetsList) return;
        
        // 设置模态框标题和描述
        courseAssetsTitle.textContent = course.name || '课程资料';
        courseAssetsDescription.textContent = course.description || '暂无课程描述';
        
        // 显示加载中状态
        courseAssetsList.innerHTML = `
            <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td colspan="5" class="px-6 py-10 text-center">
                    <div class="flex flex-col items-center">
                        <svg class="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p class="text-gray-500">加载资料中...</p>
                    </div>
                </td>
            </tr>
        `;
        
        // 显示模态框
        showModal(courseAssetsModal);
        
        // 加载课程资料
        loadCourseAssets(course.id || course.name);
    }
    
    /**
     * 加载课程资料
     * @param {string} courseId - 课程ID或名称
     */
    function loadCourseAssets(courseId) {
        if (!courseAssetsList) return;
        
        // 构建API URL
        const url = `/get_course_assets_by_name_and_class?course=${encodeURIComponent(courseId)}&class_name=${encodeURIComponent(getUserClassName())}`;
        
        // 从服务器获取课程资料
        fetch(url)
            .then(response => response.json())
            .then(data => {
                // 检查是否有资料
                if (!data.assets || data.assets.length === 0) {
                    courseAssetsList.innerHTML = `
                        <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                            <td colspan="5" class="px-6 py-10 text-center">
                                <div class="flex flex-col items-center">
                                    <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <p class="text-gray-500">暂无资料</p>
                                </div>
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                // 渲染资料列表
                renderAssetsList(data.assets);
            })
            .catch(error => {
                console.error('加载课程资料失败:', error);
                
                courseAssetsList.innerHTML = `
                    <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                        <td colspan="5" class="px-6 py-4 text-center text-red-500">
                            加载失败，请稍后重试
                        </td>
                    </tr>
                `;
            });
    }
    
    /**
     * 渲染资料列表
     * @param {Array} assets - 资料数组
     */
    function renderAssetsList(assets) {
        if (!courseAssetsList) return;
    
        allAssets = assets; // 保存所有数据
        currentPage = 1;
        renderAssetsPage(currentPage);
        updatePaginationControls();
    }

    function renderAssetsPage(page) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageAssets = allAssets.slice(startIndex, endIndex);
    
        courseAssetsList.innerHTML = '';
    
        pageAssets.forEach(asset => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
            const fileType = getFileTypeInfo(asset.file_name);
            const fileSize = formatFileSize(asset.file_size || 0);
            const uploadDate = asset.upload_date ? new Date(asset.upload_date).toLocaleDateString('zh-CN') : '-';
    
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 ${fileType.colorClass} w-8 h-8 rounded flex items-center justify-center mr-3">
                            <i class="${fileType.iconClass}"></i>
                        </div>
                        <div class="flex-1 truncate max-w-xs">${asset.file_name}</div>
                    </div>
                </td>
                <td class="px-6 py-4">${fileType.label}</td>
                <td class="px-6 py-4">${fileSize}</td>
                <td class="px-6 py-4">${uploadDate}</td>
                <td class="px-12 py-4">
                    <div class="flex space-x-2">
                        <button type="button" class="preview-btn font-medium text-blue-600 dark:text-blue-500 hover:underline"
                            data-file-id="${asset.id || ''}" data-file-path="${asset.file_path || ''}">
                            预览
                        </button>
                        <a href="${getDownloadUrl(asset)}"
                            class="font-medium text-green-600 dark:text-green-500 hover:underline"
                            download="${asset.file_name}">下载</a>
                    </div>
                </td>
            `;
    
            // 绑定预览按钮
            const previewBtn = row.querySelector('.preview-btn');
            if (previewBtn) {
                previewBtn.addEventListener('click', () => {
                    previewFile(asset);
                });
            }
    
            courseAssetsList.appendChild(row);
        });
    }
    
    /**
     * 获取文件类型信息
     * @param {string} fileName - 文件名
     * @returns {Object} - 文件类型信息对象，包含图标类和标签
     */
    function getFileTypeInfo(fileName) {
        if (!fileName) return { iconClass: 'fas fa-file', label: '未知', colorClass: 'bg-gray-200' };
        
        const extension = fileName.split('.').pop().toLowerCase();
        
        const fileTypes = {
            // 文档类型
            'pdf': { iconClass: 'fas fa-file-pdf', label: 'PDF文档', colorClass: 'bg-red-100 text-red-500' },
            'doc': { iconClass: 'fas fa-file-word', label: 'Word文档', colorClass: 'bg-blue-100 text-blue-500' },
            'docx': { iconClass: 'fas fa-file-word', label: 'Word文档', colorClass: 'bg-blue-100 text-blue-500' },
            'txt': { iconClass: 'fas fa-file-alt', label: '文本文件', colorClass: 'bg-gray-100 text-gray-500' },
            
            // 表格类型
            'xls': { iconClass: 'fas fa-file-excel', label: 'Excel表格', colorClass: 'bg-green-100 text-green-500' },
            'xlsx': { iconClass: 'fas fa-file-excel', label: 'Excel表格', colorClass: 'bg-green-100 text-green-500' },
            'csv': { iconClass: 'fas fa-file-csv', label: 'CSV表格', colorClass: 'bg-green-100 text-green-500' },
            
            // 演示文稿
            'ppt': { iconClass: 'fas fa-file-powerpoint', label: 'PPT演示', colorClass: 'bg-orange-100 text-orange-500' },
            'pptx': { iconClass: 'fas fa-file-powerpoint', label: 'PPT演示', colorClass: 'bg-orange-100 text-orange-500' },
            
            // 图片类型
            'jpg': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            'jpeg': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            'png': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            'gif': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            
            // 压缩文件
            'zip': { iconClass: 'fas fa-file-archive', label: '压缩文件', colorClass: 'bg-yellow-100 text-yellow-500' },
            'rar': { iconClass: 'fas fa-file-archive', label: '压缩文件', colorClass: 'bg-yellow-100 text-yellow-500' },
            '7z': { iconClass: 'fas fa-file-archive', label: '压缩文件', colorClass: 'bg-yellow-100 text-yellow-500' },
            
            // 代码文件
            'py': { iconClass: 'fas fa-file-code', label: 'Python代码', colorClass: 'bg-indigo-100 text-indigo-500' },
            'java': { iconClass: 'fas fa-file-code', label: 'Java代码', colorClass: 'bg-indigo-100 text-indigo-500' },
            'js': { iconClass: 'fas fa-file-code', label: 'JavaScript代码', colorClass: 'bg-indigo-100 text-indigo-500' },
            'html': { iconClass: 'fas fa-file-code', label: 'HTML文件', colorClass: 'bg-indigo-100 text-indigo-500' },
            'css': { iconClass: 'fas fa-file-code', label: 'CSS文件', colorClass: 'bg-indigo-100 text-indigo-500' }
        };
        
        return fileTypes[extension] || { iconClass: 'fas fa-file', label: '其他文件', colorClass: 'bg-gray-100 text-gray-500' };
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} - 格式化后的文件大小字符串
     */
    function formatFileSize(bytes) {
        if (typeof window.formatFileSize === 'function') {
            return window.formatFileSize(bytes);
        }
        
        // 默认实现
        if (bytes === 0) return '0 Bytes';
        
        const units = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
    }
    
    /**
     * 获取下载URL
     * @param {Object} asset - 资料对象
     * @returns {string} - 下载URL
     */
    function getDownloadUrl(asset) {
        // 如果资料对象包含下载路径，直接使用
        if (asset.download_url) {
            return asset.download_url;
        }
        
        // 否则构建下载路径
        return `/download_asset?course=${encodeURIComponent(asset.course_id || asset.course_name || '')}&file_id=${encodeURIComponent(asset.id || '')}&file_name=${encodeURIComponent(asset.file_name || '')}`;
    }
    
    /**
     * 预览文件
     * @param {Object} asset - 资料对象
     */
    function previewFile(asset) {
        // 构建预览URL
        const previewUrl = `/preview_asset?file_path=${encodeURIComponent(asset.file_path || '')}&file_name=${encodeURIComponent(asset.file_name || '')}`;
        
        // 在新窗口打开预览
        window.open(previewUrl, '_blank');
    }
    
    /**
     * 获取当前用户的班级名称
     * @returns {string} - 班级名称
     */
    function getUserClassName() {
        // 尝试从页面元素中获取班级名称
        const classNameInput = document.getElementById('class_name');
        if (classNameInput && classNameInput.value) {
            return classNameInput.value;
        }
        
        // 尝试从用户信息中获取
        const userClassElement = document.getElementById('user_class_name');
        if (userClassElement && userClassElement.textContent) {
            return userClassElement.textContent.trim();
        }
        
        // 如果都获取不到，返回空字符串
        return '';
    }

    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const paginationInfo = document.getElementById('paginationInfo');

    if (prevPageBtn && nextPageBtn && paginationInfo) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderAssetsPage(currentPage);
                updatePaginationControls();
            }
        });

        nextPageBtn.addEventListener('click', () => {
            if (currentPage < Math.ceil(allAssets.length / pageSize)) {
                currentPage++;
                renderAssetsPage(currentPage);
                updatePaginationControls();
            }
        });
    }

    function updatePaginationControls() {
        paginationInfo.textContent = `第 ${currentPage} 页，共 ${Math.ceil(allAssets.length / pageSize)} 页`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= Math.ceil(allAssets.length / pageSize);

        prevPageBtn.classList.toggle('opacity-50', prevPageBtn.disabled);
        nextPageBtn.classList.toggle('opacity-50', nextPageBtn.disabled);
    }

});