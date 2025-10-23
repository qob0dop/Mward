// WebSocket 配置文件
const WS_CONFIG = {
  // WebSocket 服务器地址
  WS_BASE: "ws://localhost:5251/ws",

  // API 服务器地址
  API_BASE: "http://localhost:5251/api",

  // 心跳间隔（毫秒）
  HEARTBEAT_INTERVAL: 30000,

  // 重连间隔（毫秒）
  RECONNECT_INTERVAL: 5000,

  // 是否启用桌面通知
  ENABLE_DESKTOP_NOTIFICATION: true,

  // 是否启用声音提示
  ENABLE_SOUND_NOTIFICATION: true,

  // 是否启用自动重连
  ENABLE_AUTO_RECONNECT: true,
};

// 如果在生产环境，自动切换到生产服务器地址
if (
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  WS_CONFIG.WS_BASE = `ws://${window.location.hostname}:5251/ws`;
  WS_CONFIG.API_BASE = `http://${window.location.hostname}:5251/api`;
}
