// 处理移动端返回键（在 iframe 子页面中）

layui.use(["jquery", "appconfig", "layer"], function () {
  const $ = layui.$;
  const appconfig = layui.appconfig;
  const layer = layui.layer;
  const loginUser = JSON.parse(localStorage.getItem("loginUser"));
  const patients = [];
  let allPatients = []; // 存储所有患者数据
  let consultPatients = []; // 存储会诊患者数据
  let originalPatients = []; // 原始顺序快照
  let showMyPatientsOnly = false; // 标记是否只显示我的患者
  let isConsultMode = false; // 是否处于我的会诊模式
  let searchKeyword = ""; // 搜索关键词
  let currentSort = "default"; // 当前排序方式
  let filteredStatus = "全部"; // 当前状态筛选
  let filteredGender = "全部"; // 当前性别筛选
  let consultStatusFilter = "全部"; // 会诊状态筛选
  let consultRoleFilter = "全部"; // 会诊类别筛选（我申请/我处理）
  let availableWards = []; // 存储可用的病区列表
  let allowedWardSns = []; // 存储当前用户有权限访问的病区编号
  let currentWardSn = null; // 当前选中的病区编号
  let currentWardName = ""; // 当前选中的病区名称
  let wardSearchKeyword = ""; // 病区搜索关键词
  class PatientsManager {
    allPatients = [];
  }
  // 病区缓存：读写完整对象，兼容旧的分散键
  function getSavedWard() {
    var savedWardStr = localStorage.getItem("selectedWard");
    if (savedWardStr) {
      try {
        var parsed = JSON.parse(savedWardStr);
        if (parsed && parsed.ward_sn) return parsed;
      } catch (e) {
        console.warn("selectedWard 解析失败", e);
      }
    }

    return null;
  }

  function saveSelectedWard(wardObj) {
    if (!wardObj) return;
    try {
      localStorage.setItem("selectedWard", JSON.stringify(wardObj));
    } catch (e) {
      console.warn("selectedWard 写入失败", e);
    }
  }
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
    false,
  );

  // 加载可用病区列表
  function loadAvailableWards() {
    showLoading();

    // 先获取当前用户有权限访问的病区编号
    const employeeMi =
      (loginUser && (loginUser.user_mi || loginUser.user_name)) || "";

    $.ajax({
      url: appconfig.api + "/api/MobileWard/GetYsWards",
      method: "GET",
      data: { subsys_id: "zy_wpws", employee_mi: employeeMi },
      success: function (res) {
        if (res && res.Status === 1 && Array.isArray(res.Data)) {
          allowedWardSns = res.Data.map((item) => String(item));
          console.log("获取可访问病区编号成功:", allowedWardSns);
        } else {
          allowedWardSns = [];
          console.warn("获取可访问病区编号失败或返回空，继续加载全部病区", res);
        }
        fetchAllWards();
      },
      error: function (xhr, status, error) {
        allowedWardSns = [];
        console.error("获取可访问病区编号失败，继续加载全部病区:", error);
        fetchAllWards();
      },
    });

    // 在获取权限结果后加载病区列表，并根据权限进行筛选
    function fetchAllWards() {
      $.ajax({
        url: appconfig.api + "/api/MobileWard/GetAdtWards",
        method: "GET",
        success: function (res) {
          hideLoading();

          if (res.Status && Array.isArray(res.Data)) {
            console.log("获取病区列表成功:", res);
            availableWards = res.Data;

            // 根据权限名单进行过滤
            if (allowedWardSns.length > 0) {
              const allowedSet = new Set(allowedWardSns);
              availableWards = availableWards.filter((ward) =>
                allowedSet.has(String(ward.ward_sn)),
              );
            }

            // 存储 ward_sn 和 ward_name
            availableWards.forEach((ward) => {
              ward.ward_sn = ward.ward_sn;
              ward.ward_name = ward.ward_name;
            });

            // 无可访问病区
            if (!availableWards.length) {
              renderWards([]);
              layui.use("layer", function () {
                layui.layer.msg("暂无可访问病区", { icon: 0 });
              });
              return;
            }

            // 渲染病区列表
            renderWards(availableWards);

            // 尝试从 localStorage 恢复上次选择的病区（完整对象）
            var savedWard = getSavedWard();
            if (savedWard && savedWard.ward_sn) {
              // 验证保存的病区是否仍然存在
              var wardExists = availableWards.some(
                (ward) => String(ward.ward_sn) === String(savedWard.ward_sn),
              );

              if (wardExists) {
                // 恢复上次选择的病区
                currentWardSn = savedWard.ward_sn;
                currentWardName = savedWard.ward_name || "";
                $("#wardlist-switch").html(
                  currentWardName +
                    ' <i class="layui-icon layui-icon-down"></i>',
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

              // 保存到 localStorage（完整对象）
              saveSelectedWard(availableWards[0]);

              $("#wardlist-switch").html(
                currentWardName + ' <i class="layui-icon layui-icon-down"></i>',
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
  }
  function loadconsultpatients() {
    showLoading();

    $.ajax({
      url: appconfig.api + "/api/MobileWard/GetConsultationsByDoctor",
      type: "GET",
      data: { doctorId: loginUser.user_name },
      dataType: "json",
      success: function (res) {
        hideLoading();
        consultPatients = Array.isArray(res && res.Data) ? res.Data : [];

        // 按申请时间倒序（最新在上）
        consultPatients = consultPatients.slice().sort(function (a, b) {
          console.log(getApplyTimestamp(b), getApplyTimestamp(a));
          return getApplyTimestamp(b) - getApplyTimestamp(a);
        });
        console.log(consultPatients);

        renderConsultPatients();

        if (res && res.Status && res.Status !== 1) {
          layer.msg(res.message || "获取会诊数据失败", { icon: 0, time: 1500 });
        }
      },
      error: function () {
        hideLoading();
        layer.msg("获取会诊列表失败，请稍后再试", { icon: 2, time: 1500 });
        consultPatients = [];
        renderConsultPatients();
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
    if (isConsultMode) {
      renderConsultPatients();
      return;
    }
    const patientList = $(".patients-cardlist");
    patientList.empty(); // 清空现有内容

    // 根据排序方式先得到排序后的数组（不破坏 allPatients 原始引用）
    let loadedPatients = applySort(true); // 返回一个排序后的浅拷贝
    // 根据当前显示模式过滤患者
    if (showMyPatientsOnly) {
      loadedPatients = loadedPatients.filter(
        (patient) => patient.refer_physician == loginUser.user_mi,
      );
    }
    // 根据状态过滤
    if (filteredStatus && filteredStatus !== "全部") {
      loadedPatients = loadedPatients.filter(
        (patient) => patient.admiss_status_name === filteredStatus,
      );
    }
    if (filteredGender && filteredGender !== "全部") {
      loadedPatients = loadedPatients.filter(
        (patient) => patient.sex_name === filteredGender,
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
        `<div style="padding:20px; text-align:center; color:#888;">${emptyMessage}</div>`,
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

  // 解析会诊申请时间
  function getApplyTimestamp(item) {
    // 只按申请时间字段优先：apply_date > apply_time > applyTime > request_time
    const cand =
      (item &&
        (item.apply_date ||
          item.applyDate ||
          item.apply_time ||
          item.applyTime ||
          item.request_time)) ||
      "";

    if (!cand) return 0;

    // 直接尝试原始字符串/Date
    if (cand instanceof Date) {
      const direct = cand.getTime();
      return isNaN(direct) ? 0 : direct;
    }

    const raw = String(cand).trim();
    if (!raw) return 0;

    // 1) 先试 ISO 解析（含 T 的情况）
    let ts = Date.parse(raw);

    // 2) 兼容 "2025-12-10T09:06:37" / "2025-12-10 09:06:37"
    if (isNaN(ts)) {
      const isoLike = raw.includes("T") ? raw : raw.replace(/\s+/, "T");
      ts = Date.parse(isoLike);
    }

    // 3) 再用斜杠替换横杠，去掉毫秒
    if (isNaN(ts)) {
      const normalized = raw
        .replace("T", " ")
        .replace(/\.\d+$/, "")
        .replace(/-/g, "/");
      ts = Date.parse(normalized);
    }

    // 4) 最后做一次拆分重组
    if (isNaN(ts)) {
      const parts = raw.split(/[ T]/);
      if (parts.length >= 1) {
        const datePart = parts[0].replace(/-/g, "/");
        const timePart = parts[1] || "00:00:00";
        ts = Date.parse(`${datePart} ${timePart}`);
      }
    }

    return isNaN(ts) ? 0 : ts;
  }

  // 渲染会诊患者卡片列表（展示即可）
  function renderConsultPatients() {
    const listEl = $(".patients-cardlist");
    listEl.empty();

    if (!consultPatients || consultPatients.length === 0) {
      listEl.append(
        '<div style="padding:20px; text-align:center; color:#888;">暂无会诊记录</div>',
      );
      return;
    }

    // 按会诊状态过滤
    let filtered = consultPatients;
    filtered = filtered.filter(function (item) {
      const handled = !!(
        (item.consult_advise && String(item.consult_advise).trim()) ||
        item.consult_doctor ||
        item.consultDoctor
      );
      if (consultStatusFilter === "待处理") return !handled;
      if (consultStatusFilter === "已处理") return handled;
      return true; // 全部
    });

    // 按会诊类别过滤
    if (consultRoleFilter && consultRoleFilter !== "全部") {
      const doctorId = loginUser.user_mi || loginUser.user_name || "";
      filtered = filtered.filter(function (item) {
        const applyDoctor =
          item.apply_opera ||
          item.apply_opera_id ||
          item.apply_opera_name ||
          "";
        const handleDoctor =
          item.consult_doctor3 ||
          item.consult_doctor ||
          item.consultDoctor ||
          item.consult_doctor_name ||
          "";
        if (consultRoleFilter === "我申请") {
          return String(applyDoctor) === String(doctorId);
        }
        if (consultRoleFilter === "我处理") {
          return String(handleDoctor) === String(doctorId);
        }
        return true;
      });
    }

    // 按搜索关键词过滤（与顶部搜索框联动）
    if (searchKeyword && searchKeyword.trim() !== "") {
      const kw = String(searchKeyword).toLowerCase();
      filtered = filtered.filter(function (item) {
        const name = (
          item.patient_name ||
          item.patientName ||
          ""
        ).toLowerCase();
        const bed = String(item.bed_no || item.bedNo || "");
        const pid = String(
          item.patient_id || item.patientId || "",
        ).toLowerCase();
        const dept = (
          item.apply_dept_name ||
          item.apply_dept ||
          item.applyDept ||
          ""
        ).toLowerCase();
        const doctor = (
          item.apply_opera_name ||
          item.apply_doctor_name ||
          item.apply_opera ||
          ""
        ).toLowerCase();
        const reason = (item.consult_reason || item.reason || "").toLowerCase();
        const applyTime = String(
          item.apply_date || item.apply_time || item.applyTime || "",
        ).toLowerCase();
        return (
          name.includes(kw) ||
          bed.includes(kw) ||
          pid.includes(kw) ||
          dept.includes(kw) ||
          doctor.includes(kw) ||
          reason.includes(kw) ||
          applyTime.includes(kw)
        );
      });
    }

    if (filtered.length === 0) {
      listEl.append(
        '<div style="padding:20px; text-align:center; color:#888;">' +
          (searchKeyword && searchKeyword.trim() !== ""
            ? "未找到匹配的会诊记录"
            : "暂无会诊记录") +
          "</div>",
      );
      return;
    }

    let html = "";
    filtered.forEach(function (item) {
      const name = item.patient_name || item.patientName || "患者";
      const bed = item.bed_no || item.bedNo || "";
      const applyDept = item.apply_dept_name || item.apply_dept || "";
      const applyDoctor =
        item.apply_opera_name ||
        item.apply_doctor_name ||
        item.apply_opera ||
        "";
      const reason = item.consult_reason || item.reason || "";
      const applyTime =
        item.apply_date || item.apply_time || item.applyTime || "";
      const handled = !!(
        (item.consult_advise && String(item.consult_advise).trim()) ||
        item.consult_doctor ||
        item.consultDoctor
      );
      const statusText = handled ? "已处理" : "待处理";
      const statusColor = handled ? "#16baaa" : "#ffb800";
      const patientId = item.patient_id || item.patientId || "";
      const wardSn = item.apply_dept || item.applyDept || "";
      const consultSerial = item.consult_serial || item.consultSerial || "";

      html += `
        <div class="patient-card consult-card" data-patient-id="${patientId}" data-apply-dept="${wardSn}">
          <div class="patient-card-header" style="position:relative; padding-right:80px;">
            ${bed ? `<label>${bed}床</label>` : ""}
            <label>${name}</label>
            <span style="position:absolute; right:10px; top:6px; padding:2px 8px; border-radius:10px; font-size:12px; color:#fff; background:${statusColor};">${statusText}</span>
          </div>
          <div class="patient-card-body">
            ${
              applyDept
                ? `<label style="grid-column:1/3"><i class="layui-icon layui-icon-home"></i>申请科室：${applyDept}</label>`
                : ""
            }
            ${
              applyDoctor
                ? `<label style="grid-column:1/3"><i class="layui-icon layui-icon-username"></i>申请医生：${applyDoctor}</label>`
                : ""
            }
            ${
              reason
                ? `<label style="grid-column:1/3"><i class="layui-icon layui-icon-form"></i>会诊原因：${reason}</label>`
                : ""
            }
            ${
              applyTime
                ? `<label style="grid-column:1/3"><i class="layui-icon layui-icon-date"></i>申请时间：${applyTime}</label>`
                : ""
            }
            <div style="grid-column:3/3; display:flex; gap:8px; margin-top:4px;">
              <button class="layui-btn layui-btn-normal layui-btn-sm consult-detail-btn" data-serial="${consultSerial}" ${
                consultSerial ? "" : "disabled"
              }>
                <i class="layui-icon layui-icon-search"></i> 详情
              </button>
            </div>
          </div>
        </div>`;
    });

    listEl.append(html);
  }

  // 根据会诊记录跳转患者详情
  function openConsultPatient(wardSn, patientId) {
    if (!wardSn || !patientId) {
      layer.msg("缺少病区或患者信息，无法打开详情", { icon: 0, time: 1500 });
      return;
    }

    showLoading();
    $.ajax({
      url:
        appconfig.api +
        `/api/MobileWard/GetActPatientLists?ward=${wardSn}&inout=I`,
      method: "GET",
      success: function (res) {
        if (res && res.Status === 1 && Array.isArray(res.Data)) {
          const matched = res.Data.find(
            (p) => p.patient_id == patientId || p.patientId == patientId,
          );

          if (matched) {
            localStorage.setItem("userData", JSON.stringify(matched));
            location.href = "../view/patient.html";
          } else {
            layer.msg("未找到匹配在院患者", { icon: 0, time: 1500 });
          }
        } else {
          layer.msg("获取患者列表失败", { icon: 2, time: 1500 });
        }
      },
      error: function () {
        layer.msg("获取患者列表失败", { icon: 2, time: 1500 });
      },
      complete: function () {
        hideLoading();
      },
    });
  }

  // 打开会诊详情弹窗（加载 consultations 页面）
  function openConsultDetail(serial) {
    if (!serial) {
      layer.msg("缺少会诊单号", { icon: 0, time: 1500 });
      return;
    }
    const url = `../view/consultations.html?consult_serial=${encodeURIComponent(
      serial,
    )}`;
    layer.open({
      type: 2,
      title: "会诊详情",
      area: ["96%", "96%"],
      shade: 0.3,
      content: url,
    });
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
  $(document).on(
    "click",
    ".consult-status-filter .consult-status-option",
    function () {
      const status = $(this).data("consult-status");
      if (status === consultStatusFilter) return;
      consultStatusFilter = status;
      $(".consult-status-filter .consult-status-option").removeClass("active");
      $(this).addClass("active");
      // 仅会诊模式下有效
      if (isConsultMode) {
        renderConsultPatients();
      }
    },
  );

  // 会诊类别筛选
  $(document).on(
    "click",
    ".consult-role-filter .consult-role-option",
    function () {
      const role = $(this).data("consult-role");
      if (role === consultRoleFilter) return;
      consultRoleFilter = role;
      $(".consult-role-filter .consult-role-option").removeClass("active");
      $(this).addClass("active");
      if (isConsultMode) {
        renderConsultPatients();
      }
    },
  );
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
        '<div style="padding:20px; text-align:center; color:#888;">未找到匹配的病区</div>',
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
                        "android.content.Intent",
                      );
                      var Uri = topPlus.android.importClass("android.net.Uri");
                      var Settings = topPlus.android.importClass(
                        "android.provider.Settings",
                      );
                      var intent = new Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                      );
                      var packageName = topPlus.android.invoke(
                        main,
                        "getPackageName",
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
                  },
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
            },
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
              },
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
        qrCanvasElement.height,
      );
      const imageData = qrCanvasContext.getImageData(
        0,
        0,
        qrCanvasElement.width,
        qrCanvasElement.height,
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
              (patient) => patient.inpatient_no == data,
            );
            if (selectedPatient == null) {
              layui.use("layer", function () {
                const layer = layui.layer;
                layer.msg("未找到对应患者信息", { icon: 2, time: 2000 });
              });
              return;
            } else {
              console.log("选中患者:", selectedPatient);
              console.log("当前病区:", currentWardName);
              selectedPatient.ward_name = currentWardName;
              localStorage.setItem("userData", JSON.stringify(selectedPatient));
              location.href = "../view/patient.html";
            }
          },
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
          },
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
  $(".filter-overlay").on("click", function () {
    $(".filter-panel").css("width", "0");
  });
  //病区切换点击事件
  $(".ward-list-body").on("click", ".ward-item", function () {
    const wardSn = $(this).data("ward-sn");
    const wardName = $(this).data("ward-name");

    // 根据 ward_sn 找到完整对象用于缓存
    var wardObj = availableWards.find(function (w) {
      return String(w.ward_sn) === String(wardSn);
    });
    if (!wardObj) {
      wardObj = { ward_sn: wardSn, ward_name: wardName };
    }

    console.log("选中病区:", wardName, "编号:", wardSn);

    // 更新当前选中的病区
    currentWardSn = wardSn;
    currentWardName = wardName;

    // 保存到 localStorage，下次进入页面时自动恢复
    saveSelectedWard(wardObj);

    // 更新按钮文本
    $("#wardlist-switch").html(
      wardName + ' <i class="layui-icon layui-icon-down"></i>',
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
    isConsultMode = false;
    showMyPatientsOnly = false;
    $("#all-patients-label").addClass("active");
    $("#my-patients-label").removeClass("active");
    $("#my-consultations-label").removeClass("active");
    renderPatients(); // 重新渲染
  });

  $("#my-patients-label").on("click", function () {
    isConsultMode = false;
    showMyPatientsOnly = true;
    $("#my-patients-label").addClass("active");
    $("#all-patients-label").removeClass("active");
    $("#my-consultations-label").removeClass("active");
    renderPatients(); // 重新渲染
  });

  $("#my-consultations-label").on("click", function () {
    isConsultMode = true;
    $("#my-consultations-label").addClass("active");
    $("#my-patients-label").removeClass("active");
    $("#all-patients-label").removeClass("active");
    loadconsultpatients();
  });

  // 初始化时设置默认选中状态
  $("#all-patients-label").addClass("active");

  // 患者搜索功能
  $("#patient-search").on("input", function () {
    searchKeyword = $(this).val();
    // 根据模式渲染对应列表
    if (isConsultMode) {
      renderConsultPatients();
    } else {
      renderPatients();
    }
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
      if (isConsultMode) {
        renderConsultPatients();
      } else {
        renderPatients();
      }
    }
  });

  // 监听会诊卡片详情按钮
  $(document).on("click", ".consult-detail-btn", function (e) {
    e.stopPropagation();
    e.preventDefault();
    const serial = $(this).data("serial") || "";
    openConsultDetail(serial);
  });
  $(".patients-cardlist").on("click", ".patient-card", function () {
    // 如果点击的是会诊详情/其他按钮，则不触发卡片跳转
    if (
      event &&
      $(event.target).closest(
        ".consult-detail-btn, .btn-advise, button, a, .layui-btn",
      ).length
    ) {
      return;
    }
    if (isConsultMode) {
      const wardSn = $(this).data("apply-dept");
      const patientId = $(this).data("patient-id");
      openConsultPatient(wardSn, patientId);
      return;
    }
    const patientId = $(this).data("patient-id");
    const selectedPatient = allPatients.find(
      (patient) => patient.inpatient_no == patientId,
    );
    console.log("选中患者:", selectedPatient);
    selectedPatient.ward_name = currentWardName;
    localStorage.setItem("userData", JSON.stringify(selectedPatient));
    location.href = "../view/patient.html";
    // 这里可以添加跳转到患者详情页的逻辑
  });
  $("#filter-reset-btn").on("click", function () {
    // 重置所有筛选选项
    $(".filter-body label").removeClass("active");
    $(".filter-body .sort-option[data-sort='default']").addClass("active");
    $(".status-filter .status-option[data-sort='全部']").addClass("active");
    $(".gender-filter .gender-option[data-sort='全部']").addClass("active");
    $(
      ".consult-status-filter .consult-status-option[data-consult-status='全部']",
    ).addClass("active");
    $(
      ".consult-role-filter .consult-role-option[data-consult-role='全部']",
    ).addClass("active");
    currentSort = "default";
    filteredStatus = "全部";
    filteredGender = "全部";
    consultStatusFilter = "全部";
    consultRoleFilter = "全部";
    searchKeyword = "";
    $("#patient-search").val("");
    if (isConsultMode) {
      renderConsultPatients();
    } else {
      renderPatients();
    }
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
