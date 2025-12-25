// 全局变量，缓存已创建的 iframe
const iframeCache = {};
let currentIframe = "patients"; // 当前显示的 iframe
let buttons = null;
let mainContent = null;

// 映射 target -> url
const urlMap = {
  message: "navpage/message.html",
  patients: "navpage/patients.html",
  workbench: "navpage/workbench.html",
  contacts: "navpage/contacts.html",
  my: "navpage/my.html",
};

// 全局函数：切换 iframe
function showFrame(target) {
  const targetBtn = document.querySelector(
    `.nav-item[data-target="${target}"]`
  );
  // 先移除所有按钮的主题色
  if (buttons) {
    buttons.forEach((btn) => btn.classList.remove("theme-color"));
  }
  // 再给当前按钮添加主题色
  if (targetBtn) {
    targetBtn.classList.add("theme-color");
  }
  // 如果没有对应 url，回退到 message
  const url = urlMap[target] || urlMap["message"];

  // 隐藏所有已存在的 iframe
  Object.keys(iframeCache).forEach((key) => {
    iframeCache[key].style.display = "none";
  });
  console.log("切换到页面:", target, "当前页面:", currentIframe);
  if (currentIframe != target) {
    // 如果已经创建，直接显示（保持页面状态）
    console.log("当前页面已切换，显示缓存的 iframe:", target);
    if (iframeCache[target]) {
      console.log("页面已缓存");

      iframeCache[target].style.display = "block";
      currentIframe = target; // 每次切换都同步当前 iframe
      return;
    }
  }

  // 否则懒加载创建 iframe 并缓存
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.setAttribute("loading", "lazy");
  iframe.dataset.target = target;
  // 可根据需要添加 sandbox 属性，例如: sandbox="allow-scripts allow-same-origin"
  iframe.style.display = "block";
  currentIframe = target; // 每次切换都同步当前 iframe

  if (mainContent) {
    mainContent.appendChild(iframe);
    iframeCache[target] = iframe;
  }
}

// 监听来自子 iframe 的消息
window.addEventListener("message", function (event) {
  // 处理切换标签页的请求
  if (event.data && event.data.type === "switchTab") {
    const target = event.data.target;
    const action = event.data.action;

    // 切换到目标页面
    showFrame(target);

    // 等待 iframe 加载完成后，发送动作指令
    setTimeout(function () {
      const targetIframe = iframeCache[target];
      if (targetIframe && targetIframe.contentWindow) {
        targetIframe.contentWindow.postMessage(
          {
            type: "action",
            action: action,
          },
          "*"
        );
      }
    }, 100); // 延迟确保 iframe 已加载
  }
});

document.addEventListener("plusready", function () {
  plus.key.addEventListener(
    "backbutton",
    function () {
      // 方法1: 通过 currentIframe 变量查找
      const iframe = iframeCache[currentIframe];

      // 方法2: 或者直接查找当前显示的 iframe（display: block）
      // const iframe = document.querySelector('#main-content iframe[style*="display: block"]');

      if (iframe) {
        iframe.contentWindow.postMessage({ type: "back" }, "*");
      } else {
        console.log("未找到当前 iframe:", currentIframe);
      }
    },
    false
  );
});

document.addEventListener("DOMContentLoaded", function () {
  buttons = document.querySelectorAll(".nav-item");
  mainContent = document.getElementById("main-content");

  // 绑定按钮
  buttons.forEach((button) => {
    button.addEventListener("click", function () {
      const target = this.getAttribute("data-target");
      showFrame(target);
    });
  });

  // 默认显示
  showFrame("patients");
});
