---
title: ES聚合查询
date: 2023-06-30
---

## 聚合的种类

**聚合**可以让我们极其方便的实现对数据的统计、分析、运算。例如：

- 什么品牌的手机最受欢迎？
- 这些手机的平均价格、最高价格、最低价格？
- 这些手机每月的销售情况如何？

实现这些统计功能的比数据库的sql要方便的多，而且查询速度非常快，可以实现近实时搜索效果。

聚合常见的有三类：

- **桶聚合（Bucket Aggregation)**：用来对文档做分组
  - TermAggregation：按照文档字段值分组，例如按照品牌值分组、按照国家分组
  - Date Histogram：按照日期阶梯分组，例如一周为一组，或者一月为一组

- **指标聚合（Metric Aggregation)** ：用以计算一些值，比如：最大值、最小值、平均值等
  - Avg：求平均值
  - Max：求最大值
  - Min：求最小值
  - Stats：同时求max、min、avg、sum等
- **管道聚合（Pipline Aggregation)**：其它聚合的结果为基础做聚合

> **注意**：参加聚合的字段必须是keyword、日期、数值、布尔类型

## Bucket聚合

### 如何理解Bucket聚合

Bucket聚合设计上大概分为三类（当然有些是第二和第三类的融合）

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011550510.png)

### 准备数据

让我们先看一个例子。我们将会创建一些对汽车经销商有用的聚合，数据是关于汽车交易的信息：车型、制造商、售价、何时被出售等。

首先我们批量索引一些数据：

~~~ json
POST /test-agg-cars/_bulk
{ "index": {}}
{ "price" : 10000, "color" : "red", "make" : "honda", "sold" : "2014-10-28" }
{ "index": {}}
{ "price" : 20000, "color" : "red", "make" : "honda", "sold" : "2014-11-05" }
{ "index": {}}
{ "price" : 30000, "color" : "green", "make" : "ford", "sold" : "2014-05-18" }
{ "index": {}}
{ "price" : 15000, "color" : "blue", "make" : "toyota", "sold" : "2014-07-02" }
{ "index": {}}
{ "price" : 12000, "color" : "green", "make" : "toyota", "sold" : "2014-08-19" }
{ "index": {}}
{ "price" : 20000, "color" : "red", "make" : "honda", "sold" : "2014-11-05" }
{ "index": {}}
{ "price" : 80000, "color" : "red", "make" : "bmw", "sold" : "2014-01-01" }
{ "index": {}}
{ "price" : 25000, "color" : "blue", "make" : "ford", "sold" : "2014-02-12" }
~~~

### 标准的聚合

有了数据，开始构建我们的第一个聚合。汽车经销商可能会想知道哪个颜色的汽车销量最好，用聚合可以轻易得到结果，用 terms 桶操作：

~~~ json
GET /test-agg-cars/_search
{
    "size" : 0,
    "aggs" : { 
        "popular_colors" : { 
            "terms" : { 
              "field" : "color.keyword"
            }
        }
    }
}
~~~

1. 聚合操作被置于顶层参数 aggs 之下（如果你愿意，完整形式 aggregations 同样有效）。
2. 然后，可以为聚合指定一个我们想要名称，本例中是： popular_colors 。
3. 最后，定义单个桶的类型 terms 。

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011541258.png)

1. 因为我们设置了 size 参数，所以不会有 hits 搜索结果返回。

2. popular_colors 聚合是作为 aggregations 字段的一部分被返回的。

3. 每个桶的 key 都与 color 字段里找到的唯一词对应。它总会包含 doc_count 字段，告诉我们包含该词项的文档数量。

4. 每个桶的数量代表该颜色的文档数量。

### 多个聚合

同时计算两种桶的结果：对color和对make。同时计算两种桶的结果：对color和对make。

```bash
GET /test-agg-cars/_search
{
    "size" : 0,
    "aggs" : { 
        "popular_colors" : { 
            "terms" : { 
              "field" : "color.keyword"
            }
        },
        "make_by" : { 
            "terms" : { 
              "field" : "make.keyword"
            }
        }
    }
}
```

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011544578.png)

### 聚合的嵌套

这个新的聚合层让我们可以将 avg 度量嵌套置于 terms 桶内。实际上，这就为每个颜色生成了平均价格。

~~~~  json
GET /test-agg-cars/_search
{
   "size" : 0,
   "aggs": {
      "colors": {
         "terms": {
            "field": "color.keyword"
         },
         "aggs": { 
            "avg_price": { 
               "avg": {
                  "field": "price" 
               }
            }
         }
      }
   }
}
~~~~

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011544288.png)

正如 颜色 的例子，我们需要给度量起一个名字（ avg_price ）这样可以稍后根据名字获取它的值。最后，我们指定度量本身（ avg ）以及我们想要计算平均值的字段（ price ）

### 动态脚本的聚合

ElasticSearch还支持一些基于脚本（生成运行时的字段）的复杂的动态聚合。

~~~ json
GET /test-agg-cars/_search
{
  "runtime_mappings": {
    "make.length": {
      "type": "long",
      "script": "emit(doc['make.keyword'].value.length())"
    }
  },
  "size" : 0,
  "aggs": {
    "make_length": {
      "histogram": {
        "interval": 1,
        "field": "make.length"
      }
    }
  }
}
~~~

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011545008.png)

### 前置条件的过滤：filter

在当前文档集上下文中定义与指定过滤器(Filter)匹配的所有文档的单个存储桶。通常，这将用于将当前聚合上下文缩小到一组特定的文档。

```bash
GET /test-agg-cars/_search
{
  "size": 0,
  "aggs": {
    "make_by": {
      "filter": { "term": { "type": "honda" } },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } }
      }
    }
  }
}
```

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011546189.png)

### 对filter进行分组聚合：filters

设计一个新的例子, 日志系统中，每条日志都是在文本中，包含warning/info等信息。

```bash
PUT /test-agg-logs/_bulk?refresh
{ "index" : { "_id" : 1 } }
{ "body" : "warning: page could not be rendered" }
{ "index" : { "_id" : 2 } }
{ "body" : "authentication error" }
{ "index" : { "_id" : 3 } }
{ "body" : "warning: connection timed out" }
{ "index" : { "_id" : 4 } }
{ "body" : "info: hello pdai" }
```

我们需要对包含不同日志类型的日志进行分组，这就需要filters:

```bash
GET /test-agg-logs/_search
{
  "size": 0,
  "aggs" : {
    "messages" : {
      "filters" : {
        "other_bucket_key": "other_messages",
        "filters" : {
          "infos" :   { "match" : { "body" : "info"   }},
          "warnings" : { "match" : { "body" : "warning" }}
        }
      }
    }
  }
}
```

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011546714.png)

### 对number类型聚合：Range

基于多桶值源的聚合，使用户能够定义一组范围-每个范围代表一个桶。在聚合过程中，将从每个存储区范围中检查从每个文档中提取的值，并“存储”相关/匹配的文档。请注意，此聚合包括from值，但不包括to每个范围的值。

```bash
GET /test-agg-cars/_search
{
  "size": 0,
  "aggs": {
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 20000 },
          { "from": 20000, "to": 40000 },
          { "from": 40000 }
        ]
      }
    }
  }
}
```

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011547130.png)

### 对IP类型聚合：IP Range

专用于IP值的范围聚合。

```bash
GET /ip_addresses/_search
{
  "size": 10,
  "aggs": {
    "ip_ranges": {
      "ip_range": {
        "field": "ip",
        "ranges": [
          { "to": "10.0.0.5" },
          { "from": "10.0.0.5" }
        ]
      }
    }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "ip_ranges": {
      "buckets": [
        {
          "key": "*-10.0.0.5",
          "to": "10.0.0.5",
          "doc_count": 10
        },
        {
          "key": "10.0.0.5-*",
          "from": "10.0.0.5",
          "doc_count": 260
        }
      ]
    }
  }
}
```

- **CIDR Mask分组**

此外还可以用CIDR Mask分组

```bash
GET /ip_addresses/_search
{
  "size": 0,
  "aggs": {
    "ip_ranges": {
      "ip_range": {
        "field": "ip",
        "ranges": [
          { "mask": "10.0.0.0/25" },
          { "mask": "10.0.0.127/25" }
        ]
      }
    }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "ip_ranges": {
      "buckets": [
        {
          "key": "10.0.0.0/25",
          "from": "10.0.0.0",
          "to": "10.0.0.128",
          "doc_count": 128
        },
        {
          "key": "10.0.0.127/25",
          "from": "10.0.0.0",
          "to": "10.0.0.128",
          "doc_count": 128
        }
      ]
    }
  }
}
```

- **增加key显示**

```bash
GET /ip_addresses/_search
{
  "size": 0,
  "aggs": {
    "ip_ranges": {
      "ip_range": {
        "field": "ip",
        "ranges": [
          { "to": "10.0.0.5" },
          { "from": "10.0.0.5" }
        ],
        "keyed": true // here
      }
    }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "ip_ranges": {
      "buckets": {
        "*-10.0.0.5": {
          "to": "10.0.0.5",
          "doc_count": 10
        },
        "10.0.0.5-*": {
          "from": "10.0.0.5",
          "doc_count": 260
        }
      }
    }
  }
}
```

- **自定义key显示**

```bash
GET /ip_addresses/_search
{
  "size": 0,
  "aggs": {
    "ip_ranges": {
      "ip_range": {
        "field": "ip",
        "ranges": [
          { "key": "infinity", "to": "10.0.0.5" },
          { "key": "and-beyond", "from": "10.0.0.5" }
        ],
        "keyed": true
      }
    }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "ip_ranges": {
      "buckets": {
        "infinity": {
          "to": "10.0.0.5",
          "doc_count": 10
        },
        "and-beyond": {
          "from": "10.0.0.5",
          "doc_count": 260
        }
      }
    }
  }
}
```

### 对日期类型聚合：Date Range

专用于日期值的范围聚合。

```bash
GET /test-agg-cars/_search
{
  "size": 0,
  "aggs": {
    "range": {
      "date_range": {
        "field": "sold",
        "format": "yyyy-MM",
        "ranges": [
          { "from": "2014-01-01" },  
          { "to": "2014-12-31" } 
        ]
      }
    }
  }
}
```

结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011548390.png)

此聚合与Range聚合之间的主要区别在于 from和to值可以在[Date Math表达式在新窗口打开](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/search-aggregations-bucket-daterange-aggregation.html#date-format-pattern)中表示，并且还可以指定日期格式，通过该日期格式将返回from and to响应字段。请注意，此聚合包括from值，但**不包括to每个范围的值**。

### 对柱状图功能：Histrogram

直方图 histogram 本质上是就是为柱状图功能设计的。

创建直方图需要指定一个区间，如果我们要为售价创建一个直方图，可以将间隔设为 20,000。这样做将会在每个 $20,000 档创建一个新桶，然后文档会被分到对应的桶中。

对于仪表盘来说，我们希望知道每个售价区间内汽车的销量。我们还会想知道每个售价区间内汽车所带来的收入，可以通过对每个区间内已售汽车的售价求和得到。

可以用 histogram 和一个嵌套的 sum 度量得到我们想要的答案：

```bash
GET /test-agg-cars/_search
{
   "size" : 0,
   "aggs":{
      "price":{
         "histogram":{ 
            "field": "price.keyword",
            "interval": 20000
         },
         "aggs":{
            "revenue": {
               "sum": { 
                 "field" : "price"
               }
             }
         }
      }
   }
}
```

1. histogram 桶要求两个参数：一个数值字段以及一个定义桶大小间隔。
2. sum 度量嵌套在每个售价区间内，用来显示每个区间内的总收入。

如我们所见，查询是围绕 price 聚合构建的，它包含一个 histogram 桶。它要求字段的类型必须是数值型的同时需要设定分组的间隔范围。 间隔设置为 20,000 意味着我们将会得到如 [0-19999, 20000-39999, ...] 这样的区间。

接着，我们在直方图内定义嵌套的度量，这个 sum 度量，它会对落入某一具体售价区间的文档中 price 字段的值进行求和。 这可以为我们提供每个售价区间的收入，从而可以发现到底是普通家用车赚钱还是奢侈车赚钱。

响应结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011548300.png)

结果很容易理解，不过应该注意到直方图的键值是区间的下限。键 0 代表区间 0-19，999 ，键 20000 代表区间 20，000-39，999 ，等等。

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011548867.png)

当然，我们可以为任何聚合输出的分类和统计结果创建条形图，而不只是 直方图 桶。让我们以最受欢迎 10 种汽车以及它们的平均售价、标准差这些信息创建一个条形图。 我们会用到 terms 桶和 extended_stats 度量：

```bash
GET /test-agg-cars/_search
{
  "size" : 0,
  "aggs": {
    "makes": {
      "terms": {
        "field": "make.keyword",
        "size": 10
      },
      "aggs": {
        "stats": {
          "extended_stats": {
            "field": "price"
          }
        }
      }
    }
  }
}
```

上述代码会按受欢迎度返回制造商列表以及它们各自的统计信息。我们对其中的 stats.avg 、 stats.count 和 stats.std_deviation 信息特别感兴趣，并用 它们计算出标准差：

```bash
std_err = std_deviation / count
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011548090.png)

对应报表：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011548244.png)

## Metric聚合

### 如何理解metric聚合

- **从分类看**：Metric聚合分析分为**单值分析**和**多值分析**两类
- **从功能看**：根据具体的应用场景设计了一些分析api, 比如地理位置，百分数等等

![image-20230701160130907](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011601007.png)

### 单值分析: 标准stat类型

#### avg 平均值

计算班级的平均分

```bash
POST /exams/_search?size=0
{
  "aggs": {
    "avg_grade": { "avg": { "field": "grade" } }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "avg_grade": {
      "value": 75.0
    }
  }
}
```

#### max 最大值

计算销售最高价

```bash
POST /sales/_search?size=0
{
  "aggs": {
    "max_price": { "max": { "field": "price" } }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
      "max_price": {
          "value": 200.0
      }
  }
}
```

#### min 最小值

计算销售最低价

```bash
POST /sales/_search?size=0
{
  "aggs": {
    "min_price": { "min": { "field": "price" } }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "min_price": {
      "value": 10.0
    }
  }
}
```

#### sum 和

计算销售总价

```bash
POST /sales/_search?size=0
{
  "query": {
    "constant_score": {
      "filter": {
        "match": { "type": "hat" }
      }
    }
  },
  "aggs": {
    "hat_prices": { "sum": { "field": "price" } }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "hat_prices": {
      "value": 450.0
    }
  }
}
```

#### value_count 数量

销售数量统计

```bash
POST /sales/_search?size=0
{
  "aggs" : {
    "types_count" : { "value_count" : { "field" : "type" } }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "types_count": {
      "value": 7
    }
  }
}
```

### 单值分析: 其它类型

#### weighted_avg 带权重的avg

```bash
POST /exams/_search
{
  "size": 0,
  "aggs": {
    "weighted_grade": {
      "weighted_avg": {
        "value": {
          "field": "grade"
        },
        "weight": {
          "field": "weight"
        }
      }
    }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "weighted_grade": {
      "value": 70.0
    }
  }
}
```

#### cardinality 基数（distinct去重）

```bash
POST /sales/_search?size=0
{
  "aggs": {
    "type_count": {
      "cardinality": {
        "field": "type"
      }
    }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "type_count": {
      "value": 3
    }
  }
}
```

#### median_absolute_deviation 中位值

```bash
GET reviews/_search
{
  "size": 0,
  "aggs": {
    "review_average": {
      "avg": {
        "field": "rating"
      }
    },
    "review_variability": {
      "median_absolute_deviation": {
        "field": "rating" 
      }
    }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "review_average": {
      "value": 3.0
    },
    "review_variability": {
      "value": 2.0
    }
  }
}
```

### 非单值分析：stats型

#### stats 包含avg,max,min,sum和count

```bash
POST /exams/_search?size=0
{
  "aggs": {
    "grades_stats": { "stats": { "field": "grade" } }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "grades_stats": {
      "count": 2,
      "min": 50.0,
      "max": 100.0,
      "avg": 75.0,
      "sum": 150.0
    }
  }
}
```

#### matrix_stats 针对矩阵模型

以下示例说明了使用矩阵统计量来描述收入与贫困之间的关系。

```bash
GET /_search
{
  "aggs": {
    "statistics": {
      "matrix_stats": {
        "fields": [ "poverty", "income" ]
      }
    }
  }
}
```

返回

```bash
{
  ...
  "aggregations": {
    "statistics": {
      "doc_count": 50,
      "fields": [ {
          "name": "income",
          "count": 50,
          "mean": 51985.1,
          "variance": 7.383377037755103E7,
          "skewness": 0.5595114003506483,
          "kurtosis": 2.5692365287787124,
          "covariance": {
            "income": 7.383377037755103E7,
            "poverty": -21093.65836734694
          },
          "correlation": {
            "income": 1.0,
            "poverty": -0.8352655256272504
          }
        }, {
          "name": "poverty",
          "count": 50,
          "mean": 12.732000000000001,
          "variance": 8.637730612244896,
          "skewness": 0.4516049811903419,
          "kurtosis": 2.8615929677997767,
          "covariance": {
            "income": -21093.65836734694,
            "poverty": 8.637730612244896
          },
          "correlation": {
            "income": -0.8352655256272504,
            "poverty": 1.0
          }
        } ]
    }
  }
}
```

#### extended_stats

根据从汇总文档中提取的数值计算统计信息。

```bash
GET /exams/_search
{
  "size": 0,
  "aggs": {
    "grades_stats": { "extended_stats": { "field": "grade" } }
  }
}
```

上面的汇总计算了所有文档的成绩统计信息。聚合类型为extended_stats，并且字段设置定义将在其上计算统计信息的文档的数字字段。

```bash
{
  ...

  "aggregations": {
    "grades_stats": {
      "count": 2,
      "min": 50.0,
      "max": 100.0,
      "avg": 75.0,
      "sum": 150.0,
      "sum_of_squares": 12500.0,
      "variance": 625.0,
      "variance_population": 625.0,
      "variance_sampling": 1250.0,
      "std_deviation": 25.0,
      "std_deviation_population": 25.0,
      "std_deviation_sampling": 35.35533905932738,
      "std_deviation_bounds": {
        "upper": 125.0,
        "lower": 25.0,
        "upper_population": 125.0,
        "lower_population": 25.0,
        "upper_sampling": 145.71067811865476,
        "lower_sampling": 4.289321881345245
      }
    }
  }
}
```

#### string_stats 针对字符串

用于计算从聚合文档中提取的字符串值的统计信息。这些值可以从特定的关键字字段中检索。

```bash
POST /my-index-000001/_search?size=0
{
  "aggs": {
    "message_stats": { "string_stats": { "field": "message.keyword" } }
  }
}
```

返回

```bash
{
  ...

  "aggregations": {
    "message_stats": {
      "count": 5,
      "min_length": 24,
      "max_length": 30,
      "avg_length": 28.8,
      "entropy": 3.94617750050791
    }
  }
}
```

### 非单值分析：百分数型

#### percentiles 百分数范围

针对从聚合文档中提取的数值计算一个或多个百分位数。

```bash
GET latency/_search
{
  "size": 0,
  "aggs": {
    "load_time_outlier": {
      "percentiles": {
        "field": "load_time" 
      }
    }
  }
}
```

默认情况下，百分位度量标准将生成一定范围的百分位：[1，5，25，50，75，95，99]。

```bash
{
  ...

 "aggregations": {
    "load_time_outlier": {
      "values": {
        "1.0": 5.0,
        "5.0": 25.0,
        "25.0": 165.0,
        "50.0": 445.0,
        "75.0": 725.0,
        "95.0": 945.0,
        "99.0": 985.0
      }
    }
  }
}
```

#### percentile_ranks  百分数排行

根据从汇总文档中提取的数值计算一个或多个百分位等级。

```bash
GET latency/_search
{
  "size": 0,
  "aggs": {
    "load_time_ranks": {
      "percentile_ranks": {
        "field": "load_time",   
        "values": [ 500, 600 ]
      }
    }
  }
}
```

返回

```bash
{
  ...

 "aggregations": {
    "load_time_ranks": {
      "values": {
        "500.0": 90.01,
        "600.0": 100.0
      }
    }
  }
}
```

上述结果表示90.01％的页面加载在500ms内完成，而100％的页面加载在600ms内完成。

### 非单值分析：地理位置型

#### geo_bounds Geo bounds

```bash
PUT /museums
{
  "mappings": {
    "properties": {
      "location": {
        "type": "geo_point"
      }
    }
  }
}

POST /museums/_bulk?refresh
{"index":{"_id":1}}
{"location": "52.374081,4.912350", "name": "NEMO Science Museum"}
{"index":{"_id":2}}
{"location": "52.369219,4.901618", "name": "Museum Het Rembrandthuis"}
{"index":{"_id":3}}
{"location": "52.371667,4.914722", "name": "Nederlands Scheepvaartmuseum"}
{"index":{"_id":4}}
{"location": "51.222900,4.405200", "name": "Letterenhuis"}
{"index":{"_id":5}}
{"location": "48.861111,2.336389", "name": "Musée du Louvre"}
{"index":{"_id":6}}
{"location": "48.860000,2.327000", "name": "Musée d'Orsay"}

POST /museums/_search?size=0
{
  "query": {
    "match": { "name": "musée" }
  },
  "aggs": {
    "viewport": {
      "geo_bounds": {
        "field": "location",    
        "wrap_longitude": true  
      }
    }
  }
}
```

上面的汇总展示了如何针对具有商店业务类型的所有文档计算位置字段的边界框

```json
{
  ...
  "aggregations": {
    "viewport": {
      "bounds": {
        "top_left": {
          "lat": 48.86111099738628,
          "lon": 2.3269999679178
        },
        "bottom_right": {
          "lat": 48.85999997612089,
          "lon": 2.3363889567553997
        }
      }
    }
  }
}
```

#### geo_centroid Geo-centroid

```bash
PUT /museums
{
  "mappings": {
    "properties": {
      "location": {
        "type": "geo_point"
      }
    }
  }
}

POST /museums/_bulk?refresh
{"index":{"_id":1}}
{"location": "52.374081,4.912350", "city": "Amsterdam", "name": "NEMO Science Museum"}
{"index":{"_id":2}}
{"location": "52.369219,4.901618", "city": "Amsterdam", "name": "Museum Het Rembrandthuis"}
{"index":{"_id":3}}
{"location": "52.371667,4.914722", "city": "Amsterdam", "name": "Nederlands Scheepvaartmuseum"}
{"index":{"_id":4}}
{"location": "51.222900,4.405200", "city": "Antwerp", "name": "Letterenhuis"}
{"index":{"_id":5}}
{"location": "48.861111,2.336389", "city": "Paris", "name": "Musée du Louvre"}
{"index":{"_id":6}}
{"location": "48.860000,2.327000", "city": "Paris", "name": "Musée d'Orsay"}

POST /museums/_search?size=0
{
  "aggs": {
    "centroid": {
      "geo_centroid": {
        "field": "location" 
      }
    }
  }
}
```

上面的汇总显示了如何针对所有具有犯罪类型的盗窃文件计算位置字段的质心。

```json
{
  ...
  "aggregations": {
    "centroid": {
      "location": {
        "lat": 51.00982965203002,
        "lon": 3.9662131341174245
      },
      "count": 6
    }
  }
}
```

#### geo_line Geo-Line

```bash
PUT test
{
    "mappings": {
        "dynamic": "strict",
        "_source": {
            "enabled": false
        },
        "properties": {
            "my_location": {
                "type": "geo_point"
            },
            "group": {
                "type": "keyword"
            },
            "@timestamp": {
                "type": "date"
            }
        }
    }
}

POST /test/_bulk?refresh
{"index": {}}
{"my_location": {"lat":37.3450570, "lon": -122.0499820}, "@timestamp": "2013-09-06T16:00:36"}
{"index": {}}
{"my_location": {"lat": 37.3451320, "lon": -122.0499820}, "@timestamp": "2013-09-06T16:00:37Z"}
{"index": {}}
{"my_location": {"lat": 37.349283, "lon": -122.0505010}, "@timestamp": "2013-09-06T16:00:37Z"}

POST /test/_search?filter_path=aggregations
{
  "aggs": {
    "line": {
      "geo_line": {
        "point": {"field": "my_location"},
        "sort": {"field": "@timestamp"}
      }
    }
  }
}
```

将存储桶中的所有geo_point值聚合到由所选排序字段排序的LineString中。

```json
{
  "aggregations": {
    "line": {
      "type" : "Feature",
      "geometry" : {
        "type" : "LineString",
        "coordinates" : [
          [
            -122.049982,
            37.345057
          ],
          [
            -122.050501,
            37.349283
          ],
          [
            -122.049982,
            37.345132
          ]
        ]
      },
      "properties" : {
        "complete" : true
      }
    }
  }
}
```

### 非单值分析：Top型

#### top_hits 分桶后的top hits

```bash
POST /sales/_search?size=0
{
  "aggs": {
    "top_tags": {
      "terms": {
        "field": "type",
        "size": 3
      },
      "aggs": {
        "top_sales_hits": {
          "top_hits": {
            "sort": [
              {
                "date": {
                  "order": "desc"
                }
              }
            ],
            "_source": {
              "includes": [ "date", "price" ]
            },
            "size": 1
          }
        }
      }
    }
  }
}
```

返回

```json
{
  ...
  "aggregations": {
    "top_tags": {
       "doc_count_error_upper_bound": 0,
       "sum_other_doc_count": 0,
       "buckets": [
          {
             "key": "hat",
             "doc_count": 3,
             "top_sales_hits": {
                "hits": {
                   "total" : {
                       "value": 3,
                       "relation": "eq"
                   },
                   "max_score": null,
                   "hits": [
                      {
                         "_index": "sales",
                         "_type": "_doc",
                         "_id": "AVnNBmauCQpcRyxw6ChK",
                         "_source": {
                            "date": "2015/03/01 00:00:00",
                            "price": 200
                         },
                         "sort": [
                            1425168000000
                         ],
                         "_score": null
                      }
                   ]
                }
             }
          },
          {
             "key": "t-shirt",
             "doc_count": 3,
             "top_sales_hits": {
                "hits": {
                   "total" : {
                       "value": 3,
                       "relation": "eq"
                   },
                   "max_score": null,
                   "hits": [
                      {
                         "_index": "sales",
                         "_type": "_doc",
                         "_id": "AVnNBmauCQpcRyxw6ChL",
                         "_source": {
                            "date": "2015/03/01 00:00:00",
                            "price": 175
                         },
                         "sort": [
                            1425168000000
                         ],
                         "_score": null
                      }
                   ]
                }
             }
          },
          {
             "key": "bag",
             "doc_count": 1,
             "top_sales_hits": {
                "hits": {
                   "total" : {
                       "value": 1,
                       "relation": "eq"
                   },
                   "max_score": null,
                   "hits": [
                      {
                         "_index": "sales",
                         "_type": "_doc",
                         "_id": "AVnNBmatCQpcRyxw6ChH",
                         "_source": {
                            "date": "2015/01/01 00:00:00",
                            "price": 150
                         },
                         "sort": [
                            1420070400000
                         ],
                         "_score": null
                      }
                   ]
                }
             }
          }
       ]
    }
  }
}
```

#### top_metrics

```bash
POST /test/_bulk?refresh
{"index": {}}
{"s": 1, "m": 3.1415}
{"index": {}}
{"s": 2, "m": 1.0}
{"index": {}}
{"s": 3, "m": 2.71828}
POST /test/_search?filter_path=aggregations
{
  "aggs": {
    "tm": {
      "top_metrics": {
        "metrics": {"field": "m"},
        "sort": {"s": "desc"}
      }
    }
  }
}
```

返回

```json
{
  "aggregations": {
    "tm": {
      "top": [ {"sort": [3], "metrics": {"m": 2.718280076980591 } } ]
    }
  }
}
```

## pipeline聚合

pipeline聚合就是让上一步的聚合结果成为下一个聚合的输入，这就是管道。

### ElasticSearch设计管道机制

> 第一个维度：管道聚合有很多不同**类型**，每种类型都与其他聚合计算不同的信息，但是可以将这些类型分为两类：

- **父级** 父级聚合的输出提供了一组管道聚合，它可以计算新的存储桶或新的聚合以添加到现有存储桶中。
- **兄弟** 同级聚合的输出提供的管道聚合，并且能够计算与该同级聚合处于同一级别的新聚合。

> 第二个维度：根据**功能设计**的意图

比如前置聚合可能是Bucket聚合，后置的可能是基于Metric聚合，那么它就可以成为一类管道

进而引出了：`xxx bucket`

- Bucket聚合 -> Metric聚合

  ： bucket聚合的结果，成为下一步metric聚合的输入 

  - Average bucket
  - Min bucket
  - Max bucket
  - Sum bucket
  - Stats bucket
  - Extended stats bucket

### 案例

#### Average bucket 聚合

```bash
POST _search
{
  "size": 0,
  "aggs": {
    "sales_per_month": {
      "date_histogram": {
        "field": "date",
        "calendar_interval": "month"
      },
      "aggs": {
        "sales": {
          "sum": {
            "field": "price"
          }
        }
      }
    },
    "avg_monthly_sales": {
// tag::avg-bucket-agg-syntax[]               
      "avg_bucket": {
        "buckets_path": "sales_per_month>sales",
        "gap_policy": "skip",
        "format": "#,##0.00;(#,##0.00)"
      }
// end::avg-bucket-agg-syntax[]               
    }
  }
}
```

- 嵌套的bucket聚合：聚合出按月价格的直方图
- Metic聚合：对上面的聚合再求平均值。

**字段类型**：

- buckets_path：指定聚合的名称，支持多级嵌套聚合。
- gap_policy 当管道聚合遇到不存在的值，有点类似于term等聚合的(missing)时所采取的策略，可选择值为：skip、insert_zeros。
- skip：此选项将丢失的数据视为bucket不存在。它将跳过桶并使用下一个可用值继续计算。
- format 用于格式化聚合桶的输出(key)。

输出结果如下

```json
{
  "took": 11,
  "timed_out": false,
  "_shards": ...,
  "hits": ...,
  "aggregations": {
    "sales_per_month": {
      "buckets": [
        {
          "key_as_string": "2015/01/01 00:00:00",
          "key": 1420070400000,
          "doc_count": 3,
          "sales": {
            "value": 550.0
          }
        },
        {
          "key_as_string": "2015/02/01 00:00:00",
          "key": 1422748800000,
          "doc_count": 2,
          "sales": {
            "value": 60.0
          }
        },
        {
          "key_as_string": "2015/03/01 00:00:00",
          "key": 1425168000000,
          "doc_count": 2,
          "sales": {
            "value": 375.0
          }
        }
      ]
    },
    "avg_monthly_sales": {
      "value": 328.33333333333333,
      "value_as_string": "328.33"
    }
  }
}
```

#### Stats bucket 聚合

进一步的stat bucket也很容易理解了

```bash
POST /sales/_search
{
  "size": 0,
  "aggs": {
    "sales_per_month": {
      "date_histogram": {
        "field": "date",
        "calendar_interval": "month"
      },
      "aggs": {
        "sales": {
          "sum": {
            "field": "price"
          }
        }
      }
    },
    "stats_monthly_sales": {
      "stats_bucket": {
        "buckets_path": "sales_per_month>sales" 
      }
    }
  }
}
```

返回

```bash
{
   "took": 11,
   "timed_out": false,
   "_shards": ...,
   "hits": ...,
   "aggregations": {
      "sales_per_month": {
         "buckets": [
            {
               "key_as_string": "2015/01/01 00:00:00",
               "key": 1420070400000,
               "doc_count": 3,
               "sales": {
                  "value": 550.0
               }
            },
            {
               "key_as_string": "2015/02/01 00:00:00",
               "key": 1422748800000,
               "doc_count": 2,
               "sales": {
                  "value": 60.0
               }
            },
            {
               "key_as_string": "2015/03/01 00:00:00",
               "key": 1425168000000,
               "doc_count": 2,
               "sales": {
                  "value": 375.0
               }
            }
         ]
      },
      "stats_monthly_sales": {
         "count": 3,
         "min": 60.0,
         "max": 550.0,
         "avg": 328.3333333333333,
         "sum": 985.0
      }
   }
}
```

