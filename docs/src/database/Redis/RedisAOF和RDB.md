---
title: AOF 和 RDB
date: 2022-12-12
---

## RDB

RDB全称Redis Database Backup file（Redis数据备份文件），也被叫做Redis数据快照。简单来说就是把内存中的所有数据都记录到磁盘中。当Redis实例故障重启后，从磁盘读取快照文件，恢复数据。快照文件称为RDB文件，默认是保存在当前运行目录。

RDB 持久化既可以手动执行，也可以根据服务器配置选项定期执行。

### 执行时机

- **SAVE**

  SAVE 命令会阻塞 Redis 服务进程，直到RDB文件创建完毕为止，在服务器中阻塞期间，服务器不能处理任何的命令请求。

- **BGSVAE**

  BGSVAE 命令会派生出一个子线程，然后由子线程负责创建 RDB 文件，服务器进程（父进程）继续处理命令请求。

- **停机时**

  Redis停机时会执行一次save命令，实现RDB持久化。

- **触发RDB条件**

  Redis允许用户通过设置服务器配置的 svae 选项，让服务器每隔一段时间自动执行一次 BGSAVE 命令。

  用户可以通过 save 选项设置多个保存条件，只要其中任意一个条件被满足，服务器就会执行 BGSAVE命令

  🌰：可以在redis.conf文件中找到，格式如下：

  ~~~ properties
  # 900秒内，如果至少有1个key被修改，则执行bgsave ， 如果是save "" 则表示禁用RDB
  save 900 1  
  save 300 10  
  #代表60秒内至少执行1000次修改则触发RDB
  save 60 10000 
  ~~~
  

RDB的其它配置也可以在redis.conf文件中设置：

~~~ properties
# 是否压缩 ,建议不开启，压缩也会消耗cpu，磁盘的话不值钱
rdbcompression yes

# RDB文件名称
dbfilename dump.rdb  

# 文件保存的路径目录
dir ./ 
~~~

### RDB 触发条件的底层原理

**1. 如果用户没有主动设置 save选项，那么服务器会为save选项设置默认条件**

~~~ properties
save 900 1  
save 300 10  
save 60 10000 
~~~

**2. 服务程序会根据 save 选项所设置的保存条件，设置服务器的状态 redisServer 结构的saveparams 属性**

~~~~ c
struct redisServer {
    	//	 ...
    	// 记录保存条件的数组	
        struct saveparam *saveparams;   /* Save points array for RDB */
    	// 修改计数器
    	time_t lastsave;                /* Unix time of last successful save */
    	// 上一次执行保存的时间
    	long long dirty; 
        //   ...
};
~~~~

**3. saveparams 属性是一个数组，数组中每一个元素都是一个 saveparams 结构，每个 saveparam 结构都保存了一个 save 选项设置的保存条件**

~~~ c
struct saveparam {
    // 秒数
    time_t seconds;
    // 修改数
    int changes;
};
~~~

**4. dirty 计数器记录距离上一次成功执行 SAVE 命令或 BGSAVE 命令之后，服务器对数据库状态（服务器中的所有的数据库）进行了多少次修改（包括写入、删除、更新等操作）**

当服务器成功执行一个数据库的修改命令之后，程序就会对 dirty 计数器进行更新；命令修改了多少次数据库，ditry 计数器的值就增加多少

**5. lastsave 属性是一个 UNIX 时间戳，记录了服务器上一次成功执行 SVAE 命令或者 BGSVAE 命令的时间**

**6. Redis 的服务器周期性操作函数 serverCron 默认每隔100毫秒就会执行一次，该函数用于对正在运行的服务器进行维护，它其中一项就是检查 save 选项所设置的保存条件是否满足，如果满足的话，就执行一次 BGSAVE**

### RDB原理

BASAVE 开始时会fork主进程得到子进程，子进程共享主进程的内存数据。完成fork后读取内存数据并写入 RDB 文件。

fork采用的是 copy-on-write(写时复制) 技术：

- 当主进程执行读操作时，访问共享内存；
- 当主进程执行写操作时，则会拷贝一份数据，执行写操作。

![image-20221212065615679](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120656861.png)

## AOF

AOF（Append Only File）追加文件，通过保存 Redis 服务器所执行的写命令来记录数据状态。由于 RDB 执行的间隔时间长，两次 RDB写入数据有丢失的风险，所以 Redis 提供了 AOF 的功能，Redis 处理的每一条写命令都会保存在 AOF 文件，可以看作是命令日志文件。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120703252.png" alt="image-20221212070358190" style="zoom: 80%;" />

### AOF 持久化的实现

AOF 持久化功能的实现可以分为命令追加（append）、文件写入、文件同步（sync）三个步骤。

#### 命令追加

当 AOF 持久化功能处于打开状态，服务器在执行完一个写命令之后，会议协议格式将被执行的写命令追加到服务器状态的 aof buf缓冲区的末尾：

~~~ c
struct redisServer{
    // .....
    // AOF 缓冲区
    sds aof_buf;
    // .....
}
~~~

#### AOF 文件的写入与同步

Redis 的服务器进程就是一个事件循环（loop），里面处理文件事件，时间事件等等。因为服务器在处理文件事件时可能执行写命令，使得一些内容被追加到 aof_buf 缓冲区里面，所以在服务器每次结束一个事件循环之前，它都会调用 `flushAppendOnlyFile` 函数，考虑是否需要将 aof_buf 缓冲区的内容写入和保存到 AOF 文件里面。

~~~c
# 伪代码表示写入过程
def eventLoop():
	
	while True:
	
		# 处理文件事件，接收命令请求以及发送命令回复
		# 处理命令请求时可能会有新的内容被追加到 aof_buf 缓冲区中
		processFileEvents()
         
         # 处理时间事件
         processTimeEvents()
            
         # 考虑是否要将 aof_buf 中的内容写入和保存到 AOF 文件里面
         fulshAppendOnlyFile()
~~~

`fulshAppendOnlyFile` 函数的行为由服务器配置的 appendfsync 选项的值来决定，各个不同的值产生的行为如下：

- `always`：将 aof_buf 缓冲区的所有内容写入并同步到 AOF 文件中。
- `everysec`：将 aof_buf 缓冲区中所有的内容写入到 AOF 文件，如果上次同步 AOF 文件的时间距离现在超过一秒钟，那么造成对 AOF 文件进行同步，并且这个同步操作是由一个线程专门负责执行的。[默认方案]
- `no`：将 aof_buf 缓冲区的所有内容写入到 AOF 文件，但并不对 AOF 文件进行同步，何时同步由操作系统来决定。、

**三种策略的对比：**

|   配置   |   刷盘时机   |          优点          |            缺点            |
| :------: | :----------: | :--------------------: | :------------------------: |
|  Always  |   同步刷盘   | 可靠性高，几乎不丢数据 |         性能影响大         |
| everysec |   每秒刷盘   |        性能适中        |      最多丢失1秒数据       |
|    no    | 操作系统控制 |        性能最高        | 可靠性差，可能丢失大量数据 |

### AOF 文件的载入和还原

**Redis 读取 AOF 文件并还原数据库状态的步骤如下：**

1. **创建一个不带网络连接的客户端，来执行 AOF 文件保存的写命令。**因为 Redis 命令只能在客户端上下文中执行，而载入 AOF 文件时所使用的命令直接来源于 AOF 文件而不是网络连接，所以服务器使用一个没有网络连接的伪客户端执行 AOF 文件保存的写命令，其效果与有网络的客户端执行效果一致。
2. 从 AOF 文件中分析并读取出一条写命令。
3. 使用伪客户端执行被读取的写命令。
4. 一直执行步骤2 和 步骤3，直到 AOF 文件中所有写命令都被处理完毕为止。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120742735.png" alt="image-20221212074256680" style="zoom: 67%;" />

### AOF 重写

AOF 持久化是通过保存被执行的写命令来记录数据库状态的，所有随着服务器运行时间的流逝，AOF 文件中的内容会越来越多，文件体积也会越来越大，如果不加以控制的话，体积过大的 AOF 文件很可能会对 Redis 服务器、甚至整个宿主计算机造成影响，并且 AOF 文件来进行数据还原的所需的时间就越来越长。

Redis 提供了 AOF 文件重写（rewite）功能，通过该功能，Redis 服务器可以创建一个新的 AOF 文件替代现有的 AOF 文件，新旧两个 AOF 文件所保存的数据库状态相同，但新的 AOF 文件不会包含任何浪费空间的冗余命令。

🌰： 服务器对 animals 键执行了以下命令：

~~~ properties
# 重写之前
sadd animals "Cat"

sadd animals "Dog" "Panda" "Tiger"

srem animals "Cat"

sadd animals "Lion" "Cat"

# 重写之后
sadd animals "Dog" "Panda" "Tiger" "Lion" "Cat"
~~~

**我们可以通过调用 `BGEWIRTEAOF` 命令来后台重写AOF文件，Redisy也会在触发阈值时自动去重写AOF文件。阈值也可以在redis.conf中配置：**

~~~ properties
# AOF文件比上次文件 增长超过多少百分比则触发重写
auto-aof-rewrite-percentage 100
# AOF文件体积最小多大以上才触发重写 
auto-aof-rewrite-min-size 64mb 
~~~

**AOF的重写流程：**

1. redis 主进程通过fork创建子进程。
2. 子进程根据redis内存中的数据创建数据库重建命令序列于临时文件中。
3. 父进程继续响应客户端请求，并将其中的写请求继续追加至原来的AOF文件中，额外的，这些新的写请求会被放置在一个缓冲队列中；
4. 子进程重写完成后会通知父进程，父进程把缓冲队列中的命令写入临时文件中；
5. 父进程用临时文件替换老的aof文件



## 混合持久化

RDB 和 AOF 持久化各有利弊，RDB 可能会导致一定时间内的数据丢失，而 AOF 由于文件较大则会影响 Redis 的启动速度，为了能同时使用 RDB 和 AOF 各种的优点，Redis 4.0 之后新增了混合持久化的方式。

在开启混合持久化的情况下，AOF 重写时会把 Redis 的持久化数据，以 RDB 的格式写入到 AOF 文件的开头，之后的数据再以 AOF 的格式化追加的文件的末尾。

**我们可以通过命令或者修改配置文件来开启混合持久化**

- 命令

  ~~~ c
  # 查询是否开启混合持久化
  # yes 表示已经开启混合持久化，no 表示关闭，Redis 5.0 默认值为 yes
  config get aof-use-rdb-preamble
  # 开启混合持久化
  config set aof-use-rdb-preamble yes    
  ~~~

  

- 配置文件

  在 redis.conf 文件，把配置文件中的 `aof-use-rdb-preamble no` 改为 `aof-use-rdb-preamble yes` 如下图所示：

  ![img](https://pic4.zhimg.com/80/v2-5fa91060a7ce8e28073a9e0509e84c2b_720w.webp)

  

  **混合持久化的加载流程：**

  1. 判断是否开启 AOF 持久化，开启继续执行后续流程，未开启执行加载 RDB 文件的流程；
  2. 判断 appendonly.aof 文件是否存在，文件存在则执行后续流程；
  3. 判断 AOF 文件开头是 RDB 的格式, 先加载 RDB 内容再加载剩余的 AOF 内容；
  4. 判断 AOF 文件开头不是 RDB 的格式，直接以 AOF 格式加载整个文件。

  <img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120818250.png" alt="image-20221212081830179" style="zoom:67%;" />

  #### 小结

  **混合持久化优点：**

- 混合持久化结合了 RDB 和 AOF 持久化的优点，开头为 RDB 的格式，使得 Redis 可以更快的启动，同时结合 AOF 的优点，有减低了大量数据丢失的风险。

  **混合持久化缺点：**
  
- AOF 文件中添加了 RDB 格式的内容，使得 AOF 文件的可读性变得很差；

- 兼容性差，如果开启混合持久化，那么此混合持久化 AOF 文件，就不能用在 Redis 4.0 之前版本了。

## 持久化最佳实践

持久化虽然保证了数据不丢失，但同时拖慢了 Redis 的运行速度，那怎么更合理的使用 Redis 的持久化功能呢？

**Redis 持久化的最佳实践可从以下几个方面考虑。**

**1. 控制持久化开关**

使用者可根据实际的业务情况考虑，如果对数据的丢失不敏感的情况下，可考虑关闭 Redis 的持久化，这样所以的键值操作都在内存中，就可以保证最高效率的运行 Redis 了。 持久化关闭操作：

- 关闭 RDB 持久化，使用命令： `config set save ""`
- 关闭 AOF 和 混合持久化，使用命令： `config set appendonly no`

**2. 主从部署**

使用主从部署，一台用于响应主业务，一台用于数据持久化，这样就可能让 Redis 更加高效的运行。

**3. 使用混合持久化**

混合持久化结合了 RDB 和 AOF 的优点，Redis 5.0 默认是开启的。

**4. 使用配置更高的机器**

Redis 对 CPU 的要求并不高，反而是对内存和磁盘的要求很高，因为 Redis 大部分时候都在做读写操作，使用更多的内存和更快的磁盘，对 Redis 性能的提高非常有帮助。
