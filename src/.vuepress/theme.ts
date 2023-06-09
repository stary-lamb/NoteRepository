import { hopeTheme } from "vuepress-theme-hope";
import { navbarConfig } from "./navbar.js";
import sidebar from "./sidebar/sidebar";

export default hopeTheme({
  // hostname: "https://vuepress-theme-hope-docs-demo.netlify.app",

  author: {
    name: "柒加壹",
  },

  iconAssets: "//at.alicdn.com/t/c/font_3372836_s4petv7z3c.css",

  logo: "/logo.png",

  repo: "https://github.com/stary-lamb/NoteRepository",

  docsDir: "docs",

  pageInfo: [
    "Author",
    "Category",
    "Tag",
    "Date",
    "Original",
    "Word",
    "ReadingTime",
  ],

  navbar: navbarConfig,

  sidebar: sidebar,
  footer:'',
  displayFooter: true,
  plugins: {
    // Disable features you don’t want here
    mdEnhance: {
      align: true,
      attrs: true,
      chart: true,
      codetabs: true,
      container: true,
      demo: true,
      echarts: true,
      flowchart: true,
      gfm: true,
      imageLazyload: true,
      imageTitle: true,
      imageSize: true,
      include: true,
      katex: true,
      mark: true,
      mermaid: true,
      playground: {
        presets: ["ts", "vue"],
      },
      presentation: {
        plugins: ["highlight", "math", "search", "notes", "zoom"],
      },
      sub: true,
      sup: true,
      tabs: true,
      vPre: true,
      vuePlayground: true,
    },
  },
});
