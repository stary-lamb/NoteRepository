---
title: 基本数据类型及应用场景
date: 2022-11-17
---

## String

### 内部实现

String 类型的底层的数据结构实现主要是 **int 和 SDS（简单动态字符串）**。

字符串对象的内部编码（encoding）有 3 种 ：**int、raw和 embstr**。

#### int

当字符串键值的内容可以用一个64位有符号整型来表示且字符串长度小于等于20，Redis会将键值转化为long型来进行存储，此时即对应 OBJ_ENCODING_INT 编码类型，若不能使用整型来使用则将编码转换为 embstr 和 raw

![image-20221208195906257](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212081959310.png)

#### embstr

对于长度小于 44的字符串，Redis 对键值采用OBJ_ENCODING_EMBSTR 方式，EMBSTR 顾名思义即：embedded string，表示嵌入式的String。从内存结构上来讲 即字符串 sds结构体与其对应的 redisObject 对象分配在同一块连续的内存空间，字符串sds嵌入在redisObject对象之中一样。

![](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212081959481.png)

#### raw

当字符串的键值为长度大于44的超长字符串时，Redis 则会将键值的内部编码方式改为OBJ_ENCODING_RAW格式，这与OBJ_ENCODING_EMBSTR编码方式的不同之处在于，此时动态字符串sds的内存与其依赖的redisObject的内存不再连续了。

![image-20221208200311698](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082003754.png)

> 注意点: 字符串的编码转化为 raw 不一定时字符串长度大于44的超长字符，若对 embstr 对象进行修改时，会先转化为 raw 再进行修改，并且修改后的对象的编码值不再是 embstr 而是修改后的 raw。

### 常用命令

- 最常用
  - set key value
  - get key
- 同时设置/获取多个键值
  - MSET key value [key value...]
  - MGET key [key...]
- 数值增减
  - 递增数字：INCR key
  - 增加指定的整数：INCRBY key increment
  - 递减数字：DECR key
  - 减少指定的整数：DECRBY key decrement
- 获取字符串长度
  - STRLEN key
- 分布式锁
  - setnx key value
  - set key value [EX seconds] [PX milliseconds] [NX|XX]
    - EX：key在多少秒之后过去
    - PX：key在多少毫秒之后过期
    - NX：当key不存在的时候，才创建key，效果等同于setnx
    - XX：当key存在的时候，覆盖key

### 应用场景

🌰：给文章点赞、点赞视频、商品，统计阅读数量

~~~ shell
set items:1 0
INCR items:1
INCR items:1
INCR items:1
#获取点赞数或者阅读量
get items:1
~~~

## Hash

### 内部实现

Redis中的Hash结构相当于 Map<String,Ma<Object,Object>>

Hash 类型的底层数据结构是由**压缩列表或哈希表**实现的：

- 如果哈希类型元素个数小于 `512` 个（默认值，可由 `hash-max-ziplist-entries` 配置），所有值小于 `64` 字节（默认值，可由 `hash-max-ziplist-value` 配置）的话，Redis 会使用**压缩列表**作为 Hash 类型的底层数据结构；
- 如果哈希类型元素不满足上面条件，Redis 会使用**哈希表**作为 Hash 类型的 底层数据结构

> 注意点：
>
> 1. 一旦从压缩列表转为了哈希表，Hash类型就会一直用哈希表进行保存而不会再转回压缩列表了，且在节省内存空间方面哈希表就没有压缩列表高效了。
> 2. **在 Redis 7.0 中，压缩列表数据结构已经废弃了，交由 listpack 数据结构来实现了**。

### 常用命令

- 一个设置一个字段值：HSET key field value
- 一次获取一个字段值：HGET key field
- 一次设置多个字段值：HMSET key field value [field value ...]
- 一次获取多个字段值：HMGET key field [field]
- 获取所有字段值：hgetall key 
- 获取某个key内的全部数量：hlen
- 删除一个key：hdel

### 应用场景

🌰：购物车的实现

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211172237457.png" alt="image-20221117223737379" style="zoom:50%;" />

~~~ shell
#新增商品
hset shopcar:uid1024 334488 1
hset shopcar:uid1024 334538 1
#增加商品数量
hincrby shopcar:uid1024 334488 1
#商品总数
hlen shopcar:uid1024 
#全部选中
hgetall shopcar:uid1024 
~~~

## List

### 内部实现

一个双端链表的结构，容量是2的32次方减1个元素，大概40多亿，主要功能有push/pop等，一般用在栈、队列、消息队列等场景。

List 类型的底层数据结构是由**quicklist**实现的：

- 如果列表的元素个数小于 `512` 个（默认值，可由 `list-max-ziplist-entries` 配置），列表每个元素的值都小于 `64` 字节（默认值，可由 `list-max-ziplist-value` 配置），Redis 会使用**压缩列表**作为 List 类型的底层数据结构；
- 如果列表的元素不满足上面的条件，Redis 会使用**双向链表**作为 List 类型的底层数据结构；

> 3.2 以前的版中，List 数据类型底层数据结构是由 ziplist+linkedList 实现的，在 3.2 之后 底层数据结构更改为 **quicklist** 实现了，替代了原有的双向链表和压缩列表

### 常用命令

- 向列表左边添加元素：LPUSH key value[value...]
- 向列表右边添加元素：RPUSH key value[value...]
- 查看列表：LRANGE key start stop
- 获取列表中元素的个数：LLEN key

### 应用场景

**🌰一：微信公众号订阅消息**

1. 两个公众号分别发布了文章11 和 22

2. 自己关注了他们两个，只有发布了新文章，就会添加到我的List

   LPUSH likearticle:1024 11 22

3. 查看自己订阅的全部文章(查看0~10条数据，类似于分页)

   LRANGE likearticle:1024 0 10

**🌰二：商品评论列表**

- 需求一：用户针对某一商品进行评论，一个商品会被不同的用户进行评论，保存商品评论时，要按时间顺序排序
- 需求二：用户在前端页面查询该商品的评论，需要按照时间顺序降序排序

~~~ shell
#使用List存储商品评论信息，key是该商品的id，value是商品评论信息，商品编号为1001的商品评论key[items:comment:1001]
lpush items:comment:1001 {"id":1001,"name":"huawei","date":"1600481283054","content":"lasjfdljsa;dasdasdasda,asdasdas,asdasdas"}
~~~

## Set

### 内部实现

Set 类型的底层数据结构是由**哈希表或整数集合**实现的：

- 如果集合中的元素都是整数且元素个数小于 `512` （默认值，`set-maxintset-entries`配置）个，Redis 会使用**整数集合**作为 Set 类型的底层数据结构；
- 如果集合中的元素不满足上面条件，则 Redis 使用**哈希表**作为 Set 类型的底层数据结构。

### 常用命令

- 添加元素：SADD key member[member]
- 删除元素：SREM key member[member]
- 遍历集合中的所有元素：SMEMBERS key
- 判断元素是否在集合中：SISMEMBER key member
- 获取集合中的元素总数：SCARD key
- 从集合中随机弹出一个元素，元素不删除：SRANDMEMBER key[数字]
- 从集合中随机弹出一个元素，出一个删一个：SPOP key[数字]
- 集合运算
  - A[abc123]、B[123ax]
  - 集合的差集运算 A-B
    - 属于A但不属于B的元素构建的集合
    - SDIFF key[key]
  - 集合的交集运算 A∩B
    - 属于A同时也属于B的共同拥有元素构成的集合
    - SINTER key[key]
  - 集合的并集运算 A∪B
    - 属于A或者属于B的元素并后的集合
    - SUNION key [key....]

### 应用场景

**🌰一：抽奖**

~~~ shell
#用户点击立即参与抽奖按钮
sadd key 用户id
#显示有多少人参与抽奖
SCARD key
#抽奖（从set中任意选取N个中将人）
SRANDMEMBER key 2（随机抽奖2个人，元素不会删除[有重复抽到的风险]）
SPOP key 3（随机抽奖3个人，元素会删除[不存在重复抽到]）
~~~

**🌰二：点赞**

~~~ shell
#新增点赞
sadd pub:msgID 点赞用户ID1 点赞用户ID2
#取消点赞
srem pub:msgID 点赞用户ID
#点赞用户数统计，就是常见的点赞红色数字
scard pub:msgID
#判断某个朋友是否对楼主点赞过
SISMEMBER pub:msgID 用户ID
~~~

**🌰三：好友关注的社交关系**

- 共同关注的人

~~~ shell
sadd s1 1 2 3 4 5
sadd s2 3 4 5 6 7

# 集合的交集运算 A∩B 来进行对比
SINTER s1 s2
~~~

- 我关注的人也关注了他

~~~ shell
sadd s1 1 2 3 4 5 
sadd s2 3 4 5 6 7

SISMEMBER s1 3
SISMEMBER s2 3
~~~

**🌰四：可能认识的人**

~~~ shell
sadd s1 1 2 3 4 5 
sadd s2 3 4 5 6 7

SINTER s1 s2
SDIFF s1 s2
SDIFF s2 s1
~~~

## Zset 

### 内部实现

Zset 类型的底层数据结构是由**压缩列表或跳表**实现的：

- 如果有序集合的元素个数小于 `128` 个，并且每个元素的值小于 `64` 字节时，Redis 会使用**压缩列表**作为 Zset 类型的底层数据结构；
- 如果有序集合的元素不满足上面的条件，Redis 会使用**跳表**作为 Zset 类型的底层数据结构；

### 常用命令

- 向有序集合中加入一个元素和该元素的分数：ZADD key score member [score member....]
- 按照元素分数从小到大的顺序返回索引从satrt到stop之间的所有元素：ZRANGE key start stop[WITHSCORES]
- 获取元素的分数：ZSCORE key member
- 删除元素：ZREM key member [member...]
- 获取指定分数范围的元素：ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]
- 增加某个元素的分数：ZINCRBY key increment member
- 获取集合中元素的数量：ZCARD key
- 获取指定分数范围内的元素个数：ZCOUNT key min max
- 按照排名范围删除元素：ZREMRANGEBYRANK key start stop
- 获取元素的排名
  - 从小到大：ZRANK key member
  - 从大到小 ZREVRANK key member

### 应用场景

**🌰：排行榜**

~~~ shell
#思路：定义商品销售排行榜（sorted set集合），key为goods:sellsort，分数为商品销售数量

#商品编号1001的销量是9，商品编号1002的销量是15
zadd goods:sellsort 9 1001 15 1002 
#有一个客户又买了2件商品1001，商品编号1001销量加2
zincrby goods:sellsort 2 1001 
#求商品销量前10名
ZRANGE goods:sellsort 0 10 withscores
~~~

## Bitmaps

Bitmaps，即位图。用String类型作为底层数据结构实现的一种统计二值状态的数据类型。它的本质是数组，基于String数据类型的按位操作，有多个二进制位组成，每个二进制位都对应一个偏移量（可以称之为索引或者位格）。BitMap支持的最大位数是2^32^位，它可以极大的节约存储空间，使用512M内存就可以存储多达42.9亿的字节信息（2^32^=4294967296） 

![image-20221119092656857](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211190927065.png)

### 常用命令

- 给指定key的值的第offset赋值：setbit key offset value
- 获取指定key的第offset位：getbit key offset
- 返回指定key中[start,end]中为1的数量：bitcount key start end
- 对不同的二进制存储数据进行位运算(AND、OR、NOT、XOR)：bitop operation destkey key
- 返回指定key中第一次出现指定value(0/1)的位置：BITPOS [key] [value]

### 应用场景

🌰：签到统计

在签到统计的场景中，每一个用户的签到用1bit就可以表示，一个月（假设是31天）的签到情况用31`bit`就可以，而一年的签到也只需要用365`bit`，根本不用太复杂的集合类型。假如是亿级的系统，每天使用1个1亿位的`Bitmaps`约占12MB的内存(10^8^/1024/1024)，10天的BitMap的内存开销约为120M，内存压力不算大，但在实际使用时，最好要对Bitmaps设置过期时间，让Redis自动删除不再需要的签到记录以节省内存开销。

~~~ shell
#统计33用户在2022-11月的签到情况
setbit userID:33:202211 0 1
setbit userID:33:202211 2 1
#查看该用户在2022-11-2这天的签到情况
getbit userID:33:202211 1
#统计该用户在11月的签到情况
bitcount userID:33:202211
#查看首次打卡的时间
BITPOS userID:33:202211 0
~~~

## HyperLogLog

Redis HyoperLogLog 是用来做基数统计的算法，HyoperLogLog 的优点是在输入元素数量或者体积非常非常大时，计算基数所需空间总是固定的，并且是很小的，但它也存在缺点，HyoperLogLog是非精确统计，牺牲了准确率来换取空间，误差仅仅只是`0.81%`左右。

在Redis里面，每个HyoperLogLog键只需要花费`12KB`的内存，就可以计算接近**2^64^**个不同元素的基数，和计算基数收，元素越多越耗费内存的集合形成鲜明的对比，但HyoperLogLog只会根据输入元素来计算基数，而不会存储输入元素本身，所以HyperLogLog不能像集合那样，返回输入的各个元素。

### 常用命令

- 将所有元素添加到key中：pfadd key element
- 统计key的估算值(不精确)：pfcount key
- 合并key至新key：pgmerge new_key key1 key2

### 应用场景

- UV：Unique Visitor，独立访客，一般理解为客户端IP [需要做去重考虑]
- PV：Page View，页面访问浏览量 [不用去重]
- DAU：Daily Active User，日活跃用户量
- MAU：Monthly Active User，月活跃用户量

🌰：

需求：UV的统计需要去重，一个用户一天内的多次访问只能算作一次

​	 淘宝、天猫首页的UV，平均每天是1~1.5个亿左右

​	 每天存1.5亿的IP，访问来了后去查是否存在，不存在加入

代码实现：Conytroller

~~~ java
@RestController
@Slf4j
public class HyperLogLogController {

    @Resource
    private RedisTemplate redisTemplate;


    @ApiOperation("获取ip去重复后的首页访问量，总数统计")
    @GetMapping("/uv")
    public long uv() {
        //pfcount
        return redisTemplate.opsForHyperLogLog().size("hll");
    }
}
~~~

## GEO

Redis在3.2版本以后增加了地理位置的处理，地理空间索引可以存储坐标并进行搜索，可用于查找给定半径或边界框内的附近点。

### 常用命令

~~~ shell
#存储指定的地理空间位置，可以将一个或多个经度(longitude)、纬度(latitude)、位置名称(member)添加到指定的key中
GEOADD key longitude latitude member [longitude latitude member ...]

#从给定的key里返回所有指定名称(member)位置（经度和纬度）
GEOPOS key member [member ...]

#获取一个或多个位置元素的 geohash 
GEOHASH key member [member...]

#返回两个给定位置之间的距离 m米 km千米 ft英尺 mi英里
GEODIST key member1 member2 [m|km|ft|mi]

#给定的经纬度为中心，返回键包含的位置元素当中，与中心的距离不超过给定最大距离的所有位置元素
#WITHDIST：在返回位置元素的同时，将位置元素与中心之间的距离也一并返回。距离的单位和用户给定的范围单位保持一致
#WITHCOORD：将位置元素的经度和纬度也一并返回
#WITHHASH：以52位有符号整数的形式，返回位置元素经过原始geohash编码的有序集合分值。这个选项主要用于底层应用或调试，实际中的作用不大。
#COUNT：限定返回的记录数
GEORADIUS key longitude latitude radius <M | KM | FT | MI> [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count [ANY]] [ASC | DESC][STORE key] [STOREDIST key]

#找出位于指定范围内的元素，中心点是给定的位置元素决定
GEORADIUSBYMEMBER key member radius <M | KM | FT | MI> [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count [ANY]] [ASC | DESC] [STORE key] [STOREDIST key]	

~~~

### 应用场景

🌰：微信附近的人、查找附近的酒店、附件的共享单车、

~~~ java
@RestController
public class GeoController {
    public static final String CITY = "city";
    @Autowired
    private RedisTemplate redisTemplate;

    @ApiOperation("新增天安门故宫长城纬度")
    @PostMapping("/geoadd")
    public String geoAdd() {
        HashMap<String, Point> map = new HashMap<>();
        map.put("天安门", new Point(116.403963, 39.915119));
        map.put("故宫", new Point(116.403414, 39.924091));
        map.put("长城", new Point(116.024067, 40.362639));

        redisTemplate.opsForGeo().add(CITY, map);
        return map.toString();
    }

    @ApiOperation("获取地理位置坐标")
    @GetMapping("/geopos")
    public Point position(String member) {
        List<Point> list = this.redisTemplate.opsForGeo().position(CITY, member);
        return list.get(0);
    }

    @ApiOperation("geohash算法生成的base32编码")
    @GetMapping("/geohash")
    public String hash(String member) {
        List<String> list = redisTemplate.opsForGeo().hash(CITY, member);
        return list.get(0);
    }

    @ApiOperation("计算两个位置之间的距离")
    @GetMapping("/geodist")
    public Distance distance(String member1, String member2) {
        Distance distance = redisTemplate.opsForGeo().distance(CITY, member1, member2, RedisGeoCommands.DistanceUnit.KILOMETERS);
        return distance;
    }


    /**
     * 通过经度，纬度查找附近的
     * 北京王府井位置116.418017,39.914402,这里为了方便讲课，故意写死
     */
    @ApiOperation("通过经度，纬度查找附近的")
    @GetMapping("/georadius")
    public GeoResults radiusByxy() {
        //这个坐标是北京王府井位置
        Circle circle = new Circle(116.418017, 39.914402, Metrics.MILES.getMultiplier());
        //返回50条
        RedisGeoCommands.GeoRadiusCommandArgs args = RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs().includeDistance().includeCoordinates().sortAscending().limit(10);
        GeoResults<RedisGeoCommands.GeoLocation<String>> geoResults= this.redisTemplate.opsForGeo().radius(CITY,circle, args);
        return geoResults;
    }

    /**
     * 通过地方查找附近
     */
    @ApiOperation("通过地方查找附近")
    @GetMapping("/georadiusByMember")
    public GeoResults radiusByMember() {
        String member="天安门";
        //返回50条
        RedisGeoCommands.GeoRadiusCommandArgs args = RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs().includeDistance().includeCoordinates().sortAscending().limit(10);
        //半径10公里内
        Distance distance=new Distance(10, Metrics.KILOMETERS);
        GeoResults<RedisGeoCommands.GeoLocation<String>> geoResults= this.redisTemplate.opsForGeo().radius(CITY,member, distance,args);
        return geoResults;
    }
}
~~~

