import { defineConfig } from "vite";
import { resolve } from "path";
// copy static folders into `dist` during build
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    // 使用插件把额外的静态资源文件夹直接复制到输出目录
    rollupOptions: {
      input: {
        login: resolve(__dirname, "index.html"),
        home: resolve(__dirname, "home.html"),
        patient: resolve(__dirname, "view/patient.html"),
        wardlist: resolve(__dirname, "view/wardlist.html"),
        edoclist: resolve(__dirname, "view/edoclist.html"),
        jc_apply: resolve(__dirname, "view/jc_apply.html"),
        jy_apply: resolve(__dirname, "view/jy_apply.html"),
        oplist: resolve(__dirname, "view/oplist.html"),
        yizhu: resolve(__dirname, "view/yizhu.html"),
        nursing: resolve(__dirname, "view/nursing.html"),
        add_order: resolve(__dirname, "view/add_order.html"),
        ward_records: resolve(__dirname, "view/ward_records.html"),
        patients: resolve(__dirname, "navpage/patients.html"),
        contacts: resolve(__dirname, "navpage/contacts.html"),
        message: resolve(__dirname, "navpage/message.html"),
        workbench: resolve(__dirname, "navpage/workbench.html"),
        my: resolve(__dirname, "navpage/my.html"),
      },
    },
  },
  plugins: [
    // 关键：使用静态复制插件将js文件夹复制到dist根目录
    viteStaticCopy({
      targets: [
        {
          src: "js/**/*", // 复制js文件夹及其所有内容
          dest: "./js", // 目标为dist根目录
        },
      ],
    }),
  ],
  server: {
    open: "/index.html",
    port: 5173,
  },
});
