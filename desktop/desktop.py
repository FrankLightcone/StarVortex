# -*- coding: utf-8 -*-
import sys
import os
import json
from PySide6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, QWidget,
                              QPushButton, QHBoxLayout, QLineEdit, QLabel, 
                              QMessageBox, QFrame, QToolButton)
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtCore import QTimer, QUrl, QEvent, Qt, QPropertyAnimation, QEasingCurve, QSize, QPoint
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkRequest
from PySide6.QtGui import QIcon, QFont, QFontDatabase

# 配置文件路径
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

# 默认配置
DEFAULT_CONFIG = {
    "remote_url": "http://172.16.244.156:10099",
    "max_attempts": 5  # 最多尝试次数改为5次
}

# 自定义事件类型
class LoadUrlEvent(QEvent):
    EventType = QEvent.Type(QEvent.registerEventType())
    
    def __init__(self, url):
        super().__init__(self.EventType)
        self.url = url

class WebApp(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # 加载配置
        self.load_config()
        
        self.setWindowTitle("作业提交系统")
        self.resize(1200, 800)
        self.setStyleSheet("""
            QToolButton {
                border: none;
                border-radius: 20px;
                background-color: rgba(240, 240, 240, 0.3);  /* 更透明的背景 */
                padding: 5px;
                color: rgba(51, 51, 51, 0.5);  /* 半透明的文字 */
            }
            QToolButton:hover {
                background-color: rgba(220, 220, 220, 0.95);  /* 悬停时几乎不透明 */
                color: #000;  /* 悬停时完全不透明的文字 */
            }
            QFrame#controlPanel, QFrame#statusPanel {
                background-color: rgba(250, 250, 250, 0.95);
                border-radius: 5px;
                border: 1px solid #ddd;
            }
            QPushButton {
                background-color: #4dabf7;
                border: none;
                border-radius: 4px;
                color: white;
                padding: 5px 15px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #339af0;
            }
            QLineEdit {
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 5px;
            }
        """)
        
        # 创建主布局
        self.main_layout = QVBoxLayout()
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)
        
        # 创建控制面板框架
        self.control_panel = QFrame()
        self.control_panel.setObjectName("controlPanel")
        self.control_panel.setFrameShape(QFrame.StyledPanel)
        self.control_panel.setContentsMargins(0, 0, 0, 0)
        
        # 控制面板布局
        control_layout = QHBoxLayout(self.control_panel)
        control_layout.setContentsMargins(10, 10, 10, 10)
        
        # 服务器地址输入框
        self.url_label = QLabel("服务器地址:")
        self.url_input = QLineEdit(self.config["remote_url"])
        
        # 刷新按钮
        self.refresh_btn = QPushButton("刷新")
        self.refresh_btn.setFixedWidth(80)
        self.refresh_btn.clicked.connect(self.refresh_connection)
        
        # 添加到控制栏
        control_layout.addWidget(self.url_label)
        control_layout.addWidget(self.url_input, 1)  # 让输入框占据更多空间
        control_layout.addWidget(self.refresh_btn)
        
        # 创建WebView
        self.webview = QWebEngineView()
        self.webview.setContentsMargins(0, 0, 0, 0)
        
        # 创建状态面板框架
        self.status_panel = QFrame()
        self.status_panel.setObjectName("statusPanel")
        self.status_panel.setFrameShape(QFrame.StyledPanel)
        self.status_panel.setContentsMargins(0, 0, 0, 0)
        
        # 状态面板布局
        status_layout = QHBoxLayout(self.status_panel)
        status_layout.setContentsMargins(10, 5, 10, 5)
        
        self.status_label = QLabel("正在连接服务器...")
        self.contact_label = QLabel("需要帮助? 联系: <a href='mailto:fanrj3@mail2.sysu.edu.cn'>fanrj3@mail2.sysu.edu.cn</a>")
        self.contact_label.setOpenExternalLinks(True)
        
        status_layout.addWidget(self.status_label)
        status_layout.addStretch()
        status_layout.addWidget(self.contact_label)
        
        # 创建悬浮按钮 (放置在左上角)
        self.toggle_button = QToolButton(self)
        self.toggle_button.setFixedSize(40, 40)
        self.toggle_button.move(10, 10)
        self.toggle_button.setText("≡")  # 使用三横线作为图标
        font = QFont()
        font.setPointSize(16)
        font.setBold(True)
        self.toggle_button.setFont(font)
        self.toggle_button.setToolTip("显示/隐藏控制面板")
        self.toggle_button.clicked.connect(self.toggle_panels)
        
        # 确保悬浮按钮始终在顶层可见
        self.toggle_button.raise_()
        
        # 将控件添加到主布局
        self.main_layout.addWidget(self.control_panel)
        self.main_layout.addWidget(self.webview, 1)  # 1表示伸展因子
        self.main_layout.addWidget(self.status_panel)
        
        # 创建中心部件并设置布局
        central = QWidget()
        central.setLayout(self.main_layout)
        central.setContentsMargins(0, 0, 0, 0)
        self.setCentralWidget(central)
        
        # 初始化动画属性
        self.control_panel_height = self.control_panel.sizeHint().height()
        self.status_panel_height = self.status_panel.sizeHint().height()
        
        # 加载本地loading页面
        loading_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "loading.html")
        self.loading_url = QUrl.fromLocalFile(loading_path)
        self.webview.setUrl(self.loading_url)
        
        # 网页成功加载的标志
        self.page_loaded = False
        
        # 使用Qt的网络接口
        self.network_manager = QNetworkAccessManager(self)
        self.network_manager.finished.connect(self.handle_network_response)
        
        # 开始检查远程服务器
        self.check_count = 0
        self.check_timer = QTimer(self)
        self.check_timer.timeout.connect(self.check_remote_server)
        self.check_timer.start(1000)
        
        # 监听网页加载完成信号
        self.webview.loadFinished.connect(self.on_page_load_finished)
        
        self.webview.installEventFilter(self)
        self.button_initial_y = 10  # 按钮初始Y坐标
        # 默认显示控制面板
        self.panels_visible = True
    
    def eventFilter(self, watched, event):
        if watched == self.webview and event.type() == QEvent.MouseButtonPress:
            if self.panels_visible and self.page_loaded:
                self.hide_panels()
        return super().eventFilter(watched, event)
    
    def on_page_load_finished(self, success):
        """网页加载完成的处理函数"""
        # 注意：我们已经在handle_network_response中处理了面板隐藏
        # 这里只需要更新状态
        current_url = self.webview.url().toString()
        loading_url = self.loading_url.toString()
        
        if success and current_url != loading_url:
            # 如果成功加载了非loading页面，标记为已加载
            self.page_loaded = True
    
    def toggle_panels(self):
        """切换控制面板和状态面板的显示/隐藏"""
        if self.panels_visible:
            self.hide_panels()
        else:
            self.show_panels()
    
    def hide_panels(self):
        """隐藏控制面板和状态面板"""
        if not self.panels_visible:
            return
        
        # 创建控制面板高度动画
        self.control_anim = QPropertyAnimation(self.control_panel, b"maximumHeight")
        self.control_anim.setDuration(300)
        self.control_anim.setStartValue(self.control_panel_height)
        self.control_anim.setEndValue(0)
        self.control_anim.setEasingCurve(QEasingCurve.InOutQuad)
        
        # 创建悬浮按钮位置动画
        self.button_anim = QPropertyAnimation(self.toggle_button, b"pos")
        self.button_anim.setDuration(300)
        self.button_anim.setStartValue(self.toggle_button.pos())
        self.button_anim.setEndValue(QPoint(10, self.button_initial_y))
        self.button_anim.setEasingCurve(QEasingCurve.InOutQuad)
        self.button_anim.start()

        # 创建状态面板高度动画
        self.status_anim = QPropertyAnimation(self.status_panel, b"maximumHeight")
        self.status_anim.setDuration(300)
        self.status_anim.setStartValue(self.status_panel_height)
        self.status_anim.setEndValue(0)
        self.status_anim.setEasingCurve(QEasingCurve.InOutQuad)
        
        # 启动动画
        self.control_anim.start()
        self.status_anim.start()
        
        self.panels_visible = False
        
        # 确保悬浮按钮在最上层可见
        self.toggle_button.show()
        self.toggle_button.raise_()
    
    def show_panels(self):
        """显示控制面板和状态面板"""
        if self.panels_visible:
            return
        
        # 创建控制面板高度动画
        self.control_anim = QPropertyAnimation(self.control_panel, b"maximumHeight")
        self.control_anim.setDuration(300)
        self.control_anim.setStartValue(0)
        self.control_anim.setEndValue(self.control_panel_height)
        self.control_anim.setEasingCurve(QEasingCurve.InOutQuad)

        # 创建悬浮按钮位置动画
        self.button_anim = QPropertyAnimation(self.toggle_button, b"pos")
        self.button_anim.setDuration(300)
        self.button_anim.setStartValue(self.toggle_button.pos())
        self.button_anim.setEndValue(QPoint(10, self.control_panel_height + 15))  # 移到面板下方
        self.button_anim.setEasingCurve(QEasingCurve.InOutQuad)
        self.button_anim.start()

        # 创建状态面板高度动画
        self.status_anim = QPropertyAnimation(self.status_panel, b"maximumHeight")
        self.status_anim.setDuration(300)
        self.status_anim.setStartValue(0)
        self.status_anim.setEndValue(self.status_panel_height)
        self.status_anim.setEasingCurve(QEasingCurve.InOutQuad)
        
        # 启动动画
        self.control_anim.start()
        self.status_anim.start()
        
        self.panels_visible = True
    
    def load_config(self):
        """加载配置文件，如果不存在则创建默认配置"""
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
            else:
                self.config = DEFAULT_CONFIG
                self.save_config()
        except Exception as e:
            print(f"加载配置失败: {e}")
            self.config = DEFAULT_CONFIG
    
    def save_config(self):
        """保存配置到文件"""
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"保存配置失败: {e}")
    
    def refresh_connection(self):
        """刷新连接，使用当前输入框中的URL"""
        # 更新配置
        new_url = self.url_input.text().strip()
        if new_url:
            self.config["remote_url"] = new_url
            self.save_config()
            
            # 重置状态
            self.page_loaded = False
            self.check_count = 0
            self.status_label.setText("正在连接服务器...")
            self.webview.setUrl(self.loading_url)
            
            # 确保面板可见，以便用户看到连接状态
            self.show_panels()
            
            if not self.check_timer.isActive():
                self.check_timer.start(1000)
            else:
                # 立即检查一次
                self.check_remote_server()
    
    def check_remote_server(self):
        self.check_count += 1
        if self.check_count > self.config["max_attempts"]:
            self.check_timer.stop()
            self.status_label.setText("无法连接到服务器，请检查网络或服务器地址")
            
            # 显示优化后的错误页面
            error_html = f"""
            <html>
            <head>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                        text-align: center;
                        padding-top: 80px;
                        background-color: #f8f9fa;
                        color: #343a40;
                    }}
                    .error-container {{
                        max-width: 550px;
                        margin: 0 auto;
                        padding: 30px;
                        background-color: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                    }}
                    h2 {{
                        color: #dc3545;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }}
                    .status-icon {{
                        font-size: 60px;
                        margin-bottom: 20px;
                        color: #dc3545;
                    }}
                    p {{
                        color: #495057;
                        margin: 15px 0;
                        line-height: 1.5;
                        font-size: 16px;
                    }}
                    .server-url {{
                        background-color: #f8f9fa;
                        padding: 10px;
                        border-radius: 4px;
                        font-family: monospace;
                        color: #6c757d;
                        margin: 15px auto;
                        max-width: 90%;
                        word-break: break-all;
                    }}
                    .contact-info {{
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e9ecef;
                        color: #6c757d;
                        font-size: 14px;
                    }}
                    a {{
                        color: #007bff;
                        text-decoration: none;
                    }}
                    a:hover {{
                        text-decoration: underline;
                    }}
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="status-icon">⚠️</div>
                    <h2>无法连接到服务器</h2>
                    <p>经过多次尝试，无法连接到以下服务器地址:</p>
                    <div class="server-url">{self.config["remote_url"]}</div>
                    <p>可能的原因:</p>
                    <p>• 服务器地址输入错误<br>• 服务器暂时不可用<br>• 网络连接问题</p>
                    <p>您可以点击<b>左上角的 ≡ 按钮</b>显示控制面板，修改服务器地址或刷新连接</p>
                    
                    <div class="contact-info">
                        需要帮助? 请联系管理员: <a href="mailto:fanrj3@mail2.sysu.edu.cn">fanrj3@mail2.sysu.edu.cn</a>
                    </div>
                </div>
            </body>
            </html>
            """
            self.webview.setHtml(error_html)
            
            # 确保面板可见，因为这是错误状态
            self.show_panels()
            return
            
        # 发送网络请求
        current_url = self.config["remote_url"]
        self.network_manager.get(QNetworkRequest(QUrl(current_url)))
    
    def handle_network_response(self, reply):
        if reply.error() == reply.NetworkError.NoError:
            # 远程服务器可用，加载远程页面
            self.check_timer.stop()
            self.status_label.setText("连接成功")
            self.webview.setUrl(QUrl(self.config["remote_url"]))
            # 连接成功后立即隐藏面板，不等待页面完全加载
            # 给用户1秒时间看到"连接成功"的消息
            QTimer.singleShot(1000, self.hide_panels)
    
    def event(self, event):
        if isinstance(event, LoadUrlEvent):
            self.webview.setUrl(QUrl(event.url))
            return True
        return super().event(event)
    
    def closeEvent(self, event):
        """窗口关闭事件，保存配置"""
        # 确保当前URL被保存
        self.config["remote_url"] = self.url_input.text().strip()
        self.save_config()
        super().closeEvent(event)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # 应用样式
    app.setStyle("Fusion")
    
    window = WebApp()
    window.show()
    sys.exit(app.exec())