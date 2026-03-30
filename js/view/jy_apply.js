// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

layui.use(["appconfig", "layer", "form"], function () {
  var $ = layui.jquery;
  var appconfig = layui.appconfig;
  var layer = layui.layer;
  var form = layui.form;
  const userData = localStorage.getItem("userData")
    ? JSON.parse(localStorage.getItem("userData"))
    : {};
  // 获取URL参数
  function getUrlParam(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return unescape(r[2]);
    return null;
  }

  var patient_id = getUrlParam("patient_id");
  var admiss_times = getUrlParam("admiss_times");

  // 获取患者信息 (已在顶部显示，此处不再重复)

  // 套餐数据变量
  var testPackages = [];
  var allTestItems = []; // 所有检验项目数据
  var cardsData = []; // 卡片数据
  var sortMode = "reg_date"; // reg_date | report_date

  var sortSelect = document.getElementById("sort-select");
  var sortButton = document.getElementById("btn-sort");
  var searchInput = document.getElementById("jy-search-input");
  var clearSearchBtn = document.getElementById("jy-clear-search");
  var searchQuery = "";

  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      sortMode = this.value || "reg_date";
      renderCards(cardsData);
    });
  }

  if (sortButton && sortSelect) {
    sortButton.addEventListener("click", function () {
      sortSelect.focus();
      // 简单的视觉反馈
      sortSelect.classList.add("sort-select-active");
      setTimeout(function () {
        sortSelect.classList.remove("sort-select-active");
      }, 200);
    });
  }

  // 过滤函数：按关键词过滤卡片数据
  function filterBySearch(data) {
    var list = Array.isArray(data) ? data : [];
    var q = (searchQuery || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter(function (item) {
      var grpName = String(item.grp_name || item.name || "").toLowerCase();
      var sampleType = String(
        item.sample_type_name || item.sample_type || "",
      ).toLowerCase();
      var statusName = String(
        item.status_name || formatStatus(item.status).text || "",
      ).toLowerCase();
      var execUnit = String(item.exec_unit || "").toLowerCase();
      var code = String(item.grp_code || item.code || "").toLowerCase();
      return (
        grpName.indexOf(q) !== -1 ||
        sampleType.indexOf(q) !== -1 ||
        statusName.indexOf(q) !== -1 ||
        execUnit.indexOf(q) !== -1 ||
        code.indexOf(q) !== -1
      );
    });
  }

  // 格式化状态显示
  function formatStatus(status) {
    switch (status) {
      case "0":
        return { text: "申请", class: "status-pending" };
      case "1":
        return { text: "已登记", class: "status-completed" };
      case "3":
        return { text: "已完成", class: "status-completed" };
      default:
        return { text: "未保存", class: "status-cancelled" };
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

  // 生成卡片HTML
  function generateCardHTML(item) {
    var statusInfo = formatStatus(item.status);
    var formattedDate = formatDate(item.reg_date);
    var reportDate = formatDate(item.report_date);

    return (
      '<div class="card-item" data-id="' +
      (item.jyapply_no || "") +
      '" data-patient-id="' +
      (item.patient_id || "") +
      '" data-admiss-times="' +
      (item.admiss_times || "") +
      '">' +
      '<div class="card-header">' +
      '<div class="card-title">' +
      '<i class="layui-icon layui-icon-file"></i>' +
      `<span>${item.grp_name || "未指定项目"} 
      <span class="project-type">${item.sample_type_name}</span></span>` +
      "</div>" +
      '<div class="card-status ' +
      statusInfo.class +
      '">' +
      statusInfo.text +
      "</div>" +
      "</div>" +
      '<div class="card-body">' +
      '<div class="date-info">' +
      '<div class="date-item">' +
      '<div class="date-label">申请日期</div>' +
      '<div class="date-value">' +
      (formattedDate || "-") +
      "</div>" +
      "</div>" +
      '<div class="date-item">' +
      '<div class="date-label">报告时间</div>' +
      '<div class="date-value">' +
      (reportDate || "-") +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="card-actions">' +
      '<button class="card-btn card-btn-detail" onclick="viewCardDetail(\'' +
      (item.jyapply_no || "") +
      "', '" +
      (item.patient_id || "") +
      "')\">" +
      '<i class="layui-icon layui-icon-search"></i>' +
      "详情" +
      "</button>" +
      '<button class="card-btn card-btn-delete" onclick="deleteCardItem(\'' +
      (item.jyapply_no || "") +
      "', '" +
      (item.patient_id || "") +
      "', '" +
      (item.admiss_times || "") +
      "', '" +
      (item.exam_status || "") +
      "')\">" +
      '<i class="layui-icon layui-icon-delete"></i>' +
      "删除" +
      "</button>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  // 渲染卡片（按reg_date降序排列）
  function renderCards(data) {
    var container = document.getElementById("cards-container");

    if (!data || data.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<i class="layui-icon layui-icon-template-1"></i>' +
        '<div class="empty-state-text">暂无检验申请数据</div>' +
        '<div class="empty-state-desc">点击"新建申请"按钮创建检验申请</div>' +
        "</div>";
      return;
    }

    function getSortValue(item) {
      var val = sortMode === "report_date" ? item.report_date : item.reg_date;
      var ts = new Date(val || 0).getTime();
      return isNaN(ts) ? 0 : ts;
    }

    // 应用搜索过滤
    var filtered = filterBySearch(data);

    // 按选中方式倒序排列（最新的在前面）
    var sortedData = filtered.slice().sort(function (a, b) {
      return getSortValue(b) - getSortValue(a);
    });

    var cardsHTML = "";
    sortedData.forEach(function (item) {
      cardsHTML += generateCardHTML(item);
    });

    container.innerHTML = cardsHTML;
  }

  // 搜索输入事件（防抖）
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(function () {
        searchQuery = searchInput.value || "";
        if (clearSearchBtn) {
          clearSearchBtn.style.display = searchQuery ? "block" : "none";
        }
        renderCards(cardsData);
      }, 200),
    );
  }

  // 清空搜索
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", function () {
      if (searchInput) {
        searchInput.value = "";
      }
      searchQuery = "";
      clearSearchBtn.style.display = "none";
      renderCards(cardsData);
    });
  }

  // 加载卡片数据
  function loadCardsData() {
    // 加载前显示加载占位
    try {
      var container = document.getElementById("cards-container");
      if (container) {
        container.innerHTML =
          '<div class="loading-state" style="display:flex;align-items:center;justify-content:center;flex-direction:column;height:200px;color:#6b7280;">' +
          '<i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop" style="font-size:30px;margin-bottom:8px;"></i>' +
          "<div>正在加载申请列表...</div>" +
          "</div>";
      }
    } catch (e) {}

    $.ajax({
      url:
        appconfig.api +
        "/api/JcJy/GetJianYanApplys?patient_id=" +
        patient_id +
        "&admiss_times=" +
        admiss_times,
      type: "GET",
      dataType: "json",
      success: function (res) {
        var parseRes = {
          code: res.Status === 1 ? 0 : res.Status,
          msg: res.msg || "",
          count: res.Data ? res.Data.length : 0,
          data: res.Data || [],
        };
        if (parseRes.code === 0) {
          cardsData = parseRes.data;
          // 获取报告时间并合并后再渲染
          fetchReportDatesAndRender();
        } else {
          cardsData = [];
          renderCards([]);
        }
      },
      error: function () {
        layer.msg("获取数据失败", { icon: 5 });
        renderCards([]);
      },
    });
  }

  // 获取检验报告时间并合并到 cardsData 后渲染
  function fetchReportDatesAndRender() {
    $.ajax({
      url:
        appconfig.api + "/api/JcJy/GetJyReportPdfDate?patient_id=" + patient_id,
      type: "GET",
      dataType: "json",
      success: function (res) {
        if (res.Status === 1 && Array.isArray(res.Data)) {
          var map = {};
          res.Data.forEach(function (entry) {
            if (entry && entry.jyapply_no) {
              map[entry.jyapply_no] = entry;
            }
          });
          cardsData = (cardsData || []).map(function (item) {
            var m = map[item.jyapply_no];
            if (m) {
              item.receiving_date = m.receiving_date || item.receiving_date;
              item.report_date = m.report_date || item.report_date;
            }
            return item;
          });
        }
        renderCards(cardsData);
      },
      error: function () {
        // 获取报告时间失败时，仍然渲染原始列表
        renderCards(cardsData);
      },
    });
  }

  // 查看卡片详情
  window.viewCardDetail = function (jyapply_no, patient_id) {
    if (!jyapply_no) {
      layer.msg("申请单号为空", { icon: 5 });
      return;
    }

    // 显示加载提示
    var loadingIndex = layer.msg("正在加载检验报告...", {
      icon: 16,
      shade: 0.3,
      time: 0,
    });

    // 调用新的 API 获取检验报告信息
    $.ajax({
      url:
        appconfig.api +
        "/api/JcJy/GetJyReportPdfStream?jyapply_no=" +
        jyapply_no,
      type: "GET",
      dataType: "json",
      success: function (res) {
        layer.close(loadingIndex);

        if (res.Status === 1 && res.Data) {
          try {
            // 将 Base64 转换为 Blob
            var base64Data = res.Data.fileStream;
            var byteCharacters = atob(base64Data);
            var byteNumbers = new Array(byteCharacters.length);
            for (var i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            var blob = new Blob([byteArray], { type: "application/pdf" });

            // 创建 Blob URL
            var blobUrl = URL.createObjectURL(blob);

            // 用 PDF.js viewer 展示
            layer.open({
              type: 1,
              title: "检验报告详情",
              area: ["100%", "100%"],
              content:
                '<iframe src="../lib/pdfjs/web/viewer.html?file=' +
                encodeURIComponent(blobUrl) +
                '" style="width:100%;height:100%;border:none;"></iframe>',
              end: function () {
                // 关闭弹窗时释放 Blob URL
                URL.revokeObjectURL(blobUrl);
              },
            });
          } catch (e) {
            layer.msg("PDF解析失败：" + e.message, { icon: 5 });
          }
        } else {
          layer.msg("无报告pdf数据");
        }
      },
      error: function (xhr, status, error) {
        layer.close(loadingIndex);
        console.error("获取检验报告失败:", error);
        layer.msg("网络错误，无法获取检验报告", { icon: 5 });
      },
    });
  };

  // 删除卡片项目
  window.deleteCardItem = function (
    jyapply_no,
    patient_id,
    admiss_times,
    exam_status,
  ) {
    // if (exam_status == 0) {
    //   layer.msg("该申请已登记，不能删除", { icon: 5 });
    //   return;
    // }

    layer.confirm(
      "确定删除该申请吗？",
      { icon: 3, title: "提示" },
      function (index) {
        $.ajax({
          url: appconfig.api + "/api/JcJy/DelJianYan",
          type: "GET",
          data: {
            patient_id: patient_id,
            admiss_times: admiss_times,
            exam_no: jyapply_no,
          },
          dataType: "json",
          success: function (res) {
            if (res.Status === 1) {
              layer.msg("删除成功", { icon: 1 });
              // 重新加载数据
              loadCardsData();
            } else {
              layer.msg("删除失败: " + (res.msg || "未知错误"), {
                icon: 5,
              });
            }
          },
          error: function () {
            layer.msg("网络错误，删除失败", { icon: 5 });
          },
        });
        layer.close(index);
      },
    );
  };

  // 页面加载时直接加载卡片数据
  loadCardsData();

  // 获取检验项目数据
  function loadTestItems(callback) {
    $.ajax({
      url:
        appconfig.api +
        "/api/JcJy/GetJianYanList?ward_sn=" +
        (userData.admiss_dept || ""),
      type: "GET",
      dataType: "json",
      success: function (res) {
        if (res.Status === 1 && res.Data) {
          allTestItems = res.Data;
          callback(true);
        } else {
          layer.msg("获取检验项目数据失败: " + (res.Msg || "未知错误"), {
            icon: 5,
          });
          callback(false);
        }
      },
      error: function () {
        layer.msg("网络错误，无法获取检验项目数据", { icon: 5 });
        callback(false);
      },
    });
  }

  // 获取套餐数据
  function loadPackages(callback) {
    var loginUser = localStorage.getItem("loginUser");

    if (loginUser === null) {
      location.href = "index.html";
      return;
    }
    var loginUserData = JSON.parse(loginUser);
    $.ajax({
      url:
        appconfig.api +
        "/api/MobileWard/GetCustomerTemplates?type=jianyan&opera=" +
        loginUserData.user_mi,
      type: "GET",
      dataType: "json",
      success: function (res) {
        console.log("获取套餐数据 - 响应:", res);
        if (res.Status === 1 && res.Data) {
          testPackages = res.Data;
          callback(true);
        } else {
          layer.msg("获取套餐数据失败: " + (res.Msg || "未知错误"), {
            icon: 5,
          });
          callback(false);
        }
      },
      error: function () {
        layer.msg("网络错误，无法获取套餐数据", { icon: 5 });
        callback(false);
      },
    });
  }

  // 获取申请单编号
  function getApplySn(callback) {
    $.ajax({
      url: appconfig.api + "/api/JcJy/GetApplySn",
      type: "GET",
      dataType: "json",
      success: function (res) {
        if (res.Status === 1 && res.Data) {
          callback(true, res.Data);
        } else {
          layer.msg("获取申请单编号失败: " + (res.msg || "未知错误"), {
            icon: 5,
          });
          callback(false, null);
        }
      },
      error: function () {
        layer.msg("网络错误，无法获取申请单编号", { icon: 5 });
        callback(false, null);
      },
    });
  }

  // 提交检验申请
  function submitTestApply(selectedItems, callback) {
    console.log("提交检验申请 - selectedItems:", selectedItems);
    console.log("提交检验申请 - allTestItems长度:", allTestItems.length);

    var loginUser = localStorage.getItem("loginUser");
    var patientData = JSON.parse(localStorage.getItem("userData") || "{}");

    if (!loginUser) {
      layer.msg("登录信息已过期，请重新登录", { icon: 5 });
      callback(false);
      return;
    }

    var loginUserData = JSON.parse(loginUser);
    var todoList = [];
    var completedCount = 0;
    var totalCount = selectedItems.length;

    console.log("开始处理 selectedItems，总数:", totalCount);

    // 为每个选中的项目创建申请记录
    selectedItems.forEach(function (selectedItem) {
      console.log("处理 selectedItem:", selectedItem);

      // 从allTestItems中找到完整的项目信息
      var fullItem = allTestItems.find(function (item) {
        return (
          item.id == selectedItem.id ||
          item.code == selectedItem.id ||
          item.sub_code == selectedItem.id ||
          item.item_id == selectedItem.id
        );
      });

      console.log("找到的 fullItem:", fullItem);

      if (!fullItem) {
        console.log("未找到对应的 fullItem，selectedItem.id:", selectedItem.id);
        console.log("allTestItems 样例数据:", allTestItems.slice(0, 3));
        completedCount++;
        if (completedCount === totalCount) {
          submitAllApplies();
        }
        return;
      }

      // 获取申请单编号
      getApplySn(function (success, applyData) {
        console.log(
          "getApplySn 结果 - success:",
          success,
          "applyData:",
          applyData,
        );

        if (success && applyData) {
          // 获取当前本地时间
          var now = new Date();
          var localDateTime =
            now.getFullYear() +
            "-" +
            (now.getMonth() + 1).toString().padStart(2, "0") +
            "-" +
            now.getDate().toString().padStart(2, "0") +
            " " +
            now.getHours().toString().padStart(2, "0") +
            ":" +
            now.getMinutes().toString().padStart(2, "0") +
            ":" +
            now.getSeconds().toString().padStart(2, "0");

          var applyModel = {
            jyapply_no:
              applyData.apply_date +
              applyData.apply_sn.toString().padStart(5, "0"),
            reg_date: localDateTime,
            admiss_diag: patientData.admiss_diag || "",
            admiss_times: admiss_times,
            age: (patientData.age || "").replace("岁", ""),
            bed_no: patientData.bed_no || "",
            birth_date: patientData.birth_date
              ? new Date(patientData.birth_date)
                  .toLocaleDateString("zh-CN")
                  .replace(/\//g, "-")
              : "",
            charge_amount: "1",
            dept: patientData.dept || "",
            doctor_code: loginUserData.user_mi,
            erem_flag: "0", // 默认值，可能需要根据实际情况调整
            exec_unit: fullItem.exec_unit || "",
            grp_code: fullItem.code || "",
            grp_name:
              fullItem.sub_code_name || fullItem.name || fullItem.item_name,
            inpatient_no: patientData.inpatient_no || "",
            name: patientData.name || "",
            patient_id: patient_id,
            patient_type: "2", // 1:门诊，2：住院
            purpose: patientData.admiss_diag_name || "",
            samp_id:
              applyData.apply_date +
              applyData.apply_sn.toString().padStart(5, "0"),
            sample_type: fullItem.sample_type || "",
            sample_type_name: fullItem.sample_type_name || "",
            sex: patientData.sex || "",
            status: "0",
            add_new: true,
            ward: userData.admiss_ward || "",
            status_name: "未保存",
          };

          console.log("创建的 applyModel:", applyModel);
          todoList.push(applyModel);
          console.log("添加到 todoList 后，长度:", todoList.length);
        } else {
          console.log("获取申请单编号失败");
        }

        completedCount++;
        if (completedCount === totalCount) {
          submitAllApplies();
        }
      });
    });

    // 提交所有申请
    function submitAllApplies() {
      console.log("submitAllApplies - todoList长度:", todoList.length);
      console.log("submitAllApplies - todoList内容:", todoList);

      if (todoList.length === 0) {
        layer.msg("没有有效的申请数据", { icon: 5 });
        callback(false);
        return;
      }

      $.ajax({
        url: appconfig.api + "/api/JcJy/JianyanSubmit",
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(todoList),
        dataType: "json",
        success: function (res) {
          if (res.Status === 1) {
            callback(true);
          } else {
            layer.msg("提交申请失败: " + (res.Msg || "未知错误"), {
              icon: 5,
            });
            callback(false);
          }
        },
        error: function () {
          layer.msg("网络错误，申请提交失败", { icon: 5 });
          callback(false);
        },
      });
    }
  }

  // 新申请按钮事件处理函数
  function handleNewApply() {
    // 显示加载提示
    var loadingIndex = layer.msg("正在加载数据...", {
      icon: 16,
      shade: 0.3,
      time: 0,
    });

    // 先加载检验项目数据，再加载套餐数据
    loadTestItems(function (itemsSuccess) {
      if (!itemsSuccess) {
        layer.close(loadingIndex);
        return;
      }

      // 加载套餐数据
      loadPackages(function (packagesSuccess) {
        layer.close(loadingIndex);

        if (!packagesSuccess) {
          return;
        }

        // 生成套餐选择下拉选项
        var packageOptionsHtml = "";
        testPackages.forEach(function (pkg) {
          packageOptionsHtml +=
            '<div class="package-option" data-id="' +
            pkg.id +
            '" data-value="' +
            (pkg.value || "") +
            '">' +
            (pkg.name || "未命名套餐") +
            "</div>";
        });

        layer.open({
          type: 1,
          title: false,
          closeBtn: 0,
          skin: "custom-edit-layer",
          area: ["90%", "90%"],
          offset: window.innerWidth < 768 ? "10px" : "auto", // 移动端靠近顶部，桌面端居中
          maxmin: false,
          resize: false,
          content:
            '<div class="package-form">' +
            '<div class="package-content">' +
            '<div class="package-selector">' +
            '<div class="package-select-area">' +
            '<label class="package-select-label">选择检验套餐：</label>' +
            '<div class="package-select" id="package-select" tabindex="0">' +
            '<div class="package-select-display placeholder">请选择检验套餐</div>' +
            '<i class="layui-icon layui-icon-down package-select-arrow"></i>' +
            '<div class="package-dropdown">' +
            packageOptionsHtml +
            "</div>" +
            "</div>" +
            "</div>" +
            '<div class="package-items-area">' +
            '<div class="items-container">' +
            '<div class="no-package-selected">' +
            '<i class="layui-icon layui-icon-file" style="font-size: 36px; display: block; margin-bottom: 8px;"></i>' +
            "请先选择检验套餐" +
            "</div>" +
            "</div>" +
            "</div>" +
            "</div>" +
            "</div>" +
            '<div class="dialog-buttons">' +
            '<button class="layui-btn layui-btn-normal" id="confirm-items">' +
            '<i class="layui-icon layui-icon-ok"></i> 确认申请' +
            "</button>" +
            '<button class="layui-btn layui-btn-primary" id="cancel-items">' +
            '<i class="layui-icon layui-icon-close"></i> 取消' +
            "</button>" +
            "</div>" +
            "</div>",
          success: function (layero, index) {
            var selectedPackage = null;
            var selectedItems = [];

            // 显示项目列表
            function showItems(pkg) {
              var pkgTitle = pkg.title || pkg.name || "未命名套餐";
              var itemsHtml =
                '<div class="items-header">' +
                pkgTitle +
                " - 检验项目</div>" +
                '<div class="items-list">';

              // 根据套餐的value值过滤项目
              var packageItems = [];
              if (pkg.value && allTestItems.length > 0) {
                var valueIds = pkg.value.split(",");
                valueIds.forEach(function (id) {
                  var trimmedId = id.trim();
                  var item = allTestItems.find(function (testItem) {
                    return (
                      testItem.id == trimmedId || testItem.code == trimmedId
                    );
                  });
                  if (item) {
                    packageItems.push(item);
                  }
                });
              }

              if (packageItems.length > 0) {
                packageItems.forEach(function (item) {
                  console.log("生成checkbox的item数据:", item);

                  // 尝试多个可能的id字段名
                  var itemId =
                    item.id || item.code || item.sub_code || item.item_id || "";
                  console.log("使用的itemId:", itemId);

                  itemsHtml +=
                    '<label class="item-checkbox">' +
                    '<input type="checkbox" value="' +
                    itemId +
                    '" data-name="' +
                    (item.name || item.item_name || item.sub_code_name) +
                    '" data-price="' +
                    (item.price || item.charge_amount || "0.00") +
                    '">' +
                    '<span class="item-name">' +
                    (item.name || item.item_name || item.sub_code_name) +
                    "</span>" +
                    "</label>";
                });
              } else {
                itemsHtml +=
                  '<div style="text-align: center; padding: 50px; color: #999;">该套餐暂无项目数据</div>';
              }

              itemsHtml += "</div>";

              $(layero).find(".items-container").html(itemsHtml);

              // 监听项目选择
              $(layero)
                .find(".item-checkbox input")
                .change(function () {
                  updateSelectedItems();
                });
            }

            // 更新选中项目列表
            function updateSelectedItems() {
              selectedItems = [];
              $(layero)
                .find(".item-checkbox input:checked")
                .each(function () {
                  selectedItems.push({
                    id: $(this).val(),
                    name: $(this).data("name"),
                    price: $(this).data("price"),
                  });
                });
            }

            // 套餐选择事件
            var $packageSelect = $(layero).find("#package-select");
            var $packageDisplay = $packageSelect.find(
              ".package-select-display",
            );
            var $packageDropdown = $packageSelect.find(".package-dropdown");

            // 点击显示/隐藏下拉框
            $packageSelect.on("click", function (e) {
              e.stopPropagation();
              if ($packageDropdown.hasClass("show")) {
                $packageDropdown.removeClass("show");
                $packageSelect.removeClass("open");
              } else {
                $packageDropdown.addClass("show");
                $packageSelect.addClass("open");
              }
            });

            // 选择选项
            $packageDropdown.on("click", ".package-option", function (e) {
              e.stopPropagation();
              var packageId = $(this).data("id");
              var packageName = $(this).text();

              // 更新显示
              $packageDisplay.text(packageName).removeClass("placeholder");
              $packageDropdown.find(".package-option").removeClass("selected");
              $(this).addClass("selected");

              // 隐藏下拉框
              $packageDropdown.removeClass("show");
              $packageSelect.removeClass("open");

              // 处理选择逻辑
              if (packageId) {
                selectedPackage = testPackages.find(
                  (pkg) => pkg.id == packageId,
                );
                selectedItems = []; // 切换套餐时清空已选项目
                showItems(selectedPackage);
              }
            });

            // 点击其他地方关闭下拉框
            $(document).on("click", function () {
              $packageDropdown.removeClass("show");
              $packageSelect.removeClass("open");
            });

            // 键盘支持
            $packageSelect.on("keydown", function (e) {
              if (e.keyCode === 13 || e.keyCode === 32) {
                // Enter或Space
                e.preventDefault();
                $(this).click();
              }
            });

            // 确认申请
            $(layero)
              .find("#confirm-items")
              .click(function () {
                if (!selectedPackage) {
                  layer.msg("请先选择一个检验套餐", { icon: 5 });
                  return;
                }

                if (selectedItems.length === 0) {
                  layer.msg("请至少选择一个检验项目", { icon: 5 });
                  return;
                }

                // 显示提交进度
                var submitIndex = layer.msg("正在提交申请...", {
                  icon: 16,
                  shade: 0.3,
                  time: 0,
                });

                // 提交申请
                submitTestApply(selectedItems, function (success) {
                  layer.close(submitIndex);
                  if (success) {
                    layer.msg("检验项目申请成功！", {
                      icon: 1,
                      time: 2000,
                      end: function () {
                        layer.close(index);
                        // 重新加载卡片数据
                        loadCardsData();
                      },
                    });
                  }
                });
              });

            // 取消申请
            $(layero)
              .find("#cancel-items")
              .click(function () {
                layer.close(index);
              });
          },
        });
      });
    });
  }

  // 卡片视图的新建申请按钮事件
  $(document).on("click", "#btn-new-apply-card", function () {
    handleNewApply();
  });
});
