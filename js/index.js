layui.use(["form", "jquery", "appconfig", "dropdown"], function () {
  var $ = layui.jquery,
    form = layui.form,
    appconfig = layui.appconfig,
    layer = layui.layer;
  dropdown = layui.dropdown;
  // 统一将错误对象转换为字符串，便于日志查看
  function errToString(err) {
    if (err == null) return "";
    if (typeof err === "string") return err;
    // 常见的 Error 或含 message/stack 的对象（包含 5+ 的错误对象）
    var msg = "";
    if (err.message) msg = String(err.message);
    if (err.stack) msg = (msg ? msg + "\n" : "") + String(err.stack);
    if (msg) return msg;
    try {
      return JSON.stringify(err);
    } catch (e) {
      try {
        return String(err);
      } catch (e2) {
        return "[Unserializable error]";
      }
    }
  }
  // 检查更新（从 plus.runtime 读取应用版本）
  // 注意：此函数必须在 plus 准备好后才能调用
  function checkUpdate() {
    console.log("开始检查更新...");

    // 使用 plus.runtime.getProperty 获取更权威的应用信息（可包含来自 AndroidManifest 的信息）
    function proceedWithInfo(info) {
      // 如果 getProperty 返回 null/undefined，则回退到 plus.runtime 字段
      var localWgtVersion =
        (info && info.version) ||
        (plus && plus.runtime && plus.runtime.version) ||
        "0.0.0";
      var localVersionCode =
        (info && info.versionCode) ||
        (plus && plus.runtime && plus.runtime.versionCode) ||
        0;
      try {
        if (info) {
          console.log("🔍 准确版本信息:");
          console.log("版本名称:", info.version);
          console.log("版本号:", info.versionCode);
          if (info.appid) console.log("应用ID:", info.appid);
          // 额外打印原始对象以便调试（如不需要可注释）
          console.log("原始 info 对象:", info);
        } else {
          // 回退到 plus.runtime 的字段（在某些环境下可用）
          var fallback =
            plus && plus.runtime
              ? {
                  version: plus.runtime.version,
                  versionCode: plus.runtime.versionCode,
                }
              : null;
          console.log(
            "plus.runtime.getProperty 未返回 info，回退信息：",
            fallback,
          );
        }
      } catch (e) {
        console.warn("打印 info 时发生异常：", errToString(e));
        console.log("plus.runtime.getProperty 返回的 info（原始对象）:", info);
      }
      console.log(
        "本地版本:",
        localWgtVersion,
        "(versionCode:",
        localVersionCode + ")",
      );

      // 显示版本号
      $("#version").text("V " + localWgtVersion);

      // 检查网络连接状态（5+ 环境）
      var networkType =
        plus && plus.networkinfo ? plus.networkinfo.getCurrentType() : -1;
      console.log("当前网络类型:", networkType);

      // 如果没有网络连接，跳过更新检查（在 plus 环境下判断 CONNECTION_NONE）
      if (
        plus &&
        plus.networkinfo &&
        networkType === plus.networkinfo.CONNECTION_NONE
      ) {
        console.log("无网络连接，跳过更新检查");
        return;
      }

      const serverUrl = appconfig.api + "/wgt/update-manifest.json";
      console.log("检查更新地址:", serverUrl);

      // 使用 fetch 检查更新（带超时控制）
      var fetchTimeout = setTimeout(function () {
        console.warn("检查更新超时（10秒）");
      }, 10000);

      fetch(serverUrl, {
        method: "GET",
        cache: "no-cache",
        headers: {
          Accept: "application/json",
        },
      })
        .then((response) => {
          clearTimeout(fetchTimeout);

          if (!response.ok) {
            throw new Error(
              "HTTP " + response.status + ": " + response.statusText,
            );
          }
          return response.json();
        })
        .then((serverData) => {
          // 服务器JSON格式应为: { "latestVersionCode": 112, "latestVersionName": "1.1.2", "latestType": "apk/wgt", "files": [...] }
          console.log(
            "服务器最新版本:",
            serverData.latestVersionName || serverData.latest,
            "(versionCode:",
            serverData.latestVersionCode + ")",
          );
          console.log(
            "本地版本:",
            localWgtVersion,
            "(versionCode:",
            localVersionCode + ")",
          );
          console.log("更新类型:", serverData.latestType || "wgt");

          // 使用 versionCode 和 versionName 双重递增校验（防止污染）
          var needUpdate = false;
          var serverVersionName =
            serverData.latestVersionName || serverData.latest;
          var updateType = serverData.latestType || "wgt"; // 获取更新类型，默认为 wgt

          if (
            !serverData.latestVersionCode ||
            !localVersionCode ||
            !serverVersionName ||
            !localWgtVersion
          ) {
            console.warn("服务器或本地缺少版本信息，无法进行版本比较");
            return;
          }

          // 检查 versionCode 是否递增
          var codeIncreased = serverData.latestVersionCode > localVersionCode;

          // 检查 versionName 是否递增（简单字符串比较）
          var nameIncreased = serverVersionName > localWgtVersion;

          console.log("版本比较:");
          console.log(
            "  versionCode:",
            localVersionCode,
            "→",
            serverData.latestVersionCode,
            codeIncreased ? "✓ 递增" : "✗ 未递增",
          );
          console.log(
            "  versionName:",
            localWgtVersion,
            "→",
            serverVersionName,
            nameIncreased ? "✓ 递增" : "✗ 未递增",
          );

          if (codeIncreased && nameIncreased) {
            // 两者都递增 → 正常更新
            needUpdate = true;
            console.log("✓ versionCode 和 versionName 都递增 → 需要更新");
          } else if (codeIncreased && !nameIncreased) {
            // code 递增但 name 未递增 → 异常
            console.error(
              "❌ 检测到版本异常！versionCode 递增但 versionName 未递增",
            );
            console.error("   这可能是服务器配置错误或版本号污染");
            console.warn("⚠️ 拒绝更新以避免问题");
          } else if (!codeIncreased && nameIncreased) {
            // code 未递增但 name 递增 → 异常
            console.error(
              "❌ 检测到版本异常！versionName 递增但 versionCode 未递增",
            );
            console.error("   这可能是服务器配置错误");
            console.warn("⚠️ 拒绝更新以避免问题");
          } else {
            // 都没有递增
            if (
              serverData.latestVersionCode === localVersionCode &&
              serverVersionName === localWgtVersion
            ) {
              // 完全相同 → 已是最新版本
              console.log("✓ 已是最新版本 (versionCode 和 versionName 都匹配)");
            } else {
              // 不相同但也没递增 → 异常（可能回退或污染）
              console.error("❌ 检测到版本异常！版本号不一致但未递增");
              console.error(
                "   本地:",
                localWgtVersion,
                "(Code:",
                localVersionCode + ")",
              );
              console.error(
                "   服务器:",
                serverVersionName,
                "(Code:",
                serverData.latestVersionCode + ")",
              );
            }
          }

          if (needUpdate) {
            var newVersionText = serverData.latest;
            var updateUrl = serverData.files[0].url;

            // 根据更新类型采取不同的处理方式
            if (updateType === "apk") {
              // APK 更新：提示用户并跳转到下载页面
              if (
                confirm(
                  "检测到新版本 " +
                    newVersionText +
                    "（完整安装包），需要前往下载页面更新，是否立即前往？",
                )
              ) {
                console.log("跳转到 APK 下载页面:", appconfig.api + updateUrl);
                // 使用 plus.runtime.openURL 打开外部浏览器下载
                if (plus && plus.runtime && plus.runtime.openURL) {
                  plus.runtime.openURL(appconfig.api + updateUrl);
                } else {
                  // 降级方案：在当前页面打开
                  window.location.href = appconfig.api + updateUrl;
                }
              } else {
                console.log("用户取消了更新");
              }
            } else {
              // WGT 更新：使用原有的下载安装流程
              if (
                confirm(
                  "检测到新版本 " +
                    newVersionText +
                    "（热更新包），是否立即下载更新？",
                )
              ) {
                console.log("下载 WGT 更新包:", appconfig.api + updateUrl);
                downloadWgt(appconfig.api + updateUrl);
              } else {
                console.log("用户取消了更新");
              }
            }
          } else {
            console.log("已是最新版本");
          }
        })
        .catch((err) => {
          clearTimeout(fetchTimeout);

          // 网络错误详细处理
          var errorMsg = errToString(err);
          console.warn("检查更新失败（不影响使用）：", errorMsg);

          // 仅在开发模式显示错误（可选）
          // 生产环境静默失败，不打扰用户
          if (errorMsg.includes("Failed to fetch")) {
            console.log("提示：请检查网络连接或服务器地址是否正确");
          }

          // 不显示 layer.msg，避免影响用户体验
        });
    }

    // 若 plus.runtime.getProperty 可用，优先使用其返回的 info（更权威）
    if (
      plus &&
      plus.runtime &&
      typeof plus.runtime.getProperty === "function"
    ) {
      try {
        plus.runtime.getProperty(
          plus.runtime.appid,
          function (info) {
            // info 里通常含有 version/versionCode 等字段
            proceedWithInfo(info);
          },
          function (err) {
            console.warn(
              "plus.runtime.getProperty 失败，回退到 plus.runtime 字段：",
              errToString(err),
            );
            proceedWithInfo(null);
          },
        );
      } catch (e) {
        console.warn(
          "调用 plus.runtime.getProperty 异常，回退：",
          errToString(e),
        );
        proceedWithInfo(null);
      }
    } else {
      // 没有 getProperty 时直接回退到 plus.runtime
      proceedWithInfo(null);
    }
  }

  // 下载 WGT 文件
  function downloadWgt(wgtUrl) {
    console.log("进入下载", wgtUrl);
    if (!window.plus || !plus.downloader) {
      layer.msg("当前环境不支持下载");
      return;
    }
    var tipIndex = layer.msg("下载中...", { icon: 16, shade: 0.3, time: 0 });
    var downloadTask = plus.downloader.createDownload(
      wgtUrl,
      {},
      function (download, status) {
        if (status === 200) {
          layer.close(tipIndex);
          layer.msg("安装中...", { icon: 16, shade: 0.3, time: 0 });
          installWgt(download.filename);
        } else {
          layer.close(tipIndex);
          console.error("下载失败，状态：" + status);
          layer.msg("下载失败（状态 " + status + "）", { icon: 2 });
        }
      },
    );
    downloadTask.start();
  }

  // 安装 WGT 文件
  function installWgt(path) {
    layer.msg("安装中...", { icon: 16, shade: 0.3, time: 0 });
    plus.runtime.install(
      path,
      {},
      () => {
        layer.closeAll("msg");
        layer.msg("安装完成，即将重启", { icon: 1, time: 1200 }, function () {
          plus.runtime.restart();
        });
      },
      (err) => {
        layer.closeAll("msg");
        console.error("安装失败：", errToString(err));
        layer.alert("安装失败：" + errToString(err), { icon: 2 });
      },
    );
  }

  // 初始化5+功能（检查更新和返回键监听）
  function initPlusFeatures() {
    console.log("初始化5+功能");
    checkUpdate();

    // 监听移动端返回键，弹窗确认是否退出
    if (plus.key) {
      plus.key.addEventListener(
        "backbutton",
        function () {
          layer.confirm(
            "确认退出应用？",
            {
              icon: 3,
              title: "提示",
              btn: ["确定", "取消"],
            },
            function (index) {
              // 确定退出
              layer.close(index);
              plus.runtime.quit();
            },
            function (index) {
              // 取消
              layer.close(index);
            },
          );
        },
        false,
      );
    }
  }

  // 页面加载完成后检查更新
  if (window.plus) {
    // plus 已经存在（可能是页面刷新或二次加载），直接初始化
    console.log("plus 已存在，直接初始化");
    initPlusFeatures();
  } else {
    // 非5+环境：从 manifest.json 读取版本号用于展示
    fetch("./manifest.json", { cache: "no-cache" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (json) {
        var v = json && json.version && json.version.name;
        if (v) {
          $("#version").text("V " + v);
        }
      })
      .catch(function () {
        // 忽略错误，保持空
      });
    // 监听 plusready 事件
    document.addEventListener(
      "plusready",
      function () {
        console.log("plusready 事件触发");
        initPlusFeatures();
      },
      false,
    );
  }

  // 检查localStorage中是否有保存的API地址
  var savedApiUrl = localStorage.getItem("api_url");
  if (savedApiUrl) {
    appconfig.api = savedApiUrl;
  }
  // 设置图标点击事件
  $("#setting-btn").on("click", function () {
    var currentApiUrl =
      localStorage.getItem("api_url") || "https://www.annotokyo.fun:8123";
    layer.open({
      type: 1,
      title: "API设置",
      area: ["400px", "250px"],
      content:
        '<div style="padding: 20px;">' +
        '<div class="layui-form-item">' +
        '<label class="layui-form-label">API地址:</label>' +
        '<div class="layui-input-block">' +
        '<input type="text" id="modal-api-url" placeholder="请输入API地址" class="layui-input" value="' +
        currentApiUrl +
        '">' +
        "</div>" +
        "</div>" +
        "</div>",
      btn: ["保存", "重置", "取消"],
      btn1: function (index) {
        var newApiUrl = $("#modal-api-url").val().trim();
        if (newApiUrl) {
          localStorage.setItem("api_url", newApiUrl);
          appconfig.api = newApiUrl;
          layer.msg("API地址已保存", { icon: 1 });
          layer.close(index);
        } else {
          layer.msg("请输入有效的API地址", { icon: 2 });
        }
      },
      btn2: function () {
        $("#modal-api-url").val("https://www.annotokyo.fun:8123");
        return false; // 不关闭弹窗
      },
      btn3: function (index) {
        layer.close(index);
      },
    });
  });

  // 登录过期的时候，跳出ifram框架
  if (top.location != self.location) top.location = self.location;

  $(".icon-nocheck").on("click", function () {
    if ($(this).hasClass("icon-check")) {
      $(this).removeClass("icon-check");
    } else {
      $(this).addClass("icon-check");
    }
  });
  var loginUserData = localStorage.getItem("loginUserList");

  var showLoginList = [];
  if (loginUserData != null) {
    showLoginList = JSON.parse(loginUserData);
  }

  //自定义事件 - mousedown
  dropdown.render({
    elem: "#existname",
    trigger: "mousedown",
    //, data: [{
    //    title: 'test1'
    //    , id: 100
    //}, {
    //    title: 'test2'
    //    , id: 101
    //}, {
    //    title: 'test3'
    //    , id: 102
    //}],
    data: showLoginList,
    click: function (obj) {
      $("#username").val(obj.title);
      layui.jquery("input[name='username']").val(obj.title);
      this.elem.find("span").text(obj.title);
    },
  });
  // 进行登录操作
  form.on("submit(login)", function (data) {
    data = data.field;
    var username = data.username;
    var password = encodeURIComponent(data.password);
    var apiurl = appconfig.api; // 使用当前设置的API地址

    if (data.username == "") {
      layer.msg("用户名不能为空");
      return false;
    }

    // 确保有有效的API地址
    if (!apiurl || apiurl.trim() === "") {
      layer.msg("请先设置API地址");
      return false;
    }

    //if (data.password == '') {
    //    layer.msg('密码不能为空');
    //    return false;
    //}
    //if (data.captcha == '') {
    //    layer.msg('验证码不能为空');
    //    return false;
    //}

    $.ajax({
      //绑定病区列表
      url:
        apiurl +
        "/api/MobileWard/GetLoginUser?uname=" +
        data.username +
        "&pwd=" +
        password +
        "&subsys_id=" +
        (data.username == "super" ? "zy_wpws" : appconfig.subsys_id), //   获取控制器URL地址
      type: "get",
      dataType: "json",
      success: function (data) {
        if (data.Data.length > 0) {
          //layer.msg(JSON.stringify(data));

          localStorage.setItem("loginUser", JSON.stringify(data.Data[0]));
          layer.msg("登录成功");
          //保存登录名

          var loginlist;
          var arr = {
            title: username,
            id: password,
          };
          if (loginUserData === null) {
            loginlist = new Array(); //创建一个数组
            loginlist.push(arr);
            localStorage.setItem("loginUserList", JSON.stringify(loginlist));
          } else {
            loginlist = JSON.parse(loginUserData);
            var isExist = false;
            $.each(loginlist, function (i, item) {
              if (item.title === username) {
                isExist = true;
              }
            });
            if (isExist === false) {
              loginlist.push(arr);
              localStorage.setItem("loginUserList", JSON.stringify(loginlist));
            }
          }

          setTimeout(function () {
            // window.location = "view/wardlist.html";
            window.location = "home.html";
          }, 1000);
        } else {
          layer.msg("用户名或密码不正确。");
        }
      },
      error: function (data) {
        layer.msg("访问数据失败！请检查网络链接是否畅通。");
      },
    });
    return false;
  });
});
// 替换当前历史记录
history.replaceState(null, null, location.href);

// 监听浏览器前进后退按钮事件
window.onpopstate = function (event) {
  history.replaceState(null, null, location.href);
};
