import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  locales: {
    "/": {
      lang: "zh-CN",
      title: "Java学习之路",
      description: "学习笔记&个人总结",
    },
  },

  theme,

  shouldPrefetch: false,
});
