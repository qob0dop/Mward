// HBuilder App环境下打开URL的通用工具函数
function openUrlInBrowser(url, options) {
  options = options || {};
  var title = options.title || "打开链接";
  var confirmMessage =
    options.confirmMessage || "即将使用系统浏览器打开链接，确定继续吗？";
  var showConfirm = options.showConfirm !== false; // 默认显示确认框

  function doOpen() {
    if (window.plus) {
      // HBuilder App环境：使用系统浏览器打开
      try {
        plus.runtime.openURL(url, function (error) {
          layer.msg("无法打开链接：" + error.message, { icon: 5 });
        });
      } catch (e) {
        layer.msg("打开链接失败：" + e.message, { icon: 5 });
      }
    } else if (window.cordova && window.cordova.InAppBrowser) {
      // Cordova环境：使用InAppBrowser插件
      cordova.InAppBrowser.open(url, "_system");
    } else {
      // 普通浏览器环境：新标签页打开
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  if (showConfirm && window.plus) {
    layer.confirm(confirmMessage, { icon: 3, title: title }, function (index) {
      layer.close(index);
      doOpen();
    });
  } else {
    doOpen();
  }
}

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
  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const loginUserData = JSON.parse(localStorage.getItem("loginUser"));

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
  var examPackages = [];
  var allExamItems = []; // 所有检查项目数据
  var cardsData = []; // 卡片数据
  // 格式化状态显示
  function formatStatus(status) {
    switch (status) {
      case "0":
        return { text: "申请", class: "status-pending" };
      case "1":
        return { text: "已登记", class: "status-completed" };
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
    var statusInfo = formatStatus(item.exam_status);
    var formattedApplyDate = formatDate(item.apply_date);
    var formattedScheduledDate = formatDate(item.scheduled_date);

    var projectName = item.exam_sub_type_name || "未指定项目";
    var examType = item.exam_type_name || "未知类型";

    return (
      '<div class="card-item" data-id="' +
      (item.exam_serial || item.exam_no || "") +
      '" data-patient-id="' +
      (item.patient_id || "") +
      '" data-admiss-times="' +
      (item.admiss_times || "") +
      '">' +
      '<div class="card-header">' +
      '<div class="card-title">' +
      '<i class="layui-icon layui-icon-file"></i>' +
      '<span class="project-name">' +
      projectName +
      "</span>" +
      '<span class="exam-type">(' +
      examType +
      ")</span>" +
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
      formattedApplyDate +
      "</div>" +
      "</div>" +
      '<div class="date-item">' +
      '<div class="date-label">报告日期</div>' +
      '<div class="date-value">' +
      formattedScheduledDate +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="card-actions">' +
      '<button class="card-btn card-btn-detail" onclick="viewCardDetail(\'' +
      (item.exam_serial || item.exam_no || "") +
      "', '" +
      (item.patient_id || "") +
      "')\">" +
      '<i class="layui-icon layui-icon-search"></i>' +
      "详情" +
      "</button>" +
      '<button class="card-btn card-btn-delete" onclick="deleteCardItem(\'' +
      (item.exam_no || "") +
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

  // 渲染卡片（按apply_date降序排列）
  function renderCards(data) {
    var container = document.getElementById("cards-container");

    if (!data || data.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<i class="layui-icon layui-icon-list"></i>' +
        '<div class="empty-state-text">暂无检查申请数据</div>' +
        '<div class="empty-state-desc">点击"新建申请"按钮创建检查申请</div>' +
        "</div>";
      return;
    }

    // 按时间倒序排列（最新的在前面）
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
  const JcResultLists = [];
  // 加载检查结果列表
  function loadJcResultList() {
    $.ajax({
      url:
        appconfig.api +
        "/api/JcJy/GetJcResultList?patient_id=" +
        userData.patient_id +
        "&admiss_times=" +
        userData.admiss_times,
      type: "GET",
      dataType: "json",
      success: function (res) {
        if (res.Status === 1 && res.Data) {
          JcResultLists.push(...res.Data);
          console.log("检查结果列表加载成功:", JcResultLists);
        }
      },
      error: function () {
        layer.msg("获取检查结果数据失败", { icon: 5 });
        renderCards([]);
      },
    });
  }
  loadJcResultList();
  // 加载卡片数据
  function loadCardsData() {
    $.ajax({
      url:
        appconfig.api +
        "/api/JcJy/GetJianChaApplys?patient_id=" +
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
          renderCards(cardsData);
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

  // 查看卡片详情
  window.viewCardDetail = function (jcapply_no, patient_id) {
    const result = JcResultLists.find((item) => item.Exam_no === jcapply_no);
    if (!result) {
      layer.msg("未找到对应的检查结果", { icon: 5 });
      return;
    }

    var safe = (v, fallback = "-") =>
      v === null || v === undefined || v === "" ? fallback : v;

    var detailHtml =
      '<div class="detail-container">' +
      '<div class="detail-header">' +
      '<div class="detail-meta-row">' +
      '<div class="meta-chip"><span class="chip-label">申请号</span><span class="chip-value">' +
      safe(result.Exam_no, "-") +
      "</span></div>" +
      '<div class="meta-chip"><span class="chip-label">报告时间</span><span class="chip-value">' +
      safe(result.apply_date, "-") +
      "</span></div>" +
      "</div>" +
      "</div>" +
      '<div class="detail-section">' +
      '<div class="section-title">检查结果</div>' +
      '<div class="section-content highlight">' +
      safe(result.Report_Impression, "无检查结果") +
      "</div>" +
      "</div>" +
      '<div class="detail-section">' +
      '<div class="section-title">检查描述</div>' +
      '<div class="section-content">' +
      safe(result.Report_Description, "无检查描述") +
      "</div>" +
      "</div>" +
      "</div>";

    layer.open({
      type: 1,
      title: result.GrpName,
      area: ["80%", "90%"],
      content: detailHtml,
    });
  };

  // 删除卡片项目
  window.deleteCardItem = function (
    jcapply_no,
    patient_id,
    admiss_times,
    exam_status
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
          url: appconfig.api + "/api/JcJy/DelJianCha",
          type: "GET",
          data: {
            patient_id: patient_id,
            admiss_times: admiss_times,
            exam_no: jcapply_no,
            sybsys_id: loginUserData.subsys_id || "",
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
      }
    );
  };

  // 页面加载时直接加载卡片数据
  loadCardsData();
  // 获取检查项目数据
  function loadExamItems(callback) {
    $.ajax({
      url:
        appconfig.api +
        "/api/JcJy/GetJianChaList?hospital_dept=" +
        (userData.admiss_dept || ""),
      type: "GET",
      dataType: "json",
      success: function (res) {
        if (res.Status === 1 && res.Data) {
          allExamItems = res.Data;
          callback(true);
        } else {
          layer.msg("获取检查项目数据失败: " + (res.msg || "未知错误"), {
            icon: 5,
          });
          callback(false);
        }
      },
      error: function () {
        layer.msg("网络错误，无法获取检查项目数据", { icon: 5 });
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
        "/api/MobileWard/GetCustomerTemplates?type=jiancha&opera=" +
        loginUserData.user_mi,
      type: "GET",
      dataType: "json",
      success: function (res) {
        if (res.Status === 1 && res.Data) {
          examPackages = res.Data;
          callback(true);
        } else {
          layer.msg("获取套餐数据失败: " + (res.msg || "未知错误"), {
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

  // 提交检查申请
  function submitExamApply(selectedItems, callback) {
    console.log("提交检查申请 - selectedItems:", selectedItems);
    console.log("提交检查申请 - allExamItems长度:", allExamItems.length);

    var loginUser = localStorage.getItem("loginUser");
    var patientData = JSON.parse(localStorage.getItem("patientData") || "{}");

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

      // 从allExamItems中找到完整的项目信息
      var fullItem = allExamItems.find(function (item) {
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
        console.log("allExamItems 样例数据:", allExamItems.slice(0, 3));
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
          applyData
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
            // 申请单编号相关
            exam_serial:
              applyData.apply_date +
              applyData.apply_sn.toString().padStart(5, "0"),
            apply_date: localDateTime,

            // 检查项目信息
            exam_type: fullItem.type_code || fullItem.exam_type || "",
            exam_type_name:
              fullItem.type_code_name || fullItem.exam_type_name || "",
            exam_sub_type: fullItem.sub_code || fullItem.code || "",
            exam_sub_type_name:
              fullItem.sub_code_name ||
              fullItem.name ||
              fullItem.item_name ||
              "",
            exec_unit: fullItem.exec_unit || "",
            exec_unit_name: fullItem.exec_unit_name || "",

            // 基础字段
            exam_no:
              applyData.apply_date +
              applyData.apply_sn.toString().padStart(5, "0"),
            patient_id: patient_id,
            admiss_times: admiss_times,
            apply_doctor: loginUserData.user_mi,
            scheduled_date: localDateTime,
            inpatient_no: patientData.inpatient_no || "",
            apply_unit: userData.admiss_ward || localStorage.ward_sn || "",
            erem_flag: "0", // 默认非急诊
            exam_status: "0",
            add_new: true,
            charge_amount: 1,
            zy_mz_flag: "1",
            // 第三方申请信息
            third_apply_type: fullItem.third_apply_type || "",
            third_apply_class: fullItem.third_apply_class || "",

            // 检查附加信息
            exam_add_info: " ",
            exam_add_info2: patientData.admiss_diag_name || " ",
            exam_add_info3: " ",
            exam_add_info4: " ",
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
        url: appconfig.api + "/api/JcJy/JianchaSubmit",
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

    // 先加载检查项目数据，再加载套餐数据
    loadExamItems(function (itemsSuccess) {
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
        examPackages.forEach(function (pkg) {
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
          title: 0,
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
            '<label class="package-select-label">选择检查套餐：</label>' +
            '<div class="package-select" id="package-select" tabindex="0">' +
            '<div class="package-select-display placeholder">请选择检查套餐</div>' +
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
            "请先选择检查套餐" +
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
                " - 检查项目</div>" +
                '<div class="items-list">';

              // 根据套餐的value值过滤项目
              var packageItems = [];
              if (pkg.value && allExamItems.length > 0) {
                var valueIds = pkg.value.split(",");
                valueIds.forEach(function (id) {
                  var trimmedId = id.trim();
                  var item = allExamItems.find(function (examItem) {
                    return (
                      examItem.id == trimmedId || examItem.code == trimmedId
                    );
                  });
                  if (item) {
                    packageItems.push(item);
                  }
                });
              }
              console.log("过滤后的项目数据:", packageItems);
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
              ".package-select-display"
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
                selectedPackage = examPackages.find(
                  (pkg) => pkg.id == packageId
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
                  layer.msg("请先选择一个检查套餐", { icon: 5 });
                  return;
                }

                if (selectedItems.length === 0) {
                  layer.msg("请至少选择一个检查项目", { icon: 5 });
                  return;
                }

                // 显示提交进度
                var submitIndex = layer.msg("正在提交申请...", {
                  icon: 16,
                  shade: 0.3,
                  time: 0,
                });

                // 提交申请
                submitExamApply(selectedItems, function (success) {
                  layer.close(submitIndex);
                  if (success) {
                    layer.msg("检查项目申请成功！", {
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
