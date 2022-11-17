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
        {
          text: "基础",
          prefix: "basis/",
          icon: "basic",
          collapsible: true,
          children: [
            {
              text: "重要知识点",
              icon: "star",
              collapsible: true,
              children: [
                "why-there-only-value-passing-in-java",
                "serialization",
                "generics-and-wildcards",
                "reflection",
                "proxy",
                "bigdecimal",
                "unsafe",
                "spi",
                "syntactic-sugar",
              ],
            },
          ],
        },
        {
          text: "集合",
          prefix: "collection/",
          icon: "container",
          children: [
            "java-collection-questions-01",
            "java-collection-questions-02",
            "java-collection-precautions-for-use",
            {
              text: "源码分析",
              icon: "star",
              collapsible: true,
              children: [
                "arraylist-source-code",
                "hashmap-source-code",
                "concurrent-hash-map-source-code",
              ],
            },
          ],
        },

        {
          text: "IO",
          prefix: "io/",
          icon: "code",
          children: ["io-basis", "io-design-patterns", "io-model"],
        },
        {
          text: "并发编程",
          prefix: "concurrent/",
          icon: "et-performance",
          children: [
            "java-concurrent-questions-01",
            "java-concurrent-questions-02",
            "java-concurrent-questions-03",
            {
              text: "重要知识点",
              icon: "star",
              collapsible: true,
              children: [
                "jmm",
                "java-thread-pool-summary",
                "java-thread-pool-best-practices",
                "java-concurrent-collections",
                "aqs",
                "atomic-classes",
                "threadlocal",
                "completablefuture-intro",
              ],
            },
          ],
        },
        {
          text: "JVM",
          prefix: "jvm/",
          icon: "virtual_machine",
          collapsible: true,
          children: [
            "memory-area",
            "jvm-garbage-collection",
            "class-file-structure",
            "class-loading-process",
            "classloader",
            "jvm-parameters-intro",
            "jvm-intro",
            "jdk-monitoring-and-troubleshooting-tools",
          ],
        },
        {
          text: "新特性",
          prefix: "new-features/",
          icon: "featured",
          collapsible: true,
          children: [
            "java8-common-new-features",
            "java8-tutorial-translate",
            "java9",
            "java10",
            "java11",
            "java12-13",
            "java14",
            "java15",
            "java16",
            "java17",
            "java18",
            "java19",
          ],
        },
      ],
    },
    {
      text: "数据库",
      icon: "database",
      prefix: "database/",
      collapsible: true,
      children: [
        {
          text: "基础",
          icon: "basic",
          collapsible: true,
          children: ["basis", "character-set"],
        },
        {
          text: "MySQL",
          prefix: "mysql/",
          icon: "mysql",
          collapsible: true,
          children: [
            "mysql-questions-01",
            "mysql-high-performance-optimization-specification-recommendations",
            {
              text: "重要知识点",
              icon: "star",
              collapsible: true,
              children: [
                "mysql-index",
                "mysql-logs",
                "transaction-isolation-level",
                "innodb-implementation-of-mvcc",
                "how-sql-executed-in-mysql",
                "some-thoughts-on-database-storage-time",
                "index-invalidation-caused-by-implicit-conversion",
              ],
            },
          ],
        },
        {
          text: "Redis",
          prefix: "redis/",
          icon: "redis",
          collapsible: true,
          children: [
            "cache-basics",
            "redis-questions-01",
            "redis-questions-02",
            {
              text: "重要知识点",
              icon: "star",
              collapsible: true,
              children: [
                "3-commonly-used-cache-read-and-write-strategies",
                "redis-data-structures-01",
                "redis-data-structures-02",
                "redis-memory-fragmentation",
                "redis-cluster",
              ],
            },
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
        {
          text: "Git",
          icon: "git",
          prefix: "git/",
          collapsible: true,
          children: ["git-intro", "github-tips"],
        },
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