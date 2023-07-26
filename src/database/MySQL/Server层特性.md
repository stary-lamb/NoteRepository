---
title: Server层特性
date: 2023-06-21
---

## Sort Buffer

### Sort Buffer基本介绍

MySQL 会给每个线程分配一块内存用于排序，这块内存区域就称为 “sort_buffer”

“sort_buffer_size”，就是 MySQL 为排序开辟的内存大小。如果排序的数据量小于 `sort_buffer_size`，排序就在内存中完成。但如果排序数据量太大，内存放不下，则不得不利用磁盘临时文件辅助排序

你可以用下面介绍的方法，来确定一个排序语句是否使用了临时文件。

~~~ mysql
/* 打开 optimizer_trace，只对本线程有效 */
SET optimizer_trace='enabled=on';
/* @a 保存 Innodb_rows_read 的初始值 */
select VARIABLE_VALUE into @a from performance_schema.session_status where variable_nam
/* 执行语句 */
select city, name,age from t where city='杭州' order by name limit 1000;
/* 查看 OPTIMIZER_TRACE 输出 */
SELECT * FROM `information_schema`.`OPTIMIZER_TRACE`\G
/* @b 保存 Innodb_rows_read 的当前值 */
select VARIABLE_VALUE into @b from performance_schema.session_status where variable_name
/* 计算 Innodb_rows_read 差值 */
select @b-@a;
~~~

这个方法是通过查看 OPTIMIZER_TRACE 的结果来确认的，你可以从 number_of_tmp_files 中看到是否使用了临时文件。  

![image-20230622063848109](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306220638547.png)



`number_of_tmp_files` 表示的是，排序过程中使用的临时文件数。

你一定奇怪，为什么需要 12 个文件？

内存放不下时，就需要使用外部排序，外部排序一般使用归并排序算法。可以这么简单理解，MySQL 将需要排序的数据分成 12 份，每一份单独排序后存在这些临时文件中。然后把这 12 个有序文件再合并成一个有序的大文件。

如果 sort_buffer_size 超过了需要排序的数据量的大小，number_of_tmp_files 就是 0，表示排序可以直接在内存中完成。否则就需要放在临时文件中排序。

`sort_buffer_size` 越小，需要分成的份数越多，`number_of_tmp_files` 的值就越大。  

### 常见的排序算法

#### 全字段排序

SELECT列表中的全部字段都参与排序的排序方式叫做全字段排序。  

#### 归并排序

如果要排序的数据量小于sort_buffer_size，排序就在内存中完成。但如果排序数据量太大，内存放不下，则不得不利用磁盘临时文件辅助排序。

`OPTIMIZER_TRACE` 的结果可以从 number_of_tmp_files 中看到是否使用了临时文件。（内存放不下时，就需要使用外部排序，外部排序一般使用归并排序算法。数字表示，MySQL将需要排序的数据分成12份，每一份单独排序后存在这些临时文件中。然后把这12个有序文件再合并成一个有序的大文件。0表示排序可以直接在内存中完成，sort_buffer_size 越小，需要分成的份数越多，number_of_tmp_files的值就越大），也即是基本介绍中使用的方法。

#### rowid 排序

MySQL认为排序的单行长度太大，采用另外一种算法，max_length_for_sort_data，是MySQL中专门控制用于排序的行数据的长度的一个参数。它的意思是，如果单行的长度超过这个值，MySQL就认为单行太大，要换一个算法。（排序的列只包含order by后面的字段和id）  

## Join Buffer

### Join Buffer基本介绍

MySQL 提出了一个 Join Buffer 的概念，Join Buffer 就是执行连接连接查询前申请的一块固定大小的内存，先把若干条驱动表结果集中的记录装在这个Join Buffer中，然后开始扫描被驱动表，每一条被驱动表的记录一次性和Join Buffer中的多条驱动表记录做匹配，因为匹配的过程都是在内存中完成的，所以这样可以**显著减少被驱动表的I/O代价。**  

#### Join Buffer 相关参数

参数： `join_buffer_size`

介绍：用于普通索引扫描、范围索引扫描和不使用索引并因此执行全表扫描的连接的缓冲区的最小大小（单位：B字节），默认大小为262144字节（也就是256KB），最小可以设置为128字节

#### 小提示

如果Join Buffer放不下所有数据的话，策略很简单，就是**分段放**。假设，驱动表的数据行数是N，需要分K段才能完成算法流程，被驱动表的数据行数是M。
注意，这里的K不是常数，N越大K就会越大，因此把K表示为 λ * N，显然λ的取值范围是 (0,1)。
所以，在这个算法的执行过程中：

1. 扫描行数是N+λ * N * M；
2. 内存判断N * M次。

显然，内存判断次数是不受选择哪个表作为驱动表影响的。而考虑到扫描行数，在M和N大小确定的情况下，N小一些，整个算式的结果会更小。

综上所述，应该让小表当驱动表。在`N + λ * N * M`这个式子里，λ才是影响扫描行数的关键因素，这个值越小越好。    

N 越大，分段数 K 越大。那么，N固定的时候，什么参数会影响K的大小呢？（也就是λ的大小）答案是join_buffer_size。

join_buffer_size越大，一次可以放入的行越多，分成的段数也就越少，对被驱动表的全表扫描次数就越少。Join Buffer足够大，能容纳驱动表结果集中的所有记录，这样只需要访问一次被驱动表就可以完成连接操作了。  

## MRR

MRR，全称「Multi-Range Read Optimization」。  

简单来说：**MRR 通过把「随机磁盘读」，转化为「顺序磁盘读」，从而提高了索引查询的性能**。 

~~~ mysql
select * from stu where age between 10 and 20;
~~~

执行这么一条语句的时候，我们会在二级索引age上查询一条符合条件的，然后根据id回表，再去找下一条符合条件的。如果 age 对应的每个id都是非常分散的，那么每次回表，都需要一次随机的IO，磁道的寻址是个很大的开销。  

![image-20230622064937244](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306220649302.png)

要如何将随机IO转为顺序IO呢？  

~~~ mysql
mysql > set optimizer_switch='mrr=on';
Query OK, 0 rows affected (0.06 sec)
mysql > explain select * from stu where age between 10 and 20;
+----+-------------+-------+-------+------+---------+------+------+----------------+
| id | select_type | table | type | key | key_len | ref | rows | Extra |
+----+-------------+-------+-------+------+---------+------+------+----------------+
| 1 | SIMPLE | tbl | range | age | 5 | NULL | 960 | ...; Using MRR |
+----+-------------+-------+-------+------+---------+------+------+----------------+
~~~

我们开启了 MRR，重新执行 sql 语句，发现 Extra 里多了一个「Using MRR」。

这下 MySQL 的查询过程会变成这样：  

![image-20230622065024097](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306220650255.png)

![](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306220650255.png)

对于 MyISAM，**在去磁盘获取完整数据之前，会先按照 rowid 排好序，再去顺序的读取磁盘**。

**对于 Innodb，则会按照聚簇索引键值排好序，再顺序的读取聚簇索引**。

顺序读带来了几个好处：

1. **磁盘和磁头不再需要来回做机械运动**；

2. **可以充分利用磁盘预读**

   比如在客户端请求一页的数据时，可以把后面几页的数据也一起返回，放到数据缓冲池中，这样如果下次刚好需要下一页的数据，就不再需要到磁盘读取。
   
   这样做的理论依据是计算机科学中著名的局部性原理：当一个数据被用到时，其附近的数据也通常会马上被使用。  

3. **在一次查询中，每一页的数据只会从磁盘读取一次**

   MySQL 从磁盘读取页的数据后，会把数据放到数据缓冲池，下次如果还用到这个页，就不需要去磁盘读取，直接从内存读。

   但是如果不排序，可能你在读取了第 1 页的数据后，会去读取第2、3、4页数据，接着你又要去读取第 1 页的数据，这时你发现第 1 页的数据，已经从缓存中被剔除了，于是又得再去磁盘读取第 1 页的数据。

   而转化为顺序读后，你会连续的使用第 1 页的数据，这时候按照 MySQL 的缓存剔除机制，这一页的缓存是不会失效的，直到你利用完这一页的数据，由于是顺序读，在这次查询的余下过程中，你确信不会再用到这一页的数据，可以和这一页数据说告辞了。

**顺序读就是通过这三个方面，最大的优化了索引的读取**。

**别忘了，索引本身就是为了减少磁盘 IO，加快查询，而 MRR，则是把索引减少磁盘 IO 的作用，进一步放大**。  

