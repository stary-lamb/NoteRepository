import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/NoteRepository/",

  locales: {
    "/": {
      lang: "zh-CN",
      title: "",
      description: "学习笔记&个人总结",
    },
  },

  theme,

  shouldPrefetch: false,
});
