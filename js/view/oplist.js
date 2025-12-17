layui.use(["appconfig", "layer", "form"], function () {
  var $ = layui.jquery;
  var appconfig = layui.appconfig;
  var layer = layui.layer;
  var form = layui.form;
  const userData = JSON.parse(window.localStorage.getItem("userData")) || {};
  // 获取URL参数
  function getUrlParam(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return unescape(r[2]);
    return null;
  }

  var patient_id = userData.patient_id;
  var admiss_times = userData.admiss_times;

  // 卡片数据
  var cardsData = [];

  // 判断手术状态
  function getOpStatus(item) {
    var now = new Date();
    var opStart = item.op_datetime ? new Date(item.op_datetime) : null;
    var opEnd = item.op_endtime ? new Date(item.op_endtime) : null;

    if (opEnd && now > opEnd) {
      return { text: "已完成", class: "status-completed" };
    } else if (opStart && now >= opStart && opEnd && now <= opEnd) {
      return { text: "进行中", class: "status-scheduled" };
    } else if (opStart && now < opStart) {
      return { text: "已安排", class: "status-pending" };
    } else {
      return { text: "待安排", class: "status-pending" };
    }
  }

  // 格式化日期显示（精确到分钟）
  function formatDate(dateStr) {
    if (!dateStr) return "-";
    try {
      var date = new Date(dateStr);
      var year = date.getFullYear();
      var month = (date.getMonth() + 1).toString().padStart(2, "0");
      var day = date.getDate().toString().padStart(2, "0");
      var hours = date.getHours().toString().padStart(2, "0");
      var minutes = date.getMinutes().toString().padStart(2, "0");
      return year + "-" + month + "-" + day + " " + hours + ":" + minutes;
    } catch (e) {
      return "-";
    }
  }

  // 格式化简短日期（只显示日期）
  function formatShortDate(dateStr) {
    if (!dateStr) return "-";
    try {
      var date = new Date(dateStr);
      var year = date.getFullYear();
      var month = (date.getMonth() + 1).toString().padStart(2, "0");
      var day = date.getDate().toString().padStart(2, "0");
      return year + "-" + month + "-" + day;
    } catch (e) {
      return "-";
    }
  }

  // 格式化时间（只显示时间）
  function formatTime(dateStr) {
    if (!dateStr) return "-";
    try {
      var date = new Date(dateStr);
      var hours = date.getHours().toString().padStart(2, "0");
      var minutes = date.getMinutes().toString().padStart(2, "0");
      return hours + ":" + minutes;
    } catch (e) {
      return "-";
    }
  }

  // 生成卡片HTML
  function generateCardHTML(item) {
    var statusInfo = getOpStatus(item);
    var formattedApplyDate = formatDate(item.apply_date);
    var opDate = formatShortDate(item.op_datetime);
    var opStartTime = formatTime(item.op_datetime);
    var opEndTime = formatTime(item.op_endtime);

    return (
      '<div class="card-item" data-id="' +
      (item.op_record_ID || "") +
      '">' +
      '<div class="card-header">' +
      '<div class="card-title">' +
      '<i class="layui-icon layui-icon-template-1"></i>' +
      '<span class="op-name" title="' +
      (item.op_code_name || "未指定手术") +
      '">' +
      (item.op_code_name || "未指定手术") +
      "</span>" +
      '<span class="op-code">(' +
      (item.op_code || "").trim() +
      ")</span>" +
      "</div>" +
      '<div class="card-status ' +
      statusInfo.class +
      '">' +
      statusInfo.text +
      "</div>" +
      "</div>" +
      '<div class="card-body">' +
      '<div class="info-row">' +
      '<div class="info-label"><i class="layui-icon layui-icon-file"></i>术前诊断</div>' +
      '<div class="info-value">' +
      (item.diag_before_op || "-") +
      "</div>" +
      "</div>" +
      '<div class="info-row">' +
      '<div class="info-label"><i class="layui-icon layui-icon-location"></i>执行科室</div>' +
      '<div class="info-value">' +
      (item.exec_unit_name || "-") +
      "</div>" +
      "</div>" +
      '<div class="info-row">' +
      '<div class="info-label"><i class="layui-icon layui-icon-username"></i>申请医生</div>' +
      '<div class="info-value">' +
      (item.apply_user_name || "-") +
      "</div>" +
      "</div>" +
      '<div class="time-info">' +
      '<div class="time-item">' +
      '<div class="time-label">手术日期</div>' +
      '<div class="time-value">' +
      opDate +
      "</div>" +
      "</div>" +
      '<div class="time-item">' +
      '<div class="time-label">开始时间</div>' +
      '<div class="time-value">' +
      opStartTime +
      "</div>" +
      "</div>" +
      '<div class="time-item">' +
      '<div class="time-label">结束时间</div>' +
      '<div class="time-value">' +
      opEndTime +
      "</div>" +
      "</div>" +
      '<div class="time-item">' +
      '<div class="time-label">申请时间</div>' +
      '<div class="time-value">' +
      formatShortDate(item.apply_date) +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="card-actions">' +
      '<button class="card-btn card-btn-detail" onclick="viewCardDetail(\'' +
      (item.op_record_ID || "") +
      "', '" +
      (item.patient_id || "") +
      '\')"><i class="layui-icon layui-icon-search"></i>详情</button>' +
      '<button class="card-btn card-btn-delete" onclick="deleteCardItem(\'' +
      (item.op_record_ID || "") +
      '\')"><i class="layui-icon layui-icon-delete"></i>删除</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  // 渲染卡片（按申请时间降序排列）
  function renderCards(data) {
    var container = document.getElementById("cards-container");

    if (!data || data.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<i class="layui-icon layui-icon-template-1"></i>' +
        '<div class="empty-state-text">暂无手术信息数据</div>' +
        '<div class="empty-state-desc">点击"新建申请"按钮创建手术申请</div>' +
        "</div>";
      return;
    }

    // 按申请时间倒序排列（最新的在前面）
    var sortedData = data.slice().sort(function (a, b) {
      var timeA = new Date(a.apply_date || 0).getTime();
      var timeB = new Date(b.apply_date || 0).getTime();
      return timeB - timeA;
    });

    var cardsHTML = "";
    sortedData.forEach(function (item) {
      cardsHTML += generateCardHTML(item);
    });

    container.innerHTML = cardsHTML;
  }

  // 加载卡片数据
  function loadCardsData() {
    if (!patient_id || !admiss_times) {
      layer.msg("缺少患者信息参数", { icon: 5 });
      return;
    }

    var loadingIndex = layer.load(1, { shade: [0.1, "#fff"] });

    $.ajax({
      url:
        appconfig.api +
        "/api/MobileWard/Ydcf_GetPatientOpList?patient_id=" +
        patient_id +
        "&admiss_times=" +
        admiss_times,
      type: "GET",
      dataType: "json",
      success: function (res) {
        layer.close(loadingIndex);
        if (res.Status === 1) {
          cardsData = res.Data || [];
          renderCards(cardsData);
        } else {
          layer.msg("获取数据失败: " + (res.Message || "未知错误"), {
            icon: 5,
          });
          renderCards([]);
        }
      },
      error: function (xhr, status, error) {
        layer.close(loadingIndex);
        layer.msg("网络错误，获取数据失败", { icon: 5 });
        console.error("获取手术数据失败:", error);
        renderCards([]);
      },
    });
  }

  // 查看卡片详情
  window.viewCardDetail = function (op_record_ID, patient_id) {
    var item = cardsData.find(function (d) {
      return d.op_record_ID == op_record_ID || d.patient_id == patient_id;
    });

    if (!item) {
      layer.msg("未找到该手术信息", { icon: 5 });
      return;
    }

    var statusInfo = getOpStatus(item);

    var detailHTML =
      '<div class="detail-content">' +
      '<div class="detail-section">' +
      '<div class="detail-section-title"><i class="layui-icon layui-icon-template-1"></i> 手术基本信息</div>' +
      '<div class="detail-item"><div class="detail-label">手术名称：</div><div class="detail-value">' +
      (item.op_code_name || "-") +
      "</div></div>" +
      '<div class="detail-item"><div class="detail-label">手术编码：</div><div class="detail-value">' +
      (item.op_code || "").trim() +
      "</div></div>" +
      '<div class="detail-item"><div class="detail-label">术前诊断：</div><div class="detail-value">' +
      (item.diag_before_op || "-") +
      "</div></div>" +
      '<div class="detail-item"><div class="detail-label">当前状态：</div><div class="detail-value"><span class="card-status ' +
      statusInfo.class +
      '">' +
      statusInfo.text +
      "</span></div></div>" +
      "</div>" +
      '<div class="detail-section">' +
      '<div class="detail-section-title"><i class="layui-icon layui-icon-time"></i> 时间安排</div>' +
      '<div class="timeline">' +
      '<div class="timeline-item">' +
      '<div class="timeline-time">申请时间</div>' +
      '<div class="timeline-content">' +
      formatDate(item.apply_date) +
      "</div>" +
      "</div>" +
      '<div class="timeline-item">' +
      '<div class="timeline-time">手术开始</div>' +
      '<div class="timeline-content">' +
      formatDate(item.op_datetime) +
      "</div>" +
      "</div>" +
      '<div class="timeline-item">' +
      '<div class="timeline-time">手术结束</div>' +
      '<div class="timeline-content">' +
      formatDate(item.op_endtime) +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="detail-section">' +
      '<div class="detail-section-title"><i class="layui-icon layui-icon-username"></i> 相关人员</div>' +
      '<div class="detail-item"><div class="detail-label">申请医生：</div><div class="detail-value">' +
      (item.apply_user_name || "-") +
      " (" +
      (item.apply_user || "-") +
      ")</div></div>" +
      '<div class="detail-item"><div class="detail-label">执行科室：</div><div class="detail-value">' +
      (item.exec_unit_name || "-") +
      " (" +
      (item.exec_code || "-") +
      ")</div></div>" +
      "</div>" +
      '<div class="detail-section">' +
      '<div class="detail-section-title"><i class="layui-icon layui-icon-user"></i> 患者信息</div>' +
      '<div class="detail-item"><div class="detail-label">患者ID：</div><div class="detail-value">' +
      (item.patient_id || "-") +
      "</div></div>" +
      '<div class="detail-item"><div class="detail-label">住院次数：</div><div class="detail-value">' +
      (item.admit_times || "-") +
      "</div></div>" +
      "</div>" +
      "</div>";

    layer.open({
      type: 1,
      title: '<i class="layui-icon layui-icon-template-1"></i> 手术详情',
      area: ["90%", "90%"],
      maxmin: true,
      content: detailHTML,
      btn: ["关闭"],
      yes: function (index) {
        layer.close(index);
      },
    });
  };

  // 删除卡片项目
  window.deleteCardItem = function (op_record_ID) {
    layer.confirm(
      "确定删除该手术信息吗？",
      { icon: 3, title: "提示" },
      function (index) {
        // TODO: 实现删除API调用
        layer.msg("删除功能待实现", { icon: 0 });
        layer.close(index);

        // 删除成功后重新加载数据
        // loadCardsData();
      }
    );
  };

  // 新建申请按钮事件
  $(document).on("click", "#btn-new-apply-card", function () {
    layer.msg("新建手术申请功能待实现", { icon: 0 });
    // TODO: 实现新建手术申请功能
  });

  // 页面加载时加载数据
  loadCardsData();
});
