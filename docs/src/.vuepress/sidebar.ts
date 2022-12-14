import { sidebar } from "vuepress-theme-hope";


export const sidebarConfig = sidebar({
  // 必须放在最后面
  "/": [
    {
      text: "Java",
      icon: "java",
      collapsible: true,
      prefix: "java/",
      children: [
        // {
        //   text: "基础",
        //   prefix: "basis/",
        //   icon: "basic",
        //   collapsible: true,
        //   children: [
        //     {
        //       text: "重要知识点",
        //       icon: "star",
        //       collapsible: true,
        //       children: [
        //         "why-there-only-value-passing-in-java",
        //         "serialization",
        //         "generics-and-wildcards",
        //         "reflection",
        //         "proxy",
        //         "bigdecimal",
        //         "unsafe",
        //         "spi",
        //         "syntactic-sugar",
        //       ],
        //     },
        //   ],
        // },
        // {
        //   text: "集合",
        //   prefix: "collection/",
        //   icon: "container",
        //   children: [
        //     "java-collection-questions-01",
        //     "java-collection-questions-02",
        //     "java-collection-precautions-for-use",
        //     {
        //       text: "源码分析",
        //       icon: "star",
        //       collapsible: true,
        //       children: [
        //         "arraylist-source-code",
        //         "hashmap-source-code",
        //         "concurrent-hash-map-source-code",
        //       ],
        //     },
        //   ],
        // },

        // {
        //   text: "IO",
        //   prefix: "io/",
        //   icon: "code",
        //   children: ["io-basis", "io-design-patterns", "io-model"],
        // },
        // {
        //   text: "并发编程",
        //   prefix: "concurrent/",
        //   icon: "et-performance",
        //   children: [
        //     "java-concurrent-questions-01",
        //     "java-concurrent-questions-02",
        //     "java-concurrent-questions-03",
        //     {
        //       text: "重要知识点",
        //       icon: "star",
        //       collapsible: true,
        //       children: [
        //         "jmm",
        //         "java-thread-pool-summary",
        //         "java-thread-pool-best-practices",
        //         "java-concurrent-collections",
        //         "aqs",
        //         "atomic-classes",
        //         "threadlocal",
        //         "completablefuture-intro",
        //       ],
        //     },
        //   ],
        // },
        // {
        //   text: "JVM",
        //   prefix: "jvm/",
        //   icon: "virtual_machine",
        //   collapsible: true,
        //   children: [
        //     "memory-area",
        //     "jvm-garbage-collection",
        //     "class-file-structure",
        //     "class-loading-process",
        //     "classloader",
        //     "jvm-parameters-intro",
        //     "jvm-intro",
        //     "jdk-monitoring-and-troubleshooting-tools",
        //   ],
        // },
        // {
        //   text: "新特性",
        //   prefix: "new-features/",
        //   icon: "featured",
        //   collapsible: true,
        //   children: [
        //     "java8-common-new-features",
        //     "java8-tutorial-translate",
        //     "java9",
        //     "java10",
        //     "java11",
        //     "java12-13",
        //     "java14",
        //     "java15",
        //     "java16",
        //     "java17",
        //     "java18",
        //     "java19",
        //   ],
        // },
      ],
    },
    {
      text: "数据库",
      icon: "odbc",
      prefix: "database/",
      collapsible: true,
      children: [
        // {
        //   text: "MySQL",
        //   prefix: "mysql/",
        //   icon: "MySQL",
        //   collapsible: true,
        //   children: [],
        // },
        {
          text: "Redis",
          prefix: "redis/",
          icon: "Redis",
          collapsible: true,
          children: [
            "Redis思维导图",
            "Redis线程模型与IO多路复用",
            "Redis数据结构",
            "Redis基本数据类型及使用场景",
            "Redis布隆过滤器",
            "Redis缓存雪崩、缓存穿透、缓存击穿",
            "Redis分布式锁",
            "Redis键过期与淘汰",
            "Redis缓存双写一致性",
            "RedisAOF和RDB",
            "Redis三大集群模式",
            "Redis最佳实践",
            "多级缓存"
          ],
        },
      ],
    },
    {
      text: "开发工具",
      icon: "kaifagongju",
      prefix: "tools/",
      collapsible: true,
      children: [
        // {
        //   text: "Git",
        //   icon: "git",
        //   prefix: "git/",
        //   collapsible: true,
        //   children: ["git-intro", "github-tips"],
        // },
        {
          text: "Docker",
          icon: "docker",
          prefix: "docker/",
          collapsible: true,
          children: ["Docker安装", "Docker安装常用环境"],
        },
      ],
    },
  ],
});