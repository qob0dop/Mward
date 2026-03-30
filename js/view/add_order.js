layui.use(["appconfig", "form"], function () {
  const appconfig = layui.appconfig;
  const form = layui.form;
  const $ = layui.$;
  const orderTemplates = [];
  const loginUser = JSON.parse(localStorage.getItem("loginUser") || "{}");
  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  let currentType = "dept"; // 当前选择的模板类型
  let filteredTemplates = []; // 搜索过滤后的模板
  let searchKeyword = ""; // 当前搜索关键词
  let currentOrderDetails = []; // 当前模板的医嘱详情
  let selectedOrders = []; // 当前模板中已选择的医嘱索引
  let globalSelectedOrders = []; // 全局已选医嘱列表，存储完整医嘱对象及来源信息
  let lastPatternName = ""; // 最近一次打开的模板名称
  let panelMode = "all"; // 面板模式: all | selected
  const parentOrder_no = GetParentOrderNo(); // 获取父医嘱号
  // 选项缓存与辅助方法（参考 yizhu.html 逻辑，做轻量实现）
  const frequencyCache = {
    1: { loaded: false, list: [] },
    0: { loaded: false, list: [] },
  }; // 长期/临时分开缓存
  const supplyCache = { loaded: false, list: [] };
  const doseUnitCacheMap = {}; // key: serial|order_code -> [{unit_code, unit_name, unit_type}]
  // 频次编码 -> 医保频次映射
  function mapMedFrequency(code) {
    const c = String(code || "")
      .trim()
      .toUpperCase();
    if (!c) return "99";
    if (["BID", "BID1", "BID2", "BID3", "BID4", "BID5", "BID6"].includes(c))
      return "1";
    if (["BIW", "BIW1", "BIW2"].includes(c)) return "2";
    if (["Q12H"].includes(c)) return "4";
    if (["Q1H1", "Q1H2"].includes(c)) return "5";
    if (["Q3H1", "Q3H2", "Q3H3"].includes(c)) return "6";
    if (["Q6H1", "Q6H2", "Q6H3"].includes(c)) return "7";
    if (["Q8H", "Q8H1", "Q8H2"].includes(c)) return "8";
    if (
      ["QD1", "QD2", "QD3", "QD4", "QD5", "QD6", "QD7", "QD8", "QD9"].includes(
        c
      )
    )
      return "9";
    if (["QID1", "QID2", "QID3", "QID4", "QID5", "QID6"].includes(c))
      return "10";
    if (["QOD1", "QOD2"].includes(c)) return "11";
    if (["QW1", "QW2", "QW3", "QW4", "QW5", "QW6", "QW7"].includes(c))
      return "12";
    if (c === "ST") return "13";
    return "99";
  }

  // 简易日期格式：YYYY-MM-DD
  function formatToYMD(val) {
    if (!val) return "";
    function toDate(input) {
      if (input instanceof Date) return input;
      if (typeof input === "string") {
        const s = input.trim();
        if (/^\d{8}$/.test(s)) {
          return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
        }
        const parsedStr = new Date(s.replace(/\//g, "-"));
        if (!isNaN(parsedStr.getTime())) return parsedStr;
      }
      const parsed = new Date(input);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const d = toDate(val);
    if (!d) return val || "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // 日期时间格式：YYYY-MM-DD HH:mm:ss
  function formatToYMDHMS(val) {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }
  function GetParentOrderNo() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log("Parent Order No:", urlParams.get("parent_no"));
    return urlParams.get("parent_no") || "";
  }
  function fetchFrequencyList(longOnceFlag = "1") {
    const flag = String(longOnceFlag);
    if (frequencyCache[flag] && frequencyCache[flag].loaded) {
      return Promise.resolve(frequencyCache[flag].list);
    }
    return new Promise((resolve) => {
      $.ajax({
        url: appconfig.api + "/api/MobileWard/GetYzFrequency",
        type: "GET",
        dataType: "json",
        data: { long_once_flag: flag },
        success: function (res) {
          const list =
            res && res.Status && Array.isArray(res.Data) ? res.Data : [];
          if (!frequencyCache[flag])
            frequencyCache[flag] = { loaded: false, list: [] };
          frequencyCache[flag].loaded = true;
          frequencyCache[flag].list = list;
          resolve(list);
        },
        error: function () {
          resolve([]);
        },
      });
    });
  }

  function fetchSupplyList() {
    if (supplyCache.loaded) return Promise.resolve(supplyCache.list);
    return new Promise((resolve) => {
      $.ajax({
        url: appconfig.api + "/api/MobileWard/GetYzSupplyList",
        type: "GET",
        dataType: "json",
        success: function (res) {
          const list =
            res && res.Status && Array.isArray(res.Data) ? res.Data : [];
          supplyCache.loaded = true;
          supplyCache.list = list;
          resolve(list);
        },
        error: function () {
          resolve([]);
        },
      });
    });
  }

  function fetchDoseUnitList(serial, order_code) {
    const key = (serial || "00") + "|" + (order_code || "");
    if (doseUnitCacheMap[key]) return Promise.resolve(doseUnitCacheMap[key]);
    if (!order_code) return Promise.resolve([]);
    return new Promise((resolve) => {
      $.ajax({
        url: appconfig.api + "/api/MobileWard/GetYzDictList",
        type: "GET",
        dataType: "json",
        data: { serial: serial || "00", order_code: order_code },
        success: function (res) {
          const arr = [];
          const d =
            res && res.Status && res.Data && res.Data[0] ? res.Data[0] : null;
          if (d) {
            if (d.mini_unit && d.mini1_name)
              arr.push({
                unit_code: d.mini_unit,
                unit_name: d.mini1_name,
                unit_type: "mini",
              });
            if (d.pack_unit && d.pack_name)
              arr.push({
                unit_code: d.pack_unit,
                unit_name: d.pack_name,
                unit_type: "pack",
              });
            if (d.vol_unit && d.vol_name)
              arr.push({
                unit_code: d.vol_unit,
                unit_name: d.vol_name,
                unit_type: "vol",
              });
            if (d.weight_unit && d.weight_name)
              arr.push({
                unit_code: d.weight_unit,
                unit_name: d.weight_name,
                unit_type: "weight",
              });
          }
          doseUnitCacheMap[key] = arr;
          resolve(arr);
        },
        error: function () {
          resolve([]);
        },
      });
    });
  }

  function buildOptions(list, codeKey, nameKey, selectedCode) {
    let html = '<option value="">请选择</option>';
    (list || []).forEach(function (it) {
      const code = (it && it[codeKey]) || "";
      const name = (it && it[nameKey]) || code;
      const sel =
        String(code).trim().toUpperCase() ===
        String(selectedCode || "")
          .trim()
          .toUpperCase()
          ? " selected"
          : "";
      html +=
        '<option value="' +
        String(code).replace(/"/g, "&quot;") +
        '"' +
        sel +
        ">" +
        String(name).replace(/</g, "&lt;") +
        "</option>";
    });
    return html;
  }

  function findCodeByName(list, name, codeKey, nameKey) {
    if (!name) return "";
    const it = (list || []).find(function (x) {
      return String(x[nameKey] || "").trim() === String(name).trim();
    });
    return it ? it[codeKey] || "" : "";
  }

  // 加载模板列表
  function loadYzPatternList() {
    const deptSn = userData.dept || "";
    const opera = currentType === "dept" ? "" : loginUser.user_mi || "";
    $.ajax({
      url: appconfig.api + "/api/MobileWard/GetYzPatternList",
      type: "get",
      dataType: "json",
      data: { dept_sn: deptSn, opera: opera },
      success: function (res) {
        if (res.Status === 1) {
          orderTemplates.length = 0; // 清空现有数据
          (res.Data || []).forEach((item) => {
            orderTemplates.push(item);
          });
          console.log("模板列表(", currentType, "):", orderTemplates);
          renderTemplateList();
        } else {
          layui.layer.msg("获取医嘱模板失败", { icon: 2, time: 3000 });
        }
      },
      error: function () {
        layui.layer.msg("网络错误，获取医嘱模板失败", {
          icon: 2,
          time: 3000,
        });
      },
    });
  }

  // 渲染模板列表
  function renderTemplateList() {
    const templateListContainer = $("#template-list");

    // 通用渲染：科室/个人共用
    if (orderTemplates.length === 0) {
      const emptyText = currentType === "dept" ? "暂无模板" : "暂无个人模板";
      templateListContainer.html(`<div class="empty-state">${emptyText}</div>`);
      updateSearchStats(0, 0);
      return;
    }

    // 根据搜索关键词过滤模板
    const templatesToShow = searchKeyword ? filteredTemplates : orderTemplates;

    templateListContainer.empty();

    if (templatesToShow.length === 0 && searchKeyword) {
      templateListContainer.html(
        '<div class="empty-state">未找到匹配的模板<br>请尝试其他关键词</div>'
      );
    } else {
      templatesToShow.forEach((template, index) => {
        const originalIndex = searchKeyword
          ? orderTemplates.indexOf(template)
          : index;
        const templateCard = `
                <div class="template-card" data-index="${originalIndex}">
                  <div class="template-title">${
                    template.pattern_name || "模板" + (originalIndex + 1)
                  }</div>
                  <div class="template-desc">
                    <strong>模板编码:</strong> ${
                      template.pattern_code || "暂无"
                    }<br>
                    ${
                      template.description
                        ? "<strong>描述:</strong> " + template.description
                        : ""
                    }
                    ${
                      template.create_date
                        ? "<br><strong>创建时间:</strong> " +
                          template.create_date
                        : ""
                    }
                  </div>
                </div>
              `;
        templateListContainer.append(templateCard);
      });
    }

    // 更新搜索统计
    updateSearchStats(templatesToShow.length, orderTemplates.length);

    // 绑定模板卡片点击事件
    $(".template-card").on("click", function () {
      const index = $(this).data("index");
      const selectedTemplate = orderTemplates[index];
      console.log("选择的模板:", selectedTemplate);

      // 添加视觉反馈
      $(".template-card").removeClass("selected");
      $(this).addClass("selected");

      // 获取模板详情
      if (selectedTemplate && selectedTemplate.pattern_code) {
        LoadYzPatternDetail(
          selectedTemplate.pattern_code,
          selectedTemplate.pattern_name
        );
      } else {
        layui.layer.msg("模板信息不完整，无法获取详情", {
          icon: 2,
          time: 3000,
        });
      }
    });
  }

  // 搜索模板
  function searchTemplates(keyword) {
    searchKeyword = keyword.toLowerCase().trim();

    if (!searchKeyword) {
      filteredTemplates = [];
      renderTemplateList();
      return;
    }

    filteredTemplates = orderTemplates.filter((template) => {
      const name = (template.pattern_name || "").toLowerCase();
      const code = (template.pattern_code || "").toLowerCase();
      const desc = (template.description || "").toLowerCase();

      return (
        name.includes(searchKeyword) ||
        code.includes(searchKeyword) ||
        desc.includes(searchKeyword)
      );
    });

    renderTemplateList();
  }

  // 更新搜索统计信息
  function updateSearchStats(showCount, totalCount) {
    const statsElement = $("#searchStats");
    if (searchKeyword) {
      statsElement.text(`找到 ${showCount} 个模板，共 ${totalCount} 个`);
    } else if (totalCount > 0) {
      statsElement.text(`共 ${totalCount} 个模板`);
    } else {
      statsElement.text("");
    }
  }

  // 导航栏点击事件
  $(".nav-item").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    currentType = $(this).data("type");

    // 切换导航时重置搜索
    $("#searchInput").val("");
    $("#clearSearch").hide();
    $("#searchIcon").show();
    searchKeyword = "";
    filteredTemplates = [];

    // 导航切换时重新拉取对应类型的模板列表
    loadYzPatternList();
  });

  function LoadYzPatternDetail(patternCode, patternName) {
    if (!patternCode) {
      console.error("模板编码不能为空");
      return;
    }

    $.ajax({
      url: appconfig.api + "/api/MobileWard/GetYzPatternDetail",
      type: "get",
      dataType: "json",
      data: {
        dept_sn: userData.dept || "",
        emp_sn: loginUser.user_mi || "",
        pattern_code: patternCode,
      },
      success: function (res) {
        if (res.Status === 1) {
          console.log("获取到模板详情:", res.Data);
          currentOrderDetails = res.Data || [];
          showOrderPanel(patternName, currentOrderDetails);
        } else {
          layui.layer.msg(
            "获取医嘱模板明细失败: " + (res.Message || "未知错误"),
            { icon: 2, time: 3000 }
          );
        }
      },
      error: function (xhr, status, error) {
        layui.layer.msg("网络错误，获取医嘱模板明细失败", {
          icon: 2,
          time: 3000,
        });
        console.error("获取模板详情失败:", error);
      },
    });
  }

  // 显示医嘱选择面板
  function showOrderPanel(patternName, orderDetails) {
    const panel = $("#orderPanel");
    const overlay = $("#orderOverlay");
    const title = $("#orderPanelTitle");
    const orderList = $("#orderList");

    // 设置标题
    title.text(`${patternName} - 医嘱列表`);
    lastPatternName = patternName || lastPatternName;
    panelMode = "all";

    // 重新加载当前模板的选择状态
    selectedOrders = [];
    orderDetails.forEach((order, index) => {
      const globalIndex = globalSelectedOrders.findIndex(
        (global) =>
          global.order_code === order.order_code &&
          global.pattern_name === patternName
      );
      if (globalIndex !== -1) {
        selectedOrders.push(index);
      }
    });

    // 生成医嘱列表
    orderList.empty();

    if (orderDetails.length === 0) {
      orderList.html(
        '<div style="text-align: center; padding: 20px; color: #999;">该模板暂无医嘱明细</div>'
      );
    } else {
      orderDetails.forEach((order, index) => {
        const checked = selectedOrders.includes(index) ? "checked" : "";
        const orderItem = `
                <div class="order-item">
                  <input type="checkbox" class="order-checkbox" data-index="${index}" id="order_${index}" ${checked}>
                  <div class="order-content">
                    <div class="order-name">${
                      order.order_name ||
                      order.drug_name ||
                      "医嘱" + (index + 1)
                    }</div>
                    <div class="order-details">
                      ${
                        order.drug_specification
                          ? "规格: " + order.drug_specification + " | "
                          : ""
                      }
                      ${
                        order.doseage
                          ? "剂量: " +
                            order.doseage +
                            order.doseage_unit_name +
                            " | "
                          : ""
                      }
                      ${
                        order.frequ_name
                          ? "频次: " + order.frequ_name + " | "
                          : ""
                      }
                      ${
                        order.supply_name
                          ? "用法: " + order.supply_name + " | "
                          : ""
                      }
                      ${
                        order.charge_amount
                          ? "数量: " + order.charge_amount
                          : ""
                      }
                      ${order.order_code ? "<br>编码: " + order.order_code : ""}
                    </div>
                  </div>
                </div>
              `;
        orderList.append(orderItem);
      });
    }

    // 显示蒙版和面板
    overlay.addClass("show");
    panel.removeClass("hide").addClass("show");

    // 更新选择计数
    updateSelectedCount();
  }

  // 显示全屏已选医嘱页面
  function showSelectedOrdersFullpage() {
    const fullpage = $("#selectedOrdersFullpage");
    const title = $("#fullpageTitle");
    const content = $("#fullpageContent");

    title.text(`全局已选医嘱 (${globalSelectedOrders.length})`);

    content.empty();
    if (globalSelectedOrders.length === 0) {
      content.html(
        '<div style="text-align:center;padding:60px;color:#999;font-size:16px;">暂无已选医嘱</div>'
      );
    } else {
      globalSelectedOrders.forEach((globalOrder, globalIndex) => {
        const isLongTerm = globalOrder.long_once_flag === "1";
        const typeBadge = `<span class="layui-badge ${
          isLongTerm ? "layui-bg-blue" : "layui-bg-orange"
        }" style="margin-right: 8px;">${isLongTerm ? "长期" : "临时"}</span>`;

        const orderItem = `
                <div class="order-item" data-global-index="${globalIndex}">
                  <div class="order-main">
                    <div class="order-content">
                      <div class="order-name">
                        ${typeBadge}
                        ${
                          globalOrder.order_name ||
                          globalOrder.drug_name ||
                          "医嘱"
                        }</div>
                      <div class="order-details">
                        <strong>来源模板:</strong> ${
                          globalOrder.pattern_name
                        }<br>
                        ${
                          globalOrder.drug_description
                            ? "规格: " + globalOrder.drug_description + " | "
                            : ""
                        }
                        ${
                          globalOrder.doseage
                            ? "剂量: " +
                              globalOrder.doseage +
                              globalOrder.doseage_unit_name +
                              " | "
                            : ""
                        }
                        ${
                          globalOrder.frequ_name
                            ? "频次: " + globalOrder.frequ_name + " | "
                            : ""
                        }
                        ${
                          globalOrder.supply_name
                            ? "用法: " + globalOrder.supply_name
                            : ""
                        }
                        ${
                          globalOrder.order_code
                            ? "<br>编码: " + globalOrder.order_code
                            : ""
                        }
                      </div>
                    </div>
                  </div>
                  <div class="order-footer">
                    <div class="action-buttons">
                      <button class="btn btn-secondary global-edit-btn" data-global-index="${globalIndex}" type="button">编辑</button>
                      <button class="btn btn-secondary global-delete-btn" data-global-index="${globalIndex}" type="button">删除</button>
                    </div>
                  </div>
                </div>`;
        content.append(orderItem);
      });
    }

    // 更新计数
    $("#fullpageSelectedCount").text(
      `全局已选 ${globalSelectedOrders.length} 项`
    );

    fullpage.addClass("show");
  }

  // 隐藏全屏已选医嘱页面
  function hideSelectedOrdersFullpage() {
    $("#selectedOrdersFullpage").removeClass("show");
  }

  // 更新已选择医嘱计数
  function updateSelectedCount() {
    const currentCount = selectedOrders.length;
    const globalCount = globalSelectedOrders.length;

    $("#selectedCount").text(`已选择 ${currentCount} 项`);

    // 同步底部汇总栏（显示全局计数）
    $("#summarySelectedCount").text(globalCount);
    const summaryBar = $("#selectedSummaryBar");
    if (globalCount > 0) {
      summaryBar.addClass("show");
    } else {
      summaryBar.removeClass("show");
    }

    // 更新全选按钮文字
    const totalCount = currentOrderDetails.length;
    const selectAllBtn = $("#selectAllBtn");
    if (currentCount === totalCount && totalCount > 0) {
      selectAllBtn.text("取消全选");
    } else {
      selectAllBtn.text("全选");
    }
  }

  // 隐藏医嘱面板
  function hideOrderPanel() {
    const panel = $("#orderPanel");
    const overlay = $("#orderOverlay");

    panel.removeClass("show");
    overlay.removeClass("show");
    // 不清空 selectedOrders，保留汇总栏；仅隐藏面板
  }

  // 搜索框事件绑定
  function initSearchEvents() {
    const searchInput = $("#searchInput");
    const clearButton = $("#clearSearch");
    const searchIcon = $("#searchIcon");

    // 搜索输入事件 - 实时搜索
    searchInput.on("input", function () {
      const keyword = $(this).val();

      // 显示/隐藏清空按钮
      if (keyword) {
        clearButton.show();
        searchIcon.hide();
      } else {
        clearButton.hide();
        searchIcon.show();
      }

      // 执行搜索
      searchTemplates(keyword);
    });

    // 清空搜索
    clearButton.on("click", function () {
      searchInput.val("");
      clearButton.hide();
      searchIcon.show();
      searchTemplates("");
    });

    // 搜索图标点击
    searchIcon.on("click", function () {
      searchInput.focus();
    });

    // 回车搜索
    searchInput.on("keypress", function (e) {
      if (e.which === 13) {
        searchTemplates($(this).val());
      }
    });
  }

  // 医嘱面板事件绑定
  function initOrderPanelEvents() {
    // 关闭面板
    $("#closeOrderPanel").on("click", function () {
      hideOrderPanel();
    });

    // 点击蒙版关闭面板
    $("#orderOverlay").on("click", function () {
      hideOrderPanel();
    });

    // 防止面板内容点击事件冒泡到蒙版
    $("#orderPanel").on("click", function (e) {
      e.stopPropagation();
    });

    // 医嘱复选框变化
    $(document).on("change", ".order-checkbox", function () {
      const index = parseInt($(this).data("index"));
      const isChecked = $(this).is(":checked");
      const currentOrder = currentOrderDetails[index];

      if (isChecked) {
        // 添加到当前选择
        if (!selectedOrders.includes(index)) {
          selectedOrders.push(index);
        }
        // 添加到全局选择（避免重复）
        const existsInGlobal = globalSelectedOrders.findIndex(
          (global) =>
            global.order_code === currentOrder.order_code &&
            global.pattern_name === lastPatternName
        );
        if (existsInGlobal === -1) {
          globalSelectedOrders.push({
            ...currentOrder,
            long_once_flag: "0", // 默认设置为临时医嘱
            pattern_name: lastPatternName,
            original_index: index,
          });
        }
      } else {
        // 从当前选择中移除
        const pos = selectedOrders.indexOf(index);
        if (pos !== -1) {
          selectedOrders.splice(pos, 1);
        }
        // 从全局选择中移除
        const globalIndex = globalSelectedOrders.findIndex(
          (global) =>
            global.order_code === currentOrder.order_code &&
            global.pattern_name === lastPatternName
        );
        if (globalIndex !== -1) {
          globalSelectedOrders.splice(globalIndex, 1);
        }
      }

      updateSelectedCount();
      if (panelMode === "selected") {
        showSelectedOrdersFullpage();
      }
    });

    // 全局已选医嘱 - 删除按钮
    $(document).on("click", ".global-delete-btn", function () {
      const globalIndex = parseInt($(this).data("global-index"));
      const orderName = globalSelectedOrders[globalIndex]
        ? globalSelectedOrders[globalIndex].order_name ||
          globalSelectedOrders[globalIndex].drug_name ||
          "医嘱"
        : "此医嘱";

      layui.layer.confirm(
        `确定删除 ${orderName} 吗？`,
        { icon: 3, title: "删除确认" },
        function (idx) {
          // 确认删除
          globalSelectedOrders.splice(globalIndex, 1);
          updateSelectedCount();
          showSelectedOrdersFullpage();
          layui.layer.close(idx);
        }
      );
    });

    // 全局已选医嘱 - 编辑按钮（带下拉选择：剂量单位/用法/频率）
    $(document).on("click", ".global-edit-btn", function () {
      const globalIndex = parseInt($(this).data("global-index"));
      const order = globalSelectedOrders[globalIndex];
      if (!order) return;

      // 确保 long_once_flag 存在，默认为长期医嘱 '1'

      order.long_once_flag = order.long_once_flag === "0" ? "0" : "1";

      const serial = order.Serial || order.serial || "00";
      const orderCode = order.order_code || "";

      // 根据当前医嘱类型加载初始频次列表
      Promise.all([
        fetchFrequencyList(order.long_once_flag),
        fetchDoseUnitList(serial, orderCode),
        fetchSupplyList(),
      ]).then(function ([freqList, unitList, supplyList]) {
        const frequ_code =
          order.frequ_code ||
          findCodeByName(freqList, order.frequ_name, "code", "name");
        const dose_unit_code =
          order.doseage_unit ||
          findCodeByName(
            unitList,
            order.doseage_unit_name,
            "unit_code",
            "unit_name"
          );
        const supply_code =
          order.supply_code ||
          findCodeByName(
            supplyList,
            order.supply_name,
            "supply_code",
            "supply_name"
          );

        const freqOptions = buildOptions(freqList, "code", "name", frequ_code);
        const unitOptions = buildOptions(
          unitList,
          "unit_code",
          "unit_name",
          dose_unit_code
        );
        const supplyOptions = buildOptions(
          supplyList,
          "supply_code",
          "supply_name",
          supply_code
        );

        const content = `
                <form class="layui-form edit-order-form" lay-filter="editOrderForm" style="padding: 20px 25px 10px 0px;">
                  <div class="layui-form-item">
                    <h3>${(order.order_name || "").replace(/"/g, "&quot;")}</h3>
                    
                  </div>
                  <div class="layui-form-item">
                    <label class="layui-form-label">医嘱类型</label>
                    <div class="layui-input-block">
                      <input type="checkbox" name="long_once_flag" lay-skin="switch" lay-text="长|临" lay-filter="longOnceSwitch" ${
                        order.long_once_flag === "0" ? "" : "checked"
                      } value="1">
                    </div>
                  </div>
                  <div class="layui-form-item">
                    <label class="layui-form-label">剂量</label>
                    <div class="layui-input-block">
                      <input type="text" id="edit_order_doseage" name="doseage" class="layui-input" value="${
                        order.doseage || ""
                      }" placeholder="请输入剂量">
                    </div>
                  </div>
                  <div class="layui-form-item">
                    <label class="layui-form-label">单位</label>
                    <div class="layui-input-block">
                      <select id="edit_order_doseage_unit" name="doseage_unit" lay-search>${unitOptions}</select>
                    </div>
                  </div>
                 
                  <div class="layui-form-item">
                    <label class="layui-form-label">频次</label>
                    <div class="layui-input-block">
                      <select id="edit_order_frequ" name="frequ_code" lay-search>${freqOptions}</select>
                    </div>
                  </div>
                   <div class="layui-form-item">
                    <label class="layui-form-label">数量</label>
                    <div class="layui-input-block">
                      <input type="number" id="edit_order_charge_amount" name="charge_amount" class="layui-input" value="${
                        order.charge_amount || "1"
                      }" placeholder="请输入数量">
                    </div>
                  </div>
                  <div class="layui-form-item" style="grid-column: 1 / -1;">
                    <label class="layui-form-label">用法</label>
                    <div class="layui-input-block">
                      <select id="edit_order_supply" name="supply_code" lay-search>${supplyOptions}</select>
                    </div>
                  </div>
                 
                </form>
              `;

        layui.layer.open({
          type: 1,
          title: false,
          closeBtn: 0,
          area: ["90%", "auto"],
          maxWidth: "600px",
          skin: "custom-edit-layer",
          content: content,
          btn: ["保存", "取消"],
          success: function (layero) {
            form.render(null, "editOrderForm"); // 渲染整个表单

            // 监听医嘱类型切换
            form.on("switch(longOnceSwitch)", function (data) {
              const newFlag = data.elem.checked ? "1" : "0";
              fetchFrequencyList(newFlag).then(function (newList) {
                const newFreqOptions = buildOptions(
                  newList,
                  "code",
                  "name",
                  ""
                ); // 不保留旧选择
                layero.find("#edit_order_frequ").html(newFreqOptions);
                form.render("select", "editOrderForm"); // 重新渲染下拉框
              });
            });
          },
          yes: function (index, layero) {
            const newDose = layero.find("#edit_order_doseage").val();
            const newCharge = layero.find("#edit_order_charge_amount").val();
            const newFrequCode = layero.find("#edit_order_frequ").val();
            const newDoseUnitCode = layero
              .find("#edit_order_doseage_unit")
              .val();
            const newSupplyCode = layero.find("#edit_order_supply").val();
            const newLongOnceFlag = layero
              .find('input[name="long_once_flag"]')
              .is(":checked")
              ? "1"
              : "0";

            // 重新获取当前类型的频次列表以找到名称
            const currentFreqList = frequencyCache[newLongOnceFlag].list || [];
            const frequItem = currentFreqList.find(
              (x) =>
                String(x.code || "").toUpperCase() ===
                String(newFrequCode || "").toUpperCase()
            );
            const unitItem = (unitList || []).find(
              (x) =>
                String(x.unit_code || "").toUpperCase() ===
                String(newDoseUnitCode || "").toUpperCase()
            );
            const supplyItem = (supplyList || []).find(
              (x) =>
                String(x.supply_code || "").toUpperCase() ===
                String(newSupplyCode || "").toUpperCase()
            );

            order.doseage = newDose;
            order.charge_amount = newCharge;
            order.long_once_flag = newLongOnceFlag;
            order.frequ_code = newFrequCode || "";
            order.frequ_name =
              (frequItem && (frequItem.name || frequItem.code)) || "";
            order.supply_code = newSupplyCode || "";
            order.supply_name =
              (supplyItem &&
                (supplyItem.supply_name || supplyItem.supply_code)) ||
              "";
            order.doseage_unit = newDoseUnitCode || "";
            order.doseage_unit_name =
              (unitItem && (unitItem.unit_name || unitItem.unit_code)) || "";

            globalSelectedOrders[globalIndex] = order;
            updateSelectedCount();
            showSelectedOrdersFullpage();
            layui.layer.close(index);
          },
        });
      });
    });

    // 全选/取消全选
    $("#selectAllBtn").on("click", function () {
      const totalCount = currentOrderDetails.length;
      const isSelectAll = selectedOrders.length !== totalCount;

      $(".order-checkbox").prop("checked", isSelectAll);

      if (isSelectAll) {
        // 全选：添加所有医嘱到当前和全局选择
        selectedOrders = [...Array(totalCount).keys()];
        currentOrderDetails.forEach((order, index) => {
          const existsInGlobal = globalSelectedOrders.findIndex(
            (global) =>
              global.order_code === order.order_code &&
              global.pattern_name === lastPatternName
          );
          if (existsInGlobal === -1) {
            globalSelectedOrders.push({
              ...order,
              long_once_flag: "0", // 默认设置为临时医嘱
              pattern_name: lastPatternName,
              original_index: index,
            });
          }
        });
      } else {
        // 取消全选：从当前和全局选择中移除当前模板的所有医嘱
        selectedOrders = [];
        globalSelectedOrders = globalSelectedOrders.filter(
          (global) => global.pattern_name !== lastPatternName
        );
      }

      updateSelectedCount();
    });

    // 确认添加医嘱
    $("#confirmOrderBtn").on("click", function () {
      if (globalSelectedOrders.length === 0) {
        layui.layer.msg("请至少选择一个医嘱", { icon: 2, time: 2000 });
        return;
      }

      console.log("确认添加的全局医嘱:", globalSelectedOrders);

      // 这里可以添加提交医嘱的逻辑
      layui.layer.msg(
        `已选择 ${globalSelectedOrders.length} 个医嘱，准备添加到患者医嘱中`,
        { icon: 1, time: 2000 }
      );

      // 隐藏面板
      hideOrderPanel();
    });

    // 查看已选：进入全屏模式
    $("#viewSelectedBtn").on("click", function () {
      if (globalSelectedOrders.length === 0) {
        layui.layer.msg("还没有勾选任何医嘱", { icon: 2, time: 2000 });
        return;
      }
      showSelectedOrdersFullpage();
    });

    // 关闭全屏页面
    $("#closeFullpage").on("click", function () {
      hideSelectedOrdersFullpage();
    });

    // 全屏页面确认添加
    $("#fullpageConfirmBtn").on("click", function () {
      if (globalSelectedOrders.length === 0) {
        layui.layer.msg("请至少选择一个医嘱", { icon: 2, time: 2000 });
        return;
      }

      console.log("确认添加的全局医嘱:", globalSelectedOrders);

      // 先走审核，通过后再提交；有提示则让用户确认
      auditSelectedOrders({
        autoSubmitOnPass: true,
        onProceedAfterIssue: submitSelectedOrders,
      });
    });

    // 全屏审核
    $("#fullpageAuditBtn").on("click", function () {
      if (!globalSelectedOrders || globalSelectedOrders.length === 0) {
        layui.layer.msg("暂无已选医嘱可审核", { icon: 2, time: 2000 });
        return;
      }
      auditSelectedOrders();
    });
  }

  // 批量提交已选医嘱
  // 尝试刷新 yizhu 的简洁封装：会先尝试直接调用父/顶层/opener 函数，失败时使用 postMessage 回退
  function tryRefreshYizhu() {
    try {
      // 直接调用 parent.frames[0].refreshYizhu（你已确认该方法有效）
      if (
        parent &&
        parent.frames &&
        parent.frames[0] &&
        typeof parent.frames[0].refreshYizhu === "function"
      ) {
        parent.frames[0].refreshYizhu();
        console.log("调用 parent.frames[0].refreshYizhu 成功");
        return true;
      }
      // 回退：使用 postMessage 告知可接收方刷新
      var msg = { type: "refreshYizhuRequest" };
      try {
        if (parent && parent !== window && parent.postMessage)
          parent.postMessage(msg, "*");
      } catch (e) {}
      try {
        if (window.top && window.top !== window && window.top.postMessage)
          window.top.postMessage(msg, "*");
      } catch (e) {}
      try {
        if (window.opener && window.opener.postMessage)
          window.opener.postMessage(msg, "*");
      } catch (e) {}
      return false;
    } catch (e) {
      console.warn("tryRefreshYizhu 异常：", e);
      return false;
    }
  }
  function submitSelectedOrders() {
    if (!globalSelectedOrders || globalSelectedOrders.length === 0) {
      layui.layer.msg("没有可提交的医嘱", { icon: 2, time: 2000 });
      return;
    }

    // 获取当前用户、病人和科室信息
    const currentUser = JSON.parse(localStorage.getItem("loginUser") || "{}");
    const patientData = JSON.parse(localStorage.getItem("userData") || "{}");
    const wardData = JSON.parse(localStorage.getItem("wardData") || "{}");

    // 获取当前时间
    const now = new Date();
    const currentTime =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0") +
      " " +
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0") +
      ":" +
      String(now.getSeconds()).padStart(2, "0");

    const doctorCode = currentUser.user_id || currentUser.user_mi || "00000";

    // 将globalSelectedOrders转换为API所需的格式
    const todoList = globalSelectedOrders.map(function (order) {
      return {
        act_order_no: "", // 后端生成
        add_opera: doctorCode,
        admiss_times: patientData.admiss_times || "1",
        ca_id_doctor: doctorCode,
        charge_amount: order.charge_amount || "1",
        discription: order.instruction || order.drug_description || "",
        drug_occ: order.drug_occ || "",
        drug_specification: order.drug_specification || order.order_spec || "",
        end_time: null,
        end_time_2: null,
        enter_oper: doctorCode,
        enter_time: currentTime,
        exec_unit: userData.admiss_ward || "",
        exclusive_type: "1",
        fit_flag: "1",
        frequ_code: (order.frequency || order.frequ_code || "ONCE").trim(),
        group_no: order.group_no || "000000",
        instruction: order.instruction || order.drug_description || "",
        is_new: true,
        long_once_flag: order.long_once_flag || "0",
        modify_price: "",
        order_code: order.order_code || "",
        order_doctor: doctorCode,
        order_name: order.order_name || order.drug_name || "",
        order_time: currentTime,
        order_type: (order.long_once_flag || "0") === "1" ? "3" : "4",
        parent_no: parentOrder_no || null,
        patient_id: patientData.patient_id || "00000",
        prev_flag: "",
        Serial: order.serial || "",
        self_buy: "0",
        skin_test_flag: "",
        spinfo_type: "1",
        start_time: currentTime,
        status_flag: "0",
        supply_code: order.supply_code || "",
        doseage: order.dosage || order.doseage || null,
        doseage_unit: order.doseage_unit || null,
        doseage_unit_name:
          order.doseage_unit_name || order.doseage_unit || null,
        frequ_code: order.frequency || order.frequ_code || "ONCE",
        ward_sn: userData.admiss_ward || "",
      };
    });

    console.log("准备提交的医嘱数据:", todoList);

    // 显示加载中
    const loadingMsg = "正在提交医嘱...";
    console.log(loadingMsg);

    // 发送AJAX请求
    $.ajax({
      url: appconfig.api + "/api/MobileWard/AddActYz",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(todoList),
      dataType: "json",
      success: function (response) {
        console.log("提交响应:", response);
        if (response && response.Status === 1) {
          layui.layer.msg("提交成功！", { icon: 1, time: 2000 });
          // 清空已选医嘱
          globalSelectedOrders = [];
          selectedOrders = [];
          updateSelectedCount();
          hideSelectedOrdersFullpage();
          // 简洁调用：尝试刷新 yizhu（内部实现包含直接调用与 postMessage 回退）
          tryRefreshYizhu();
          // 可以在这里添加刷新页面或跳转的逻辑
        } else {
          const errorMsg =
            response && response.Message ? response.Message : "提交失败";
          layui.layer.msg(errorMsg, { icon: 2, time: 3000 });
        }
      },
      error: function (xhr) {
        console.error("提交失败:", xhr);
        let errorMsg = "网络错误，提交失败";
        if (xhr.responseJSON && xhr.responseJSON.Message) {
          errorMsg = xhr.responseJSON.Message;
        }
        layui.layer.msg(errorMsg, { icon: 2, time: 3000 });
      },
    });
  }

  // 录入审核：将已选医嘱作为 AD_LIST 提交到融合审核
  function auditSelectedOrders(options) {
    const opts = options || {};
    const autoSubmitOnPass = !!opts.autoSubmitOnPass;
    const onPass =
      typeof opts.onPass === "function"
        ? opts.onPass
        : autoSubmitOnPass
        ? submitSelectedOrders
        : null;
    const onProceedAfterIssue =
      typeof opts.onProceedAfterIssue === "function"
        ? opts.onProceedAfterIssue
        : onPass;
    const onCancel = typeof opts.onCancel === "function" ? opts.onCancel : null;
    try {
      const wardData = JSON.parse(
        localStorage.getItem("selectedWard") ||
          localStorage.getItem("wardData") ||
          "{}"
      );
      const now = new Date();
      const currentDateTime = formatToYMDHMS(now);

      // 构建 AD_LIST（多个医嘱）
      const adList = (globalSelectedOrders || []).map(function (order) {
        const longFlag = String(order.long_once_flag || "0");
        const freqCode = (order.frequency || order.frequ_code || "").trim();
        return {
          DATA_ID:
            (userData.inpatient_no || "") + (userData.admiss_times || ""),
          UPDATE_TIME: formatToYMDHMS(userData.admiss_date),
          FIXMEDINS_CODE: "H42080400001",
          FIXMEDINS_NAME: "荆门市中医医院",
          AREA_CODE: "",
          AREA_NAME: "",
          PATIENT_ID: userData.patient_id,
          ZYH: (userData.inpatient_no || "") + (userData.admiss_times || ""),
          RPNO: "",
          AD_ID: order.act_order_no || "",
          AD_CATOGRAY: longFlag === "1" ? "1" : "2",
          AD_CODE: order.order_code || "",
          AD_NAME: order.order_name || order.drug_name || "",
          AD_ITEM_CODE: order.order_code || "",
          AD_ITEM_NAME: order.order_name || order.drug_name || "",
          AD_ITEM_QUANTITY: order.charge_amount || "1",
          AD_ITEM_AMOUNT: +order.charge_amount * +order.linked_price || 0,
          MED_ROUTE: order.supply_code || "99",
          MED_FREQUENCY: mapMedFrequency(freqCode),
          AD_CRTE_DATE: currentDateTime,
          AD_CRTE_DEPT_CODE: userData.ward || userData.admiss_ward || "",
          AD_CRTE_DEPT_NAME: userData.ward_name || wardData.ward_name || "",
          AD_CRTE_DR_CODE: loginUser.user_mi || loginUser.user_id || "",
          AD_CRTE_DR_NAME: loginUser.name || loginUser.user_name || "",
          AD_B_EXEC_DATE: "",
          AD_E_EXEC_DATE: "",
          PAY_TYPE: "2",
        };
      });

      const payload = {
        CALLER: {
          CALLER_SYS_NAME: "HIS住院工作站",
          CALLER_USER_ID: loginUser.user_mi || loginUser.user_id || "",
          CALLER_USER_NAME: loginUser.name || loginUser.user_name || "",
        },
        AD_BASE_INFO: {
          DATA_ID:
            (userData.inpatient_no || "") + (userData.admiss_times || ""),
          UPDATE_TIME: formatToYMDHMS(userData.admiss_date),
          FIXMEDINS_CODE: "H42080400001",
          FIXMEDINS_NAME: "荆门市中医医院",
          AREA_CODE: "",
          AREA_NAME: "",
          PATIENT_ID: userData.patient_id || "",
          ZYH: (userData.inpatient_no || "") + (userData.admiss_times || ""),
          PSN_NAME: userData.name || "",
          HI_SETL_LV: "3",
          GEND: userData.sex || "",
          BRDY: formatToYMD(userData.birth_date) || "",
          CERTNO: userData.idcard || "-",
          BEDNO: userData.bed_no || "",
          PREGNANCY: "",
          TRUM: "",
          MED_TYPE: "21",
          INSUTYPE: "",
          ADM_TIME: formatToYMDHMS(userData.admiss_date),
          ADM_DEPT_CODE: userData.admiss_dept || "",
          ADM_DEPT_NAME: userData.ward_name || wardData.ward_name || "",
          ADM_CATY: wardData.tcmms_code1 || "",
          WARDAREA_CODE: wardData.ward_sn || userData.admiss_ward || "",
          WARDAREA_NAME: wardData.ward_name || userData.ward_name || "",
          IPT_DR_CODE: loginUser.user_mi || loginUser.user_id || "",
          IPT_DR_NAME: loginUser.name || loginUser.user_name || "",
          RESP_NURS_CODE: userData.refer_nurse || "",
          RESP_NURS_NAME: userData.refer_nurse_name || "",
          DSCG_TIME: "",
          DSCG_DEPT_CODE: "",
          DSCG_DEPT_NAME: "",
          DSCG_CATY: "",
          MEDFEE_SUMAMT: "0",
          STATUS: "1",
        },
        AD_DISE_LIST: [
          {
            DATA_ID:
              (userData.inpatient_no || "") + (userData.admiss_times || ""),
            UPDATE_TIME: formatToYMDHMS(userData.admiss_date),
            FIXMEDINS_CODE: "H42080400001",
            FIXMEDINS_NAME: "荆门市中医医院",
            AREA_CODE: "",
            AREA_NAME: "",
            PATIENT_ID: userData.patient_id || "",
            ZYH: (userData.inpatient_no || "") + (userData.admiss_times || ""),
            MAINDIAG_FLAG: "1",
            DIAG_CODE: userData.admiss_diag || "",
            DIAG_NAME: userData.admiss_diag_name || "",
            SEQ: "1",
          },
        ],
        AD_OPRN_OPRT_LIST: [],
        AD_LIST: adList,
        AD_FEE_LIST: [],
      };

      const url = appconfig.api + "/fusion_audit/open_api/advice_audit";
      const loadingIndex = layui.layer.load(1, { shade: [0.3, "#000"] });
      $.ajax({
        url,
        method: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(payload),
        success: function (res) {
          layui.layer.close(loadingIndex);
          try {
            const ok =
              res &&
              (res.code === 0 ||
                res.Status === 1 ||
                res.success === true ||
                res.code === 200);
            if (ok) {
              const data = res && res.data;
              const redirectUrl = data && data.url;
              if (!redirectUrl) {
                layui.layer.msg("审核通过，正在提交", { icon: 1, time: 1500 });
                if (typeof onPass === "function") onPass();
              } else {
                // 提取 id 参数
                let reqId = "";
                try {
                  const u = new URL(redirectUrl);
                  reqId = u.searchParams.get("id") || "";
                } catch (_) {}
                if (!reqId) {
                  layui.layer.msg("审核返回待查看URL，但未能解析ID", {
                    icon: 0,
                    time: 3000,
                  });
                } else {
                  fetchAuditResult(reqId, {
                    onContinue: onProceedAfterIssue,
                    onCancel: onCancel,
                  });
                }
              }
            } else {
              const msg =
                (res && (res.message || res.Message)) || "接口返回非成功状态";
              layui.layer.msg(msg, { icon: 2, time: 4000 });
            }
          } catch (e) {
            layui.layer.msg("接口返回解析失败", { icon: 2, time: 3000 });
          }
        },
        error: function (xhr) {
          layui.layer.close(loadingIndex);
          let text = "网络/CORS错误，无法请求审核接口";
          if (xhr && xhr.responseText) {
            console.error("审核错误响应:", xhr.responseText);
          }
          layui.layer.msg(text, { icon: 2, time: 5000 });
        },
      });
    } catch (e) {
      console.error("auditSelectedOrders 异常:", e);
      layui.layer.msg("审核请求构建失败", { icon: 2, time: 3000 });
    }
  }

  // 拉取审核结果并弹窗显示
  function fetchAuditResult(requestId, options) {
    const opts = options || {};
    const onContinue =
      typeof opts.onContinue === "function" ? opts.onContinue : null;
    const onCancel = typeof opts.onCancel === "function" ? opts.onCancel : null;
    const url =
      appconfig.api +
      "/fusion_audit/open_api/inpatient/audit_result/advice_audit/" +
      encodeURIComponent(requestId);
    const loadingIndex = layui.layer.load(1, { shade: [0.3, "#000"] });
    $.ajax({
      url,
      method: "GET",
      dataType: "json",
      success: function (res) {
        layui.layer.close(loadingIndex);
        const data = res && res.data;
        if (!data) {
          layui.layer.msg("未获取到审核结果数据", { icon: 0, time: 3000 });
          return;
        }

        const rules = (data.inpatientRuleList || []).map(function (r) {
          const items = [];
          items.push(
            `<div><strong>医嘱:</strong> ${
              r.adItemName || r.adName || ""
            }</div>`
          );
          if (r.ruleList && r.ruleList.length) {
            r.ruleList.forEach(function (rl) {
              items.push(
                `<div>` +
                  `<div><strong>规则:</strong> ${
                    rl.ruleName || rl.ruleCode || ""
                  }</div>` +
                  (rl.tips
                    ? `<div><strong>提示:</strong> ${rl.tips}</div>`
                    : "") +
                  `</div>`
              );
            });
          }
          return `<div style="padding:8px;border-bottom:1px solid #eee;">${items.join(
            ""
          )}</div>`;
        });

        const bodyHtml =
          `<div style="max-height:420px;overflow:auto;">` +
          (rules.length ? rules.join("") : "<div>无违规提示</div>") +
          `</div>`;

        layui.layer.open({
          type: 1,
          title: "审核结果",
          area: ["90%", "auto"],
          shadeClose: true,
          content: bodyHtml,
          btn: ["知道了，仍要提交", "取消提交"],
          btnAlign: "c",
          yes: function (index) {
            layui.layer.close(index);
            if (onContinue) onContinue();
          },
          btn2: function (index) {
            layui.layer.close(index);
            if (onCancel) onCancel();
          },
        });
      },
      error: function (xhr) {
        layui.layer.close(loadingIndex);
        let text = "获取审核结果失败";
        if (xhr && xhr.responseText)
          console.error("审核结果错误响应:", xhr.responseText);
        layui.layer.msg(text, { icon: 2, time: 4000 });
      },
    });
  }

  // 初始化页面
  loadYzPatternList();
  initSearchEvents();
  initOrderPanelEvents();

  // 返回按钮事件
  $("#backBtn").on("click", function () {
    // 返回到医嘱列表页面
    // window.history.back();
    parent.layer.closeAll();
  });
});
