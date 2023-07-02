---
title: ES查询文档
date: 2023-06-30
---

## DSL查询分类

Elasticsearch提供了基于JSON的DSL（[Domain Specific Language](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)）来定义查询。常见的查询类型包括：

- **查询所有**：查询出所有数据，一般测试用。例如：match_all

- **全文检索（full text）查询**：利用分词器对用户输入内容分词，然后去倒排索引库中匹配。例如：
  - match_query
  - multi_match_query
- **精确查询**：根据精确词条值查找数据，一般是查找keyword、数值、日期、boolean等类型字段。例如：
  - ids
  - range
  - term
- **地理（geo）查询**：根据经纬度查询。例如：
  - geo_distance
  - geo_bounding_box
- **复合（compound）查询**：复合查询可以将上述各种查询条件组合起来，合并查询条件。例如：
  - bool
  - function_score

查询的语法基本一致：

```json
GET /indexName/_search
{
  "query": {
    "查询类型": {
      "查询条件": "条件值"
    }
  }
}
```

我们以查询所有为例，其中：

- 查询类型为match_all
- 没有查询条件

```json
// 查询所有
GET /indexName/_search
{
  "query": {
    "match_all": {
    }
  }
}
```

其它查询无非就是**查询类型**、**查询条件**的变化。

## 全文搜索查询

### 使用场景

全文检索查询的基本流程如下：

- 对用户搜索的内容做分词，得到词条
- 根据词条去倒排索引库中匹配，得到文档id
- 根据文档id找到文档，返回给用户

比较常用的场景包括：

- 商城的输入框搜索
- 百度输入框搜索

例如京东：

![image-20230701141418672](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011414851.png)



### Match类型

#### match 查询的步骤

- **准备一些数据**

这里我们准备一些数据，通过实例看match 查询的步骤

```json
PUT /test-dsl-match
{ "settings": { "number_of_shards": 1 }} 

POST /test-dsl-match/_bulk
{ "index": { "_id": 1 }}
{ "title": "The quick brown fox" }
{ "index": { "_id": 2 }}
{ "title": "The quick brown fox jumps over the lazy dog" }
{ "index": { "_id": 3 }}
{ "title": "The quick brown fox jumps over the quick dog" }
{ "index": { "_id": 4 }}
{ "title": "Brown fox brown dog" }
```

- **查询数据**

```json
GET /test-dsl-match/_search
{
    "query": {
        "match": {
            "title": "QUICK!"
        }
    }
}
```

Elasticsearch 执行上面这个 match 查询的步骤是：

1. **检查字段类型** 。

标题 title 字段是一个 string 类型（ analyzed ）已分析的全文字段，这意味着查询字符串本身也应该被分析。

1. **分析查询字符串** 。

将查询的字符串 QUICK! 传入标准分析器中，输出的结果是单个项 quick 。因为只有一个单词项，所以 match 查询执行的是单个底层 term 查询。

1. **查找匹配文档** 。

用 term 查询在倒排索引中查找 quick 然后获取一组包含该项的文档，本例的结果是文档：1、2 和 3 。

1. **为每个文档评分** 。

用 term 查询计算每个文档相关度评分 _score ，这是种将词频（term frequency，即词 quick 在相关文档的 title 字段中出现的频率）和反向文档频率（inverse document frequency，即词 quick 在所有文档的 title 字段中出现的频率），以及字段的长度（即字段越短相关度越高）相结合的计算方式。

- **验证结果**

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011417587.png)

#### match多个词

##### match多个词的本质

查询多个词"BROWN DOG!"

```json
GET /test-dsl-match/_search
{
    "query": {
        "match": {
            "title": "BROWN DOG"
        }
    }
}
```

![](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011420635.png)

因为 match 查询必须查找两个词（ ["brown","dog"] ），它在内部实际上先执行两次 term 查询，然后将两次查询的结果合并作为最终结果输出。为了做到这点，它将两个 term 查询包入一个 bool 查询中，

所以上述查询的结果，和如下语句查询结果是等同的

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "bool": {
      "should": [
        {
          "term": {
            "title": "brown"
          }
        },
        {
          "term": {
            "title": "dog"
          }
        }
      ]
    }
  }
}
~~~

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011421485.png" alt="img" style="zoom: 67%;" />

##### match多个词的逻辑

上面等同于should（任意一个满足），是因为 match还有一个operator参数，默认是or, 所以对应的是should。

所以上述查询也等同于

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "match": {
      "title": {
        "query": "BROWN DOG",
        "operator": "or"
      }
    }
  }
}
~~~

那么我们如果是需要and操作呢，即同时满足呢？

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "match": {
      "title": {
        "query": "BROWN DOG",
        "operator": "and"
      }
    }
  }
}
~~~

等同于

~~~~ js
GET /test-dsl-match/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "title": "brown"
          }
        },
        {
          "term": {
            "title": "dog"
          }
        }
      ]
    }
  }
}
~~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011423551.png)

#### 控制match的匹配精度

如果用户给定 3 个查询词，想查找至少包含其中 2 个的文档，该如何处理？将 operator 操作符参数设置成 and 或者 or 都是不合适的。

match 查询支持 minimum_should_match 最小匹配参数，这让我们可以指定必须匹配的词项数用来表示一个文档是否相关。我们可以将其设置为某个具体数字，更常用的做法是将其设置为一个百分数，因为我们无法控制用户搜索时输入的单词数量：

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "match": {
      "title": {
        "query":"quick brown dog",
        "minimum_should_match": "75%"
      }
    }
  }
}
~~~

当给定百分比的时候，minimum_should_match 会做合适的事情：在之前三词项的示例中， 75% 会自动被截断成 66.6% ，即三个里面两个词。无论这个值设置成什么，至少包含一个词项的文档才会被认为是匹配的。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011425510.png" alt="img" style="zoom:67%;" />

当然也等同于

~~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "bool": {
      "should": [
        { "match": { "title": "quick" }},
        { "match": { "title": "brown"   }},
        { "match": { "title": "dog"   }}
      ],
      "minimum_should_match": 2 
    }
  }
}
~~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011425065.png)

#### 其它match类型

##### match_pharse

~~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "match_phrase": {
      "title": {
        "query": "quick brown"
      }
    }
  }
}
~~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011427068.png)

很多人对它仍然有误解的，比如如下例子：

```bash
GET /test-dsl-match/_search
{
  "query": {
    "match_phrase": {
      "title": {
        "query": "quick brown f"
      }
    }
  }
}
```

这样的查询是查不出任何数据的，因为前文中我们知道了match本质上是对term组合，match_phrase本质是连续的term的查询，所以f并不是一个分词，不满足term查询，所以最终查不出任何内容了。

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011427402.png)

##### match_pharse_prefix

那有没有可以查询出`quick brown f`的方式呢？ELasticSearch在match_phrase基础上提供了一种可以查最后一个词项是前缀的方法，这样就可以查询`quick brown f`了

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "match_phrase_prefix": {
      "title": {
        "query": "quick brown f"
      }
    }
  }
}
~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011428644.png)

> ps: prefix的意思不是整个text的开始匹配，而是最后一个词项满足term的prefix查询而已

##### match_bool_prefix

除了match_phrase_prefix，ElasticSearch还提供了match_bool_prefix查询

~~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "match_bool_prefix": {
      "title": {
        "query": "quick brown f"
      }
    }
  }
}
~~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011429835.png)

它们两种方式有啥区别呢？

match_bool_prefix查询中的quick,brown,f是无序的

match_bool_prefix本质上可以转换为：

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "bool" : {
      "should": [
        { "term": { "title": "quick" }},
        { "term": { "title": "brown" }},
        { "prefix": { "title": "f"}}
      ]
    }
  }
}
~~~

##### multi_match

如果我们期望一次对多个字段查询，怎么办呢？ElasticSearch提供了multi_match查询的方式

~~~~ json
{
  "query": {
    "multi_match" : {
      "query":    "Will Smith",
      "fields": [ "title", "*_name" ] 
    }
  }
}
~~~~

`*`表示前缀匹配字段

### query string类型

#### query_string

此查询使用语法根据运算符（例如AND或）来解析和拆分提供的查询字符串NOT。然后查询在返回匹配的文档之前独立分析每个拆分的文本。

可以使用该query_string查询创建一个复杂的搜索，其中包括通配符，跨多个字段的搜索等等。尽管用途广泛，但查询是严格的，如果查询字符串包含任何无效语法，则返回错误。

例如：

~~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "query_string": {
      "query": "(lazy dog) OR (brown dog)",
      "default_field": "title"
    }
  }
}
~~~~

这里查询结果，你需要理解本质上查询这四个分词（term）or的结果而已，所以doc 3和4也在其中

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011431968.png)

#### query_string_simple

该查询使用一种简单的语法来解析提供的查询字符串并将其拆分为基于特殊运算符的术语。然后查询在返回匹配的文档之前独立分析每个术语。

尽管其语法比query_string查询更受限制 ，但**simple_query_string 查询不会针对无效语法返回错误。而是，它将忽略查询字符串的任何无效部分**。

举例：

~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "simple_query_string" : {
        "query": "\"over the\" + (lazy | quick) + dog",
        "fields": ["title"],
        "default_operator": "and"
    }
  }
}
~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011432692.png)

### Interval类型

Intervals是时间间隔的意思，本质上将多个规则按照顺序匹配。

比如：

~~~~ json
GET /test-dsl-match/_search
{
  "query": {
    "intervals" : {
      "title" : {
        "all_of" : {
          "ordered" : true,
          "intervals" : [
            {
              "match" : {
                "query" : "quick",
                "max_gaps" : 0,
                "ordered" : true
              }
            },
            {
              "any_of" : {
                "intervals" : [
                  { "match" : { "query" : "jump over" } },
                  { "match" : { "query" : "quick dog" } }
                ]
              }
            }
          ]
        }
      }
    }
  }
}
~~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011433945.png)

## 复合查询

复合（compound）查询：复合查询可以将其它简单查询组合起来，实现更复杂的搜索逻辑。常见的有两种：

- fuction score：算分函数查询，可以控制文档相关性算分，控制文档排名
- bool query：布尔查询，利用逻辑关系组合多个其它的查询，实现复杂搜索

### bool query(布尔查询)

通过布尔逻辑将较小的查询组合成较大的查询。

#### 基本概念

Bool查询语法有以下特点

- 子查询可以任意顺序出现
- 可以嵌套多个查询，包括bool查询
- 如果bool查询中没有must条件，should中必须至少满足一条才会返回结果。

bool查询包含四种操作符，分别是must,should,must_not,filter。他们均是一种数组，数组里面是对应的判断条件。

- `must`： 必须匹配。贡献算分
- `must_not`：过滤子句，必须不能匹配，但不贡献算分
- `should`： 选择性匹配，至少满足一条。贡献算分
- `filter`： 过滤子句，必须匹配，但不贡献算分

#### 案例

看下官方举例

- 例子1

```bash
POST _search
{
  "query": {
    "bool" : {
      "must" : {
        "term" : { "user.id" : "kimchy" }
      },
      "filter": {
        "term" : { "tags" : "production" }
      },
      "must_not" : {
        "range" : {
          "age" : { "gte" : 10, "lte" : 20 }
        }
      },
      "should" : [
        { "term" : { "tags" : "env1" } },
        { "term" : { "tags" : "deployed" } }
      ],
      "minimum_should_match" : 1,
      "boost" : 1.0
    }
  }
}
```

在filter元素下指定的查询对评分没有影响 , 评分返回为0。分数仅受已指定查询的影响。

- 例子2

```bash
GET _search
{
  "query": {
    "bool": {
      "filter": {
        "term": {
          "status": "active"
        }
      }
    }
  }
}
```

这个例子查询查询为所有文档分配0分，因为没有指定评分查询。

- 例子3

```bash
GET _search
{
  "query": {
    "bool": {
      "must": {
        "match_all": {}
      },
      "filter": {
        "term": {
          "status": "active"
        }
      }
    }
  }
}
```

此bool查询具有match_all查询，该查询为所有文档指定1.0分。

- 例子4

```bash
GET /_search
{
  "query": {
    "bool": {
      "should": [
        { "match": { "name.first": { "query": "shay", "_name": "first" } } },
        { "match": { "name.last": { "query": "banon", "_name": "last" } } }
      ],
      "filter": {
        "terms": {
          "name.last": [ "banon", "kimchy" ],
          "_name": "test"
        }
      }
    }
  }
}
```

每个query条件都可以有一个`_name`属性，用来追踪搜索出的数据到底match了哪个条件。

### boosting query(提高查询)

不同于bool查询，bool查询中只要一个子查询条件不匹配那么搜索的数据就不会出现。而boosting query则是降低显示的权重/优先级（即score)。

#### 基本概念

比如搜索逻辑是 name = 'apple' and type ='fruit'，对于只满足部分条件的数据，不是不显示，而是降低显示的优先级（即score)

#### 案例

首先创建数据

```bash
POST /test-dsl-boosting/_bulk
{ "index": { "_id": 1 }}
{ "content":"Apple Mac" }
{ "index": { "_id": 2 }}
{ "content":"Apple Fruit" }
{ "index": { "_id": 3 }}
{ "content":"Apple employee like Apple Pie and Apple Juice" }
```

对匹配`pie`的做降级显示处理

```bash
GET /test-dsl-boosting/_search
{
  "query": {
    "boosting": {
      "positive": {
        "term": {
          "content": "apple"
        }
      },
      "negative": {
        "term": {
          "content": "pie"
        }
      },
      "negative_boost": 0.5
    }
  }
}
```

执行结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011441041.png)

### constant_score（固定分数查询）

查询某个条件时，固定的返回指定的score；显然当不需要计算score时，只需要filter条件即可，因为filter context忽略score。

#### 案例

首先创建数据

```bash
POST /test-dsl-constant/_bulk
{ "index": { "_id": 1 }}
{ "content":"Apple Mac" }
{ "index": { "_id": 2 }}
{ "content":"Apple Fruit" }
```

查询apple

```bash
GET /test-dsl-constant/_search
{
  "query": {
    "constant_score": {
      "filter": {
        "term": { "content": "apple" }
      },
      "boost": 1.2
    }
  }
}
```

执行结果如下：

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011442352.png)

### dis_max(最佳匹配查询）

分离最大化查询（Disjunction Max Query）指的是： 将任何与任一查询匹配的文档作为结果返回，但只将最佳匹配的评分作为查询的评分结果返回。

#### 案例

假设有个网站允许用户搜索博客的内容，以下面两篇博客内容文档为例：

```bash
POST /test-dsl-dis-max/_bulk
{ "index": { "_id": 1 }}
{"title": "Quick brown rabbits","body":  "Brown rabbits are commonly seen."}
{ "index": { "_id": 2 }}
{"title": "Keeping pets healthy","body":  "My quick brown fox eats rabbits on a regular basis."}
```

用户输入词组 “Brown fox” 然后点击搜索按钮。事先，我们并不知道用户的搜索项是会在 title 还是在 body 字段中被找到，但是，用户很有可能是想搜索相关的词组。用肉眼判断，文档 2 的匹配度更高，因为它同时包括要查找的两个词：

现在运行以下 bool 查询：

```bash
GET /test-dsl-dis-max/_search
{
    "query": {
        "bool": {
            "should": [
                { "match": { "title": "Brown fox" }},
                { "match": { "body":  "Brown fox" }}
            ]
        }
    }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011444346.png)

为了理解导致这样的原因，需要看下如何计算评分的

- **should 条件的计算分数**

```bash
GET /test-dsl-dis-max/_search
{
    "query": {
        "bool": {
            "should": [
                { "match": { "title": "Brown fox" }},
                { "match": { "body":  "Brown fox" }}
            ]
        }
    }
}
```

要计算上述分数，首先要计算match的分数

1. 第一个match 中 `brown的分数`

doc 1 分数 = 0.6931471

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011444557.png" alt="img" style="zoom: 80%;" />

2. title中没有fox，所以第一个match 中 `brown fox 的分数 = brown分数 + 0 = 0.6931471`

doc 1 分数 = 0.6931471 + 0 = 0.6931471

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011444183.png" alt="img" style="zoom:80%;" />

3. 第二个 match 中 `brown分数`

doc 1 分数 = 0.21110919

doc 2 分数 = 0.160443

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011445359.png" alt="img" style="zoom:80%;" />

4. 第二个 match 中 `fox分数`

doc 1 分数 = 0

doc 2 分数 = 0.60996956

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011445135.png" alt="img" style="zoom:80%;" />

5. 所以第二个 match 中 `brown fox分数 = brown分数 + fox分数`

doc 1 分数 = 0.21110919 + 0 = 0.21110919

doc 2 分数 = 0.160443 + 0.60996956 = 0.77041256

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011445784.png" alt="img" style="zoom:80%;" />

6. 所以整个语句分数， `should分数 = 第一个match + 第二个match分数`

doc 1 分数 = 0.6931471 + 0.21110919 = 0.90425634

doc 2 分数 = 0 + 0.77041256 = 0.77041256

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011446045.png" alt="img" style="zoom:80%;" />

- **引入了dis_max**

不使用 bool 查询，可以使用 dis_max 即分离 最大化查询（Disjunction Max Query） 。分离（Disjunction）的意思是 或（or） ，这与可以把结合（conjunction）理解成 与（and） 相对应。分离最大化查询（Disjunction Max Query）指的是： 将任何与任一查询匹配的文档作为结果返回，但只将最佳匹配的评分作为查询的评分结果返回 ：

```bash
GET /test-dsl-dis-max/_search
{
    "query": {
        "dis_max": {
            "queries": [
                { "match": { "title": "Brown fox" }},
                { "match": { "body":  "Brown fox" }}
            ],
            "tie_breaker": 0
        }
    }
}
```

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011446867.png" alt="img" style="zoom: 50%;" />

0.77041256怎么来的呢？ 下文给你解释它如何计算出来的。

- **dis_max 条件的计算分数**

分数 = 第一个匹配条件分数 + tie_breaker * 第二个匹配的条件的分数 ...

```bash
GET /test-dsl-dis-max/_search
{
    "query": {
        "dis_max": {
            "queries": [
                { "match": { "title": "Brown fox" }},
                { "match": { "body":  "Brown fox" }}
            ],
            "tie_breaker": 0
        }
    }
}
```

doc 1 分数 = 0.6931471 + 0.21110919 * 0 = 0.6931471

doc 2 分数 = 0.77041256 = 0.77041256

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011446429.png)

这样你就能理解通过dis_max将doc 2 置前了， 当然这里如果缺省`tie_breaker`字段的话默认就是0，你还可以设置它的比例（在0到1之间）来控制排名。（显然值为1时和should查询是一致的）

### function_score(函数查询）

简而言之就是用自定义function的方式来计算_score。

可以ES有哪些自定义function呢？

- `script_score` 使用自定义的脚本来完全控制分值计算逻辑。如果你需要以上预定义函数之外的功能，可以根据需要通过脚本进行实现。
- `weight` 对每份文档适用一个简单的提升，且该提升不会被归约：当weight为2时，结果为2 * _score。
- `random_score` 使用一致性随机分值计算来对每个用户采用不同的结果排序方式，对相同用户仍然使用相同的排序方式。
- `field_value_factor` 使用文档中某个字段的值来改变_score，比如将受欢迎程度或者投票数量考虑在内。
- `衰减函数(Decay Function)` - `linear`，`exp`，`gauss`

#### 案例

最简单的random_score 为例

```bash
GET /_search
{
  "query": {
    "function_score": {
      "query": { "match_all": {} },
      "boost": "5",
      "random_score": {}, 
      "boost_mode": "multiply"
    }
  }
}
```

进一步的，它还可以使用上述function的组合(functions)

```bash
GET /_search
{
  "query": {
    "function_score": {
      "query": { "match_all": {} },
      "boost": "5", 
      "functions": [
        {
          "filter": { "match": { "test": "bar" } },
          "random_score": {}, 
          "weight": 23
        },
        {
          "filter": { "match": { "test": "cat" } },
          "weight": 42
        }
      ],
      "max_boost": 42,
      "score_mode": "max",
      "boost_mode": "multiply",
      "min_score": 42
    }
  }
}
```

script_score 可以使用如下方式

```bash
GET /_search
{
  "query": {
    "function_score": {
      "query": {
        "match": { "message": "elasticsearch" }
      },
      "script_score": {
        "script": {
          "source": "Math.log(2 + doc['my-int'].value)"
        }
      }
    }
  }
}
```

## Term查询

准备数据

```bash
PUT /test-dsl-term-level
{
  "mappings": {
    "properties": {
      "name": {
        "type": "keyword"
      },
      "programming_languages": {
        "type": "keyword"
      },
      "required_matches": {
        "type": "long"
      }
    }
  }
}

POST /test-dsl-term-level/_bulk
{ "index": { "_id": 1 }}
{"name": "Jane Smith", "programming_languages": [ "c++", "java" ], "required_matches": 2}
{ "index": { "_id": 2 }}
{"name": "Jason Response", "programming_languages": [ "java", "php" ], "required_matches": 2}
{ "index": { "_id": 3 }}
{"name": "Dave Pdai", "programming_languages": [ "java", "c++", "php" ], "required_matches": 3, "remarks": 
```

### 字段是否存在:exist

由于多种原因，文档字段的索引值可能不存在：

- 源JSON中的字段是null或[]
- 该字段已"index" : false在映射中设置
- 字段值的长度超出ignore_above了映射中的设置
- 字段值格式错误，并且ignore_malformed已在映射中定义

所以exist表示查找是否存在字段。

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011449001.png)

### id查询:ids

ids 即对id查找

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "ids": {
      "values": [3, 1]
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011450308.png)

### 前缀:prefix

通过前缀查找某个字段

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "prefix": {
      "name": {
        "value": "Jan"
      }
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011450642.png)

### 分词匹配:term

~~~ json
GET /test-dsl-term-level/_search
{
  "query": {
    "term": {
      "programming_languages": "php"
    }
  }
}

~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011451225.png)

### 多个分词匹配:terms

按照读个分词term匹配，它们是or的关系

~~~~ json
GET /test-dsl-term-level/_search
{
  "query": {
    "terms": {
      "programming_languages": ["php","c++"]
    }
  }
}
~~~~

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011452486.png)

### 按某个数字字段分词匹配:term set

设计这种方式查询的初衷是用文档中的数字字段动态匹配查询满足term的个数

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "terms_set": {
      "programming_languages": {
        "terms": [ "java", "php" ],
        "minimum_should_match_field": "required_matches"
      }
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011452738.png)

### 通配符:wildcard

通配符匹配，比如`*`

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "wildcard": {
      "name": {
        "value": "D*ai",
        "boost": 1.0,
        "rewrite": "constant_score"
      }
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011453881.png)

### 范围:range

常常被用在数字或者日期范围的查询

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "range": {
      "required_matches": {
        "gte": 3,
        "lte": 4
      }
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011453892.png)

### 正则:regexp

通过正则表达式查询

以"Jan"开头的name字段

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "regexp": {
      "name": {
        "value": "Ja.*",
        "case_insensitive": true
      }
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011453422.png)

### 模糊匹配:fuzzy

官方文档对模糊匹配：编辑距离是将一个术语转换为另一个术语所需的一个字符更改的次数。这些更改可以包括：

- 更改字符（box→ fox）
- 删除字符（black→ lack）
- 插入字符（sic→ sick）
- 转置两个相邻字符（act→ cat）

```bash
GET /test-dsl-term-level/_search
{
  "query": {
    "fuzzy": {
      "remarks": {
        "value": "hell"
      }
    }
  }
}
```

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011453076.png)

## 搜索结果处理

搜索的结果可以按照用户指定的方式去处理或展示。

### 排序

elasticsearch默认是根据相关度算分（_score）来排序，但是也支持自定义方式对搜索[结果排序](https://www.elastic.co/guide/en/elasticsearch/reference/current/sort-search-results.html)。可以排序字段类型有：keyword类型、数值类型、地理坐标类型、日期类型等。

#### 普通字段排序

keyword、数值、日期类型排序的语法基本一致。

**语法**：

```json
GET /indexName/_search
{
  "query": {
    "match_all": {}
  },
  "sort": [
    {
      "FIELD": "desc"  // 排序字段、排序方式ASC、DESC
    }
  ]
}
```

排序条件是一个数组，也就是可以写多个排序条件。按照声明的顺序，当第一个条件相等时，再按照第二个条件排序，以此类推

**示例**：

需求描述：酒店数据按照用户评价（score)降序排序，评价相同的按照价格(price)升序排序

![image-20230701145522412](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011455482.png)

#### 地理坐标排序

地理坐标排序略有不同。

**语法说明**：

```json
GET /indexName/_search
{
  "query": {
    "match_all": {}
  },
  "sort": [
    {
      "_geo_distance" : {
          "FIELD" : "纬度，经度", // 文档中geo_point类型的字段名、目标坐标点
          "order" : "asc", // 排序方式
          "unit" : "km" // 排序的距离单位
      }
    }
  ]
}
```

这个查询的含义是：

- 指定一个坐标，作为目标点
- 计算每一个文档中，指定字段（必须是geo_point类型）的坐标 到目标点的距离是多少
- 根据距离排序

**示例：**

需求描述：实现对酒店数据按照到你的位置坐标的距离升序排序

提示：[获取你的位置的经纬度的方式](https://lbs.amap.com/demo/jsapi-v2/example/map/click-to-get-lnglat/)

假设我的位置是：31.034661，121.612282，寻找我周围距离最近的酒店。

![image-20230701145615170](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011456296.png)

### 分页

elasticsearch 默认情况下只返回top10的数据。而如果要查询更多数据就需要修改分页参数了。elasticsearch中通过修改from、size参数来控制要返回的分页结果：

- from：从第几个文档开始
- size：总共查询几个文档

类似于mysql中的`limit ?, ?`

#### 基本的分页

分页的基本语法如下：

```json
GET /hotel/_search
{
  "query": {
    "match_all": {}
  },
  "from": 0, // 分页开始的位置，默认为0
  "size": 10, // 期望获取的文档总数
  "sort": [
    {"price": "asc"}
  ]
}
```

#### 深度分页问题

现在，我要查询990~1000的数据，查询逻辑要这么写：

```json
GET /hotel/_search
{
  "query": {
    "match_all": {}
  },
  "from": 990, // 分页开始的位置，默认为0
  "size": 10, // 期望获取的文档总数
  "sort": [
    {"price": "asc"}
  ]
}
```

这里是查询990开始的数据，也就是 第990~第1000条 数据。

不过，elasticsearch内部分页时，必须先查询 0~1000条，然后截取其中的990 ~ 1000的这10条：

![image-20230701145702222](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011457291.png)

查询TOP1000，如果es是单点模式，这并无太大影响。

但是elasticsearch将来一定是集群，例如我集群有5个节点，我要查询TOP1000的数据，并不是每个节点查询200条就可以了。

因为节点A的TOP200，在另一个节点可能排到10000名以外了。

因此要想获取整个集群的TOP1000，必须先查询出每个节点的TOP1000，汇总结果后，重新排名，重新截取TOP1000。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011457353.png" alt="image-20230701145715274" style="zoom: 80%;" />



那如果我要查询9900~10000的数据呢？是不是要先查询TOP10000呢？那每个节点都要查询10000条？汇总到内存中？



当查询分页深度较大时，汇总数据过多，对内存和CPU会产生非常大的压力，因此elasticsearch会禁止from+ size 超过10000的请求。



针对深度分页，ES提供了两种解决方案，[官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/paginate-search-results.html)：

- search after：分页时需要排序，原理是从上一次的排序值开始，查询下一页数据。官方推荐使用的方式。
- scroll：原理将排序后的文档id形成快照，保存在内存。官方已经不推荐使用。

#### 小结

分页查询的常见实现方案以及优缺点：

- `from + size`：
  - 优点：支持随机翻页
  - 缺点：深度分页问题，默认查询上限（from + size）是10000
  - 场景：百度、京东、谷歌、淘宝这样的随机翻页搜索
- `after search`：
  - 优点：没有查询上限（单次查询的size不超过10000）
  - 缺点：只能向后逐页查询，不支持随机翻页
  - 场景：没有随机翻页需求的搜索，例如手机向下滚动翻页
- `scroll`：
  - 优点：没有查询上限（单次查询的size不超过10000）
  - 缺点：会有额外内存消耗，并且搜索结果是非实时的
  - 场景：海量数据的获取和迁移。从ES7.1开始不推荐，建议用 after search方案。

### 高亮

#### 高亮原理

什么是高亮显示呢？

我们在百度，京东搜索时，关键字会变成红色，比较醒目，这叫高亮显示：

![image-20230701145824993](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011458073.png)

高亮显示的实现分为两步：

1. 给文档中的所有关键字都添加一个标签，例如`<em>`标签
2. 面给`<em>`标签编写CSS样式

#### 实现高亮

**高亮的语法**：

```json
GET /hotel/_search
{
  "query": {
    "match": {
      "FIELD": "TEXT" // 查询条件，高亮一定要使用全文检索查询
    }
  },
  "highlight": {
    "fields": { // 指定要高亮的字段
      "FIELD": {
        "pre_tags": "<em>",  // 用来标记高亮字段的前置标签
        "post_tags": "</em>" // 用来标记高亮字段的后置标签
      }
    }
  }
}
```

**注意：**

- 高亮是对关键字高亮，因此**搜索条件必须带有关键字**，而不能是范围这样的查询。
- 默认情况下，**高亮的字段，必须与搜索指定的字段一致**，否则无法高亮
- 如果要对非搜索字段高亮，则需要添加一个属性：required_field_match=false

**示例**：

![image-20230701145909732](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011459870.png)

### 总结

查询的DSL是一个大的JSON对象，包含下列属性：

- query：查询条件
- from和size：分页条件
- sort：排序条件
- highlight：高亮条件

![image-20230701145938870](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011459957.png)

## RestClient查询文档

### 快速入门

我们以match_all查询为例

#### 发起查询请求

![image-20230701150102913](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011501998.png)

代码解读：

- 第一步，创建`SearchRequest`对象，指定索引库名

- 第二步，利用`request.source()`构建DSL，DSL中可以包含查询、分页、排序、高亮等
  - `query()`：代表查询条件，利用`QueryBuilders.matchAllQuery()`构建一个match_all查询的DSL
- 第三步，利用client.search()发送请求，得到响应

这里关键的API有两个，一个是`request.source()`，其中包含了查询、排序、分页、高亮等所有功能：

![image-20230701150122009](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011501097.png)

另一个是`QueryBuilders`，其中包含match、term、function_score、bool等各种查询：

![image-20230701150134563](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011501651.png)

#### 解析响应

![image-20230701150158089](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011501204.png)

elasticsearch返回的结果是一个JSON字符串，结构包含：

- `hits`：命中的结果
  - `total`：总条数，其中的value是具体的总条数值
  - `max_score`：所有结果中得分最高的文档的相关性算分
  - `hits`：搜索结果的文档数组，其中的每个文档都是一个json对象
    - `_source`：文档中的原始数据，也是json对象

因此，我们解析响应结果，就是逐层解析JSON字符串，流程如下：

- `SearchHits`：通过response.getHits()获取，就是JSON中的最外层的hits，代表命中的结果
  - `SearchHits#getTotalHits().value`：获取总条数信息
  - `SearchHits#getHits()`：获取SearchHit数组，也就是文档数组
    - `SearchHit#getSourceAsString()`：获取文档结果中的_source，也就是原始的json文档数据

#### 完整代码

~~~~ java
@Test
void testMatchAll() throws IOException {
    // 1.准备Request
    SearchRequest request = new SearchRequest("hotel");
    // 2.准备DSL
    request.source()
        .query(QueryBuilders.matchAllQuery());
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);

    // 4.解析响应
    handleResponse(response);
}

private void handleResponse(SearchResponse response) {
    // 4.解析响应
    SearchHits searchHits = response.getHits();
    // 4.1.获取总条数
    long total = searchHits.getTotalHits().value;
    System.out.println("共搜索到" + total + "条数据");
    // 4.2.文档数组
    SearchHit[] hits = searchHits.getHits();
    // 4.3.遍历
    for (SearchHit hit : hits) {
        // 获取文档source
        String json = hit.getSourceAsString();
        // 反序列化
        HotelDoc hotelDoc = JSON.parseObject(json, HotelDoc.class);
        System.out.println("hotelDoc = " + hotelDoc);
    }
}
~~~~

#### 小结

步骤是：

1. 创建SearchRequest对象

2. 准备Request.source()，也就是DSL。

   1. QueryBuilders来构建查询条件
   2. 传入Request.source() 的 query() 方法

3. 发送请求，得到结果

4. 解析结果（参考JSON结果，从外到内，逐层解析）

### match查询

全文检索的match和multi_match查询与match_all的API基本一致。差别是查询条件，也就是query的部分。

![image-20230701150311394](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011503466.png)

因此，Java代码上的差异主要是request.source().query()中的参数了。同样是利用QueryBuilders提供的方法：

![image-20210721215843099](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011503815.png) 

而结果解析代码则完全一致，可以抽取并共享。

**完整代码如下：**

```java
@Test
void testMatch() throws IOException {
    // 1.准备Request
    SearchRequest request = new SearchRequest("hotel");
    // 2.准备DSL
    request.source()
        .query(QueryBuilders.matchQuery("all", "如家"));
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);

}
```

### 精确查询

精确查询主要是两者：

- term：词条精确匹配
- range：范围查询

与之前的查询相比，差异同样在查询条件，其它都一样。

查询条件构造的API如下：

![image-20210721220305140](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011503041.png)

### 布尔查询

布尔查询是用must、must_not、filter等方式组合其它查询，代码示例如下：

![image-20210721220927286](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011504129.png)



可以看到，API与其它查询的差别同样是在查询条件的构建，QueryBuilders，结果解析等其他代码完全不变。

**完整代码如下：**

```java
@Test
void testBool() throws IOException {
    // 1.准备Request
    SearchRequest request = new SearchRequest("hotel");
    // 2.准备DSL
    // 2.1.准备BooleanQuery
    BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
    // 2.2.添加term
    boolQuery.must(QueryBuilders.termQuery("city", "杭州"));
    // 2.3.添加range
    boolQuery.filter(QueryBuilders.rangeQuery("price").lte(250));

    request.source().query(boolQuery);
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);

}
```

### 排序、分页

搜索结果的排序和分页是与query同级的参数，因此同样是使用request.source()来设置。

对应的API如下：

![image-20210721221121266](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011504998.png)**完整代码示例：**

```java
@Test
void testPageAndSort() throws IOException {
    // 页码，每页大小
    int page = 1, size = 5;

    // 1.准备Request
    SearchRequest request = new SearchRequest("hotel");
    // 2.准备DSL
    // 2.1.query
    request.source().query(QueryBuilders.matchAllQuery());
    // 2.2.排序 sort
    request.source().sort("price", SortOrder.ASC);
    // 2.3.分页 from、size
    request.source().from((page - 1) * size).size(5);
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);

}
```

### 高亮

高亮的代码与之前代码差异较大，有两点：

- 查询的DSL：其中除了查询条件，还需要添加高亮条件，同样是与query同级。
- 结果解析：结果除了要解析_source文档数据，还要解析高亮结果

#### 高亮请求构建

高亮请求的构建API如下：

![image-20210721221744883](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011505350.png)

上述代码省略了查询条件部分，但是大家不要忘了：高亮查询必须使用全文检索查询，并且要有搜索关键字，将来才可以对关键字高亮。

**完整代码如下：**

```java
@Test
void testHighlight() throws IOException {
    // 1.准备Request
    SearchRequest request = new SearchRequest("hotel");
    // 2.准备DSL
    // 2.1.query
    request.source().query(QueryBuilders.matchQuery("all", "如家"));
    // 2.2.高亮
    request.source().highlighter(new HighlightBuilder().field("name").requireFieldMatch(false));
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);

}
```

#### 高亮结果解析

高亮的结果与查询的文档结果默认是分离的，并不在一起。

因此解析高亮的代码需要额外处理：

![image-20210721222057212](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011505360.png)

**代码解读：**

- 第一步：从结果中获取source。hit.getSourceAsString()，这部分是非高亮结果，json字符串。还需要反序列为HotelDoc对象
- 第二步：获取高亮结果。hit.getHighlightFields()，返回值是一个Map，key是高亮字段名称，值是HighlightField对象，代表高亮值
- 第三步：从map中根据高亮字段名称，获取高亮字段值对象HighlightField
- 第四步：从HighlightField中获取Fragments，并且转为字符串。这部分就是真正的高亮字符串了
- 第五步：用高亮的结果替换HotelDoc中的非高亮结果

**完整代码如下：**

```java
private void handleResponse(SearchResponse response) {
    // 4.解析响应
    SearchHits searchHits = response.getHits();
    // 4.1.获取总条数
    long total = searchHits.getTotalHits().value;
    System.out.println("共搜索到" + total + "条数据");
    // 4.2.文档数组
    SearchHit[] hits = searchHits.getHits();
    // 4.3.遍历
    for (SearchHit hit : hits) {
        // 获取文档source
        String json = hit.getSourceAsString();
        // 反序列化
        HotelDoc hotelDoc = JSON.parseObject(json, HotelDoc.class);
        // 获取高亮结果
        Map<String, HighlightField> highlightFields = hit.getHighlightFields();
        if (!CollectionUtils.isEmpty(highlightFields)) {
            // 根据字段名获取高亮结果
            HighlightField highlightField = highlightFields.get("name");
            if (highlightField != null) {
                // 获取高亮值
                String name = highlightField.getFragments()[0].string();
                // 覆盖非高亮结果
                hotelDoc.setName(name);
            }
        }
        System.out.println("hotelDoc = " + hotelDoc);
    }
}
```

