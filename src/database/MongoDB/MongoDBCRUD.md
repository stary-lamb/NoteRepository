---
title: MongoDBCRUD
date: 2023-07-01
---

## 集合操作

集合，类似关系型数据库中的表。

可以显示的创建，也可以隐式的创建。  

### 集合的显式创建

基本语法格式：

~~~ shell
db.createCollection(name)
~~~

参数说明：

- name: 要创建的集合名称

例如：创建一个名为 mycollection 的普通集合。

~~~ shell
db.createCollection("mycollection")
~~~

查看当前库中的表：show tables命令  

~~~ shell
show collections
或 
show tables
~~~

集合的命名规范：

- 集合名不能是空字符串""。
- 集合名不能含有`\0字符`（空字符)，这个字符表示集合名的结尾。
- 集合名不能以"system."开头，这是为系统集合保留的前缀。
- 用户创建的集合名字不能含有保留字符。有些驱动程序的确支持在集合名里面包含，这是因为某些系统生成的集合中包含该字符。除
- 非你要访问这种系统创建的集合，否则千万不要在名字里出现$。

### 集合的隐式创建

当向一个集合中插入一个文档的时候，如果集合不存在，则会自动创建集合。

> 提示：通常我们使用隐式创建文档即可。  

### 集合的删除

集合删除语法格式如下：  

~~~ shell
db.collection.drop()
或 
db.集合.drop()
~~~

**返回值**

如果成功删除选定集合，则 drop() 方法返回 true，否则返回 false。

例如：要删除mycollection集合  

~~~ shell
db.mycollection.drop()
~~~

## 文档基本CRUD

文档（document）的数据结构和 JSON 基本一样。

所有存储在集合中的数据都是 BSON 格式。  

### 文档的插入

#### 单个文档插入

使用insert() 或 save() 方法向集合中插入文档，语法如下：  

~~~ shell
db.collection.insert(
	<document or array of documents>,
	{
	  writeConcern: <document>,
	  ordered: <boolean>
	}
)
~~~

参数：

| Parameter    | Type              | Description                                                  |
| ------------ | ----------------- | ------------------------------------------------------------ |
| document     | document or array | 要插入到集合中的文档或文档数组。(json格式）                  |
| writeConcern | document          | Optional. A document expressing the write concern. Omit to use the default write concern. See Write Concern.Do not explicitly set the write concern for the operation if run in a transaction. To use write concern with transactions, see Transactions and Write Concern. |
| ordered      | boolean           | 可选。如果为真，则按顺序插入数组中的文档，如果其中一个文档出现错误，MongoDB将返回而 不处理数组中的其余文档。如果为假，则执行无序插入，如果其中一个文档出现错误，则继续处理 数组中的主文档。在版本2.6+中默认为true |

示例：

要向comment的集合(表)中插入一条测试数据：  

~~~ shell
db.comment.insert({"articleid":"100000","content":"今天天气真好，阳光媚","userid":"1001","nickname":"Rose","createdatetime":new Date(),"likenum":NumberInt(10),"state":null})
~~~

提示：

1. comment集合如果不存在，则会隐式创建
2. Mongo中的数字，默认情况下是double类型，如果要存整型，必须使用函数NumberInt(整型数字)，否则取出来就有问题了。
3. 插入当前日期使用 new Date()
4. 插入的数据没有指定 _id ，会自动生成主键值
5. 如果某字段没值，可以赋值为null，或不写该字段。  

执行后，如下，说明插入一个数据成功了。

~~~ shell
WriteResult({ "nInserted" : 1 })
~~~



注意：

1. 文档中的键/值对是有序的。
2. 文档中的值不仅可以是在双引号里面的字符串，还可以是其他几种数据类型（甚至可以是整个嵌入的文档)。
3. MongoDB区分类型和大小写。
4. MongoDB的文档不能有重复的键。
5. 文档的键是字符串。除了少数例外情况，键可以使用任意UTF-8字符

文档键命名规范：

- 键不能含有`\0` (空字符)。这个字符用来表示键的结尾。
- `.`和`$`有特别的意义，只有在特定环境下才能使用。
- 以下划线`"_"`开头的键是保留的(不是严格要求的)。  

#### 批量插入

语法：

~~~ shell
db.collection.insertMany(
	[ <document 1> , <document 2>, ... ],
	{
	  writeConcern: <document>,
	  ordered: <boolean>
	}
)
~~~

参数：

| Parameter    | Type     | Description                                                  |
| ------------ | -------- | ------------------------------------------------------------ |
| document     | document | 要插入到集合中的文档或文档数组。（(json格式）                |
| writeConcern | document | Optional. A document expressing the write concern. Omit to use the default write concern.Do not explicitly set the write concern for the operation if run in a transaction. To use write concern with transactions, see Transactions and Write Concern. |
| ordered      | boolean  | 可选。一个布尔值，指定Mongod实例应执行有序插入还是无序插入。默认为true。 |

示例：

批量插入多条文章评论：

~~~ shell
db.comment.insertMany([
{"_id":"1","articleid":"100001","content":"我们不应该把清晨浪费在手机上，健康很重要，一杯温水幸福你我
他。","userid":"1002","nickname":"相忘于江湖","createdatetime":new Date("2019-08-
05T22:08:15.522Z"),"likenum":NumberInt(1000),"state":"1"},
{"_id":"2","articleid":"100001","content":"我夏天空腹喝凉开水，冬天喝温开水","userid":"1005","nickname":"伊人憔
悴","createdatetime":new Date("2019-08-05T23:58:51.485Z"),"likenum":NumberInt(888),"state":"1"},
{"_id":"3","articleid":"100001","content":"我一直喝凉开水，冬天夏天都喝。","userid":"1004","nickname":"杰克船
长","createdatetime":new Date("2019-08-06T01:05:06.321Z"),"likenum":NumberInt(666),"state":"1"},
{"_id":"4","articleid":"100001","content":"专家说不能空腹吃饭，影响健康。","userid":"1003","nickname":"凯
撒","createdatetime":new Date("2019-08-06T08:18:35.288Z"),"likenum":NumberInt(2000),"state":"1"},
{"_id":"5","articleid":"100001","content":"研究表明，刚烧开的水千万不能喝，因为烫
嘴。","userid":"1003","nickname":"凯撒","createdatetime":new Date("2019-08-
06T11:01:02.521Z"),"likenum":NumberInt(3000),"state":"1"}
]);
~~~

提示：

插入时指定了`_id`，则主键就是该值。

如果某条数据插入失败，将会终止插入，但已经插入成功的数据不会回滚掉。

因为批量插入由于数据较多容易出现失败，因此，可以使用try catch进行异常捕捉处理，测试的时候可以不处理。如（了解）：

~~~~ shell
try {
db.comment.insertMany([
{"_id":"1","articleid":"100001","content":"我们不应该把清晨浪费在手机上，健康很重要，一杯温水幸福你我
他。","userid":"1002","nickname":"相忘于江湖","createdatetime":new Date("2019-08-
05T22:08:15.522Z"),"likenum":NumberInt(1000),"state":"1"},
{"_id":"2","articleid":"100001","content":"我夏天空腹喝凉开水，冬天喝温开水","userid":"1005","nickname":"伊人憔
悴","createdatetime":new Date("2019-08-05T23:58:51.485Z"),"likenum":NumberInt(888),"state":"1"},
{"_id":"3","articleid":"100001","content":"我一直喝凉开水，冬天夏天都喝。","userid":"1004","nickname":"杰克船
长","createdatetime":new Date("2019-08-06T01:05:06.321Z"),"likenum":NumberInt(666),"state":"1"},
{"_id":"4","articleid":"100001","content":"专家说不能空腹吃饭，影响健康。","userid":"1003","nickname":"凯
撒","createdatetime":new Date("2019-08-06T08:18:35.288Z"),"likenum":NumberInt(2000),"state":"1"},
{"_id":"5","articleid":"100001","content":"研究表明，刚烧开的水千万不能喝，因为烫
嘴。","userid":"1003","nickname":"凯撒","createdatetime":new Date("2019-08-
06T11:01:02.521Z"),"likenum":NumberInt(3000),"state":"1"}
]);
} catch (e) {
print (e);
}
~~~~

### 文档的基本查询

查询数据的语法格式如下：

~~~ shell
db.collection.find(<query>, [projection])
~~~

参数：

| Parameter  | Type     | Description                                                  |
| ---------- | -------- | ------------------------------------------------------------ |
| query      | document | 可选。使用查询运算符指定选择筛选器。若要返回集合中的所有文档，请省略此参数或传递空文档 ( {} )。 |
| projection | document | 可选。指定要在与查询筛选器匹配的文档中返回的字段（投影）。若要返回匹配文档中的所有字段， 请省略此参数。 |

#### 查询所有

如果我们要查询spit集合的所有文档，我们输入以下命令 

~~~ shell
db.comment.find()
或 
db.comment.find({})
~~~

这里你会发现每条文档会有一个叫_id的字段，这个相当于我们原来关系数据库中表的主键，当你在插入文档记录时没有指定该字段，MongoDB会自动创建，其类型是ObjectID类型。

如果我们在插入文档记录时指定该字段也可以，其类型可以是ObjectID类型，也可以是MongoDB支持的任意类型。

如果我想按一定条件来查询，比如我想查询userid为1003的记录，怎么办？很简单！只 要在find()中添加参数即可，参数也是json格式，如下：  

~~~~ shell
db.comment.find({userid:'1003'})
~~~~

如果你只需要返回符合条件的第一条数据，我们可以使用findOne命令来实现，语法和find一样。

如：查询用户编号是1003的记录，但只最多返回符合条件的第一条记录：

~~~ shell
db.comment.findOne({userid:'1003'})
~~~

#### 投影查询（Projection Query）

如果要查询结果返回部分字段，则需要使用投影查询（不显示所有字段，只显示指定的字段）。

如：查询结果只显示 _id、userid、nickname : 

~~~ shell
> db.comment.find({userid:"1003"},{userid:1,nickname:1})
{ "_id" : "4", "userid" : "1003", "nickname" : "凯撒" }
{ "_id" : "5", "userid" : "1003", "nickname" : "凯撒" }
~~~

默认`_id`会显示。

如：查询结果只显示`userid、nickname`，不显示`_id`：  

~~~ shell
> db.comment.find({userid:"1003"},{userid:1,nickname:1,_id:0})
{ "userid" : "1003", "nickname" : "凯撒" }
{ "userid" : "1003", "nickname" : "凯撒" }
~~~

再例如：查询所有数据，但只显示`_id、userid、nickname`: 

~~~ shell
> db.comment.find({},{userid:1,nickname:1})
~~~

### 文档的更新

更新文档的语法：

~~~ shell
db.collection.update(query, update, options)
//或
db.collection.update(
<query>,
<update>,
{
upsert: <boolean>,
multi: <boolean>,
writeConcern: <document>,
collation: <document>,
arrayFilters: [ <filterdocument1>, ... ],
hint: <document|string> // Available starting in MongoDB 4.2
}
)
~~~

| Parameter    | Type                 | Description                                                  |
| ------------ | -------------------- | ------------------------------------------------------------ |
| query        | document             | 更新的选择条件。可以使用与find（）方法中相同的查询选择器，类似sql update查询内where后面的。。在3.0版中进行了更改：当使用upsert:true执行update（）时，如果查询使用点表示法在_id字段上指定条件，则MongoDB将拒绝插入新文档。 |
| update       | document or pipeline | 要应用的修改。该值可以是：包含更新运算符表达式的文档，或仅包含：对的替换文档，或在MongoDB 4.2中启动聚合管道。管道可以由以下阶段组成： 癲 其 别 名 set 癲 其 别 名 unset 癲 其 别 名 replaceWith。换句话说：它是update的对象和一些更新的操作符（如 inc...）等，也可以理解为 |
| upsert       | boolean              | 可选。如果设置为true，则在没有与查询条件匹配的文档时创建新文档。默认值为false，如果找不到匹配项，则不会插入新文档。 |
| multi        | boolean              | 可选。如果设置为true，则更新符合查询条件的多个文档。如果设置为false，则更新一个文档。默认值为false。 |
| writeConcern | document             | 可选。表示写问题的文档。抛出异常的级别。                     |
| collation    | document             | 可选。 指定要用于操作的校对规则。 校对规则允许用户为字符串比较指定特定于语言的规则，例如字母大小写和重音标记的规则。 校对规则选项具有以下语法： <br>校对规则：{ 区域设置：， caseLevel:， caseFirst:， 强度：， numericordering:， 替代：， 最大变量：， 向后： } <br>指定校对规则时，区域设置字段是必需的；所有其他校对规则字段都是可选的。有关字段的说明，请参阅校对规则文档。<br/> 如果未指定校对规则，但集合具有默认校对规则（请参见db.createCollection（）），则该操作将使用为集合指定的校对规则。 <br/>如果没有为集合或操作指定校对规则，MongoDB将使用以前版本中使用的简单二进制比较进行字符串比较。不能为一个操作指定多个校对规则。例如，不能为每个字段指定不同的校对规则，或者如果使用排序执行查找，则不能将一个校对规则用于查找，另一个校对规则用于排序。 3.4版新增。 |
| arrayFilters | array                | 可选。一个筛选文档数组，用于确定要为数组字段上的更新操作修改哪些数组元素。 |
| hint         | Document or string   | 可选。指定用于支持查询谓词的索引的文档或字符串。该选项可以采用索引规范文档或索引名称字符串。如果指定的索引不存在，则说明操作错误。例如，请参阅版本4中的“为更新操作指定提示。 |

> 提示：主要关注前四个参数即可。  

#### 覆盖的修改

如果我们想修改_id为1的记录，点赞量为1001，输入以下语句： 

~~~~ shell
db.comment.update({_id:"1"},{likenum:NumberInt(1001)})
~~~~

执行后，我们会发现，这条文档除了likenum字段其它字段都不见了

#### 局部修改

为了解决这个问题，我们需要使用修改器`$set`来实现，命令如下：

我们想修改_id为2的记录，浏览量为889，输入以下语句：

~~~ shell
db.comment.update({_id:"2"},{$set:{likenum:NumberInt(889)}})
~~~

#### 批量的修改

更新所有用户为`1003`的用户的昵称为`凯撒大帝`   

~~~~ shell
//默认只修改第一条数据
db.comment.update({userid:"1003"},{$set:{nickname:"凯撒2"}})
//修改所有符合条件的数据
db.comment.update({userid:"1003"},{$set:{nickname:"凯撒大帝"}},{multi:true})
~~~~

> 提示：如果不加后面的参数，则只更新符合条件的第一条记录  

#### 列值增长的修改

如果我们想实现对某列值在原有值的基础上进行增加或减少，可以使用 $inc 运算符来实现。

需求：对3号数据的点赞数，每次递增1  

~~~ shell
db.comment.update({_id:"3"},{$inc:{likenum:NumberInt(1)}})
~~~

### 删除文档

删除文档的语法结构：

~~~~ shell
db.集合名称.remove(条件)
~~~~

以下语句可以将数据全部删除，请慎用  

~~~ shell
db.comment.remove({})
~~~

如果删除_id=1的记录，输入以下语句

~~~~ shell
db.comment.remove({_id:"1"})文档的分页查询
~~~~

## 文档查询

### 统计查询 

统计查询使用count()方法，语法如下：

~~~~ shell
db.collection.count(query, options)
~~~~

参数：  

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| query     | document | 查询选择条件。                 |
| options   | document | 可选。用于修改计数的额外选项。 |

> 提示：可选项暂时不使用。

#### 统计所有记录数

统计comment集合的所有的记录数：  

~~~ shell
db.comment.count()
~~~

#### 按条件统计记录数

例如：统计userid为1003的记录条数  

~~~ shell
db.comment.count({userid:"1003"})
~~~

> 提示：默认情况下 count() 方法返回符合条件的全部记录条数。  

### 分页列表查

可以使用limit()方法来读取指定数量的数据，使用skip()方法来跳过指定数量的数据。

基本语法如下所示：  

~~~ shell
>db.COLLECTION_NAME.find().limit(NUMBER).skip(NUMBER)
~~~

如果你想返回指定条数的记录，可以在find方法后调用limit来返回结果(TopN)，默认值20，例如：  

~~~ shell
db.comment.find().limit(3)
~~~

skip方法同样接受一个数字参数作为跳过的记录条数。（前N个不要）,默认值是0  

~~~ shell
db.comment.find().skip(3)
~~~



分页查询：需求：每页2个，第二页开始：跳过前两条数据，接着值显示3和4条数据 

~~~ shell
//第一页
db.comment.find().skip(0).limit(2)
//第二页
db.comment.find().skip(2).limit(2)
//第三页
db.comment.find().skip(4).limit(2)
~~~

### 排序查询

sort() 方法对数据进行排序，sort() 方法可以通过参数指定排序的字段，并使用 1 和 -1 来指定排序的方式，其中 1 为升序排列，而 -1 是用于降序排列。

语法如下所示：

~~~~ shell
db.COLLECTION_NAME.find().sort({KEY:1})
或 
db.集合名称.find().sort(排序方式)
~~~~

例如：

对userid降序排列，并对访问量进行升序排列

~~~ shell
db.comment.find().sort({userid:-1,likenum:1})
~~~

>提示：skip(), limilt(), sort()三个放在一起执行的时候，执行的顺序是先 sort(), 然后是 skip()，最后是显示的 limit()，和命令编写顺序无关。  

### 正则的复杂条件查询

MongoDB的模糊查询是通过正则表达式的方式实现的。格式为：

~~~ shell
db.collection.find({field:/正则表达式/})
或 
db.集合.find({字段:/正则表达式/})
~~~

> 提示：正则表达式是js的语法，直接量的写法。

例如，我要查询评论内容包含“开水”的所有文档，代码如下：

~~~ shell
db.comment.find({content:/开水/})
~~~

如果要查询评论的内容中以“专家”开头的，代码如下：

~~~ shell
db.comment.find({content:/^专家/})
~~~

### 比较查询
<, <=, >, >= 这个操作符也是很常用的，格式如下:

~~~ shell
db.集合名称.find({ "field" : { $gt: value }}) // 大于: field > value
db.集合名称.find({ "field" : { $lt: value }}) // 小于: field < value
db.集合名称.find({ "field" : { $gte: value }}) // 大于等于: field >= value
db.集合名称.find({ "field" : { $lte: value }}) // 小于等于: field <= value
db.集合名称.find({ "field" : { $ne: value }}) // 不等于: field != value
~~~

示例：查询评论点赞数量大于700的记录

~~~~ shell
db.comment.find({likenum:{$gt:NumberInt(700)}})
~~~~

### 包含查询
包含使用`$in`操作符。 示例：查询评论的集合中userid字段包含1003或1004的文档

~~~ shell
db.comment.find({userid:{$in:["1003","1004"]}})
~~~

不包含使用`$nin`操作符。 示例：查询评论集合中userid字段不包含1003和1004的文档

~~~ shell
db.comment.find({userid:{$nin:["1003","1004"]}})
~~~

### 条件连接查询

我们如果需要查询同时满足两个以上条件，需要使用`$and`操作符将条件进行关联。（相当于SQL的and） 格式为：

~~~~ shell
$and:[ { },{ },{ } ]
~~~~

示例：查询评论集合中likenum大于等于700 并且小于2000的文档：

~~~ shell
db.comment.find({$and:[{likenum:{$gte:NumberInt(700)}},{likenum:{$lt:NumberInt(2000)}}]})
~~~

如果两个以上条件之间是或者的关系，我们使用 操作符进行关联，与前面 and的使用方式相同 格式为：

~~~ shell
$or:[ { },{ },{ } ]
~~~

示例：查询评论集合中userid为1003，或者点赞数小于1000的文档记录

~~~ shell
db.comment.find({$or:[ {userid:"1003"} ,{likenum:{$lt:1000} }]})
~~~

## 小结

- 选择切换数据库：`use articledb`
- 插入数据：`db.comment.insert({bson数据})`
- 查询所有数据：`db.comment.find();`
- 条件查询数据：`db.comment.find({条件})`
- 查询符合条件的第一条记录：`db.comment.findOne({条件})`
- 查询符合条件的前几条记录：`db.comment.find({条件}).limit(条数)`
- 查询符合条件的跳过的记录：`db.comment.find({条件}).skip(条数)`
- 修改数据：`db.comment.update({条件},{修改后的数据})`或`db.comment.update({条件}`,`{$set:{要修改部分的字段:数据})`
- 修改数据并自增某字段值：`db.comment.update({条件}`,`{$inc:{自增的字段:步进值}})`
- 删除数据：`db.comment.remove({条件})`
- 统计查询：`db.comment.count({条件})`
- 模糊查询：`db.comment.find({字段名:/正则表达式/})`
- 条件比较运算：`db.comment.find({字段名:{$gt:值}})`
- 包含查询：`db.comment.find({字段名:{$in:[值1，值2]}})`或`db.comment.find({字段名:{$nin:[值1，值2]}})`
- 条件连接查询：`db.comment.find({$and:[{条件1},{条件2}]})`或`db.comment.find({$or:[{条件1},{条件2}]})`  