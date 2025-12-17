// xml转换为js对象
function xmlToJson(xml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "text/xml");

  function parseNode(node) {
    const obj = {};
    if (node.nodeType === 1) {
      if (node.attributes.length > 0) {
        obj["@attributes"] = {};
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          obj["@attributes"][attr.nodeName] = attr.nodeValue;
        }
      }
      if (node.hasChildNodes()) {
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childName = child.nodeName;
          if (childName === "#text") {
            const text = child.nodeValue.trim();
            if (text) {
              obj["#text"] = text;
            }
          } else {
            const childObj = parseNode(child);
            if (obj[childName]) {
              if (!Array.isArray(obj[childName])) {
                obj[childName] = [obj[childName]];
              }
              obj[childName].push(childObj);
            } else {
              obj[childName] = childObj;
            }
          }
        }
      }
    }
    const keys = Object.keys(obj); //拍平处理
    if (keys.length === 1 && keys[0] === "#text") {
      return obj["#text"];
    }
    return obj;
  }

  return parseNode(xmlDoc.documentElement);
}
layui.use(["tree", "appconfig", "element"], function () {
  var $ = layui.jquery;
  var tree = layui.tree;
  var appconfig = layui.appconfig;
  var element = layui.element;
  var userData = localStorage.getItem("userData");

  // 处理用户数据
  if (userData) {
    userData = JSON.parse(userData);
  } else {
    userData = { patient_id: "000368431100" }; // 默认数据
  }

  // 获取URL参数
  function getUrlParam(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return unescape(r[2]);
    return null;
  }

  var patient_id =
    getUrlParam("patient_id") || userData.patient_id || "000368431100";

  // 动态加载电子病历列表
  $.ajax({
    url: appconfig.api + "/api/MobileWard/GetDzblList?patient_id=" + patient_id,
    type: "GET",
    dataType: "json",
    beforeSend: function () {
      $("#content-loading")
        .show()
        .html(
          '<i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop" style="margin-right: 10px;"></i>正在加载病历列表...'
        );
    },
    success: function (res) {
      try {
        if (res.Status !== 1 || !res.Data || res.Data.length === 0) {
          $("#content-loading").html(
            '<i class="layui-icon layui-icon-face-cry" style="margin-right: 10px;"></i>暂无病历数据'
          );
          return;
        }

        var records = res.Data;

        // 按分类分组
        var groupedRecords = {};
        var categoryOrder = []; // 记录分类顺序

        records.forEach(function (record) {
          var categoryKey = record.record_type || "unknown";
          var categoryName = record.name || "未分类";

          if (!groupedRecords[categoryKey]) {
            groupedRecords[categoryKey] = {
              name: categoryName,
              records: [],
            };
            categoryOrder.push(categoryKey);
          }

          groupedRecords[categoryKey].records.push(record);
        });

        var html = "";
        var globalIndex = 0;

        // 生成分类和病历列表
        categoryOrder.forEach(function (categoryKey) {
          var category = groupedRecords[categoryKey];
          var categoryId = "category-" + categoryKey;

          html += '<div class="category-item">';
          html +=
            '<div class="category-header" data-category="' + categoryId + '">';
          html +=
            "<span>" +
            category.name +
            " (" +
            category.records.length +
            ")</span>";
          html += '<i class="layui-icon layui-icon-down"></i>';
          html += "</div>";
          html += '<div class="category-content" id="' + categoryId + '">';

          category.records.forEach(function (record) {
            var recordTime = record.record_time
              ? new Date(record.record_time)
                  .toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  .replace(/\//g, "-")
              : "无记录时间";

            var createTime = record.create_time
              ? new Date(record.create_time)
                  .toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  .replace(/\//g, "-")
              : "";

            html +=
              '<div class="record-item' +
              (globalIndex === 0 ? " active" : "") +
              '" data-index="' +
              globalIndex +
              '">';
            html +=
              '<div class="record-title">' +
              (record.doc_alias || "未命名病历") +
              "</div>";
            html += '<div class="record-meta">';
            html +=
              '<span><i class="layui-icon layui-icon-time"></i> ' +
              recordTime +
              "</span>";
            if (createTime) {
              html +=
                '<span><i class="layui-icon layui-icon-username"></i> ' +
                (record.create_opera || "") +
                "</span>";
            }
            html += "</div>";
            html += "</div>";

            globalIndex++;
          });

          html += "</div>";
          html += "</div>";
        });

        $("#doc_menu").html(html);

        // 默认显示第一条病历内容
        if (records.length > 0 && records[0].record_text) {
          $("#record-title").text(records[0].doc_alias || "电子病历");
          $("#content-display").html(records[0].record_text).show();
          $("#content-loading").hide();
        } else {
          $("#content-loading").html(
            '<i class="layui-icon layui-icon-file" style="margin-right: 10px;"></i>请选择左侧病历查看详情'
          );
        }

        // 分类折叠/展开功能
        $(document).on("click", ".category-header", function (e) {
          e.stopPropagation();
          var categoryId = $(this).data("category");
          var content = $("#" + categoryId);

          $(this).toggleClass("collapsed");
          content.toggleClass("collapsed");
        });

        // 点击病历项切换内容
        $(document).on("click", ".record-item", function () {
          var index = $(this).data("index");
          var record = records[index];

          // 更新选中状态
          $(".record-item").removeClass("active");
          $(this).addClass("active");

          // 显示病历内容
          if (record.record_text) {
            $("#record-title").text(record.doc_alias || "电子病历");
            $("#content-display").html(record.record_text).show();
            $("#content-loading").hide();
          } else {
            $("#content-loading")
              .html(
                '<i class="layui-icon layui-icon-file" style="margin-right: 10px;"></i>该病历暂无内容'
              )
              .show();
            $("#content-display").hide();
          }
        });
      } catch (error) {
        console.error("数据解析错误:", error);
        $("#content-loading").html(
          '<i class="layui-icon layui-icon-close" style="color: #ff5722; margin-right: 10px;"></i><span style="color: #ff5722;">数据解析失败</span>'
        );
      }
    },
    error: function (xhr, status, error) {
      console.error("请求失败:", error);
      $("#content-loading").html(
        '<i class="layui-icon layui-icon-close" style="color: #ff5722; margin-right: 10px;"></i><span style="color: #ff5722;">网络请求失败</span>'
      );
    },
  });

  // 初始化页面显示
  $("#btn_ward_name").html(localStorage.ward_name || "病区名称");

  if (userData && userData.name) {
    $("#btn_user_name").html(
      userData.name +
        " " +
        (userData.sex_name || "") +
        " " +
        (userData.ages || "")
    );
  } else {
    $("#btn_user_name").html("患者姓名");
  }

  $(".layuimini-container").show();

  // 导航栏切换功能（默认隐藏，按本地偏好/屏幕宽度恢复）
  (function initNavHidden() {
    var body = $("body");
    var icon = $("#toggleIcon");
    var pref = localStorage.getItem("navHidden");
    var shouldHide = true; // 默认隐藏
    if (pref === "false" && window.innerWidth > 768) {
      shouldHide = false;
    }
    if (shouldHide) {
      body.addClass("nav-hidden");
      icon
        .removeClass("layui-icon-shrink-right")
        .addClass("layui-icon-spread-left");
    } else {
      body.removeClass("nav-hidden");
      icon
        .removeClass("layui-icon-spread-left")
        .addClass("layui-icon-shrink-right");
    }
  })();

  // 切换按钮点击事件
  $("#navToggleBtn").on("click", function () {
    var body = $("body");
    var icon = $("#toggleIcon");

    if (body.hasClass("nav-hidden")) {
      // 显示导航栏
      body.removeClass("nav-hidden");
      icon
        .removeClass("layui-icon-spread-left")
        .addClass("layui-icon-shrink-right");
      localStorage.setItem("navHidden", "false");
    } else {
      // 隐藏导航栏
      body.addClass("nav-hidden");
      icon
        .removeClass("layui-icon-shrink-right")
        .addClass("layui-icon-spread-left");
      localStorage.setItem("navHidden", "true");
    }
  });

  // 响应式处理：窄屏时自动隐藏导航栏
  function checkScreenSize() {
    if (window.innerWidth <= 768) {
      if (!$("body").hasClass("nav-hidden")) {
        $("#navToggleBtn").click();
      }
    }
  }

  // 页面加载时检查屏幕大小
  checkScreenSize();

  // 监听窗口大小变化
  $(window).on("resize", function () {
    checkScreenSize();
  });
});
