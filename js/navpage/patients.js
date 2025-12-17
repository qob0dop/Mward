// 处理移动端返回键（在 iframe 子页面中）

layui.use(["jquery", "appconfig"], function () {
  const $ = layui.$;
  const appconfig = layui.appconfig;
  const loginUser = JSON.parse(localStorage.getItem("loginUser"));
  const patients = [];
  let allPatients = []; // 存储所有患者数据
  let originalPatients = []; // 原始顺序快照
  let showMyPatientsOnly = false; // 标记是否只显示我的患者
  let searchKeyword = ""; // 搜索关键词
  let currentSort = "default"; // 当前排序方式
  let filteredStatus = "全部"; // 当前状态筛选
  let filteredGender = "全部"; // 当前性别筛选
  let availableWards = []; // 存储可用的病区列表
  let currentWardSn = null; // 当前选中的病区编号
  let currentWardName = ""; // 当前选中的病区名称
  let wardSearchKeyword = ""; // 病区搜索关键词
  // 显示/隐藏加载遮罩的助手函数
  function showLoading() {
    $(".loading-overlay .layui-icon-loading").addClass("show");
    $(".loading-overlay").addClass("show");
  }

  function hideLoading() {
    $(".loading-overlay .layui-icon-loading").removeClass("show");
    $(".loading-overlay").removeClass("show");
  }
  //加载患者信息
  window.addEventListener(
    "message",
    function (event) {
      // 处理来自父窗口的动作指令
      if (event.data && event.data.type === "action") {
        if (event.data.action === "showMyPatients") {
          // 触发"我的患者"按钮点击
          showMyPatientsOnly = true;
          $("#my-patients-label").addClass("active");
          $("#all-patients-label").removeClass("active");
          renderPatients(); // 重新渲染
        }
        return;
      }

      // 处理返回键
      if (event.data && event.data.type === "back") {
        // 1. 优先检查是否有 layer 弹层
        if (window.layui && layui.layer) {
          var openLayers = document.querySelectorAll(".layui-layer");
          if (openLayers && openLayers.length > 0) {
            layui.layer.closeAll();
            return;
          }
        }

        // 2. 检查筛选面板是否打开
        if ($(".filter-panel").width() > 0) {
          $(".filter-panel").css("width", "0");
          return;
        }

        // 3. 检查病区列表是否打开
        if ($(".ward-list").is(":visible")) {
          $(".ward-list").fadeOut(300);
          $(".overlay").fadeOut(300);
          return;
        }

        // 如果以上都没有打开,不处理（让父页面处理返回逻辑）
      }
    },
    false
  );

  // 加载可用病区列表
  function loadAvailableWards() {
    showLoading();

    $.ajax({
      url: appconfig.api + "/api/MobileWard/GetAdtWards",
      method: "GET",
      success: function (res) {
        hideLoading();

        if (res.Status && Array.isArray(res.Data)) {
          console.log("获取病区列表成功:", res);
          availableWards = res.Data;

          // 存储 ward_sn 和 ward_name
          availableWards.forEach((ward) => {
            ward.ward_sn = ward.ward_sn;
            ward.ward_name = ward.ward_name;
          });

          // 渲染病区列表
          renderWards(availableWards);

          // 尝试从 localStorage 恢复上次选择的病区
          var savedWardSn = localStorage.getItem("selectedWardSn");
          var savedWardName = localStorage.getItem("selectedWardName");

          if (savedWardSn && savedWardName) {
            // 验证保存的病区是否仍然存在
            var wardExists = availableWards.some(
              (ward) => ward.ward_sn === savedWardSn
            );

            if (wardExists) {
              // 恢复上次选择的病区
              currentWardSn = savedWardSn;
              currentWardName = savedWardName;
              $("#wardlist-switch").html(
                currentWardName + ' <i class="layui-icon layui-icon-down"></i>'
              );

              // 加载该病区的患者列表
              loadPatients(currentWardSn);
              return;
            }
          }

          // 如果没有保存的病区或病区不存在，默认选择第一个病区
          if (availableWards.length > 0) {
            currentWardSn = availableWards[0].ward_sn || "1011001";
            currentWardName = availableWards[0].ward_name || "急诊一科";

            // 保存到 localStorage
            localStorage.setItem("selectedWardSn", currentWardSn);
            localStorage.setItem("selectedWardName", currentWardName);

            $("#wardlist-switch").html(
              currentWardName + ' <i class="layui-icon layui-icon-down"></i>'
            );

            // 加载该病区的患者列表
            loadPatients(currentWardSn);
          }
        } else {
          layui.use("layer", function () {
            layui.layer.msg("获取病区列表失败", { icon: 2 });
          });
        }
      },
      error: function (xhr, status, error) {
        hideLoading();
        console.error("获取病区列表失败:", error);
        layui.use("layer", function () {
          layui.layer.msg("获取病区列表失败: " + error, { icon: 2 });
        });
      },
    });
  }

  function loadPatients(ward_sn) {
    if (!ward_sn) {
      console.warn("ward_sn 为空，无法加载患者列表");
      return;
    }

    // 显示加载图标和遮罩层
    showLoading();

    console.log("加载患者列表，病区编号:", ward_sn);

    $.ajax({
      url:
        appconfig.api +
        `/api/MobileWard/GetActPatientLists?ward=${ward_sn}&inout=I`,
      method: "GET",
      success: function (res) {
        // 隐藏加载图标和遮罩层
        hideLoading();

        if (res.Status === 1) {
          console.log(res.Data);
          allPatients = res.Data || []; // 存储所有患者数据
          originalPatients = allPatients.slice(); // 复制一份原始顺序
          applySort();
          renderPatients(); // 根据当前显示模式渲染
        }
      },
      error: function () {
        // 请求失败时也要隐藏加载图标和遮罩层
        hideLoading();
      },
    });
  }
  //渲染患者信息卡片列表
  function renderPatients() {
    const patientList = $(".patients-cardlist");
    patientList.empty(); // 清空现有内容

    // 根据排序方式先得到排序后的数组（不破坏 allPatients 原始引用）
    let loadedPatients = applySort(true); // 返回一个排序后的浅拷贝
    // 根据当前显示模式过滤患者
    if (showMyPatientsOnly) {
      loadedPatients = loadedPatients.filter(
        (patient) => patient.refer_physician == loginUser.user_mi
      );
    }
    // 根据状态过滤
    if (filteredStatus && filteredStatus !== "全部") {
      loadedPatients = loadedPatients.filter(
        (patient) => patient.admiss_status_name === filteredStatus
      );
    }
    if (filteredGender && filteredGender !== "全部") {
      loadedPatients = loadedPatients.filter(
        (patient) => patient.sex_name === filteredGender
      );
    }

    // 根据搜索关键词过滤
    if (searchKeyword.trim() !== "") {
      loadedPatients = loadedPatients.filter((patient) => {
        const keyword = searchKeyword.toLowerCase();
        return (
          patient.name.toLowerCase().includes(keyword) ||
          patient.bed_no.toString().includes(keyword) ||
          patient.inpatient_no.toLowerCase().includes(keyword) ||
          (patient.refer_physician_name &&
            patient.refer_physician_name.toLowerCase().includes(keyword)) ||
          (patient.refer_nurse_name &&
            patient.refer_nurse_name.toLowerCase().includes(keyword))
        );
      });
    }

    if (loadedPatients.length === 0) {
      let emptyMessage = "该病区暂无患者";
      if (showMyPatientsOnly) {
        emptyMessage = "您暂无负责的患者";
      }
      if (searchKeyword.trim() !== "") {
        emptyMessage = "未找到匹配的患者";
      }
      patientList.append(
        `<div style="padding:20px; text-align:center; color:#888;">${emptyMessage}</div>`
      );
      return;
    }
    let html = "";
    loadedPatients.forEach((patient) => {
      const bedLabelStyle =
        patient.sex_name === "女"
          ? 'style="background-color: rgb(253, 121, 168);"'
          : "";

      let admissStatusLabel = "";
      if (patient.admiss_status_name) {
        let statusColor = "";
        switch (patient.admiss_status_name) {
          case "危":
            statusColor = "rgb(214, 48, 49)";
            break;
          case "重":
            statusColor = "rgb(253, 203, 110)";
            break;
          // case "常规":
          //   statusColor = "rgb(116, 185, 255)";
          //   break;
          default:
            statusColor = "";
        }
        admissStatusLabel = `<label id="admiss-status-label"  style="background-color: ${statusColor};">${patient.admiss_status_name}<label id="admiss-status-triangle"></label></label>
                `;
      }

      html += `
        <div class="patient-card" data-patient-id="${patient.inpatient_no}">
          <div class="patient-card-header">
            <label ${bedLabelStyle}>${patient.bed_no}床</label>
            <label>${patient.name}</label>
            
          </div>
          ${admissStatusLabel}
          <div class="patient-card-body">
            <label><i class="layui-icon layui-icon-friends"></i>病号：${patient.inpatient_no}</label>
            <label><i class="layui-icon layui-icon-date"></i>年龄：${patient.age}</label>
            <label style="grid-column-start: 1;
  grid-column-end: 3;"><i class="layui-icon layui-icon-time"></i>入院时间：${patient.admiss_date_text}</label>
            <label>管床医生：${patient.refer_physician_name}</label>
            <label>管床护士：${patient.refer_nurse_name}</label>
          </div>
        </div>
            `;
    });
    patientList.append(html);
  }

  // 解析入院时间字段（后端字段名推测：admiss_time / in_time / admit_time）；尝试多字段兼容
  function parseAdmitTime(p) {
    const cand =
      p.admiss_time ||
      p.in_time ||
      p.admit_time ||
      p.admissDate ||
      p.admiss_date ||
      "";
    if (!cand) return 0;
    const ts = Date.parse(cand.replace(/-/g, "/")); // 兼容 Safari
    return isNaN(ts) ? 0 : ts;
  }

  // 应用排序；whenReturnOnly=true 时返回排序结果数组而不修改 allPatients
  function applySort(whenReturnOnly) {
    let base = allPatients;
    if (currentSort === "default") {
      // 恢复原始顺序
      base = originalPatients.slice();
    } else if (currentSort === "admit_desc") {
      base = allPatients
        .slice()
        .sort((a, b) => parseAdmitTime(b) - parseAdmitTime(a));
    } else if (currentSort === "admit_asc") {
      base = allPatients
        .slice()
        .sort((a, b) => parseAdmitTime(a) - parseAdmitTime(b));
    }
    if (whenReturnOnly) return base;
    // 非只返回模式下，更新 allPatients 的展示顺序（非必须，可选）
    return base;
  }

  // 绑定排序点击
  $(document).on("click", ".order-filter .sort-option", function () {
    const sort = $(this).data("sort");
    if (sort === currentSort) return; // 无变化
    currentSort = sort;
    // UI 状态
    $(".order-filter .sort-option").removeClass("active");
    $(this).addClass("active");
    renderPatients();
  });
  $(document).on("click", ".status-filter .status-option", function () {
    const sort = $(this).data("sort");
    if (sort === filteredStatus) return; // 无变化
    filteredStatus = sort;
    // UI 状态
    $(".status-filter .status-option").removeClass("active");
    $(this).addClass("active");
    renderPatients();
  });
  $(document).on("click", ".gender-filter .gender-option", function () {
    const sort = $(this).data("sort");
    if (sort === filteredGender) return; // 无变化
    filteredGender = sort;
    $(".gender-filter .gender-option").removeClass("active");
    $(this).addClass("active");
    renderPatients();
  });
  // 初始化：加载病区列表
  loadAvailableWards();

  //监听病区切换按钮
  $("#wardlist-switch").on("click", function () {
    $(".ward-list").fadeToggle(300);
    $(".overlay").fadeToggle(300); // 同时切换遮罩
  });

  //渲染病区列表
  function renderWards(loadedWards) {
    let filteredWards = loadedWards;

    // 根据搜索关键词过滤病区
    if (wardSearchKeyword.trim() !== "") {
      filteredWards = loadedWards.filter((ward) => {
        const keyword = wardSearchKeyword.toLowerCase();
        return (
          ward.ward_name.toLowerCase().includes(keyword) ||
          (ward.ward_py_code &&
            ward.ward_py_code.toLowerCase().includes(keyword)) ||
          (ward.dept_name && ward.dept_name.toLowerCase().includes(keyword)) ||
          ward.ward_sn.toString().includes(keyword)
        );
      });
    }

    $(".ward-list-header").text(`共${filteredWards.length}个病区`);
    const wardList = $(".ward-list-body");
    wardList.empty(); // 清空现有内容

    if (filteredWards.length === 0) {
      wardList.append(
        '<div style="padding:20px; text-align:center; color:#888;">未找到匹配的病区</div>'
      );
      return;
    }

    let html = "";
    filteredWards.forEach((ward) => {
      // 高亮当前选中的病区
      const activeClass = ward.ward_sn === currentWardSn ? "active" : "";
      html += `
              <div class="ward-item ${activeClass}" data-ward-sn="${ward.ward_sn}" data-ward-name="${ward.ward_name}">
                <label>${ward.ward_name}</label>
              </div>
            `;
    });
    wardList.append(html);
  }
  // 扫码相关变量
  let qrStream = null;
  let qrAnimationId = null;
  let qrVideoElement = null;
  let qrCanvasElement = null;
  let qrCanvasContext = null;

  // 扫码功能 - 使用 jsQR
  function startScan() {
    layui.use("layer", function () {
      const layer = layui.layer;

      console.log("点击扫码按钮");

      // 因为可能在iframe中，需要从顶层窗口获取 plus 对象
      var topPlus = null;
      try {
        topPlus = top.plus || parent.plus || window.plus;
      } catch (e) {
        topPlus = window.plus;
      }

      console.log("window.plus 存在:", !!window.plus);
      console.log("top.plus 存在:", !!(top && top.plus));
      console.log("parent.plus 存在:", !!(parent && parent.plus));
      console.log("最终使用的 plus 存在:", !!topPlus);
      console.log("plus.android 存在:", !!(topPlus && topPlus.android));

      // 在5+原生环境下，点击时检查并申请权限
      if (topPlus && topPlus.android) {
        console.log("检测到 Android 5+ 环境，开始申请相机权限");
        try {
          // 使用 plus.android.requestPermissions 申请权限
          console.log("正在申请相机权限...");

          topPlus.android.requestPermissions(
            ["android.permission.CAMERA"],
            function (e) {
              // 权限申请成功的回调
              console.log("相机权限申请结果回调", e);

              if (e.granted && e.granted.length > 0) {
                // 权限被授予
                console.log("相机权限已授权", e.granted);
                layer.msg("权限已授予", { icon: 1, time: 1000 });
                proceedToStartScanner();
              } else if (e.deniedAlways && e.deniedAlways.length > 0) {
                // 权限被永久拒绝
                console.log("相机权限被永久拒绝", e.deniedAlways);
                layer.confirm(
                  "相机权限被拒绝，需要前往设置中手动授权",
                  {
                    icon: 3,
                    btn: ["前往设置", "取消"],
                  },
                  function (idx) {
                    layer.close(idx);
                    try {
                      // 跳转到应用设置页
                      var main = topPlus.android.runtimeMainActivity();
                      var Intent = topPlus.android.importClass(
                        "android.content.Intent"
                      );
                      var Uri = topPlus.android.importClass("android.net.Uri");
                      var Settings = topPlus.android.importClass(
                        "android.provider.Settings"
                      );
                      var intent = new Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                      );
                      var packageName = topPlus.android.invoke(
                        main,
                        "getPackageName"
                      );
                      var uri = Uri.fromParts("package", packageName, null);
                      intent.setData(uri);
                      main.startActivity(intent);
                    } catch (err) {
                      console.error("无法打开设置页", err);
                      layer.msg("请在系统设置中手动授予相机权限", {
                        icon: 0,
                        time: 3000,
                      });
                    }
                  }
                );
              } else if (e.deniedPresent && e.deniedPresent.length > 0) {
                // 权限被本次拒绝(但可以再次申请)
                console.log("相机权限被拒绝", e.deniedPresent);
                layer.msg("需要相机权限才能扫码，请重新尝试并允许权限", {
                  icon: 2,
                  time: 3000,
                });
              } else {
                console.warn("未知的权限申请结果", e);
                layer.msg("权限申请结果未知，请重试", { icon: 0, time: 2000 });
              }
            },
            function (e) {
              // 权限申请失败的回调
              console.error("相机权限申请失败", e);
              layer.msg("权限申请失败: " + JSON.stringify(e), {
                icon: 2,
                time: 3000,
              });
            }
          );
        } catch (err) {
          console.error("权限处理异常", err);
          layer.msg("权限处理异常: " + err.message, { icon: 2 });
          // 如果权限API出错，尝试直接启动扫码（让getUserMedia触发权限）
          proceedToStartScanner();
        }
      }
      // 非5+环境（浏览器/iOS webview）
      else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // 浏览器环境：直接启动扫码，让浏览器处理权限
        console.log("浏览器环境，直接启动扫码");
        proceedToStartScanner();
      }
      // 其他情况
      else {
        layer.msg("您的浏览器不支持摄像头功能", { icon: 2 });
      }

      // 实际启动扫码器的函数
      function proceedToStartScanner() {
        // 检查浏览器是否支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          layer.msg("您的浏览器不支持摄像头功能", { icon: 2 });
          return;
        }

        // 检查 jsQR 是否加载
        if (typeof jsQR === "undefined") {
          layer.msg("扫码库加载失败，请刷新页面重试", { icon: 2 });
          return;
        }

        // 启动扫码
        startQRScanner();
      }
    });
  }

  // 启动扫码器
  function startQRScanner() {
    layui.use("layer", function () {
      const layer = layui.layer;

      qrVideoElement = document.getElementById("qr-video");
      qrCanvasElement = document.getElementById("qr-canvas");
      qrCanvasContext = qrCanvasElement.getContext("2d");

      // 显示扫码界面
      document.getElementById("qr-scanner-container").classList.add("active");

      // 请求摄像头权限
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "environment", // 使用后置摄像头
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .then(function (stream) {
          qrStream = stream;
          qrVideoElement.srcObject = stream;
          qrVideoElement.setAttribute("playsinline", true);
          qrVideoElement.play();

          // 等待视频准备好后开始扫描
          qrVideoElement.addEventListener("loadedmetadata", function () {
            qrCanvasElement.width = qrVideoElement.videoWidth;
            qrCanvasElement.height = qrVideoElement.videoHeight;
            requestAnimationFrame(scanQRCode);
          });

          // 检查是否支持手电筒
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities
            ? track.getCapabilities()
            : {};
          if (capabilities.torch) {
            document.getElementById("flashBtn").style.display = "inline-block";
          }
        })
        .catch(function (err) {
          console.error("摄像头访问失败:", err);
          stopQRScanner();

          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            layer.confirm(
              "需要摄像头权限才能扫码，请在浏览器设置中允许访问摄像头",
              {
                icon: 3,
                btn: ["知道了"],
              }
            );
          } else if (err.name === "NotFoundError") {
            layer.msg("未检测到摄像头设备", { icon: 2 });
          } else {
            layer.msg("摄像头启动失败: " + err.message, { icon: 2 });
          }
        });
    });
  }

  // 扫描二维码
  function scanQRCode() {
    if (
      !qrVideoElement ||
      qrVideoElement.readyState !== qrVideoElement.HAVE_ENOUGH_DATA
    ) {
      qrAnimationId = requestAnimationFrame(scanQRCode);
      return;
    }

    try {
      // 将视频帧绘制到 canvas
      qrCanvasContext.drawImage(
        qrVideoElement,
        0,
        0,
        qrCanvasElement.width,
        qrCanvasElement.height
      );
      const imageData = qrCanvasContext.getImageData(
        0,
        0,
        qrCanvasElement.width,
        qrCanvasElement.height
      );

      // 使用 jsQR 识别二维码
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        // 扫码成功
        console.log("扫码成功:", code.data);
        stopQRScanner();
        handleScanResult(code.data, "QR_CODE");
      } else {
        // 继续扫描
        qrAnimationId = requestAnimationFrame(scanQRCode);
      }
    } catch (e) {
      console.error("扫码过程出错:", e);
      qrAnimationId = requestAnimationFrame(scanQRCode);
    }
  }

  // 停止扫码器
  window.stopQRScanner = function () {
    // 停止动画
    if (qrAnimationId) {
      cancelAnimationFrame(qrAnimationId);
      qrAnimationId = null;
    }

    // 停止摄像头
    if (qrStream) {
      qrStream.getTracks().forEach(function (track) {
        track.stop();
      });
      qrStream = null;
    }

    // 清空视频
    if (qrVideoElement) {
      qrVideoElement.srcObject = null;
    }

    // 隐藏扫码界面
    document.getElementById("qr-scanner-container").classList.remove("active");
  };

  // 切换手电筒
  window.toggleFlashlight = function () {
    if (!qrStream) return;

    const track = qrStream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;

    const capabilities = track.getCapabilities();
    if (!capabilities.torch) return;

    const settings = track.getSettings();
    const currentTorch = settings.torch || false;

    track
      .applyConstraints({
        advanced: [{ torch: !currentTorch }],
      })
      .then(function () {
        layui.use("layer", function () {
          layui.layer.msg(!currentTorch ? "手电筒已打开" : "手电筒已关闭", {
            icon: 1,
            time: 1000,
          });
        });
      })
      .catch(function (err) {
        console.error("切换手电筒失败:", err);
      });
  };

  // 处理扫码结果
  function handleScanResult(result, type) {
    layui.use("layer", function () {
      const layer = layui.layer;

      console.log("扫码类型:", type);
      console.log("扫码内容:", result);

      // 显示扫码结果
      // layer.open({
      //   type: 1,
      //   title: '扫码结果',
      //   area: ['90%', 'auto'],
      //   content: `
      //               <div style="padding: 20px;">
      //                   <div style="margin-bottom: 15px;">
      //                       <div style="color: #666; font-size: 14px; margin-bottom: 5px;">扫码类型：</div>
      //                       <div style="font-size: 16px; color: #333;">${type || '未知'}</div>
      //                   </div>
      //                   <div style="margin-bottom: 15px;">
      //                       <div style="color: #666; font-size: 14px; margin-bottom: 5px;">扫码内容：</div>
      //                       <div style="font-size: 16px; color: #333; word-break: break-all; padding: 10px; background: #f8f9fa; border-radius: 4px;">${result}</div>
      //                   </div>
      //                   <div style="text-align: center; margin-top: 20px;">
      //                       <button class="layui-btn layui-btn-normal" onclick="copyToClipboard('${result.replace(/'/g, "\\'")}')">
      //                           <i class="layui-icon layui-icon-file"></i> 复制内容
      //                       </button>
      //                       <button class="layui-btn layui-btn-primary" onclick="layer.closeAll()">
      //                           <i class="layui-icon layui-icon-close"></i> 关闭
      //                       </button>
      //                   </div>
      //               </div>
      //           `
      // });

      // 业务处理：根据扫码内容进行相应操作
      processScanData(result, type);
    });
  }

  // 处理扫码数据的业务逻辑
  function processScanData(data, type) {
    // 判断是否是患者ID格式（示例：P123456 或 PATIENT_123456）
    if (data) {
      layui.use("layer", function () {
        const layer = layui.layer;
        layer.confirm(
          "检测到患者信息，是否跳转到患者详情？",
          {
            icon: 3,
            btn: ["确定", "取消"],
          },
          function (index) {
            layer.close(index);
            // 跳转到患者详情页
            const selectedPatient = allPatients.find(
              (patient) => patient.inpatient_no == data
            );
            if (selectedPatient == null) {
              layui.use("layer", function () {
                const layer = layui.layer;
                layer.msg("未找到对应患者信息", { icon: 2, time: 2000 });
              });
              return;
            } else {
              console.log("选中患者:", selectedPatient);
              localStorage.setItem("userData", JSON.stringify(selectedPatient));
              location.href = "../view/patient.html";
            }
          }
        );
      });
    }
    // 判断是否是URL
    else if (data.startsWith("http://") || data.startsWith("https://")) {
      layui.use("layer", function () {
        const layer = layui.layer;
        layer.confirm(
          "检测到网址链接，是否在浏览器中打开？",
          {
            icon: 3,
            btn: ["打开", "取消"],
          },
          function (index) {
            layer.close(index);
            var topPlus = top.plus || parent.plus || window.plus;
            if (topPlus && topPlus.runtime) {
              topPlus.runtime.openURL(data);
            } else {
              window.open(data, "_blank");
            }
          }
        );
      });
    }
    // 可以添加更多业务逻辑
    // 例如：检测药品条码、检测设备编号等
  }
  $("#scan-icon").on("click", function () {
    startScan();
  });
  //关闭病区列表
  $("#wardlist-close").on("click", function () {
    $(".ward-list").fadeOut(300);
    $(".overlay").fadeOut(300); // 同时关闭遮罩
  });
  // 点击遮罩关闭面板（可选）
  $(".overlay").on("click", function () {
    $(".ward-list").fadeOut(300);
    $(".overlay").fadeOut(300); // 同时关闭遮罩
  });

  //病区切换点击事件
  $(".ward-list-body").on("click", ".ward-item", function () {
    const wardSn = $(this).data("ward-sn");
    const wardName = $(this).data("ward-name");

    console.log("选中病区:", wardName, "编号:", wardSn);

    // 更新当前选中的病区
    currentWardSn = wardSn;
    currentWardName = wardName;

    // 保存到 localStorage，下次进入页面时自动恢复
    localStorage.setItem("selectedWardSn", wardSn);
    localStorage.setItem("selectedWardName", wardName);

    // 更新按钮文本
    $("#wardlist-switch").html(
      wardName + ' <i class="layui-icon layui-icon-down"></i>'
    );

    // 更新病区列表中的选中状态
    $(".ward-list-body .ward-item").removeClass("active");
    $(this).addClass("active");

    // 加载选中病区的患者
    loadPatients(wardSn);

    // 关闭病区列表面板
    $(".ward-list").fadeOut(300);
    $(".overlay").fadeOut(300);
  });

  // 全部患者/我的患者切换功能
  $("#all-patients-label").on("click", function () {
    showMyPatientsOnly = false;
    $("#all-patients-label").addClass("active");
    $("#my-patients-label").removeClass("active");
    renderPatients(); // 重新渲染
  });

  $("#my-patients-label").on("click", function () {
    showMyPatientsOnly = true;
    $("#my-patients-label").addClass("active");
    $("#all-patients-label").removeClass("active");
    renderPatients(); // 重新渲染
  });

  // 初始化时设置默认选中状态
  $("#all-patients-label").addClass("active");

  // 患者搜索功能
  $("#patient-search").on("input", function () {
    searchKeyword = $(this).val();
    renderPatients(); // 重新渲染患者列表
  });

  // 病区搜索功能
  $("#ward-search").on("input", function () {
    wardSearchKeyword = $(this).val();
    renderWards(availableWards); // 重新渲染病区列表
  });

  // 清空搜索框时也重新渲染
  $("#patient-search").on("blur", function () {
    if ($(this).val().trim() === "") {
      searchKeyword = "";
      renderPatients();
    }
  });
  $(".patients-cardlist").on("click", ".patient-card", function () {
    const patientId = $(this).data("patient-id");
    const selectedPatient = allPatients.find(
      (patient) => patient.inpatient_no == patientId
    );
    console.log("选中患者:", selectedPatient);
    localStorage.setItem("userData", JSON.stringify(selectedPatient));
    location.href = "../view/patient.html";
    // 这里可以添加跳转到患者详情页的逻辑
  });
  $("#filter-reset-btn").on("click", function () {
    // 重置所有筛选选项
    $(".filter-body label").removeClass("active");
    $(".filter-body .sort-option[data-sort='default']").addClass("active");
    currentSort = "default";
    renderPatients(); // 重新渲染患者列表
  });
  $("#filter-confirm-btn").on("click", function () {
    $(".filter-panel").css("width", "0");
    renderPatients(); // 应用筛选并重新渲染
  });
  $("#filter-label").on("click", function () {
    if ($(".filter-panel").width() > 0) {
      // 面板已打开，关闭它
      $(".filter-panel").css("width", "0");
      return;
    }
    $(".filter-panel").css("width", "100%");
  });
});
