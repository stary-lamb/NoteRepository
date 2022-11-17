import { defineClientConfig } from "@vuepress/client";
import { h } from "vue";

import { useStyleTag } from "F:/知识库/NoteRepository/docs/node_modules/vuepress-plugin-components/lib/client/vueuse.js";
import Badge from "F:/知识库/NoteRepository/docs/node_modules/vuepress-plugin-components/lib/client/components/Badge.js";
import FontIcon from "F:/知识库/NoteRepository/docs/node_modules/vuepress-plugin-components/lib/client/components/FontIcon.js";
import BackToTop from "F:/知识库/NoteRepository/docs/node_modules/vuepress-plugin-components/lib/client/components/BackToTop.js";


export default defineClientConfig({
  enhance: ({ app }) => {
    app.component("Badge", Badge);
    app.component("FontIcon", FontIcon);
    
  },
  setup: () => {
    useStyleTag(`@import url("//at.alicdn.com/t/c/font_3372836_h6iwyh0er3.css");`, { id: "icon-assets" });
    
  },
  rootComponents: [
    () => h(BackToTop, { threshold: 300 }),
    
  ],
});
