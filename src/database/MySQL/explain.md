---
title: explain执行计划
date: 2023-07-06
---

## expalin 内容

下面是一次explain返回的一条SQL语句的执行计划的内容：

![image-20230726111315027](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307261113503.png)

一个执行计划中，共有12个字段，每个字段都挺重要的，先来介绍下这12个字段：

| 字段名            | 说明                                                         |
| ----------------- | ------------------------------------------------------------ |
| id                | 执行计划中每个操作的唯一标识符。对于一条查询语句，每个操作都有一个唯一的id |
| select_type       | 操作的类型。常见的类型包括SIMPLE、PRIMARY、SUBQUERY、UNION等。不同类型的操作会影响查询的执行效率 |
| table             | 当前操作所涉及的表                                           |
| partitions        | 当前操作所涉及的分区                                         |
| **type**          | **表示查询时所使用的索引类型，包括ALL、index、range、ref、eq_ref、const等** |
| **possible_keys** | **表示可能被查询优化器选择使用的索引**                       |
| **key**           | **表示查询优化器选择使用的索引**                             |
| key_len           | 表示索引的长度。索引的长度越短，查询时的效率越高             |
| ref               | 表示连接操作所使用的索引                                     |
| rows              | 表示此操作需要扫描的行数，即扫描表中多少行才能得到结果       |
| filtered          | 表示此操作过滤掉的行数占扫描行数的百分比。该值越大，表示查询结果越准确 |
| **Extra**         | **表示其他额外的信息，包括Using index、Using filesort、Using temporary等** |

假如我们有如下一张表（MySQL Innodb 5.7）：

~~~ mysql
CREATE TABLE `t2` (
`id` INT(11),
`a` varchar(64) NOT NULL,
`b` varchar(64) NOT NULL,
`c` varchar(64) NOT NULL,
`d` varchar(64) NOT NULL,
`f` varchar(64) DEFAULT NULL,
PRIMARY KEY(id),
UNIQUE KEY `f` (`f`),
KEY `idx_abcd` (`a`,`b`,`c`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
~~~

## type

type，它有以下几个取值内容：

- system：系统表，少量数据，往往不需要进行磁盘IO 
- const：使用常数索引，MySQL 只会在查询时使用常数值进行匹配。 
  - `explain select * from t2 where f='Hollis';` 
  - 使用唯一性索引做唯一查询 
- eq_ref：唯一索引扫描，只会扫描索引树中的一个匹配行。 
  - `explain select * from t1 join t2 on t1.id = t2.id where t1.f1 = 's';`
  - 当使用 WHERE 子句中的条件进行关联查询时，如果被关联的表的被关联列上存在唯一索引或主键，MySQL 就会选择使用 eq_ref 访问 方式，将该表作为主表进行访问，而被关联的表作为辅助表，只需要访问一次即可。 
- ref：非唯一索引扫描， 只会扫描索引树中的一部分来查找匹配的行。 
  - `explain select * from t2 where a = 'Hollis';`
  - 使用非唯一索引进行查询 
- range：范围扫描，只会扫描索引树中的一个范围来查找匹配的行。
  - ` explain select * from t2 where a > 'a' and a < 'c'; `
  - 使用索引进行性范围查询 
- index：全索引扫描，会遍历索引树来查找匹配的行。
  - `explain select c from t2 where b = 's';` 
  - 不符合最左前缀匹配的查询 
- ALL：全表扫描，将遍历全表来找到匹配的行。 
  - `explain select * from t2 where d = "ni";` 
  - 使用非索引字段查询

需要注意的是，这里的index表示的是做了索引树扫描，效率并不高。以上类型由快到慢： **system** > const > eq_ref > **ref> range > index** >ALL

## possible_keys 和 key 

- `possible_keys`：表示查询语句中可以使用的索引，而不一定实际使用了这些索引。这个字段列出了可能用于这个查询的所有索引，包括联合索引的组合。
- `key`字段：表示实际用于查询的索引。如果在查询中使用了索引，则该字段将显示使用的索引名称。

## Extra

- Using where：表示 MySQL 将在存储引擎检索行后，再进行条件过滤（使用 WHERE 子句）；查询的列未被索引覆盖，where筛选条件非索 引的前导列或者where筛选条件非索引列。 
  - `explain select * from t2 where d = "ni";` 非索引字段查询 
  - `explain select d from t2 where b = "ni";` 未索引覆盖，用联合索引的非前导列查询 
- Using index：表示 MySQL 使用了覆盖索引（也称为索引覆盖）优化，只需要扫描索引，而无需回到数据表中检索行； 
  - `explain select b,c from t2 where a = "ni"; `索引覆盖 
- Using index condition：表示 MySQL 在使用索引进行查找时，无法使用覆盖索引优化，需要回到数据表中检索行； 
  - `explain select d from t2 where a = "ni" and b like "s%"; `使用到索引下推。 
- Using where; Using index：查询的列被索引覆盖，并且where筛选条件是索引列之一但是不是索引的不是前导列或者where筛选条件是索引列前导列的一个范围 
  - `explain select a from t2 where b = "ni"; `索引覆盖，但是不符合最左前缀 
  - `explain select b from t2 where a in ('a','d','sd');` 索引覆盖，但是前导列是个范围
- Using join buffer：表示 MySQL 使用了连接缓存； 
  - `explain select * from t1 join t2 on t1.id = t2.id where a = 's';` 
- Using temporary：表示 MySQL 创建了临时表来存储查询结果。这通常是在排序或分组时发生的； 
  - `explain select count(*),b from t2 group by b; `
- Using filesort：表示 MySQL 将使用文件排序而不是索引排序，这通常发生在无法使用索引来进行排序时； 
  - `explain select count(*),b from t2 group by b; `
- Using index for group-by：表示 MySQL 在分组操作中使用了索引。这通常是在分组操作涉及到索引中的所有列时发生的； 
- Using filesort for group-by：表示 MySQL 在分组操作中使用了文件排序。这通常发生在无法使用索引进行分组操作时； 
- Range checked for each record：表示 MySQL 在使用索引范围查找时，需要检查每一条记录； 
- Using index for order by：表示 MySQL 在排序操作中使用了索引，这通常发生在排序涉及到索引中的所有列时； 
- Using filesort for order by：表示 MySQL 在排序操作中使用了文件排序，这通常发生在无法使用索引进行排序时； 
- Using index for group-by; Using index for order by：表示 MySQL 在分组和排序操作中都使用了索引。

## 判断一条SQL走没有索引

首先看key字段有没有值，有值表示用到了索引树，但是具体是怎么用的，还得看type和extra。

### 情况一

`explain select b from t2 where a in ('a','d','sd');`

~~~ tex
+----+-------+---------------+----------+--------------------------+
| id | type  | possible_keys | key      | Extra 			   	  |
+----+-------+---------------+----------+--------------------------+
| 1  | index | NULL          | idx_abcd | Using where; Using index |
+----+-------+---------------+----------+--------------------------+ 
~~~

type = index，key = idx_abcd，extra = Using where; Using index ，表示本次查询用到了idx_abcd的联合索引，但是没有遵守最左前缀匹配，或者遵守了最左前缀，但是使用了a字段进行了范围查询。所以，最终其实还是扫描了索引树的。效率并不高

### 情况二

`explain select * from t2 where a = 'Hollis';`

~~~ tex
+----+-------+---------------+----------+--------------------------+
| id | type | possible_keys | key       | Extra                    |
+----+-------+---------------+----------+--------------------------+
| 1  | ref  | idx_abcd      | idx_abcd  | NULL                     |
+----+-------+---------------+----------+--------------------------+
~~~

表示用到了索引进行查询，并且用到的是idx_abcd这个非唯一索引。

### 情况三

` explain select * from t2 where f = 'f';`

~~~~ tex
+----+-------+---------------+----------+--------------------------+
| id | type  | possible_keys | key      | Extra                    |
+----+-------+---------------+----------+--------------------------+
| 1  | const | f             | f        | NULL                     |
+----+-------+---------------+----------+--------------------------+ 
~~~~

表示用到了索引进行查询，并且用到的是f这个唯一索引。

### 情况四

`explain select b,c from t2 where a = 'Hollis';`

~~~ tex
+----+-------+---------------+----------+--------------------------+
| id | type  | possible_keys | key      | Extra                    |
+----+-------+---------------+----------+--------------------------+
| 1  | ref   | idx_abcd      | idx_abcd | Using index              |
+----+-------+---------------+----------+--------------------------+
~~~

表示用到了索引进行查询，并且用到了idx_abcd这个索引，而且查询用到了覆盖索引，不需要回表

### 情况五

~~~ tex
+----+-------+---------------+----------+--------------------------+
| id | type  | possible_keys | key      | Extra                    |
+----+-------+---------------+----------+--------------------------+
| 1  | ALL   | NULL          | NULL     | Using where              |
+----+-------+---------------+----------+--------------------------+ 
~~~

### 总结

![image-20230726114538165](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307261145573.png)