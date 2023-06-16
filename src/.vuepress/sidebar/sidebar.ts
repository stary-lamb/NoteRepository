import {sidebar} from "vuepress-theme-hope";
import {project} from "./project.js";

export default sidebar({
    "/project": project,
    // 必须放在最后面
    "/": [
        {
            text: "Java",
            icon: "java",
            collapsible: true,
            prefix: "java/",
            children: [
                {
                    text: "集合",
                    prefix: "collection/",
                    icon: "collection",
                    collapsible: true,
                    children: [
                        "前言",
                        "ArrayList源码解析",
                        "LinkedList源码解析",
                        "HashMap源码解析",
                        "ConcurrentHashMap源码解析"
                    ],
                },
                // {
                //   text: "IO",
                //   prefix: "io/",
                //   icon: "code",
                //   children: ["io-basis", "io-design-patterns", "io-model"],
                // },
                {
                    text: "并发编程",
                    prefix: "juc/",
                    icon: "gaobingfa",
                    collapsible: true,
                    children: [
                        "JUC思维导图",
                        "多线程基础",
                        "FutureTask & CompletableFuture",
                        "Java内存模型-JMM",
                        "volatile",
                        "CAS",
                        "原子操作类",
                        "Threadlocal",
                        "AQS",
                        "线程中断与LockSupport",
                        "Java锁",
                        "Java对象内存布局和对象头",
                        "Synchronized",
                        "ReentrantLock",
                        "ReentrantReadWriteLock",
                        "StampedLock",
                    ],
                },
                {
                    text: "JVM",
                    prefix: "jvm/",
                    icon: "jvm",
                    collapsible: true,
                    children: [
                        "类加载子系统",
                        "运行时内存",
                        "垃圾回收",
                        "执行引擎",
                        "对象内存布局"
                    ],
                },
                {
                    text: "新特性",
                    prefix: "new",
                    icon: "new",
                    collapsible: true,
                    children: [
                        "函数式编程",
                    ],
                },
            ],
        },
        {
            text: "数据库",
            icon: "odbc",
            prefix: "database/",
            collapsible: true,
            children: [
                {
                    text: "MySQL",
                    prefix: "mysql/",
                    icon: "MySQL",
                    collapsible: true,
                    children: [
                        {
                            text: "MySQL基础",
                            prefix: "basic/",
                            icon: "jichushuju",
                            collapsible: true,
                            children: [
                                "MySQL基础操作",
                                "MySQL增删改查",
                                "MySQL数据类型",
                                "运算符",
                                "排序与分页",
                                "多表查询",
                                "子查询",
                                "单行函数",
                                "聚合函数",
                                "约束",
                                "视图",
                                "存储过程",
                                "触发器",
                                "变量、流程控制与游标"
                            ],
                        },
                    ],
                },
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
            text: "消息队列",
            icon: "MQ",
            prefix: "mq/",
            collapsible: true,
            children: [
                {
                    text: "RabbitMQ",
                    link: "RabbitMQ",
                    icon: "rabbitmq",
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
        {
            text: "设计模式",
            icon: "sheji-xianxing",
            collapsible: true,
            prefix: "design/",
            children: [
                "前言",
                "六大原则",
                "工厂模式",
                "抽象工厂模式",
                "建造者模式",
                "原型模式",
                "单例模式",
                "适配器模式",
                "桥接模式",
                "组合模式",
                "装饰器模式",
                "外观模式",
                "享元模式",
                "代理模式",
                "责任链模式",
                "命令模式",
                "迭代器模式",
                "中介模式",
                "备忘录模式",
                "观察者模式",
                "状态模式",
                "策略模式",
                "模板模式",
                "访问者模式"
            ],
        }
    ],
});