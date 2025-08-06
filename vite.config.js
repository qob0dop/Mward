import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
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
      },
    },
  },
  server: {
    open: "/index.html",
    port: 5173,
  },
});
