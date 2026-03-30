layui.use(["appconfig", "layer", "form", "jquery"], function () {
  const $ = layui.jquery;
  const appconfig = layui.appconfig;
  const layer = layui.layer;
  const form = layui.form;

  // WebSocket 配置（从 appconfig 获取）
  const WS_CONFIG = {
    WS_BASE: appconfig.ws + "/ws", // 使用 appconfig 的 ws 地址
    API_BASE: appconfig.api + "/api", // 使用 appconfig 的 api 地址
    HEARTBEAT_INTERVAL: 30000,
    RECONNECT_INTERVAL: 5000,
    ENABLE_DESKTOP_NOTIFICATION: true,
    ENABLE_SOUND_NOTIFICATION: true,
    ENABLE_AUTO_RECONNECT: true,
  };

  // WebSocket 变量
  let ws = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;

  // 消息数据存储
  const messageData = [];
  let messageIdCounter = 1;
  let currentFilter = "pending";
  const loginUser = JSON.parse(localStorage.getItem("loginUser"));

  // 获取用户信息（从 localStorage 或其他地方获取）
  function getUserInfo() {
    // 这里需要根据实际情况获取用户信息
    // 示例：从 localStorage 获取
    return {
      userId: loginUser
        ? loginUser.user_mi
        : localStorage.getItem("userId") || "DOC001",
      userRole: "doctor",
      wardCode: loginUser
        ? loginUser.dept_sn
        : localStorage.getItem("wardCode") || "NK001",
    };
  }

  // 更新 WebSocket 状态指示器（使用 jQuery）
  function updateWSStatus(status) {
    const $statusElement = $("#wsStatus");
    if ($statusElement.length === 0) return;

    $statusElement
      .removeClass("ws-online ws-offline ws-connecting")
      .addClass("ws-status");

    switch (status) {
      case "online":
        $statusElement.addClass("ws-online").attr("title", "WebSocket已连接");
        break;
      case "offline":
        $statusElement.addClass("ws-offline").attr("title", "WebSocket未连接");
        break;
      case "connecting":
        $statusElement
          .addClass("ws-connecting")
          .attr("title", "WebSocket连接中...");
        break;
    }
  }

  // WebSocket 连接
  function connectWebSocket() {
    const userInfo = getUserInfo();
    const wsUrl = `${WS_CONFIG.WS_BASE}?userId=${userInfo.userId}&userRole=${userInfo.userRole}&wardCode=${userInfo.wardCode}`;

    console.log("正在连接 WebSocket:", wsUrl);
    updateWSStatus("connecting");

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = function () {
        console.log("✅ WebSocket 连接成功");
        updateWSStatus("online");

        // 显示连接成功提示（直接使用 layer，无需再次 use）
        layer.msg("消息推送已连接", { icon: 1, time: 1000 });

        // 开始心跳
        startHeartbeat();
      };

      ws.onmessage = function (event) {
        console.log("📨 收到消息:", event.data);

        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch (e) {
          console.error("解析消息失败:", e);
        }
      };

      ws.onerror = function (error) {
        console.error("❌ WebSocket 错误:", error);
        updateWSStatus("offline");
      };

      ws.onclose = function () {
        console.log("🔌 WebSocket 连接已关闭");
        updateWSStatus("offline");
        stopHeartbeat();

        // 自动重连
        if (WS_CONFIG.ENABLE_AUTO_RECONNECT) {
          reconnectTimer = setTimeout(() => {
            console.log("尝试重新连接...");
            connectWebSocket();
          }, WS_CONFIG.RECONNECT_INTERVAL);
        }
      };
    } catch (error) {
      console.error("WebSocket 连接失败:", error);
      updateWSStatus("offline");
    }
  }

  // 心跳机制
  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ Type: "ping" }));
      }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // 处理接收到的 WebSocket 消息
  function handleWebSocketMessage(msg) {
    // 忽略连接和心跳消息
    if (
      msg.Type === "connection" ||
      msg.Type === "pong" ||
      msg.Type === "echo"
    ) {
      return;
    }

    // 处理危急值消息
    if (msg.CrisisString) {
      console.log("收到危急值消息:", {
        PatientCrisisID: msg.PatientCrisisID,
        CrisisString: msg.CrisisString,
        PatientInfo: msg.PatientInfo,
        ReceiveFlag: msg.ReceiveFlag,
      });

      // 检查是否已存在该消息
      const existingMessage = messageData.find(
        (m) => m.crisisId === msg.PatientCrisisID
      );

      if (existingMessage) {
        // 如果消息已存在
        if (String(msg.ReceiveFlag) === "1" || msg.ReceiveFlag === 1) {
          // ReceiveFlag = 1 表示已处理，更新消息状态
          console.log("收到已处理的消息，更新状态:", msg.PatientCrisisID);
          existingMessage.opinionStatus = "processed";
          existingMessage.isRead = true;
          existingMessage.receiveFlag = msg.ReceiveFlag;

          // 如果有处置意见，也更新
          if (msg.DoctorOpinion) {
            existingMessage.doctorOpinion = msg.DoctorOpinion;
            existingMessage.fullContent = `患者信息：${
              msg.PatientInfo || "未知"
            }\n\n危急值内容：\n${msg.CrisisString}\n\n接收时间：${
              existingMessage.time
            }\n\n处置意见：\n${msg.DoctorOpinion}`;
          }

          // 更新界面
          renderMessages();
          updateUnreadCount();
          layer.msg("消息状态已更新", { icon: 1, time: 1000 });
        } else {
          // 重复的未处理消息，忽略
          console.log("收到重复消息，忽略:", msg.PatientCrisisID);
        }
        return;
      }

      // 如果是已处理的新消息，不添加
      if (String(msg.ReceiveFlag) === "1" || msg.ReceiveFlag === 1) {
        console.log("收到已处理的新消息，不添加到列表:", msg.PatientCrisisID);
        return;
      }
      console;
      // 添加新的未处理消息
      addNewMessage({
        type: "urgent",
        title: `危急值通知：${msg.HZXM || "患者"}`,
        content: msg.Content,
        sender: "系统推送",
        fullContent: `患者信息：${msg.PatientInfo || "未知"}\n\n危急值内容：\n${
          msg.CrisisString
        }\n\n接收时间：${new Date().toLocaleString()}`,
        crisisId: msg.PatientCrisisID, // 使用 PatientCrisisID 作为危急值ID
        patientInfo: msg.PatientInfo,
        needOpinion: true, // 标记需要医生处置意见
        opinionStatus: "pending", // 处置状态：pending(待处理)、processed(已处理)
      });

      // 显示桌面通知
      showDesktopNotification(msg);

      // 播放提示音（如果需要）
      playNotificationSound();
    }
  }

  // 删除消息（根据 crisisId）
  function removeMessage(crisisId) {
    const index = messageData.findIndex((msg) => msg.crisisId === crisisId);
    if (index !== -1) {
      messageData.splice(index, 1);
      console.log("已删除消息:", crisisId);

      // 更新界面
      renderMessages();
      updateUnreadCount();
    }
  }

  // 添加新消息
  function addNewMessage(messageInfo) {
    const newMessage = {
      id: messageIdCounter++,
      type: messageInfo.type || "urgent",
      title: messageInfo.title,
      content: messageInfo.content,
      sender: messageInfo.sender,
      time: new Date().toLocaleString(),
      isRead: false,
      fullContent: messageInfo.fullContent,
      crisisId: messageInfo.crisisId, // 危急值ID
      patientInfo: messageInfo.patientInfo, // 患者信息
      needOpinion: messageInfo.needOpinion || false, // 是否需要处置意见
      opinionStatus: messageInfo.opinionStatus || "pending", // 处置状态
      doctorOpinion: messageInfo.doctorOpinion || "", // 医生处置意见
    };

    // 添加到消息列表开头
    messageData.unshift(newMessage);

    // 更新界面
    renderMessages();
    updateUnreadCount();

    // 显示新消息提示
    layer.msg("收到新消息", { icon: 1, time: 1500 });

    // 推送手机通知（使用 plus.push）
    pushMobileNotification(messageInfo);
  }

  // 推送手机通知（5+ App）
  function pushMobileNotification(messageInfo) {
    // 获取 plus 对象（iframe 中需要从父窗口获取）
    const plusObj = window.top.plus || window.parent.plus || window.plus;

    // 检查是否在 5+ App 环境中
    if (typeof plusObj === "undefined" || !plusObj) {
      console.log(
        "非 5+ App 环境，跳过手机通知（当前在 iframe 中，已尝试从父窗口获取 plus）"
      );
      return;
    }

    console.log("✅ 检测到 5+ App 环境，准备推送通知");

    // 确保 plus 对象已准备好
    const doPush = function () {
      try {
        // 创建本地通知
        const options = {
          cover: false, // 是否覆盖之前的通知
          title: messageInfo.title || "危急值通知", // 通知标题
          content: messageInfo.content || "您有新的危急值消息", // 通知内容
          payload: JSON.stringify({
            type: "crisis_message",
            crisisId: messageInfo.crisisId,
            patientInfo: messageInfo.patientInfo,
          }), // 自定义数据
        };

        // 创建并推送通知
        const message = plusObj.push.createMessage(
          options.content,
          options.payload,
          {
            title: options.title,
            cover: options.cover,
            sound: "system", // 使用系统默认提示音
            vibrate: true, // 震动
          }
        );

        console.log("✅ 手机通知推送成功:", options.title);
      } catch (error) {
        console.error("❌ 手机通知推送失败:", error);
      }
    };

    // 如果 plus 已准备好,直接执行;否则等待 plusready 事件
    if (plusObj) {
      doPush();
    } else {
      document.addEventListener("plusready", doPush, false);
    }
  }

  // 显示桌面通知
  function showDesktopNotification(msg) {
    if (
      WS_CONFIG.ENABLE_DESKTOP_NOTIFICATION &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("危急值通知", {
        body: msg.CrisisString,
        icon: "/favicon.ico",
        tag: "crisis-notification",
        requireInteraction: true, // 需要用户交互才关闭
      });
    }
  }

  // 播放提示音
  function playNotificationSound() {
    if (!WS_CONFIG.ENABLE_SOUND_NOTIFICATION) return;

    // 创建音频元素并播放
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUR"
    );
    audio.play().catch((e) => console.log("播放提示音失败:", e));
  }

  // 提交医生处置意见
  async function submitDoctorOpinion(messageId) {
    console.log("提交处置意见，消息ID:", messageId);
    const message = messageData.find((msg) => msg.id === messageId);
    if (!message) {
      layer.msg("消息不存在", { icon: 2 });
      return;
    }

    const $opinionInput = $("#doctorOpinionInput");
    if ($opinionInput.length === 0) {
      console.error("未找到处置意见输入框");
      layer.msg("系统错误：未找到输入框", { icon: 2 });
      return;
    }

    const opinion = $opinionInput.val().trim();
    if (!opinion) {
      layer.msg("请输入处置意见", { icon: 0 });
      return;
    }

    // 获取用户信息
    const userInfo = getUserInfo();

    // 显示加载提示
    const loadingIndex = layer.load(1, { shade: [0.3, "#000"] });

    try {
      console.log("正在提交处置意见...", {
        crisisId: message.crisisId,
        userId: userInfo.userId,
        opinion: opinion,
      });

      const response = await fetch(
        `${WS_CONFIG.API_BASE}/message/opinion/doctor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            CrisisId: message.crisisId,
            UserId: userInfo.userId,
            Opinion: opinion,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.Message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // 关闭加载提示
      layer.close(loadingIndex);

      if (result.Success) {
        // 更新消息状态
        message.opinionStatus = "processed";
        message.doctorOpinion = opinion;

        // 显示成功提示
        layer.msg("处置意见提交成功", { icon: 1, time: 1500 });

        // 关闭详情窗口
        setTimeout(() => {
          closeMessageDetail();
          // 更新消息列表显示
          renderMessages();
        }, 1500);

        console.log("✅ 处置意见提交成功");
      } else {
        throw new Error(result.Message || "提交失败");
      }
    } catch (error) {
      console.error("❌ 提交处置意见失败:", error);

      // 关闭加载提示
      layer.close(loadingIndex);
      layer.msg("提交失败: " + error.message, { icon: 2, time: 2000 });
    }
  }

  // 请求桌面通知权限
  function requestNotificationPermission() {
    // 桌面通知权限（浏览器环境）
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // 5+ App 通知权限
    const setupPlusNotification = function () {
      // 获取 plus 对象（iframe 中需要从父窗口获取）
      const plusObj = window.top.plus || window.parent.plus || window.plus;

      if (typeof plusObj === "undefined" || !plusObj) {
        console.log("非 5+ App 环境，跳过通知监听器注册");
        return;
      }

      try {
        // 监听通知点击事件
        plusObj.push.addEventListener(
          "click",
          function (msg) {
            console.log("用户点击了通知:", msg);

            try {
              // 解析通知携带的数据
              const payload = JSON.parse(msg.payload);

              if (payload.type === "crisis_message" && payload.crisisId) {
                // 查找对应的消息
                const message = messageData.find(
                  (m) => m.crisisId === payload.crisisId
                );
                if (message) {
                  // 显示消息详情
                  showMessageDetail(message.id);
                }
              }
            } catch (error) {
              console.error("处理通知点击失败:", error);
            }
          },
          false
        );

        console.log("✅ 5+ App 通知监听器已注册");
      } catch (error) {
        console.error("❌ 5+ App 通知监听器注册失败:", error);
      }
    };

    // 如果 plus 已准备好,直接执行;否则等待 plusready 事件
    const plusObj = window.top.plus || window.parent.plus || window.plus;
    if (plusObj) {
      setupPlusNotification();
    } else {
      document.addEventListener("plusready", setupPlusNotification, false);
    }
  }

  // 加载历史消息
  async function loadHistoryMessages() {
    const userInfo = getUserInfo();
    const wardCode = userInfo.wardCode;
    const doctorId = userInfo.userId;
    if (!wardCode) {
      console.error("未获取到科室编号");
      return;
    }

    // 显示加载提示
    const loadingIndex = layer.msg("正在加载消息...", {
      icon: 16,
      shade: 0.3,
      time: 0, // 不自动关闭
    });

    try {
      console.log("开始加载历史消息，科室编号:", wardCode);

      // 并行请求未处理和已处理的消息
      const [unprocessedRes, processedRes] = await Promise.all([
        fetch(`${WS_CONFIG.API_BASE}/Message/processed/doctor/${doctorId}`),
        fetch(`${WS_CONFIG.API_BASE}/Message/unprocessed/doctor/${doctorId}`),
      ]);

      if (!unprocessedRes.ok || !processedRes.ok) {
        throw new Error("获取历史消息失败");
      }

      const unprocessedData = await unprocessedRes.json();
      const processedData = await processedRes.json();

      // 关闭加载提示
      layer.close(loadingIndex);

      if (unprocessedData.Success && processedData.Success) {
        console.log("历史消息加载成功:", {
          unprocessed: unprocessedData.Count,
          processed: processedData.Count,
        });

        // 处理未处理的消息
        if (unprocessedData.Data && unprocessedData.Data.length > 0) {
          unprocessedData.Data.forEach((msg) => {
            addHistoryMessage(msg);
          });
        }

        // 处理已处理的消息
        if (processedData.Data && processedData.Data.length > 0) {
          processedData.Data.forEach((msg) => {
            addHistoryMessage(msg);
          });
        }

        // 按时间倒序排序（最新的在前）
        messageData.sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeB - timeA; // 降序
        });

        // 更新界面
        renderMessages();
        updateUnreadCount();

        const totalUnprocessed = unprocessedData.Count;
        const totalProcessed = processedData.Count;
        const totalCount = totalUnprocessed + totalProcessed;

        if (totalCount > 0) {
          layer.msg(
            `加载完成：${totalUnprocessed} 条待处置，${totalProcessed} 条已处置`,
            {
              icon: 1,
              time: 2000,
            }
          );
        } else {
          layer.msg("暂无消息", {
            icon: 1,
            time: 1500,
          });
        }
      } else {
        throw new Error("数据格式错误");
      }
    } catch (error) {
      console.error("❌ 加载历史消息失败:", error);
      layer.close(loadingIndex);
      layer.msg("加载消息失败: " + error.message, { icon: 2, time: 2000 });
    }
  }

  // 添加历史消息（从API获取的消息）
  function addHistoryMessage(msg) {
    // 检查是否已存在（避免重复）
    const existingMessage = messageData.find(
      (m) => m.crisisId === msg.PatientCrisisID
    );
    if (existingMessage) {
      console.log("历史消息已存在，跳过:", msg.PatientCrisisID);
      return;
    }
    console.log(msg);
    // 根据 ReceiveFlag 确定处置状态：1=已处置，0=未处置
    // ReceiveFlag 可能是字符串 '0'/'1' 或数字 0/1
    const isProcessed = String(msg.IS_DEAL) === "1" || msg.IS_DEAL === 1;
    const opinionStatus = isProcessed ? "processed" : "pending";
    console.log(
      "消息状态 - ReceiveFlag:",
      msg.ReceiveFlag,
      "isProcessed:",
      isProcessed
    );
    const newMessage = {
      id: messageIdCounter++,
      type: "urgent",
      title: `危急值通知：${msg.HZXM || "患者"}`,
      content: msg.Content || "危急值信息",
      sender: "系统推送",
      time: msg.WJZTBSJ
        ? new Date(msg.WJZTBSJ).toLocaleString()
        : new Date().toLocaleString(),
      isRead: isProcessed, // 已处理的标记为已读
      fullContent: `${msg.CrisisString || "未知"}`,
      crisisId: msg.PatientCrisisID,
      patientInfo: msg.PatientInfo,
      needOpinion: true,
      opinionStatus: opinionStatus, // 根据 ReceiveFlag 确定
      doctorOpinion: msg.Receivetext || "",
      receiveFlag: msg.ReceiveFlag, // 保存原始 ReceiveFlag
    };

    // 添加到消息列表
    messageData.push(newMessage);
  }

  // 初始化函数
  async function init() {
    renderMessages();
    bindEvents();
    updateUnreadCount();

    // 先加载历史消息（不阻塞后续操作）
    try {
      await loadHistoryMessages();
    } catch (error) {
      console.error("历史消息加载失败，继续初始化WebSocket:", error);
    }

    // 然后连接 WebSocket 进行实时更新
    connectWebSocket();

    // 请求通知权限
    requestNotificationPermission();
  }

  // 页面加载完成后初始化
  // 由于在 layui.use 回调中,DOMContentLoaded 可能已经触发,所以直接检查状态
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM 已经加载完成,直接初始化
    init();
  }

  // 渲染消息列表（使用 jQuery）
  function renderMessages() {
    const $container = $("#messageContainer");
    let filteredMessages = messageData;

    // 根据筛选条件过滤消息
    switch (currentFilter) {
      case "unread":
        filteredMessages = messageData.filter((msg) => !msg.isRead);
        break;
      case "pending":
        // 待处置：显示状态为 pending 的消息
        filteredMessages = messageData.filter(
          (msg) => msg.opinionStatus === "pending"
        );
        break;
      case "processed":
        // 已处置：显示状态为 processed 的消息
        filteredMessages = messageData.filter(
          (msg) => msg.opinionStatus === "processed"
        );
        break;
      default:
        filteredMessages = messageData;
    }

    if (filteredMessages.length === 0) {
      $container.html(`
                    <div class="no-messages">
                        <div class="layui-icon layui-icon-email"></div>
                        <p>暂无消息</p>
                    </div>
                `);
      return;
    }

    let html = "";
    filteredMessages.forEach((message) => {
      const typeClass = message.type;
      const typeName = getTypeName(message.type);
      const unreadClass = message.isRead ? "" : "unread";

      // 构建处置状态标签
      let opinionStatusBadge = "";
      if (message.needOpinion && message.type === "urgent") {
        if (message.opinionStatus === "processed") {
          opinionStatusBadge =
            '<span style="background: #52c41a; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 5px;"><i class="layui-icon layui-icon-ok-circle" style="font-size: 11px;"></i> 已处置</span>';
        } else {
          opinionStatusBadge =
            '<span style="background: #faad14; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 5px;"><i class="layui-icon layui-icon-time" style="font-size: 11px;"></i> 待处置</span>';
        }
      }

      html += `
                    <div class="message-card ${unreadClass}" onclick="showMessageDetail(${message.id})">
                        <div class="message-header">
                            <div>
                                ${opinionStatusBadge}
                            </div>
                            <span class="message-time">${message.time}</span>
                        </div>
                        <div class="message-title-text">${message.title}</div>
                        <div class="message-content">${message.content}</div>
                        <div class="message-sender">
                            <i class="layui-icon layui-icon-username"></i>
                            ${message.sender}
                        </div>
                    </div>
                `;
    });

    $container.html(html);
  }

  // 获取消息类型名称
  function getTypeName(type) {
    const typeNames = {
      system: "系统",
      notice: "公告",
      work: "工作",
      urgent: "紧急",
    };
    return typeNames[type] || "消息";
  }

  // 绑定事件（使用 jQuery）
  function bindEvents() {
    // 筛选按钮事件
    $(".message-filter").on("click", function () {
      $(".message-filter").removeClass("active");
      $(this).addClass("active");
      currentFilter = $(this).data("filter");
      renderMessages();
    });
  }

  // 显示消息详情
  function showMessageDetail(messageId) {
    const message = messageData.find((msg) => msg.id === messageId);
    if (!message) return;

    // 标记为已读
    if (!message.isRead) {
      message.isRead = true;
      updateUnreadCount();
      renderMessages();
    }

    // 构建详情内容
    //<span class="message-type ${message.type}">${getTypeName(message.type)}</span>
    let detailHtml = `
                <div class="message-header" style="margin-bottom: 0px;">
                    <span class="message-time">${message.time}</span>
                </div>
                <div id="messageFullContent" style="white-space: pre-line; margin-bottom: 15px;">
                    ${message.fullContent}
                </div>
            `;

    // 如果是危急值消息且需要医生处置意见
    if (message.needOpinion && message.type === "urgent") {
      const userInfo = getUserInfo();

      // 显示处置状态
      if (message.opinionStatus === "processed" && message.doctorOpinion) {
        // 已处理：显示处置意见
        detailHtml += `
                        <div style="background: #f0f9ff; border-left: 4px solid #1890ff; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                            <div style="color: #1890ff; font-weight: bold; margin-bottom: 8px;">
                                <i class="layui-icon layui-icon-ok-circle"></i> 已处置
                            </div>
                            <div style="color: #333; line-height: 1.6;">
                                <strong>处置意见：</strong><br/>
                                ${message.doctorOpinion}
                            </div>
                        </div>
                    `;
      } else if (userInfo.userRole === "doctor") {
        // 待处理：显示输入框（仅医生可见）
        detailHtml += `
                        <div style="background: #fff7e6; border-left: 4px solid #faad14; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                            <div style="color: #fa8c16; font-weight: bold; margin-bottom: 10px;">
                                <i class="layui-icon layui-icon-tips"></i> 待处置
                            </div>
                            <textarea id="doctorOpinionInput" placeholder="请输入处置意见..." 
                                style="box-sizing: border-box;width: 100%; min-height: 100px; padding: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; line-height: 1.5; resize: vertical; font-family: inherit;"></textarea>
                            <div style="margin-top: 10px; text-align: right;">
                                <button onclick="submitDoctorOpinion(${message.id})" 
                                    style="background: #1890ff; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                    <i class="layui-icon layui-icon-ok"></i> 提交处置意见
                                </button>
                            </div>
                        </div>
                    `;
      } else {
        // 护士查看：显示待处理状态
        detailHtml += `
                        <div style="background: #fff7e6; border-left: 4px solid #faad14; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                            <div style="color: #fa8c16; font-weight: bold;">
                                <i class="layui-icon layui-icon-tips"></i> 待医生处置
                            </div>
                        </div>
                    `;
      }
    }

    detailHtml += `
                <div class="message-sender">
                    <i class="layui-icon layui-icon-username"></i>
                    发送人：${message.sender}
                </div>
            `;

    // 显示详情弹窗（使用 jQuery）
    $("#detailTitle").text(message.title);
    $("#detailContent").html(detailHtml);
    $("#messageDetailOverlay").show();
  }

  // 关闭消息详情
  function closeMessageDetail() {
    $("#messageDetailOverlay").hide();
  }

  // 全部标记为已读
  function markAllAsRead() {
    if (messageData.length === 0) {
      layer.msg("暂无消息", { icon: 0 });
      return;
    }

    messageData.forEach((msg) => (msg.isRead = true));
    updateUnreadCount();
    renderMessages();
    layer.msg("所有消息已标记为已读", { icon: 1 });
  }

  // 更新未读数量
  function updateUnreadCount() {
    const unreadCount = messageData.filter((msg) => !msg.isRead).length;
    const $countElement = $("#unreadCount");
    if (unreadCount > 0) {
      $countElement.text(unreadCount).show();
    } else {
      $countElement.hide();
    }
  }

  // 处理移动端返回键（在 iframe 子页面中）
  window.addEventListener(
    "message",
    function (event) {
      // 检查是否有打开的 layer 弹层
      if (event.data && event.data.type === "back") {
        closeMessageDetail();
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

  // 页面卸载时关闭 WebSocket
  window.addEventListener("beforeunload", function () {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    stopHeartbeat();
    if (ws) {
      ws.close();
      ws = null;
    }
  });

  // 将需要在 HTML onclick 中使用的函数暴露到全局作用域
  window.showMessageDetail = showMessageDetail;
  window.closeMessageDetail = closeMessageDetail;
  window.markAllAsRead = markAllAsRead;
  window.submitDoctorOpinion = submitDoctorOpinion;
}); // 结束 layui.use
