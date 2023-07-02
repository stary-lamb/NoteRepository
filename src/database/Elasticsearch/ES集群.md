---
title: ES集群
date: 2023-06-30
---

## 集群脑裂问题

### 集群职责划分

Elasticsearch中集群节点有不同的职责划分：

![image-20230701162209026](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011622110.png)



默认情况下，集群中的任何一个节点都同时具备上述四种角色。

但是真实的集群一定要将集群职责分离：

- master节点：对CPU要求高，但是内存要求第
- data节点：对CPU和内存要求都高
- coordinating节点：对网络带宽、CPU要求高

职责分离可以让我们根据不同节点的需求分配不同的硬件去部署。而且避免业务之间的互相干扰。

一个典型的es集群职责划分如图：

![image-20210723223629142](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011622251.png)

### 脑裂问题

脑裂是因为集群中的节点失联导致的。

例如一个集群中，主节点与其它节点失联：

![image-20210723223804995](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011622665.png)

此时，node2和node3认为node1宕机，就会重新选主：

![image-20210723223845754](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011622557.png)

当node3当选后，集群继续对外提供服务，node2和node3自成集群，node1自成集群，两个集群数据不同步，出现数据差异。

当网络恢复后，因为集群中有两个master节点，集群状态的不一致，出现脑裂的情况：

![image-20210723224000555](F:\课程视频&资料\ElasticSearch\黑马es资料\day03\assets\image-20210723224000555.png)



解决脑裂的方案是，要求选票超过 ( eligible节点数量 + 1 ）/ 2 才能当选为主，因此eligible节点数量最好是奇数。对应配置项是discovery.zen.minimum_master_nodes，在es7.0以后，已经成为默认配置，因此一般不会发生脑裂问题



例如：3个节点形成的集群，选票必须超过 （3 + 1） / 2 ，也就是2票。node3得到node2和node3的选票，当选为主。node1只有自己1票，没有当选。集群中依然只有1个主节点，没有出现脑裂。

### 小结

master eligible节点的作用是什么？

- 参与集群选主
- 主节点可以管理集群状态、管理分片信息、处理创建和删除索引库的请求

data节点的作用是什么？

- 数据的CRUD

coordinator节点的作用是什么？

- 路由请求到其它节点

- 合并查询到的结果，返回给用户

## 集群分布式存储

当新增文档时，应该保存到不同分片，保证数据均衡，那么coordinating node如何确定数据该存储到哪个分片呢？

### 分片存储测试

插入三条数据：

![image-20210723225006058](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011623170.png)



![image-20210723225034637](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011623311.png)



![image-20210723225112029](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011623765.png)



测试可以看到，三条数据分别在不同分片：

![image-20210723225227928](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011623528.png)

结果：

![image-20210723225342120](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011623556.png)



### 分片存储原理

Elasticsearch会通过hash算法来计算文档应该存储到哪个分片：

![image-20210723224354904](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011623325.png)



说明：

- _routing默认是文档的id
- 算法与分片数量有关，因此索引库一旦创建，分片数量不能修改！



**新增文档的流程如下：**

![image-20210723225436084](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011624815.png)

**解读：**

1. 新增一个id=1的文档
2. 对id做hash运算，假如得到的是2，则应该存储到shard-2
3. shard-2的主分片在node3节点，将数据路由到node3
4. 保存文档
5. 同步给shard-2的副本replica-2，在node2节点
6. 返回结果给coordinating-node节点

## 集群分布式查询

Elasticsearch的查询分成两个阶段：

- scatter phase：分散阶段，coordinating node会把请求分发到每一个分片

- gather phase：聚集阶段，coordinating node汇总data node的搜索结果，并处理为最终结果集返回给用户

![image-20210723225809848](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011624078.png)

## 集群故障转移

集群的master节点会监控集群中的节点状态，如果发现有节点宕机，会立即将宕机节点的分片数据迁移到其它节点，确保数据安全，这个叫做故障转移。

1. 例如一个集群结构如图：

![image-20210723225945963](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011624600.png)

现在，node1是主节点，其它两个节点是从节点。

2. 突然，node1发生了故障：

![image-20210723230020574](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011625854.png)



宕机后的第一件事，需要重新选主，例如选中了node2：

![image-20210723230055974](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011625422.png)



node2成为主节点后，会检测集群监控状态，发现：shard-1、shard-0没有副本节点。因此需要将node1上的数据迁移到node2、node3：

![image-20210723230216642](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307011625390.png)



