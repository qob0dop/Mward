const loginUser = JSON.parse(localStorage.getItem("loginUser"));
layui.use(["layer", "appconfig"], function () {
  const $ = layui.jquery;
  const layer = layui.layer;
  const appconfig = layui.appconfig;
  initData();
  function initData() {
    if (loginUser) {
      // 设置用户名
      if (loginUser.name) {
        $("#loginUserName").text(loginUser.name);
        // 设置头像首字
        $("#userAvatar").text(loginUser.name.charAt(0));
        $("#loginDept").text(
          "科室:" + (loginUser.dept_name || loginUser.dept_sn)
        );
      }
      // 设置工号
      if (loginUser.user_mi) {
        $("#userMi").text(loginUser.user_mi);
      }
    }
  }
});

// 显示模态框
function showModal(title, content) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = content;
  document.getElementById("modalOverlay").style.display = "flex";
}

// 关闭模态框
function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

// 切换开关
function toggleNotification(element) {
  element.classList.toggle("active");
  const isActive = element.classList.contains("active");
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.msg(isActive ? "已开启消息推送" : "已关闭消息推送", { icon: 1 });
  });
}

function toggleSound(element) {
  element.classList.toggle("active");
  const isActive = element.classList.contains("active");
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.msg(isActive ? "已开启声音提醒" : "已关闭声音提醒", { icon: 1 });
  });
}

// 我的排班
function showMySchedule() {
  const scheduleContent = `
                <div style="text-align: center;">
                    <h4 style="margin-bottom: 20px; color: #333;">本周排班</h4>
                    <div style="text-align: left; font-size: 14px; line-height: 1.8;">
                        <div style="margin-bottom: 10px;">
                            <strong>周一：</strong> 上午班 08:00-12:00
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>周二：</strong> 夜班 20:00-08:00
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>周三：</strong> 休息
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>周四：</strong> 下午班 14:00-20:00
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>周五：</strong> 上午班 08:00-12:00
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>周六：</strong> 休息
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>周日：</strong> 值班 08:00-17:00
                        </div>
                    </div>
                </div>
            `;
  showModal("我的排班", scheduleContent);
}

// 工作统计
function showWorkStats() {
  const statsContent = `
                <div style="text-align: center;">
                    <h4 style="margin-bottom: 20px; color: #333;">本月工作统计</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; text-align: center;">
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #1e9fff;">156</div>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">接诊患者</div>
                        </div>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #52c41a;">89</div>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">开立医嘱</div>
                        </div>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #fa8c16;">45</div>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">查房次数</div>
                        </div>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #722ed1;">98%</div>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">满意度</div>
                        </div>
                    </div>
                </div>
            `;
  showModal("工作统计", statsContent);
}

// 我的患者
function showMyPatients() {
  // 向父窗口发送消息，请求切换到 patients 页面并筛选我的患者
  window.parent.postMessage(
    {
      type: "switchTab",
      target: "patients",
      action: "showMyPatients",
    },
    "*"
  );
}

// 编辑资料
function editProfile() {
  const profileContent = `
                <div class="form-item">
                    <label class="form-label">姓名</label>
                    <input type="text" class="form-input" value="李医生" placeholder="请输入姓名">
                </div>
                <div class="form-item">
                    <label class="form-label">职位</label>
                    <input type="text" class="form-input" value="主治医师" placeholder="请输入职位">
                </div>
                <div class="form-item">
                    <label class="form-label">科室</label>
                    <input type="text" class="form-input" value="内科" placeholder="请输入科室">
                </div>
                <div class="form-item">
                    <label class="form-label">联系电话</label>
                    <input type="tel" class="form-input" value="138****1002" placeholder="请输入联系电话">
                </div>
                <div class="form-item">
                    <label class="form-label">邮箱</label>
                    <input type="email" class="form-input" value="li.doctor@hospital.com" placeholder="请输入邮箱">
                </div>
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                    <button class="btn btn-primary" onclick="saveProfile()">保存</button>
                </div>
            `;
  showModal("编辑资料", profileContent);
}

// 修改密码
function changePassword() {
  const passwordContent = `
                <div class="form-item">
                    <label class="form-label">当前密码</label>
                    <input type="password" class="form-input" placeholder="请输入当前密码">
                </div>
                <div class="form-item">
                    <label class="form-label">新密码</label>
                    <input type="password" class="form-input" placeholder="请输入新密码">
                </div>
                <div class="form-item">
                    <label class="form-label">确认新密码</label>
                    <input type="password" class="form-input" placeholder="请再次输入新密码">
                </div>
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                    <button class="btn btn-primary" onclick="savePassword()">修改</button>
                </div>
            `;
  showModal("修改密码", passwordContent);
}

// 帮助中心
function showHelp() {
  const helpContent = `
                <div style="text-align: left; font-size: 14px; line-height: 1.6;">
                    <h4 style="color: #333; margin-bottom: 15px;">常见问题</h4>
                    <div style="margin-bottom: 15px;">
                        <strong>Q: 如何查看患者信息？</strong><br>
                        A: 在患者页面可以查看所有患者信息，支持搜索和筛选功能。
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Q: 如何开立医嘱？</strong><br>
                        A: 进入患者详情页面，点击"开立医嘱"按钮即可。
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Q: 如何查看排班？</strong><br>
                        A: 在工作台或个人中心可以查看排班信息。
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Q: 忘记密码怎么办？</strong><br>
                        A: 请联系系统管理员重置密码。
                    </div>
                </div>
            `;
  showModal("帮助中心", helpContent);
}

// 关于系统
function showAbout() {
  const aboutContent = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; color: #1e9fff; margin-bottom: 20px;">
                        <i class="layui-icon layui-icon-app"></i>
                    </div>
                    <h4 style="color: #333; margin-bottom: 10px;">移动查房系统</h4>
                    <p style="color: #666; margin-bottom: 20px;">版本 v2.1.0</p>
                    <div style="text-align: left; font-size: 14px; line-height: 1.6;">
                        <div style="margin-bottom: 10px;"><strong>更新日期：</strong>2025-09-28</div>
                        <div style="margin-bottom: 10px;"><strong>开发商：</strong>医院信息科</div>
                        <div style="margin-bottom: 10px;"><strong>技术支持：</strong>400-1234-5678</div>
                        <hr style="margin: 15px 0; border: none; border-top: 1px solid #f0f0f0;">
                        <div style="margin-bottom: 10px;"><strong>更新内容：</strong></div>
                        <div style="color: #666;">
                            • 新增消息推送功能<br>
                            • 优化患者查询性能<br>
                            • 修复已知问题<br>
                            • 提升用户体验
                        </div>
                    </div>
                </div>
            `;
  showModal("关于系统", aboutContent);
}

// 设置
function showSettings() {
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.msg("系统设置功能", { icon: 1 });
  });
}

// 通知 - 跳转到消息页面
function goToMessage() {
  // 向父窗口发送消息，请求切换到 message 页面
  window.parent.postMessage(
    {
      type: "switchTab",
      target: "message",
    },
    "*"
  );
}

// 更换头像
function changeAvatar() {
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.msg("头像更换功能", { icon: 1 });
  });
}

// 复制到剪贴板
window.copyToClipboard = function (text) {
  var topPlus = top.plus || parent.plus || window.plus;

  if (topPlus && topPlus.runtime) {
    // 使用 5+ API 复制
    topPlus.runtime.clipboard.setData(text);
    layui.use("layer", function () {
      const layer = layui.layer;
      layer.msg("已复制到剪贴板", { icon: 1, time: 1500 });
    });
  } else {
    // 浏览器环境，使用传统方法
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      layui.use("layer", function () {
        const layer = layui.layer;
        layer.msg("已复制到剪贴板", { icon: 1, time: 1500 });
      });
    } catch (err) {
      layui.use("layer", function () {
        const layer = layui.layer;
        layer.msg("复制失败，请手动复制", { icon: 2 });
      });
    }
    document.body.removeChild(textarea);
  }
};

// 保存资料
function saveProfile() {
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.msg("资料保存成功", { icon: 1 });
    closeModal();
  });
}

// 保存密码
function savePassword() {
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.msg("密码修改成功", { icon: 1 });
    closeModal();
  });
}

// 退出登录
function logout() {
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.confirm(
      "确定要退出登录吗？",
      {
        btn: ["确定", "取消"],
        icon: 3,
        title: "退出确认",
      },
      function (index) {
        layer.msg("正在退出...", { icon: 1 });
        layer.close(index);
        window.location.href = "../index.html"; // 跳转到index.html
        // 这里可以添加实际的退出逻辑
      }
    );
  });
}

// 处理移动端返回键（在 iframe 子页面中）
window.addEventListener(
  "message",
  function (event) {
    // 检查是否有打开的 layer 弹层
    if (event.data && event.data.type === "back") {
      closeModal();
      if (window.layui && layui.layer) {
        var openLayers = document.querySelectorAll(".layui-layer");
        if (openLayers && openLayers.length > 0) {
          // 如果有弹层，关闭最上层的弹层
          layui.layer.closeAll();
          return;
        }
      }
    }

    // 如果没有弹层，不处理（让父页面处理返回逻辑）
  },
  false
);
