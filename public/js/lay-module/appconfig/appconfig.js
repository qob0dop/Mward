/**
  扩展一个http模块
**/

layui.define(function (exports) {
  //提示：模块也可以依赖其它模块，如：layui.define('layer', callback);

  // 检查localStorage中是否有保存的API地址
  var savedApiUrl = localStorage.getItem("api_url");
  var defaultApi = "http://10.102.41.142:5250"; // 默认API地址

  var obj = {
    // api: "http://10.102.41.142:5105", //根据自己项目的端口而定
    api: savedApiUrl || defaultApi, // 优先使用保存的API地址，没有则用默认值
    twd_webpage: "http://10.102.38.186:8801",
    subsys_id: "zy_wpws2",
  };

  //输出test接口
  exports("appconfig", obj);
});
