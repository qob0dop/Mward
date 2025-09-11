import { defineConfig } from "vite";
import { resolve } from "path";
// copy static folders into `dist` during build
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  root: ".",
  base: "./",
  // 将常用的静态资源文件夹原样复制到 dist 中，按需修改 folders 列表
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'api/**', dest: 'api' },
        { src: 'images/**', dest: 'images' },
        { src: 'css/**', dest: 'css' },
        { src: 'js/**', dest: 'js' },
        { src: 'lib/**', dest: 'lib' },
        // 如果你有其他自定义静态文件夹，按 { src: 'myfolder/**', dest: 'myfolder' } 增加即可
      ]
    })
  ],
  build: {
    outDir: "dist",
    // 使用插件把额外的静态资源文件夹直接复制到输出目录
    rollupOptions: {
      input: {
        main: resolve(__dirname, "main.html"),
        login: resolve(__dirname, "index.html"),
        patient: resolve(__dirname, "view/patient.html"),
        wardlist: resolve(__dirname, "view/wardlist.html"),
        edoclist: resolve(__dirname, "view/edoclist.html"),
        jc_apply: resolve(__dirname, "view/jc_apply.html"),
        jy_apply: resolve(__dirname, "view/jy_apply.html"),
        oplist: resolve(__dirname, "view/oplist.html"),
        yizhu: resolve(__dirname, "view/yizhu.html"),
        ward_records: resolve(__dirname, "view/ward_records.html"),
      }
    }
  },
  server: {
    open: "/index.html",
    port: 5173,
  },
});
