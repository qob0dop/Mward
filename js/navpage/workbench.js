// 处理移动端返回键（在 iframe 子页面中）
window.addEventListener(
  "message",
  function (event) {
    // 检查是否有打开的 layer 弹层
    if (event.data && event.data.type === "back") {
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
layui.use(["element", "layer"], function () {
  const $ = layui.$;
  $("#consult").on("click", function () {
    location.href = "/worktools/consult.html";
  });
});
