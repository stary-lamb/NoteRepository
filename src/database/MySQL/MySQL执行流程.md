---
title: MySQL的执行流程
date: 2023-06-21
---

## SQL的执行流程

我们执行下面这条 SQL 语句时，MySQL具体的执行流程是怎样的呢?

~~~ mysql
select * from T where ID=10
~~~

一条 SQL 语句在MySQL中的执行过程具体如下：

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306161538071.png" alt="image-20230616153815996" style="zoom: 33%;" />

大体上，MySQL 可以分为 Server 层和存储引擎层两部分  

- `Server层`：包括连接器、查询缓存、分析器、优化器、执行器等，涵盖 MySQL 的大多数核心服务功能，以及所有的内置函数（如日期、时间、数学和加密函数等），所有跨存储引擎的功能都在这一层实现，比如存储过程、触发器、视图等。
- `存储引擎层`：存储引擎层负责数据的存储和提取。其架构模式是插件式的，支持 InnoDB、MyISAM、Memory 等多个存储引擎。现在最常用的存储引擎是 InnoDB，它从 MySQL 5.5.5 版本开始成为了默认存储引擎。

## 连接器

**第一步**，你会先连接到这个数据库上，这时候接待你的就是连接器。**连接器负责跟客户端建立连接、获取权限、维持和管理连接**。连接命令一般是这么写的：  

~~~ shell
mysql -h$ip -P$port -u$user -p
~~~

我们可以通过TCP/IP、命名管道符和共享内存、UNIX 域套接字 等方式跟服务端建立连接。当连接到我们服务器之后，连接器就要开始认证你的身份，这个时候用的就是你输入的用户名和密码。  

如果用户名或密码不对，你就会收到一个 "Access denied for user" 的错误，然后客户端程序结束执行。

如果用户名密码认证通过，连接器会到权限表里面查出你拥有的权限。之后，这个连接里面的权限判断逻辑，都将依赖于此时读到的权限。  

## 查询缓存

连接建立完成后，你就可以执行 select 语句了。执行逻辑就会来到**第二步：查询缓存**  

MySQL 拿到一个查询请求后，会先到查询缓存看看，之前是不是执行过这条语句。之前执行过的语句及其结果可能会以 key-value 对的形式，被直接缓存在内存中。key 是查询的语句，value 是查询的结果。如果你的查询能够直接**在这个缓存中找到 key**，那么这个 **value 就会被直接返回给客户端**。  
 
但是大多数情况下我会建议你不要使用查询缓存，为什么呢？因为查询缓存往往弊大于利。因为查询缓存的失效非常频繁，只要有对一个表的更新，这个表上所有的查询缓存都会被清空。

当然在 MySQL 也提供了这种“按需使用”的方式。你可以将参数 query_cache_type 设置成 DEMAND，这样对于默认的 SQL 语句都不使用查询缓存。而对于你确定要使用查询缓存的语句，可以用 SQL_CACHE 显式指定，像下面这个语句一样：  

~~~ mysql
 select SQL_CACHE * from T where ID=10；
~~~

> ps：MySQL 8.0 版本直接将查询缓存的整块功能删掉了，也就是说 8.0 开始彻底没有这个功能了。  

## 分析器

如果没有命中查询缓存，就要开始真正执行语句了。首先，MySQL 需要知道你要做什么，因此需要对 SQL 语句做解析。

分析器先会做“`词法分析`”。你输入的是由多个字符串和空格组成的一条 SQL 语句，MySQL 需要识别出里面的字符串分别是什么，代表什么。

MySQL 从你输入的 "select" 这个关键字识别出来，这是一个查询语句。它也要把字符串 “T” 识别成 “表名 T”，把字符串 “ID” 识别成“列 ID”。

做完了这些识别以后，就要做“`语法分析`”。根据词法分析的结果，语法分析器会根据语法规则，判断你输入的这个 SQL 语句是否满足 MySQL 语法。

如果你的语句不对，就会收到“You have an error in your SQL syntax”的错误提醒，比如下面这个语句 select 少打了开头的字母“s”。

~~~ mysql
mysql> elect * from t where ID=1;
ERROR 1064 (42000): You have an error in your SQL syntax;
check the manual that corresponds to your MySQL server version for the right
syntax to use near'elect * from t where ID=1' at line 1
~~~

> ps：一般语法错误会提示第一个出现错误的位置，所以你要关注的是紧接“use near”的内容。  

## 优化器

经过了分析器，MySQL 就知道你要做什么了。在开始执行之前，还要先经过优化器的处理。

优化器是在表里面有多个索引的时候，**决定使用哪个索引**；或者在一个语句有多表关联（join）的时候，**决定各个表的连接顺序**。比如你执行下面这样的语句，这个语句是执行两个表的 join：  

~~~ mysql
mysql> select * from t1 join t2 using(ID) where t1.c=10 and t2.d=20;
~~~

方案一：既可以先从表 t1 里面取出 c=10 的记录的 ID 值，再根据 ID 值关联到表 t2，再判断 t2 里面 d 的值是否等于 20。

方案二：也可以先从表 t2 里面取出 d=20 的记录的 ID 值，再根据 ID 值关联到表 t1，再判断 t1 里面 c 的值是否等于 10。  

当然，这两种执行方法的逻辑结果是一样的，但是执行的效率会有不同，而优化器的作用就是决定选择使用哪一个方案。

优化器阶段完成后，这个语句的执行方案就确定下来了，然后进入执行器阶段。  

## 执行器

MySQL 通过分析器知道了你要做什么，通过优化器知道了该怎么做，于是就进入了执行器
阶段，开始执行语句。

开始执行的时候，要先判断一下你对这个表 T 有**没有执行查询的权限**，如果没有，就会返回没有权限的错误。

~~~ mysql
mysql> select * from T where ID=10;
ERROR 1142 (42000): SELECT command denied to user 'b'@'localhost' for table 'T'
~~~

如果有权限，就打开表继续执行。打开表的时候，执行器就会根据表的引擎定义，去使用这个引擎提供的接口。

比如我们这个例子中的表 T 中，ID 字段没有索引，那么执行器的执行流程是这样的：  

1. 调用 InnoDB 引擎接口取这个表的第一行，判断 ID 值是不是 10，如果不是则跳过，如
   果是则将这行存在结果集中；
2. 调用引擎接口取“下一行”，重复相同的判断逻辑，直到取到这个表的最后一行。
3.  执行器将上述遍历过程中所有满足条件的行组成的记录集作为结果集返回给客户端。  

**对于有索引的表，执行的逻辑也差不多**。第一次调用的是 **“取满足条件的第一行”** 这个接口，之后循环取“满足条件的下一行”这个接口，这些接口都是引擎中已经定义好的。

慢查询日志中看到一个 rows_examined 的字段，表示这个语句执行过程中扫描了多少行。这个值就是在执行器每次调用引擎获取数据行的时候累加的。
但是在有些场景下，执行器调用一次，在引擎内部则扫描了多行，因此引擎扫描行数跟rows_examined 并不是完全关联的。

## 存储引擎

### 存储引擎管理

#### 查看存储引擎 

```mysql
show engines;
# 或
show engines\G
```

#### 设置系统默认的存储引擎

- 查看默认的存储引擎：

```mysql
show variables like '%storage_engine%'; 
#或
SELECT @@default_storage_engine;
```

- 修改默认的存储引擎

如果在创建表的语句中没有显式指定表的存储引擎的话，那就会默认使用`InnoDB`作为表的存储引擎。

```mysql
SET DEFAULT_STORAGE_ENGINE=MyISAM;
```

或者修改`my.cnf`文件：

```ini
default-storage-engine=MyISAM 
```

```shell
# 重启服务 
systemctl restart mysqld.service
```

#### 设置表的存储引擎

存储引擎是负责对表中的数据进行提取和写入工作的，我们可以为`不同的表设置不同的存储引擎`，也就是说不同的表可以有不同的物理存储结构，不同的提取和写入方式。

**创建表时指定存储引擎**

```mysql
CREATE TABLE 表名(
    建表语句; 
) ENGINE = 存储引擎名称;
```

**修改表的存储引擎**

```mysql
ALTER TABLE 表名 ENGINE = 存储引擎名称;
```

### 引擎基本介绍

####  InnoDB

**InnoDB 引擎：具备外键支持功能的事务存储引擎**

- MySQL从3.23.34a开始就包含 InnoDB 存储引擎。`大于等于5.5之后，默认采用InnoDB引擎`。 
- InnoDB是MySQL的`默认事务型引擎`，它被设计用来处理大量的短期(short-lived)事务。可以确保事务的完整提交(Commit)和回滚(Rollback)。
- 除了增加和查询外，还需要更新、删除操作，那么，应优先选择InnoDB存储引擎。
- **除非有非常特别的原因需要使用其他的存储引擎，否则应该优先考虑InnoDB引擎。**
- 数据文件结构：
  - 表名.frm 存储表结构（MySQL8.0时，合并在表名.ibd中）
  - 表名.ibd 存储数据和索引
- InnoDB是`为处理巨大数据量的最大性能设计`。
  - 在以前的版本中，字典数据以元数据文件、非事务表等来存储。现在这些元数据文件被删除了。比如：`.frm`，`.par`，`.trn`，`.isl`，`.db.opt`等都在MySQL8.0中不存在了。
- 对比MyISAM的存储引擎，`InnoDB写的处理效率差一些`，并且会占用更多的磁盘空间以保存数据和索引。
- MyISAM只缓存索引，不缓存真实数据；InnoDB不仅缓存索引还要缓存真实数据，`对内存要求较高`，而且内存大小对性能有决定性的影响。

#### MyISAM 

**MyISAM 引擎：主要的非事务处理存储引擎**

- MyISAM提供了大量的特性，包括全文索引、压缩、空间函数(GIS)等，但MyISAM`不支持事务、行级锁、外键`，有一个毫无疑问的缺陷就是`崩溃后无法安全恢复`。 
- `5.5之前默认的存储引擎`
- 优势是访问的`速度快`，对事务完整性没有要求或者以SELECT、INSERT为主的应用
- 针对数据统计有额外的常数存储。故而 count(*) 的查询效率很高
- 数据文件结构：
  - 表名.frm 存储表结构
  - 表名.MYD 存储数据 (MYData)
  - 表名.MYI 存储索引 (MYIndex)
- 应用场景：只读应用或者以读为主的业务

#### 其他引擎

- **Archive引擎：用于数据存档**

- **Archive** **引擎：用于数据存档**

- **Blackhole** **引擎：丢弃写操作，读操作会返回空内容** 

- **CSV** **引擎：存储数据时，以逗号分隔各个数据项**

- **Memory** **引擎：置于内存的表**

- **Federated** **引擎：访问远程表** 

- **Merge引擎：管理多个MyISAM表构成的表集合** 

- **NDB引擎：MySQL集群专用存储引擎**

### MyISAM 与 InnoDB 对比

|                | **MyISAM**                                               | **InnoDB**                                                   |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 外键           | 不支持                                                   | 支持                                                         |
| 事务           | 不支持                                                   | 支持                                                         |
| 行表锁         | 表锁，即使操作一条记录也会锁住整个表，不适合高并发的操作 | 行锁，操作时只锁某一行，不对其它行有影响，适合高并发的操作   |
| 缓存           | 只缓存索引，不缓存真实数据                               | 不仅缓存索引还要缓存真实数据，对内存要求较高，而且内存大小对性能有决定性的影响 |
| 自带系统表使用 | Y                                                        | N                                                            |
| 关注点         | 性能：节省资源、消耗少、简单业务                         | 事务：并发写、事务、更大资源                                 |
| 默认安装       | Y                                                        | Y                                                            |
| 默认使用       | N                                                        | Y                                                            |