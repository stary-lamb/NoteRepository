---
title: 三大集群模式
date: 2022-12-12
---

## 主从模式

**主从复制的作用主要包括:**

- **数据冗余**：主从复制实现了数据的热备份，是持久化之外的一种数据冗余方式。
- **故障恢复**：当主节点出现问题时，可以由从节点提供服务，实现快速的故障恢复，实际上是一种服务的冗余。
- **负载均衡**：在主从复制的基础上，配合读写分离，可以由主节点提供写服务，由从节点提供读服务(即写 Redis 数据时应用连接主节点，读 Redis 数据时应用连接从节点)，分担服务器负载，尤其是在写少读多的场景下，通过多个从节点分担读负载，可以大大提高 Redis 服务器的并发量。
- **高可用基石**：除了上述作用以外，主从复制还是哨兵和集群能够实施的基础，因此说主从复制是 Redis 高可用的基础。

主从库之间采用的是**读写分离**的方式

- 读操作: 主库、从库都可以接收
- 写操作:首先到主库执行，然后，主库将写操作同步给从库。



### 主从搭建

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212122042901.png" alt="image-20221212204220846" style="zoom: 67%;" />



共包含三个节点，一个主节点，两个从节点。

这里我们会使用三台服务器分别启动3个redis实例，A 作为master服务器，B 和 C 作为slave服务器，搭建一主二从复制结构,信息如下：

| 序号 |       IP        | PORT | 角色   |
| :--: | :-------------: | :--: | ------ |
|  A   | 192.168.222.128 | 6379 | master |
|  B   | 192.168.222.129 | 6379 | slave  |
|  C   | 192.168.222.130 | 6379 | slave  |

**1. A、B、C 配置文件 redis.conf 共同修改**

需要将 bind ip 地址改为所有可以访问，要不然slave库无法连接master库。

```javascript
bind 0.0.0.0
```

**2. B 和 C 配置文件 redis.conf 修改**

- slaveof：master ip 和端口号
- masterauth：master 密码（如果需要才改）
- replica-read-only：redis 作为从库是只读的（默认不用改）

配置完成后重启 3 个 redis 服务，启动顺序不用管，就算是先启动slave库，那么后启动master库，slave库也会去连接master库，然后形成主从关系。

```javascript
replicaof  192.168.222..128 6379
masterauth xxxxxx
replica-read-only yes
```

**4. 启动成功后我们可以使用 info replication 命令查看 A、B、C 客户端。**

### 主从复制原理

在2.8版本之前只有全量复制，而在2.8版本之后有了全量复制和增量复制

**全量复制**：在第一次主从同步时，或者在从库宕机很久后的第一次重连，会把所有数据以RDB形式同步给从库

**增量复制**：在之后的每条命令都会以增量形式同步给从库

### 全量复制

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212122120989.png" alt="image-20221212212058912" style="zoom:67%;" />

**第一阶段是主从库间建立连接，协商同步的过程**

~~~ properties
psync {runID} {offset}
~~~

从库给主库发送 `psync` 命令，表示要进行数据同步，主库根据这个命令的参数来启动复制。psync 命令包含了**主库的 runID** 和 **复制进度 offset** 两个参数。

runID，是每个 Redis 实例启动时都会自动生成一个随机 ID，用来唯一标记这个实例。当从库和主库第一次复制时，因为不知道主库的 runID，所以将 runID 设为 "?"。

offset 此时设为 -1，表示第一次复制。

主库收到 psync 命令后，会用 `FULLRESYNC` 响应命令带上两个参数：主库 runID 和主库 目前复制进度 offset，返回给从库。从库收到响应后，会记录下这两个参数。

> FULLRESYNC 响应表示第一次复制采用的全量复制，也就算说，主库会把当前所有的数据都复制给从库。

**第二阶段主库将所有数据同步给从库**

从库收到数据后，在本地完成数据加载。这个过程依赖于内存快照生成的 RDB 文件。

主库执行 `bgsave` 命令 ，生成 RDB 文件，接着将文件发给从库。从库 RDB文件后，会先清空当前数据库，然后加载 RDB 文件。因为从库在通过 replicaof 命令开始和主库同步前，可能保存了其他的数据。为了避免之前数据的影响，从库需要先把当前数据库清空。

在主库同步给从库的过程中，主库不会被阻塞，仍然可以正常接收请求。但这些请求中的写操作并没有记录到刚刚生成的 RDB 文件中，主库会在内存中用专门的 replication buffer，记录 RDB 文件生成后收到的所有写操作。

**第三阶段主库会把第二阶段执行过程中新收的写命令，在发送给从库**

当主库完成 RDB 文件发送后，就会把 replication buffer 中的修改操作发给从库，从库在重新执行这些操作。

### 增量复制

在 Redis 2.8 之前，如果主从库在命令传播时出现了网络闪断，那么，从库就会和主库重新进行一次全量复制，开销非常大。

从 Redis 2.8 开始，网络断了之后，主从库会采用增量复制的方式继续同步。

当主从库断连之后，主库会把断连期间收到的写操作命令，写入 replication buffer，同时也会把这些操作命令写入 repl_backlog_buff 这个缓冲区

**repl_backlog_buff**：一个环形缓冲区，主库会记录自己写到的位置，从库会记录自己已经读到的位置。

刚开始的时候，主库和从库的写读的位置是在一起，随着主库不断接收新的写操作它会在缓冲区中的写位置会逐步偏离，我们通过用偏移量来衡量这个偏移距离，对主库来说，对应的偏移量就是 master_repl_offset。主库接收的新写操作越多，这个值就会越大。

同样，从库在复制完写操作命令后，它在缓冲区中的读位置也开始逐步偏移刚才的起始位 置，此时，从库已复制的偏移量 slave_repl_offset 也在不断增加。正常情况下，这两个偏 移量基本相等。

在网络断连阶段，主库可能会收到新的写操作命令，所以，一般来说，master_repl_offset 会大于 slave_repl_offset。待主从库的连接恢复之后，从库首先会给主库发送 psync 命令，并把自己当前的 slave_repl_offset 发给主库，主库会判断自己的 master_repl_offset 和 slave_repl_offset 之间的差距来进行同步。

- 如果 offset 位置还没被覆盖，主库会相应 `Contine`，代表可以增量复制，把 offset 之后所有的命令发送给从库。
- 如果 offset 位置已经被覆盖，主库会响应 `FULLRESYNC`，代表要重新进行全量复制。

**为了避免主从断开之后要重新进行全量复制，我们需要调整 repl_backlog_size 参数，具体的计算公式如下：**

缓冲空间大小 = 主库写入命令速度 * 操作大小 - 主从库网络传输命令速度 * 操作大小。

在实际应用中，考虑 到可能存在一些突发的请求压力，我们通常需要把这个缓冲空间扩大一倍，即 repl_backlog_size = 缓冲空间大小 * 2，这也就是 repl_backlog_size 的最终值

**增量复制流程图：**

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212122308954.png" alt="image-20221212230808894" style="zoom:67%;" />

### 主从复制优化

**主从同步可以保证主从数据的一致性，非常重要。**

可以从以下几个方面来优化 Redis 主从复制：

- 在 master 中配置 repl-diskless-sync yes启用无磁盘复制，避免全量同步时的磁盘IO。

- Redis 单节点上的内存占用不要太大，减少 RDB 导致的过多磁盘IO

- 适当提高 repl_baklog_buff 的大小，发现slave宕机时尽快实现故障恢复，尽可能避免全量同步

- 限制一个 master上的 slave 节点数量，如果实在是太多 slave ，则可以采用主-从-从链式结构，减少 maste 压力

  <img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212122249264.png" alt="image-20221212224956193" style="zoom:67%;" />

## 哨兵模式

当主机宕机之后，需要把一台 slave 服务器切换为主服务器，这就需要人工干预，费时费力，还会造成一段时间内服务不可用，所有哨兵模式就可以很好的解决这个问题了；**一般公司采用 一主-两从-三哨兵的方式来搭建高可用的架构。**

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212122327787.png" alt="image-20221212232759727" style="zoom:67%;" />

### 哨兵搭建

在主从复制环境的基础上，创建一个sentinel.conf文件，添加下面的内容：

~~~ properties
# redis sentinel配置文件
#配置监听的主节点，masterRedis为服务名称，可以自己定义。192.168.50.130为主节点的ip，6379为主节点的名称，1代表有一个或者一个以上的哨兵认为主节点不可用时，则进行选举操作
#sentine1 monitor <master-name> <ip> <redis-port> <quorum>
sentinel monitor masterRedis 192.168.50.130 6379 1
#设置主节点的访问密码
sentinel auth-pass masterRedis enginex123
# 关闭保护模式，只有关闭之后，才能远程连接
protected-mode no
# 哨兵端口
port 26379
# 哨兵数据存放位置
dir "/Users/lisw/work/work-tools/redis-6.2.7/redis-sentinel/sentineldata"
# 日志文件
logfile "../redis-sentinel/sentinellog.log"
# 以守护进程运行
daemonize yes
# 进程ID保存位置
pidfile "/var/run/redis-sentinel-26379.pid"
# 设置sentinel的访问密码
requirepass "enginex123"
~~~

### 运行原理

在主从集群中，主库上有一个名为 `__sentinel__:hello` 的频道，不同哨兵就是通过它来相互发现，实现互相通信的。👇图中，哨兵 1 把自己的 IP（172.16.19.3）和端口（26579）发布到 `__sentinel__:hello` 频道上，哨兵 2 和 3 订阅了该频道。那么此时，哨兵 2 和 3 就可以从这个频道直接获取哨兵 1 的 IP 地址和端口号。然后，哨兵 2、3 可以和哨兵 1 建立网络连接。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212130621228.jpeg" alt="img" style="zoom: 25%;" />

**哨兵监控 Redis 库**

哨兵默认每10秒会向主库发送 INFO 命令。就像下图所示，哨兵 2 给主库发送 INFO 命令，主库接受到这个命令后，就会把从库列表返回给哨兵。接着，哨兵就可以根据从库列表中的连接信息，和每个从库建立连接，并在这个连接上持续地对从库进行监控。哨兵 1 和 3 可以通过相同的方法和从库建立连接。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212130623096.jpeg" alt="img" style="zoom: 25%;" />

### 故障判定

- **主观下线**：任何一个哨兵都可以监控探测，并作出 Redis 节点下线的判断

- **客观下线**：有哨兵集权共同决定 Redis 节点是否下线

Sentinel会**以每秒一次的频率**向所有与它创建了命令连接的实例（**包括主服务器、从服务器、其他Sentinel在内**）发送**PING命令**，并通过实例返回的PING命令回复来判断实例是否在线。

**实例对PING命令的回复可以分为以下两种情况：**

- **有效回复**：实例返回+PONG、-LOADING、-MASTERDOWN三种回复的其中一种
- **无效回复**：实例返回除+PONG、-LOADING、-MASTERDOWN三种回复之外的其他 回复，或者在指定时限内没有返回任何回复

如果同一个实例在 down-after-milliseconds 毫秒内，连续向 sentinel返回无效回复，那么 sentinel 就会先把它标记为**主观下线**。

~~~ properties
# 指定多少毫秒之后 主节点没有应答哨兵sentinel 此时 哨兵认为主节点下线 默认30秒
SENTINEL down-after-milliseconds master 3000
~~~

当 sentinel 将一个主服务判断为主观下线之后，为了确认这个主服务器是否真的下线了，它会向同样监视这一主服务的其他 sentinel 进行询问，看它们是否任务主服务器以及进入了下线状态。当 sentinel 从其他 sentinel 那里接收到足够数量的已下线判断之后，sentinel 就会将从服务器判定为客观下线，并对主服务器执行故障转移操作。

简单来说**客观下线**的标准就是，当有 N 个哨兵实例时，最好要有 N/2 + 1 个实例判 断主库为“主观下线”，才能最终判定主库为 客观下线。

有多少个实例做出主观下线的判断才可以，可以由 Redis 管理员自行设定

~~~ properties
#配置监听的主节点，masterRedis为服务名称，可以自己定义。192.168.50.130为主节点的ip，6379为主节点的名称，1代表有一个或者一个以上的哨兵认为主节点不可用时，则进行选举操作
#sentine1 monitor <master-name> <ip> <redis-port> <quorum>
sentinel monitor masterRedis 192.168.50.130 6379 1
~~~

### 哨兵选举

当判断完主库下线后，要通过哨兵选举机制来决定哪个哨兵来执行主从切换。

**选举/共识机制**

为了避免哨兵的单点情况发生，所以需要一个哨兵的分布式集群。作为分布式集群，必然涉及共识问题（即选举问题）；同时故障的转移和通知都只需要一个主的哨兵节点就可以了。

哨兵的选举机制其实很简单，就是一个Raft选举算法： **选举的票数大于等于num(sentinels)/2+1时，将成为领导者，如果没有超过，继续选举**

- 任何一个想成为 Leader 的哨兵，要满足两个条件
  - 第一，拿到半数以上的赞成票；
  - 第二，拿到的票数同时还需要大于等于哨兵配置文件中的 quorum 值。

以 3 个哨兵为例，假设此时的 quorum 设置为 2，那么，任何一个想成为 Leader 的哨兵只要拿到 2 张赞成票，就可以了。

> 这里很多人会搞混 **判定客观下线** 和 **是否能够主从切换（用到选举机制）** 两个概念，我们再看一个例子。
>
> Redis 1主4从，5个哨兵，哨兵配置quorum为2，如果3个哨兵故障，当主库宕机时，哨兵能否判断主库 客观下线？能否自动切换?
>
> ****
>
> 经过实际测试：
>
> 1、哨兵集群可以判定主库“主观下线”。由于quorum=2，所以当一个哨兵判断主库“主观下线”后，询问另外一个哨兵后也会得到同样的结果，2个哨兵都判定“主观下线”，达到了quorum的值，因此，**哨兵集群可以判定主库为“客观下线”**。
>
> 2、**但哨兵不能完成主从切换**。哨兵标记主库“客观下线后”，在选举“哨兵领导者”时，一个哨兵必须拿到超过多数的选票(5/2+1=3票)。但目前只有2个哨兵活着，无论怎么投票，一个哨兵最多只能拿到2票，永远无法达到`N/2+1`选票的结果。

### 新库选定

哨兵选择新主库的过程称为“筛选 + 打分”。简单来说，我们在多个从库中，先按照一定的筛选条件，把不符合条件的从库去掉。然后，我们再按照一定的规则， 给剩下的从库逐个打分，将得分最高的从库选为新主库

- 过滤掉不健康的（下线或断线），没有回复过哨兵ping响应的从节点。
- 选择`salve-priority`从节点优先级最高（redis.conf）的。
- 选择复制偏移量最大，只复制最完整的从节点。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212130708984.jpeg" alt="img" style="zoom: 25%;" />

### 故障转移

故障转移的流程如下：

- 将slave-1脱离原从节点（PS: 5.0 中应该是`replicaof no one`)，升级主节点，
- 将从节点slave-2指向新的主节点
- 通知客户端主节点已更换
- 将原主节点（oldMaster）变成从节点，指向新的主节点

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212130729009.png" alt="image-20221213072905840" style="zoom: 67%;" />

## 集群模式

主从复制 和 哨兵机制 保障了高可用，就读写分离而言虽然slave节点扩展了主从的读并发能力，但是**写能力**和**存储能力**是无法进行扩展，就只能是master节点能够承载的上限。如果面对海量数据那么必然需要构建master（主节点分片)之间的集群，同时必然需要吸收高可用（主从复制和哨兵机制）能力，即每个master分片节点还需要有slave节点，这是分布式系统中典型的纵向扩展（集群的分片技术）的体现；所以在Redis 3.0版本中对应的设计就是Redis Cluster。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212130743459.png" alt="image-20221213074328389" style="zoom:50%;" />

### 集群模式搭建

Redis5.0以后，集群管理以及集成到了redis-cli中，格式如下：

```sh
redis-cli --cluster create --cluster-replicas 1 192.168.150.101:7001 192.168.150.101:7002 192.168.150.101:7003 192.168.150.101:8001 192.168.150.101:8002 192.168.150.101:8003
```

命令说明：

- `redis-cli --cluster`或者`./redis-trib.rb`：代表集群操作命令
- `create`：代表是创建集群
- `--replicas 1`或者`--cluster-replicas 1` ：指定集群中每个master的副本个数为1，此时`节点总数 ÷ (replicas + 1)` 得到的就是master的数量。因此节点列表中的前n个就是master，其它节点都是slave节点，随机分配到不同master

### 散列槽

Redis-cluster没有使用一致性hash，而是引入了**哈希槽**的概念。Redis-cluster中有16384(即2的14次方）个哈希槽，每个key通过CRC16校验后对16383取模来决定放置哪个槽。Cluster中的每个节点负责一部分hash槽（hash slot）。

比如集群中存在三个节点，则可能存在的一种分配如下：

- 节点A包含0到5500号哈希槽；
- 节点B包含5501到11000号哈希槽；
- 节点C包含11001 到 16384号哈希槽。

如果我们想让一部分 key 在同一节点下， redis也提供了打标的方法 `Hash tags` ，我们可以让 key 带上一个 tag 的方式，这样 hash 计算的时候只会取{}里面的值

~~~ shell
 set {activity}user:10086 "小明"
~~~

### 请求重定向

Redis cluster采用去中心化的架构，集群的主节点各自负责一部分槽，客户端如何确定key到底会映射到哪个节点上呢？这就依赖了 **MOVED重定向** 和 **ASK重定向**

在cluster模式下，**节点对请求的处理过程**如下：

- 检查当前key是否存在当前 NODE ？ 
  - 通过crc16（key）/16384计算出slot
  - 查询负责该slot负责的节点，得到节点指针
  - 该指针与自身节点比较
- 若slot不是由自身负责，则返回 MOVED重定向
- 若slot由自身负责，且key在slot中，则返回该key对应结果
- 若key不存在此slot中，检查该slot是否正在迁出（MIGRATING）？
- 若key正在迁出，返回ASK错误重定向客户端到迁移的目的服务器上
- 若Slot未迁出，检查Slot是否导入中？
- 若Slot导入中且有ASKING标记，则直接操作
- 否则返回MOVED重定向

#### MOVED 重定向

- 槽命中：直接返回结果
- 槽不命中：即当前键命令所请求的键不在当前请求的节点中，则当前节点会向客户端发送一个Moved 重定向，客户端根据Moved 重定向所包含的内容找到目标节点，再一次发送命令。

redis-cli会帮你自动重定向（如果没有集群方式启动，即没加参数 -c，redis-cli不会自动重定向），并且编写程序时，寻找目标节点的逻辑需要交予程序员手动完成。

#### ASK 重定向

Ask重定向发生于集群伸缩时，集群伸缩会导致槽迁移，当我们去源节点访问时，此时数据已经可能已经迁移到了目标节点，使用Ask重定向来解决此种情况。

![image-20221219205254997](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212192052172.png)

#### smart客户端

上述两种重定向的机制使得客户端的实现更加复杂，提供了smart客户端（JedisCluster）来**减低复杂性，追求更好的性能**。客户端内部负责计算/维护键-> 槽 -> 节点映射，用于快速定位目标节点。

实现原理：

- 从集群中选取一个可运行节点，使用 cluster slots得到槽和节点的映射关系

  <img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212192053654.png" alt="img" style="zoom:50%;" />

- 将上述映射关系存到本地，通过映射关系就可以直接对目标节点进行操作（CRC16(key) -> slot -> node），很好地避免了Moved重定向，并为每个节点创建JedisPool

- 至此就可以用来进行命令操作

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212192105259.png" alt="image-20221219210533178" style="zoom: 67%;" />

### Gossip 协议

Redis Cluster 通讯底层是Gossip协议

gossip 协议（gossip protocol）又称 epidemic 协议（epidemic protocol），是基于流行病传播方式的节点或者进程之间信息交换的协议。 在分布式系统中被广泛使用，比如我们可以使用 gossip 协议来确保网络中所有节点的数据一样。

Gossip协议已经是P2P网络中比较成熟的协议了。Gossip协议的最大的好处是，**即使集群节点的数量增加，每个节点的负载也不会增加很多，几乎是恒定的。这就允许Consul管理的集群规模能横向扩展到数千个节点**。

Gossip算法又被称为反熵（Anti-Entropy），熵是物理学上的一个概念，代表杂乱无章，而反熵就是在杂乱无章中寻求一致，这充分说明了Gossip的特点：在一个有界网络中，每个节点都随机地与其他节点通信，经过一番杂乱无章的通信，最终所有节点的状态都会达成一致。每个节点可能知道所有其他节点，也可能仅知道几个邻居节点，只要这些节可以通过网络连通，最终他们的状态都是一致的，当然这也是疫情传播的特点。

> 通俗来说 Gossip协议也可以称为 流言协议，说白了就是八卦协议，这种传播规模和传播速度都是非常快的

#### Gossip协议的使用

Redis 集群是去中心化的，彼此之间状态同步靠 gossip 协议通信，集群的消息有以下几种类型：

- `Meet` 通过「cluster meet ip port」命令，已有集群的节点会向新的节点发送邀请，加入现有集群。
- `Ping` 节点每秒会向集群中其他节点发送 ping 消息，消息中带有自己已知的两个节点的地址、槽、状态信息、最后一次通信时间等。
- `Pong` 节点收到 ping 消息后会回复 pong 消息，消息中同样带有自己已知的两个节点信息。
- `Fail` 节点 ping 不通某节点后，会向集群所有节点广播该节点挂掉的消息。其他节点收到消息后标记已下线。

### 故障检测

集群中的每个节点都会定期地向集群中的其他节点发送PING消息，以此交换各个节点状态信息，检测各个节点状态：**在线状态**、**疑似下线状态PFAIL**、**已下线状态FAIL**。

**自己保存信息**：当主节点A通过消息得知主节点B认为主节点D进入了疑似下线(PFAIL)状态时,主节点A会在自己的clusterState.nodes字典中找到主节点D所对应的clusterNode结构，并将主节点B的下线报告添加到clusterNode结构的fail_reports链表中，并后续关于结点D疑似下线的状态通过Gossip协议通知其他节点。

**一起裁定**：如果集群里面，半数以上的主节点都将主节点D报告为疑似下线，那么主节点D将被标记为已下线(FAIL)状态，将主节点D标记为已下线的节点会向集群广播主节点D的FAIL消息，所有收到FAIL消息的节点都会立即更新nodes里面主节点D状态标记为已下线。

**最终裁定**：将 node 标记为 FAIL 需要满足以下两个条件：

- 有半数以上的主节点将 node 标记为 PFAIL 状态。
- 当前节点也将 node 标记为 PFAIL 状态。

### 维护心跳

#### 心跳时间

Redis节点会记录其向每一个节点上一次发出ping和收到pong的时间，心跳发送时机与这两个值有关。通过下面的方式既能保证及时更新集群状态，又不至于使心跳数过多：

- 每次Cron向所有未建立链接的节点发送ping或meet
- 每1秒从所有已知节点中随机选取5个，向其中上次收到pong最久远的一个发送ping
- 每次Cron向收到pong超过timeout/2的节点发送ping
- 收到ping或meet，立即回复pong

#### 心跳数据

- Header，发送者自己的信息 
  - 所负责slots的信息
  - 主从信息
  - ip port信息
  - 状态信息
- Gossip，发送者所了解的部分其他节点的信息 
  - ping_sent , pong_received
  - ip , port信息
  - 状态信息，比如发送者认为该节点已经不可达，会在状态信息中标记其为PFAIL或FAIL

#### 处理心跳

当slave发现自己的master变为FAIL状态时，便尝试进行Failover，以期成为新的master。由于挂掉的master可能会有多个slave。Failover的过程需要经过类Raft协议的过程在整个集群内达到一致， 其过程如下：

- slave发现自己的master变为FAIL
- 将自己记录的集群currentEpoch加1，并广播Failover Request信息
- 其他节点收到该信息，只有master响应，判断请求者的合法性，并发送FAILOVER_AUTH_ACK，对每一个epoch只发送一次ack
- 尝试failover的slave收集FAILOVER_AUTH_ACK
- 超过半数后变成新Master
- 广播Pong通知其他集群节点

**1. 新节点加入**

- 发送meet包加入集群
- 从pong包中的gossip得到未知的其他节点
- 循环上述过程，直到最终加入集群

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212192220646.png" alt="image-20221219222043576" style="zoom:50%;" />

**2. Slots信息**

- 判断发送者声明的slots信息，跟本地记录的是否有不同
- 如果不同，且发送者epoch较大，更新本地记录
- 如果不同，且发送者epoch小，发送Update信息通知发送者

**3. Master slave信息**

发现发送者的master、slave信息变化，更新本地状态

**4. 节点Fail探测(故障发现)**

- 超过超时时间仍然没有收到pong包的节点会被当前节点标记为PFAIL
- PFAIL标记会随着gossip传播
- 每次收到心跳包会检测其中对其他节点的PFAIL标记，当做对该节点FAIL的投票维护在本机
- 对某个节点的PFAIL标记达到大多数时，将其变为FAIL标记并广播FAIL消息

### 广播信息

当需要发布一些非常重要需要立即送达的信息时，上述心跳加Gossip的方式就显得捉襟见肘了，这时就需要向所有集群内机器的广播信息，使用广播发的场景：

- **节点的Fail信息**：当发现某一节点不可达时，探测节点会将其标记为PFAIL状态，并通过心跳传播出去。当某一节点发现这个节点的PFAIL超过半数时修改其为FAIL并发起广播。
- **Failover Request信息**：slave尝试发起FailOver时广播其要求投票的信息
- **新Master信息**：Failover成功的节点向整个集群广播自己的信息

### 故障恢复

当slave发现自己的master变为FAIL状态时，便尝试进行Failover，以期成为新的master。由于挂掉的master可能会有多个slave。Failover的过程需要经过类Raft协议的过程在整个集群内达到一致， 其过程如下：

- slave发现自己的master变为FAIL
- 将自己记录的集群currentEpoch加1，并广播Failover Request信息
- 其他节点收到该信息，只有master响应，判断请求者的合法性，并发送FAILOVER_AUTH_ACK，对每一个epoch只发送一次ack
- 尝试failover的slave收集FAILOVER_AUTH_ACK
- 超过半数后变成新Master
- 广播Pong通知其他集群节点

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212192222979.png" alt="img" style="zoom: 67%;" />

### 扩缩容

#### 扩容

当集群出现容量限制或者其他一些原因需要扩容时，redis cluster提供了比较优雅的集群扩容方案。

1. 首先将新节点加入到集群中，可以通过在集群中任何一个客户端执行cluster meet 新节点ip:端口，或者通过redis-trib add node添加，新添加的节点默认在集群中都是主节点。
2. 迁移数据 迁移数据的大致流程是，首先需要确定哪些槽需要被迁移到目标节点，然后获取槽中key，将槽中的key全部迁移到目标节点，然后向集群所有主节点广播槽（数据）全部迁移到了目标节点。直接通过redis-trib工具做数据迁移很方便。 现在假设将节点A的槽10迁移到B节点，过程如下：

```bash
B:cluster setslot 10 importing A.nodeId
A:cluster setslot 10 migrating B.nodeId
```

循环获取槽中key，将key迁移到B节点

```bash
A:cluster getkeysinslot 10 100
A:migrate B.ip B.port "" 0 5000 keys key1[ key2....]
```

向集群广播槽已经迁移到B节点

```bash
cluster setslot 10 node B.nodeId
```

#### 缩容

缩容的大致过程与扩容一致，需要判断下线的节点是否是主节点，以及主节点上是否有槽，若主节点上有槽，需要将槽迁移到集群中其他主节点，槽迁移完成之后，需要向其他节点广播该节点准备下线（cluster forget nodeId）。最后需要将该下线主节点的从节点指向其他主节点，当然最好是先将从节点下线。

#### Redis Cluster的Hash Slot 为什么是16384？

我们知道一致性hash算法是2的16次方，为什么hash slot是2的14次方呢？

在redis节点发送心跳包时需要把所有的槽放到这个心跳包里，以便让节点知道当前集群信息，16384=16k，在发送心跳包时使用char进行bitmap压缩后是2k（2 * 8 (8 bit) * 1024(1k) = 16K），也就是说使用2k的空间创建了16k的槽数。

虽然使用CRC16算法最多可以分配65535（2^16-1）个槽位，65535=65k，压缩后就是8k（8 * 8 (8 bit) * 1024(1k) =65K），也就是说需要需要8k的心跳包，作者认为这样做不太值得；并且一般情况下一个redis集群不会有超过1000个master节点，所以16k的槽位是个比较合适的选择。

