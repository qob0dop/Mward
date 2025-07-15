/**
  扩展一个http模块
**/

layui.define(function (exports) { //提示：模块也可以依赖其它模块，如：layui.define('layer', callback);
    var obj = {
        api: "http://10.102.41.142:5105",  //根据自己项目的端口而定
        twd_webpage: "http://10.102.38.186:8801",
        subsys_id:"zy_wpws2"
    };

    //输出test接口
    exports('appconfig', obj);
});

