// 实际联系人数据（从API获取）
let contactsData = [
  // 静态测试数据
  {
    id: "D001",
    name: "张医生",
    position: "doctor",
    positionName: "医生",
    department: "内科",
    phone: "138****1001",
    extension: "D001",
    office: "门诊楼3楼",
    email: "zhangys@hospital.com",
    status: "online",
    avatar: "张",
    sex: "男",
    yb_code: "D001",
  },
  {
    id: "D002",
    name: "李医生",
    position: "doctor",
    positionName: "医生",
    department: "外科",
    phone: "138****1002",
    extension: "D002",
    office: "门诊楼4楼",
    email: "liys@hospital.com",
    status: "busy",
    avatar: "李",
    sex: "女",
    yb_code: "D002",
  },
  {
    id: "N001",
    name: "王护士",
    position: "nurse",
    positionName: "护士",
    department: "内科",
    phone: "138****2001",
    extension: "N001",
    office: "护士站A",
    email: "wanghs@hospital.com",
    status: "online",
    avatar: "王",
    sex: "女",
    yb_code: "N001",
  },
  {
    id: "N002",
    name: "刘护士",
    position: "nurse",
    positionName: "护士",
    department: "外科",
    phone: "138****2002",
    extension: "N002",
    office: "护士站B",
    email: "liuhs@hospital.com",
    status: "online",
    avatar: "刘",
    sex: "女",
    yb_code: "N002",
  },
  {
    id: "A001",
    name: "陈主任",
    position: "admin",
    positionName: "员工",
    department: "行政办公室",
    phone: "138****3001",
    extension: "A001",
    office: "行政楼2楼",
    email: "chenzr@hospital.com",
    status: "offline",
    avatar: "陈",
    sex: "男",
    yb_code: "A001",
  },
  {
    id: "A002",
    name: "赵秘书",
    position: "admin",
    positionName: "员工",
    department: "院长办公室",
    phone: "138****3002",
    extension: "A002",
    office: "行政楼3楼",
    email: "zhaoms@hospital.com",
    status: "online",
    avatar: "赵",
    sex: "女",
    yb_code: "A002",
  },
];

// 将API数据转换为前端需要的格式
function transformEmployeeData(apiData) {
  return apiData.map((emp) => {
    // 根据医保编号 yb_ys_code 判断职位类型
    let position = "admin";
    let positionName = "员工";

    // 使用医保编号判断（N开头=护士，D开头=医生）
    if (emp.yb_ys_code && emp.yb_ys_code.length > 0) {
      const firstChar = emp.yb_ys_code.charAt(0).toUpperCase();
      if (firstChar === "N") {
        position = "nurse";
        positionName = "护士";
      } else if (firstChar === "D") {
        position = "doctor";
        positionName = "医生";
      }
      // 其他字母开头的也归为员工（保持默认值）
    }
    // 没有医保编号的直接归为员工（保持默认值）

    return {
      id: emp.emp_sn,
      name: emp.name || "未知",
      position: position,
      positionName: positionName,
      department: emp.dept_sn || "未知科室",
      phone: emp.dh || "无",
      extension: emp.code || "",
      office: "办公室",
      email: emp.email || emp.sfz || "无",
      status: "online", // 默认在线状态
      avatar: emp.name ? emp.name.charAt(0) : "?",
      sex: emp.sex_name || "未知",
      yb_code: emp.yb_ys_code || "", // 保存医保编号
    };
  });
} // 获取员工列表
function getEmployeeList() {
  layui.use(["layer", "appconfig"], function () {
    const $ = layui.$;
    const layer = layui.layer;
    const appconfig = layui.appconfig;
    const loginUser = JSON.parse(localStorage.getItem("loginUser")) || {};

    // 获取当前选择的范围
    const scope = document.getElementById("scope-select").value;

    // 根据范围构建URL
    let url = appconfig.api + "/api/MobileWard/GetEmployees";
    if (scope === "dept") {
      // 同科室模式，添加dept_sn参数
      url += "?dept_sn=" + (loginUser.dept_sn || "");
    }
    // 全部模式不添加dept_sn参数

    // 显示加载中
    const loadingIndex = layer.load(1, { shade: [0.1, "#fff"] });

    $.ajax({
      url: url,
      type: "GET",
      dataType: "json",
      success: function (response) {
        layer.close(loadingIndex);

        if (response && Array.isArray(response.Data)) {
          // 转换并保存数据（会覆盖静态测试数据）
          contactsData = transformEmployeeData(response.Data);
          // 渲染列表
          renderContacts();
        } else {
          layer.msg("数据格式错误", { icon: 2 });
        }
      },
      error: function (xhr, status, error) {
        layer.close(loadingIndex);
        layer.msg("获取员工列表失败，显示测试数据", { icon: 0 });
        console.error("获取员工列表失败:", error);
        // API失败时使用静态测试数据
        renderContacts();
      },
    });
  });
}

let currentFilter = "all";
let searchKeyword = "";

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", function () {
  bindEvents();
  // 先显示静态测试数据
  renderContacts();
  // 然后尝试从API获取员工列表（成功后会覆盖静态数据）
  getEmployeeList();
});

// 渲染联系人列表
function renderContacts() {
  const container = document.getElementById("contactsContainer");
  let filteredContacts = contactsData;

  // 根据筛选条件过滤
  if (currentFilter !== "all") {
    filteredContacts = filteredContacts.filter(
      (contact) => contact.position === currentFilter
    );
  }

  // 根据搜索关键词过滤
  if (searchKeyword) {
    filteredContacts = filteredContacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        contact.positionName
          .toLowerCase()
          .includes(searchKeyword.toLowerCase()) ||
        contact.phone.includes(searchKeyword)
    );
  }

  if (filteredContacts.length === 0) {
    container.innerHTML = `
                    <div class="no-contacts">
                        <div class="layui-icon layui-icon-username"></div>
                        <p>暂无联系人</p>
                    </div>
                `;
    return;
  }

  // 按职位分组
  const grouped = groupByPosition(filteredContacts);
  let html = "";

  Object.keys(grouped).forEach((position) => {
    const positionName = getPositionName(position);
    html += `<div class="department-header">${positionName}</div>`;

    grouped[position].forEach((contact) => {
      html += renderContactCard(contact);
    });
  });

  container.innerHTML = html;
}

// 按职位分组
function groupByPosition(contacts) {
  const grouped = {};
  contacts.forEach((contact) => {
    if (!grouped[contact.position]) {
      grouped[contact.position] = [];
    }
    grouped[contact.position].push(contact);
  });
  return grouped;
}

// 获取职位名称
function getPositionName(position) {
  const names = {
    doctor: "👨‍⚕️ 医生",
    nurse: "👩‍⚕️ 护士",
    admin: "👨‍💼 员工",
  };
  return names[position] || "其他";
}

// 获取状态文本
function getStatusText(status) {
  const statusTexts = {
    online: "在线",
    busy: "忙碌",
    offline: "离线",
  };
  return statusTexts[status] || "未知";
}

// 渲染联系人卡片
function renderContactCard(contact) {
  return `
                <div class="contact-card">
                    <div class="contact-header">
                        <div class="contact-avatar ${contact.position}">
                            ${contact.avatar}
                        </div>
                        <div class="contact-info">
                            <div class="contact-name">${contact.name}${
    contact.sex ? " (" + contact.sex + ")" : ""
  }</div>
                            <span class="contact-position ${
                              contact.position
                            }">${contact.positionName}</span>
                            <div class="contact-department">编号: ${
                              contact.id
                            }</div>
                        </div>
                        <div class="contact-status">
                            <span class="status-dot ${contact.status}"></span>
                            <span class="status-text">${getStatusText(
                              contact.status
                            )}</span>
                        </div>
                    </div>
                    
                    <div class="contact-details">
                        <div class="contact-item">
                            <i class="layui-icon layui-icon-cellphone"></i>
                            ${contact.phone}
                        </div>
                        <div class="contact-item">
                            <i class="layui-icon layui-icon-username"></i>
                            工号: ${contact.extension}
                        </div>
                    </div>
                    
                    <div class="contact-actions">
                        <button class="action-btn" onclick="sendMessage('${
                          contact.id
                        }', '${contact.name}')">
                            <i class="layui-icon layui-icon-dialogue"></i> 消息
                        </button>
                        <button class="action-btn primary" onclick="makeCall('${
                          contact.phone
                        }', '${contact.name}')">
                            <i class="layui-icon layui-icon-cellphone"></i> 拨号
                        </button>
                    </div>
                </div>
            `;
}

// 绑定事件
function bindEvents() {
  // 范围选择器事件
  const scopeSelect = document.getElementById("scope-select");
  scopeSelect.addEventListener("change", function () {
    // 当范围改变时，重新获取员工列表
    getEmployeeList();
  });

  // 筛选按钮事件
  document.querySelectorAll(".contact-filter").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".contact-filter")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentFilter = this.dataset.filter;
      renderContacts();
    });
  });

  // 搜索框事件
  const searchInput = document.getElementById("contact-search");
  searchInput.addEventListener("input", function () {
    searchKeyword = this.value.trim();
    renderContacts();
  });
}

// 拨打电话
function makeCall(phone, name) {
  if (!phone || phone === "无") {
    layui.use("layer", function () {
      const layer = layui.layer;
      layer.msg("该联系人未设置电话号码", { icon: 2 });
    });
    return;
  }

  layui.use("layer", function () {
    const layer = layui.layer;
    layer.confirm(
      `确定要拨打 ${name} 的电话 ${phone} 吗？`,
      {
        btn: ["直接拨号", "取消"],
        icon: 3,
        title: "拨号确认",
      },
      function (index) {
        layer.close(index);

        // 优先使用 5+ API (HBuilder App)
        if (window.plus && plus.device) {
          try {
            // 使用 5+ API 拨号
            plus.device.dial(phone, true); // true 表示直接拨号，false 表示打开拨号界面
            console.log("使用 5+ API 拨号:", phone);
          } catch (e) {
            console.error("5+ API 拨号失败:", e);
            // 降级到 HTML5 tel 协议
            fallbackToTel(phone, name);
          }
        } else {
          // 降级到 HTML5 tel 协议 (浏览器环境)
          fallbackToTel(phone, name);
        }
      }
    );
  });
}

// 降级方案：使用 HTML5 tel 协议
function fallbackToTel(phone, name) {
  try {
    // 清理电话号码中的特殊字符
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    window.location.href = "tel:" + cleanPhone;
    console.log("使用 tel 协议拨号:", cleanPhone);
  } catch (e) {
    console.error("tel 协议拨号失败:", e);
    layui.use("layer", function () {
      const layer = layui.layer;
      layer.msg("拨号功能不可用", { icon: 2 });
    });
  }
}

// 发送消息
function sendMessage(contactId, name) {
  layui.use("layer", function () {
    const layer = layui.layer;
    layer.prompt(
      {
        formType: 2,
        value: "",
        title: `发送消息给 ${name}`,
        area: ["300px", "150px"],
      },
      function (value, index) {
        if (value && value.trim()) {
          layer.msg(`消息已发送给 ${name}`, { icon: 1 });
          layer.close(index);
        } else {
          layer.msg("消息内容不能为空", { icon: 2 });
        }
      }
    );
  });
}

// 显示紧急联系人
function showEmergencyContacts() {
  layui.use("layer", function () {
    const layer = layui.layer;
    const emergencyHtml = `
                    <div style="padding: 20px;">
                        <h4 style="margin-bottom: 15px; color: #333;">紧急联系人</h4>
                        <div style="margin-bottom: 10px;">
                            <strong>值班医生：</strong> 
                            <a href="tel:138****1001" style="color: #1e9fff;">138****1001</a>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>值班护士：</strong> 
                            <a href="tel:138****2001" style="color: #1e9fff;">138****2001</a>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>保安值班：</strong> 
                            <a href="tel:138****9999" style="color: #1e9fff;">138****9999</a>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>医务科：</strong> 
                            <a href="tel:138****8888" style="color: #1e9fff;">138****8888</a>
                        </div>
                    </div>
                `;
    layer.open({
      type: 1,
      title: false,
      closeBtn: 1,
      area: ["300px", "auto"],
      skin: "layui-layer-rim",
      content: emergencyHtml,
    });
  });
}

// 处理移动端返回键（在 iframe 子页面中）
window.addEventListener(
  "message",
  function (event) {
    // 检查是否有打开的 layer 弹层
    if (event.data && event.data.type === "back") {
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
