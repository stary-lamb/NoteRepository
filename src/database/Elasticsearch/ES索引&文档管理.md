---
title: ElasticSearch 索引&文档管理
date: 2023-06-30
---

## 索引管理

索引就类似数据库表，mapping映射就类似表的结构。

我们要向es中存储数据，必须先创建"库" 和 "表"。

### mapping 映射

mapping是对索引库中文档的约束，常见的mapping属性包括：

- type：字段数据类型，常见的简单类型有：
  - 字符串：text（可分词的文本）、keyword（精确值，例如：品牌、国家、ip地址）
  - 数值：long、integer、short、byte、double、float、
  - 布尔：boolean
  - 日期：date
  - 对象：object
- index：是否创建索引，默认为true
- analyzer：使用哪种分词器
- properties：该字段的子字段

例如下面的json文档：

~~~ json
{
    "age": 21,
    "weight": 52.1,
    "isMarried": false,
    "info": "黑马程序员Java讲师",
    "email": "zy@itcast.cn",
    "score": [99.1, 99.5, 98.9],
    "name": {
        "firstName": "云",
        "lastName": "赵"
    }
}
~~~

对应的每个字段映射（mapping）：

- age：类型为 integer；参与搜索，因此需要index为true；无需分词器
- weight：类型为float；参与搜索，因此需要index为true；无需分词器
- isMarried：类型为boolean；参与搜索，因此需要index为true；无需分词器
- info：类型为字符串，需要分词，因此是text；参与搜索，因此需要index为true；分词器可以用ik_smart
- email：类型为字符串，但是不需要分词，因此是keyword；不参与搜索，因此需要index为false；无需分词器
- score：虽然是数组，但是我们只看元素的类型，类型为float；参与搜索，因此需要index为true；无需分词器
- name：类型为object，需要定义多个子属性
  - name.firstName；类型为字符串，但是不需要分词，因此是keyword；参与搜索，因此需要index为true；无需分词器
  - name.lastName；类型为字符串，但是不需要分词，因此是keyword；参与搜索，因此需要index为true；无需分词器

那么如果我们需要对这个建立索引的过程做更多的控制：比如想要确保这个索引有数量适中的主分片，并且在我们索引任何数据之前，分析器和映射已经被建立好。那么就会引入两点：第一个**禁止自动创建索引**，第二个是**手动创建索引**。

- 禁止自动创建索引

可以通过在 config/elasticsearch.yml 的每个节点下添加下面的配置：

~~~ shell
action.auto_create_index: false
~~~

### 索引的格式

在请求体里面传入设置或类型映射，如下所示：

~~~ json
PUT /my_index
{
    "settings": { ... any settings ... },
    "mappings": {
        "properties": { ... any properties ... }
    }
}
~~~

- **settings**: 用来设置分片,副本等配置信息
- **mappings**: 字段映射，类型等
  - **properties**: 由于type在后续版本中会被Deprecated, 所以无需被type嵌套

### 索引管理操作

#### 创建索引

- **基本语法：**
  - 请求方式：PUT
  - 请求路径：/索引库名，可以自定义
  - 请求参数：mapping映射

我们创建一个user 索引`test-index-users`，其中包含三个属性：name，age, remarks; 存储在一个分片一个副本上。

~~~ json
PUT /test-index-users
{
  "settings": {
		"number_of_shards": 1,
		"number_of_replicas": 1
	},
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "age": {
        "type": "long"
      },
      "remarks": {
        "type": "text"
      }
    }
  }
}
~~~

执行结果

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307010956806.png)

#### 修改索引

查看刚才的索引,`curl 'localhost:9200/_cat/indices?v' | grep users`

~~~ shell
yellow open test-index-users                          LSaIB57XSC6uVtGQHoPYxQ 1 1     1    0   4.4kb   4.4kb
~~~

我们注意到刚创建的索引的状态是yellow的，因为我测试的环境是单点环境，无法创建副本，但是在上述`number_of_replicas`配置中设置了副本数是1； 所以在这个时候我们需要修改索引的配置。

修改副本数量为0

~~~  json
PUT /test-index-users/_settings
{
  "settings": {
    "number_of_replicas": 0
  }
}
~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307010959896.png)

再次查看状态

~~~ shell
green open test-index-users                          LSaIB57XSC6uVtGQHoPYxQ 1 1     1    0   4.4kb   4.4kb
~~~

> ps：倒排索引结构虽然不复杂，但是一旦数据结构改变（比如改变了分词器），就需要重新创建倒排索引，这简直是灾难。因此索引库**一旦创建，无法修改mapping**。
>
> 虽然无法修改mapping中已有的字段，但是却允许添加新的字段到mapping中，因为不会对倒排索引产生影响。
>
> ~~~ json
> PUT /索引库名/_mapping
> {
>   "properties": {
>     "新字段名":{
>       "type": "integer"
>     }
>   }
> }
> ~~~

#### 打开/关闭索引

- **关闭索引**

一旦索引被关闭，那么这个索引只能显示元数据信息，**不能够进行读写操作**。

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011017945.png)

当关闭以后，再插入数据时：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011017322.png)

- **打开索引**

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011017144.png)

打开后又可以重新写数据了

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011017523.png)

#### 查看索引

**基本语法**：

- 请求方式：GET

- 请求路径：/索引库名

- 请求参数：无

**格式**：

~~~ shell
GET /索引库名
~~~

#### 删除索引

**语法：**

- 请求方式：DELETE
- 请求路径：/索引库名
- 请求参数：无

**格式：**

~~~ shell
DELETE /索引库名
~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011019048.png)

#### Kibana管理索引

在Kibana如下路径，我们可以查看和管理索引

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011021881.png)

#### 总结

- 创建索引库：PUT /索引库名
- 查询索引库：GET /索引库名
- 删除索引库：DELETE /索引库名
- 添加字段：PUT /索引库名/_mapping

## 索引模板

索引模板是一种告诉Elasticsearch在创建索引时如何配置索引的方法。

- **使用方式**

  在创建索引之前可以先配置模板，这样在创建索引（手动创建索引或通过对文档建立索引）时，模板设置将用作创建索引的基础

### 模板类型

模板有两种类型：**索引模板**和**组件模板**。

1. **组件模板**是可重用的构建块，用于配置映射，设置和别名；它们不会直接应用于一组索引。
2. **索引模板**可以包含组件模板的集合，也可以直接指定设置，映射和别名。

### 索引模板中的优先级

1. 可组合模板优先于旧模板。如果没有可组合模板匹配给定索引，则旧版模板可能仍匹配并被应用。

2. 如果使用显式设置创建索引并且该索引也与索引模板匹配，则创建索引请求中的设置将优先于索引模板及其组件模板中指定的设置。

3. 如果新数据流或索引与多个索引模板匹配，则使用优先级最高的索引模板

### 内置索引模板

ElasticSearch具有内置索引模板，每个索引模板的优先级为100，适用于以下索引模式：

1. `logs-*-*`
2. `metrics-*-*`
3. `synthetics-*-*`

### 案例

- 首先**创建两个索引组件模板**：

~~~ json
PUT _component_template/component_template1
{
  "template": {
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        }
      }
    }
  }
}

PUT _component_template/runtime_component_template
{
  "template": {
    "mappings": {
      "runtime": { 
        "day_of_week": {
          "type": "keyword",
          "script": {
            "source": "emit(doc['@timestamp'].value.dayOfWeekEnum.getDisplayName(TextStyle.FULL, Locale.ROOT))"
          }
        }
      }
    }
  }
}
~~~

执行结果如下

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011026223.png)

- **创建使用组件模板的索引模板**

~~~~ json
PUT _index_template/template_1
{
  "index_patterns": ["bar*"],
  "template": {
    "settings": {
      "number_of_shards": 1
    },
    "mappings": {
      "_source": {
        "enabled": true
      },
      "properties": {
        "host_name": {
          "type": "keyword"
        },
        "created_at": {
          "type": "date",
          "format": "EEE MMM dd HH:mm:ss Z yyyy"
        }
      }
    },
    "aliases": {
      "mydata": { }
    }
  },
  "priority": 500,
  "composed_of": ["component_template1", "runtime_component_template"], 
  "version": 3,
  "_meta": {
    "description": "my custom"
  }
}
~~~~

执行结果如下

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011027854.png)

- 创建一个匹配`bar*`的索引`bar-test`

~~~ she
PUT /bar-test
~~~

然后获取mapping

~~~ shell
GET /bar-test/_mapping
~~~

执行结果如下

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011028896.png)

### 模拟多组件模板

> 由于模板不仅可以由多个组件模板组成，还可以由索引模板自身组成；那么最终的索引设置将是什么呢？ElasticSearch设计者考虑到这个，提供了API进行模拟组合后的模板的配置。

#### 模拟某个索引结果

比如上面的template_1, 我们不用创建bar*的索引(这里模拟bar-pdai-test)，也可以模拟计算出索引的配置：

~~~ shell
POST /_index_template/_simulate_index/bar-pdai-test
~~~

执行结果如下

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011029943.png)

#### 模拟组件模板结果

当然，由于template_1模板是由两个组件模板组合的，我们也可以模拟出template_1被组合后的索引配置：

~~~ shell
POST /_index_template/_simulate/template_1
~~~

执行结果如下：

~~~ js
{
  "template" : {
    "settings" : {
      "index" : {
        "number_of_shards" : "1"
      }
    },
    "mappings" : {
      "runtime" : {
        "day_of_week" : {
          "type" : "keyword",
          "script" : {
            "source" : "emit(doc['@timestamp'].value.dayOfWeekEnum.getDisplayName(TextStyle.FULL, Locale.ROOT))",
            "lang" : "painless"
          }
        }
      },
      "properties" : {
        "@timestamp" : {
          "type" : "date"
        },
        "created_at" : {
          "type" : "date",
          "format" : "EEE MMM dd HH:mm:ss Z yyyy"
        },
        "host_name" : {
          "type" : "keyword"
        }
      }
    },
    "aliases" : {
      "mydata" : { }
    }
  },
  "overlapping" : [ ]
}
~~~

#### 模拟组件模板和自身模板结合后的结果

- 新建两个模板

~~~~ json
PUT /_component_template/ct1
{
  "template": {
    "settings": {
      "index.number_of_shards": 2
    }
  }
}

PUT /_component_template/ct2
{
  "template": {
    "settings": {
      "index.number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        }
      }
    }
  }
}
~~~~

模拟在两个组件模板的基础上，添加自身模板的配置

~~~ json
POST /_index_template/_simulate
{
  "index_patterns": ["my*"],
  "template": {
    "settings" : {
        "index.number_of_shards" : 3
    }
  },
  "composed_of": ["ct1", "ct2"]
}
~~~

执行的结果如下：

~~~ json
{
  "template" : {
    "settings" : {
      "index" : {
        "number_of_shards" : "3",
        "number_of_replicas" : "0"
      }
    },
    "mappings" : {
      "properties" : {
        "@timestamp" : {
          "type" : "date"
        }
      }
    },
    "aliases" : { }
  },
  "overlapping" : [ ]
}
~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011032538.png)

## 文档操作

### 新增文档

**语法：**

```json
POST /索引库名/_doc/文档id
{
    "字段1": "值1",
    "字段2": "值2",
    "字段3": {
        "子属性1": "值3",
        "子属性2": "值4"
    },
    // ...
}
```

**示例：**

```json
POST /heima/_doc/1
{
    "info": "黑马程序员Java讲师",
    "email": "zy@itcast.cn",
    "name": {
        "firstName": "云",
        "lastName": "赵"
    }
}
```

**响应：**

![image-20230701103402145](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011034257.png)

### 查询文档

根据rest风格，新增是post，查询应该是get，不过查询一般都需要条件，这里我们把文档id带上。

**语法：**

```json
GET /{索引库名称}/_doc/{id}
```

**通过kibana查看数据：**

```js
GET /heima/_doc/1
```

**查看结果：**

![image-20210720213345003](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011034378.png)



### 删除文档

删除使用DELETE请求，同样，需要根据id进行删除：

**语法：**

```js
DELETE /{索引库名}/_doc/id值
```

**示例：**

```json
# 根据id删除数据
DELETE /heima/_doc/1
```

**结果：**

![image-20210720213634918](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011034263.png)



### 修改文档

修改有两种方式：

- 全量修改：直接覆盖原来的文档
- 增量修改：修改文档中的部分字段

#### 全量修改

全量修改是覆盖原来的文档，其本质是：

- 根据指定的id删除文档
- 新增一个相同id的文档

**注意**：如果根据id删除时，id不存在，第二步的新增也会执行，也就从修改变成了新增操作了。

**语法：**

~~~~ json
PUT /{索引库名}/_doc/文档id
{
    "字段1": "值1",
    "字段2": "值2",
    // ... 略
}
~~~~

**示例：**

~~~ json
PUT /heima/_doc/1
{
    "info": "黑马程序员高级Java讲师",
    "email": "zy@itcast.cn",
    "name": {
        "firstName": "云",
        "lastName": "赵"
    }
}
~~~

#### 增量修改

增量修改是只修改指定id匹配的文档中的部分字段。

**语法：**

~~~~ json
POST /{索引库名}/_update/文档id
{
    "doc": {
         "字段名": "新的值",
    }
}
~~~~

**示例：**

~~~ json
POST /heima/_update/1
{
  "doc": {
    "email": "ZhaoYun@itcast.cn"
  }
}
~~~

### 总结

- 创建文档：POST /{索引库名}/_doc/文档id   { json文档 }
- 查询文档：GET /{索引库名}/_doc/文档id
- 删除文档：DELETE /{索引库名}/_doc/文档id
- 修改文档：
  - 全量修改：PUT /{索引库名}/_doc/文档id { json文档 }
  - 增量修改：POST /{索引库名}/_update/文档id { "doc": {字段}}

## RestAPI

ES官方提供了各种不同语言的客户端，用来操作ES。这些客户端的本质就是组装DSL语句，通过http请求发送给ES。官方文档地址：https://www.elastic.co/guide/en/elasticsearch/client/index.html

其中的Java Rest Client又包括两种：

- Java Low Level Rest Client
- Java High Level Rest Client

![image-20230701103756801](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011037883.png)

目前主要使用的是Java HighLevel Rest Client客户端API

### 创建工程

#### 创建数据库

~~~~ mysql
CREATE TABLE `tb_hotel` (
  `id` bigint(20) NOT NULL COMMENT '酒店id',
  `name` varchar(255) NOT NULL COMMENT '酒店名称；例：7天酒店',
  `address` varchar(255) NOT NULL COMMENT '酒店地址；例：航头路',
  `price` int(10) NOT NULL COMMENT '酒店价格；例：329',
  `score` int(2) NOT NULL COMMENT '酒店评分；例：45，就是4.5分',
  `brand` varchar(32) NOT NULL COMMENT '酒店品牌；例：如家',
  `city` varchar(32) NOT NULL COMMENT '所在城市；例：上海',
  `star_name` varchar(16) DEFAULT NULL COMMENT '酒店星级，从低到高分别是：1星到5星，1钻到5钻',
  `business` varchar(255) DEFAULT NULL COMMENT '商圈；例：虹桥',
  `latitude` varchar(32) NOT NULL COMMENT '纬度；例：31.2497',
  `longitude` varchar(32) NOT NULL COMMENT '经度；例：120.3925',
  `pic` varchar(255) DEFAULT NULL COMMENT '酒店图片；例:/img/1.jpg',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
~~~~

#### 创建Maven工程

项目结构如图：

![image-20230701104159557](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011041684.png)

#### mapping映射分析

创建索引库，最关键的是mapping映射，而mapping映射要考虑的信息包括：

- 字段名
- 字段数据类型
- 是否参与搜索
- 是否需要分词
- 如果分词，分词器是什么？

其中：

- 字段名、字段数据类型，可以参考数据表结构的名称和类型
- 是否参与搜索要分析业务来判断，例如图片地址，就无需参与搜索
- 是否分词呢要看内容，内容如果是一个整体就无需分词，反之则要分词
- 分词器，我们可以统一使用ik_max_word

来看下酒店数据的索引库结构:

~~~ json
PUT /hotel
{
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "name":{
        "type": "text",
        "analyzer": "ik_max_word",
        "copy_to": "all"
      },
      "address":{
        "type": "keyword",
        "index": false
      },
      "price":{
        "type": "integer"
      },
      "score":{
        "type": "integer"
      },
      "brand":{
        "type": "keyword",
        "copy_to": "all"
      },
      "city":{
        "type": "keyword",
        "copy_to": "all"
      },
      "starName":{
        "type": "keyword"
      },
      "business":{
        "type": "keyword"
      },
      "location":{
        "type": "geo_point"
      },
      "pic":{
        "type": "keyword",
        "index": false
      },
      "all":{
        "type": "text",
        "analyzer": "ik_max_word"
      }
    }
  }
}
~~~

几个特殊字段说明：

- location：地理坐标，里面包含精度、纬度
- all：一个组合字段，其目的是将多字段的值 利用copy_to合并，提供给用户搜索

地理坐标说明：

![image-20230701104301516](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011043580.png)

copy_to说明：

![image-20230701104310367](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011043429.png)

#### 初始化RestClient

在elasticsearch提供的API中，与elasticsearch一切交互都封装在一个名为RestHighLevelClient的类中，必须先完成这个对象的初始化，建立与elasticsearch的连接。

分为三步：

1. 引入es的RestHighLevelClient依赖：

~~~~ xml
<dependency>
    <groupId>org.elasticsearch.client</groupId>
    <artifactId>elasticsearch-rest-high-level-client</artifactId>
</dependency>
~~~~

2. 因为SpringBoot默认的ES版本是7.6.2，所以我们需要覆盖默认的ES版本：

~~~ xml
<properties>
    <java.version>1.8</java.version>
    <elasticsearch.version>7.12.1</elasticsearch.version>
</properties>
~~~

3. 初始化RestHighLevelClient：

初始化的代码如下：

~~~ java
RestHighLevelClient client = new RestHighLevelClient(RestClient.builder(
        HttpHost.create("http://192.168.150.101:9200")
));
~~~

这里为了单元测试方便，我们创建一个测试类HotelIndexTest，然后将初始化的代码编写在@BeforeEach方法中：

~~~~ java
public class HotelIndexTest {
    private RestHighLevelClient client;

    @BeforeEach
    void setUp() {
        this.client = new RestHighLevelClient(RestClient.builder(
                HttpHost.create("http://192.168.150.101:9200")
        ));
    }

    @AfterEach
    void tearDown() throws IOException {
        this.client.close();
    }
}
~~~~

### 创建索引

#### 代码解读

创建索引库的API如下：

![image-20230701104522284](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011045391.png)

代码分为三步：

1. 创建Request对象。因为是创建索引库的操作，因此Request是CreateIndexRequest。
2. 添加请求参数，其实就是DSL的JSON参数部分。因为json字符串很长，这里是定义了静态字符串常量MAPPING_TEMPLATE，让代码看起来更加优雅。
3. 发送请求，client.indices()方法的返回值是IndicesClient类型，封装了所有与索引库操作有关的方法。

#### 完整示例

在hotel-demo的cn.itcast.hotel.constants包下，创建一个类，定义mapping映射的JSON字符串常量：

~~~~ java
package cn.itcast.hotel.constants;

public class HotelConstants {
    public static final String MAPPING_TEMPLATE = "{\n" +
            "  \"mappings\": {\n" +
            "    \"properties\": {\n" +
            "      \"id\": {\n" +
            "        \"type\": \"keyword\"\n" +
            "      },\n" +
            "      \"name\":{\n" +
            "        \"type\": \"text\",\n" +
            "        \"analyzer\": \"ik_max_word\",\n" +
            "        \"copy_to\": \"all\"\n" +
            "      },\n" +
            "      \"address\":{\n" +
            "        \"type\": \"keyword\",\n" +
            "        \"index\": false\n" +
            "      },\n" +
            "      \"price\":{\n" +
            "        \"type\": \"integer\"\n" +
            "      },\n" +
            "      \"score\":{\n" +
            "        \"type\": \"integer\"\n" +
            "      },\n" +
            "      \"brand\":{\n" +
            "        \"type\": \"keyword\",\n" +
            "        \"copy_to\": \"all\"\n" +
            "      },\n" +
            "      \"city\":{\n" +
            "        \"type\": \"keyword\",\n" +
            "        \"copy_to\": \"all\"\n" +
            "      },\n" +
            "      \"starName\":{\n" +
            "        \"type\": \"keyword\"\n" +
            "      },\n" +
            "      \"business\":{\n" +
            "        \"type\": \"keyword\"\n" +
            "      },\n" +
            "      \"location\":{\n" +
            "        \"type\": \"geo_point\"\n" +
            "      },\n" +
            "      \"pic\":{\n" +
            "        \"type\": \"keyword\",\n" +
            "        \"index\": false\n" +
            "      },\n" +
            "      \"all\":{\n" +
            "        \"type\": \"text\",\n" +
            "        \"analyzer\": \"ik_max_word\"\n" +
            "      }\n" +
            "    }\n" +
            "  }\n" +
            "}";
}
~~~~

在hotel-demo中的HotelIndexTest测试类中，编写单元测试，实现创建索引：

~~~~ java
@Test
void createHotelIndex() throws IOException {
    // 1.创建Request对象
    CreateIndexRequest request = new CreateIndexRequest("hotel");
    // 2.准备请求的参数：DSL语句
    request.source(MAPPING_TEMPLATE, XContentType.JSON);
    // 3.发送请求
    client.indices().create(request, RequestOptions.DEFAULT);
}
~~~~

### 删除索引

删除索引库的DSL语句非常简单：

~~~ json
DELETE /hotel
~~~

与创建索引库相比：

- 请求方式从PUT变为DELTE
- 请求路径不变
- 无请求参数

所以代码的差异，注意体现在Request对象上。依然是三步走：

1. 创建Request对象。这次是DeleteIndexRequest对象

2. 准备参数。这里是无参
3. 发送请求。改用delete方法

在hotel-demo中的HotelIndexTest测试类中，编写单元测试，实现删除索引：

~~~ java
@Test
void testDeleteHotelIndex() throws IOException {
    // 1.创建Request对象
    DeleteIndexRequest request = new DeleteIndexRequest("hotel");
    // 2.发送请求
    client.indices().delete(request, RequestOptions.DEFAULT);
}
~~~

### 判断索引库是否存在

判断索引库是否存在，本质就是查询，对应的DSL是：

~~~~ json
GET /hotel
~~~~

因此与删除的Java代码流程是类似的。依然是三步走：

1. 创建Request对象。这次是GetIndexRequest对象

2. 准备参数。这里是无参
3. 发送请求。改用exists方法

### 总结

JavaRestClient操作elasticsearch的流程基本类似。核心是client.indices()方法来获取索引库的操作对象。

索引库操作的基本步骤：

- 初始化RestHighLevelClient
- 创建XxxIndexRequest。XXX是Create、Get、Delete
- 准备DSL（ Create时需要，其它是无参）
- 发送请求。调用RestHighLevelClient#indices().xxx()方法，xxx是create、exists、delete

## RestClient操作文档

为了与索引库操作分离，我们再次参加一个测试类，做两件事情：

- 初始化RestHighLevelClient
- 我们的酒店数据在数据库，需要利用IHotelService去查询，所以注入这个接口

~~~ java
@SpringBootTest
public class HotelDocumentTest {
    @Autowired
    private IHotelService hotelService;

    private RestHighLevelClient client;

    @BeforeEach
    void setUp() {
        this.client = new RestHighLevelClient(RestClient.builder(
                HttpHost.create("http://192.168.150.101:9200")
        ));
    }

    @AfterEach
    void tearDown() throws IOException {
        this.client.close();
    }
}
~~~

### 新增文档

我们要将数据库的酒店数据查询出来，写入elasticsearch中。

#### 索引库实体类

数据库查询后的结果是一个Hotel类型的对象。结构如下：

~~~java
@Data
@TableName("tb_hotel")
public class Hotel {
    @TableId(type = IdType.INPUT)
    private Long id;
    private String name;
    private String address;
    private Integer price;
    private Integer score;
    private String brand;
    private String city;
    private String starName;
    private String business;
    private String longitude;
    private String latitude;
    private String pic;
}
~~~

与我们的索引库结构存在差异：

- longitude和latitude需要合并为location

因此，我们需要定义一个新的类型，与索引库结构吻合：

~~~ java
@Data
@NoArgsConstructor
public class HotelDoc {
    private Long id;
    private String name;
    private String address;
    private Integer price;
    private Integer score;
    private String brand;
    private String city;
    private String starName;
    private String business;
    private String location;
    private String pic;

    public HotelDoc(Hotel hotel) {
        this.id = hotel.getId();
        this.name = hotel.getName();
        this.address = hotel.getAddress();
        this.price = hotel.getPrice();
        this.score = hotel.getScore();
        this.brand = hotel.getBrand();
        this.city = hotel.getCity();
        this.starName = hotel.getStarName();
        this.business = hotel.getBusiness();
        this.location = hotel.getLatitude() + ", " + hotel.getLongitude();
        this.pic = hotel.getPic();
    }
}
~~~

#### 语法说明

新增文档的DSL语句如下：

~~~ json
POST /{索引库名}/_doc/1
{
    "name": "Jack",
    "age": 21
}
~~~

对应的java代码如图：

![image-20230701105134475](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011051562.png)

可以看到与创建索引库类似，同样是三步走：

1. 创建Request对象
2. 准备请求参数，也就是DSL中的JSON文档
3. 发送请求

变化的地方在于，这里直接使用client.xxx()的API，不再需要client.indices()了。

#### 完整代码

我们导入酒店数据，基本流程一致，但是需要考虑几点变化：

- 酒店数据来自于数据库，我们需要先查询出来，得到hotel对象
- hotel对象需要转为HotelDoc对象
- HotelDoc需要序列化为json格式

因此，代码整体步骤如下：

- 1）根据id查询酒店数据Hotel
- 2）将Hotel封装为HotelDoc
- 3）将HotelDoc序列化为JSON
- 4）创建IndexRequest，指定索引库名和id
- 5）准备请求参数，也就是JSON文档
- 6）发送请求

在hotel-demo的HotelDocumentTest测试类中，编写单元测试：

~~~ java
@Test
void testAddDocument() throws IOException {
    // 1.根据id查询酒店数据
    Hotel hotel = hotelService.getById(61083L);
    // 2.转换为文档类型
    HotelDoc hotelDoc = new HotelDoc(hotel);
    // 3.将HotelDoc转json
    String json = JSON.toJSONString(hotelDoc);

    // 1.准备Request对象
    IndexRequest request = new IndexRequest("hotel").id(hotelDoc.getId().toString());
    // 2.准备Json文档
    request.source(json, XContentType.JSON);
    // 3.发送请求
    client.index(request, RequestOptions.DEFAULT);
}
~~~

### 查询文档

#### 语法说明

查询的DSL语句如下：

```json
GET /hotel/_doc/{id}
```

非常简单，因此代码大概分两步：

- 准备Request对象
- 发送请求

不过查询的目的是得到结果，解析为HotelDoc，因此难点是结果的解析。完整代码如下：

![image-20230701105314473](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011053575.png)

可以看到，结果是一个JSON，其中文档放在一个`_source`属性中，因此解析就是拿到`_source`，反序列化为Java对象即可。

与之前类似，也是三步走：

1. 准备Request对象。这次是查询，所以是GetRequest
2. 发送请求，得到结果。因为是查询，这里调用client.get()方法
3. 解析结果，就是对JSON做反序列化

#### 完整代码

在hotel-demo的HotelDocumentTest测试类中，编写单元测试：

~~~ java
@Test
void testGetDocumentById() throws IOException {
    // 1.准备Request
    GetRequest request = new GetRequest("hotel", "61082");
    // 2.发送请求，得到响应
    GetResponse response = client.get(request, RequestOptions.DEFAULT);
    // 3.解析响应结果
    String json = response.getSourceAsString();

    HotelDoc hotelDoc = JSON.parseObject(json, HotelDoc.class);
    System.out.println(hotelDoc);
}
~~~

### 删除文档

删除的DSL为是这样的：

```json
DELETE /hotel/_doc/{id}
```

与查询相比，仅仅是请求方式从DELETE变成GET，可以想象Java代码应该依然是三步走：

1. 准备Request对象，因为是删除，这次是DeleteRequest对象。要指定索引库名和id
2. 准备参数，无参
3. 发送请求。因为是删除，所以是client.delete()方法

在hotel-demo的HotelDocumentTest测试类中，编写单元测试：

~~~ java
@Test
void testDeleteDocument() throws IOException {
    // 1.准备Request
    DeleteRequest request = new DeleteRequest("hotel", "61083");
    // 2.发送请求
    client.delete(request, RequestOptions.DEFAULT);
}
~~~

### 修改文档

#### 语法说明

修改我们讲过两种方式：

- 全量修改：本质是先根据id删除，再新增
- 增量修改：修改文档中的指定字段值

在RestClient的API中，全量修改与新增的API完全一致，判断依据是ID：

- 如果新增时，ID已经存在，则修改
- 如果新增时，ID不存在，则新增

这里不再赘述，我们主要关注增量修改。

代码示例如图：

![image-20230701105612103](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011056186.png)

与之前类似，也是三步走：

1. 准备Request对象。这次是修改，所以是UpdateRequest
2. 准备参数。也就是JSON文档，里面包含要修改的字段
3. 更新文档。这里调用client.update()方法

#### 完整代码

在hotel-demo的HotelDocumentTest测试类中，编写单元测试：

~~~~ java
@Test
void testUpdateDocument() throws IOException {
    // 1.准备Request
    UpdateRequest request = new UpdateRequest("hotel", "61083");
    // 2.准备请求参数
    request.doc(
        "price", "952",
        "starName", "四钻"
    );
    // 3.发送请求a
    client.update(request, RequestOptions.DEFAULT);
}
~~~~

### 批量导入文档

案例需求：利用BulkRequest批量将数据库数据导入到索引库中。

步骤如下：

- 利用mybatis-plus查询酒店数据

- 将查询到的酒店数据（Hotel）转换为文档类型数据（HotelDoc）

- 利用JavaRestClient中的BulkRequest批处理，实现批量新增文档

#### 语法说明

批量处理BulkRequest，其本质就是将多个普通的CRUD请求组合在一起发送。

其中提供了一个add方法，用来添加其他请求：

![image-20230701105733117](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011057187.png)

可以看到，能添加的请求包括：

- IndexRequest，也就是新增
- UpdateRequest，也就是修改
- DeleteRequest，也就是删除

因此Bulk中添加了多个IndexRequest，就是批量新增功能了。示例：

![image-20230701105743400](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011057476.png)

其实还是三步走：

1. 创建Request对象。这里是BulkRequest
2. 准备参数。批处理的参数，就是其它Request对象，这里就是多个IndexRequest
3. 发起请求。这里是批处理，调用的方法为client.bulk()方法

我们在导入酒店数据时，将上述代码改造成for循环处理即可。

#### 完整代码

在hotel-demo的HotelDocumentTest测试类中，编写单元测试：

~~~ java
@Test
void testBulkRequest() throws IOException {
    // 批量查询酒店数据
    List<Hotel> hotels = hotelService.list();

    // 1.创建Request
    BulkRequest request = new BulkRequest();
    // 2.准备参数，添加多个新增的Request
    for (Hotel hotel : hotels) {
        // 2.1.转换为文档类型HotelDoc
        HotelDoc hotelDoc = new HotelDoc(hotel);
        // 2.2.创建新增文档的Request对象
        request.add(new IndexRequest("hotel")
                    .id(hotelDoc.getId().toString())
                    .source(JSON.toJSONString(hotelDoc), XContentType.JSON));
    }
    // 3.发送请求
    client.bulk(request, RequestOptions.DEFAULT);
}
~~~

### 小结

文档操作的基本步骤：

- 初始化RestHighLevelClient
- 创建XxxRequest。XXX是Index、Get、Update、Delete、Bulk
- 准备参数（Index、Update、Bulk时需要）
- 发送请求。调用RestHighLevelClient#.xxx()方法，xxx是index、get、update、delete、bulk
- 解析结果（Get时需要）
