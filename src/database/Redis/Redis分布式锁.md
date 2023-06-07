---
title: Redis实现分布式锁
date: 2022-11-29
---

## 可靠的分布式锁的具备的条件

**1.独占性：任何时刻只能有且仅有一个线程持有**

**2.高可用：若Redis集群环境下，不能因为某一个节点挂了而出现获取锁喝释放锁是吧的情况**

**3.防死锁：杜绝死锁，必须有超时控制机制或者撤销操作，有个兜底终止跳出方案**

**4.不乱抢：防止张冠李戴，不能私下unlock别人的锁，只能自己加锁释放**

**5.重入性：同一个节点的同一个线程如果获取锁之后，它也可以再次获取这个锁**

## 分布式锁的实现方式

- MySQL，基于唯一索引 [不推荐]
- zookeeper，基于临时有序节点
- Redis，基于setnx命令

> PS：
>
> - Redis 在单机的条件是CP，在集群模式下是AP
> - zookeeper保证的是CP
>
> C（一致性）、A（可用性）、P（分区容错性）

## setnx 分布式锁

### 命令

~~~ shell
setnx key value 
expire key [EX seconds] [PX milliseconds] [NX|XX]
等同于 set key value [EX seconds] [PX milliseconds] [NX|XX]
EX：key在多少秒之后过期
PX：key在多少毫秒之后过期
NX：当key不存在的时候，才创建key，效果等同于setnx
XX：当key存在的时候，覆盖可以
~~~

> 弊端：setnx+expire不安全，两条命令非原子性的

### 实现思路

加锁：使用key的值可以根据业务的设置，value可以使用 uuid+当前线程 来保证唯一，用于标识加锁的客户端，保证加锁和解锁都是同一个客户端；同时在加锁的过程为了防止服务器发生异常，在代码层面当中走不到finally块无法保证锁释放，需要加入一个过期时间限定key

解锁：如果使用finally块的判断+del删除操作不是原子性的，我们通过Redis调用Lua脚本通过eval命令保证代码执行的原子性

代码实现：

~~~ java
@RestController
public class GoodController
{
    public static final String REDIS_LOCK_KEY = "redisLockPay";

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Value("${server.port}")
    private String serverPort;


    @GetMapping("/buy_goods")
    public String buy_Goods()
    {
        String value = UUID.randomUUID().toString()+Thread.currentThread().getName();

        try {
            Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(REDIS_LOCK_KEY, value,30L,TimeUnit.SECONDS);

            if(!flag)
            {
                return "抢夺锁失败，请下次尝试";
            }

            String result = stringRedisTemplate.opsForValue().get("goods:001");
            int goodsNumber = result == null ? 0 : Integer.parseInt(result);

            if(goodsNumber > 0)
            {
                int realNumber = goodsNumber - 1;
                stringRedisTemplate.opsForValue().set("goods:001",realNumber + "");
                System.out.println("你已经成功秒杀商品，此时还剩余：" + realNumber + "件"+"\t 服务器端口："+serverPort);
                return "你已经成功秒杀商品，此时还剩余：" + realNumber + "件"+"\t 服务器端口："+serverPort;
            }else{
                System.out.println("商品已经售罄/活动结束/调用超时，欢迎下次光临"+"\t 服务器端口："+serverPort);
            }
            return "商品已经售罄/活动结束/调用超时，欢迎下次光临"+"\t 服务器端口："+serverPort;
        } finally {
            Jedis jedis = RedisUtils.getJedis();

            String script = "if redis.call('get', KEYS[1]) == ARGV[1] " +
                    "then " +
                    "return redis.call('del', KEYS[1]) " +
                    "else " +
                    "   return 0 " +
                    "end";

            try {
                Object result = jedis.eval(script, Collections.singletonList(REDIS_LOCK_KEY), Collections.singletonList(value));
                if ("1".equals(result.toString())) {
                    System.out.println("------del REDIS_LOCK_KEY success");
                }else{
                    System.out.println("------del REDIS_LOCK_KEY error");
                }
            } finally {
                if(null != jedis) {
                    jedis.close();
                }
            }

        }
    }
}
~~~

~~~ java
public class RedisUtils
{
    private static JedisPool jedisPool;

    static {
        JedisPoolConfig jedisPoolConfig=new JedisPoolConfig();
        jedisPoolConfig.setMaxTotal(20);
        jedisPoolConfig.setMaxIdle(10);
        jedisPool=new JedisPool(jedisPoolConfig,"192.168.111.147",6379);
    }

    public static Jedis getJedis() throws Exception {
        if(null!=jedisPool){
            return jedisPool.getResource();
        }
        throw new Exception("Jedispool was not init");
    }
}
~~~

### 总结

使用Redis实现分布式锁可能会存在锁丢失的问题，在集群环境中，我们的分布式锁先加到主节点上，然后在还没有这个数据还没同步到从节点时，主节点宕机，集群哨兵监听到主节点宕机然后进行主从切换，从节点恢复对外服务之后，这个时候上面没有锁，这把锁可以会被其他的服务获取到就会导致同一时刻可能有两个服务都认为自己获取到了锁，可能就会导致一些业务的异常。

## 使用Redisson实现分布式锁

### 设计理念

该方案也是基于（set 加锁、Lua 脚本解锁）进行改良的，所以redis之父antirez 只描述了差异的地方，大致方案如下。
假设我们有N个Redis主节点，例如 N = 5这些节点是完全独立的，我们不使用复制或任何其他隐式协调系统，为了取到锁客户端执行以下操作：

| 序号 | 操作                                                         |
| :--: | ------------------------------------------------------------ |
|  1   | 获取当前时间，以毫秒为单位；                                 |
|  2   | 依次尝试从5个实例，使用相同的 key 和随机值（例如 UUID）获取锁。当向Redis 请求获取锁时，客户端应该设置一个超时时间，这个超时时间应该小于锁的失效时间。例如你的锁自动失效时间为 10 秒，则超时时间应该在 5-50 毫秒之间。这样可以防止客户端在试图与一个宕机的 Redis 节点对话时长时间处于阻塞状态。如果一个实例不可用，客户端应该尽快尝试去另外一个 Redis 实例请求获取锁； |
|  3   | 客户端通过当前时间减去步骤 1 记录的时间来计算获取锁使用的时间。当且仅当从大多数（N/2+1，这里是 3 个节点）的 Redis 节点都取到锁，并且获取锁使用的时间小于锁失效时间时，锁才算获取成功； |
|  4   | 如果取到了锁，其真正有效时间等于初始有效时间减去获取锁所使用的时间（步骤 3 计算的结果）。 |
|  5   | 如果由于某些原因未能获得锁（无法在至少 N/2 + 1 个 Redis 实例获取锁、或获取锁的时间超过了有效时间），客户端应该在所有的 Redis 实例上进行解锁（即便某些Redis实例根本就没有加锁成功，防止某些节点获取到锁但是客户端没有得到响应而导致接下来的一段时间不能被重新获取锁）。 |

>该方案为了解决数据不一致的问题，直接舍弃了异步复制只使用 master 节点，同时由于舍弃了 slave，为了保证可用性，引入了 N 个节点，官方建议是 5台机器。
>客户端只有在满足下面的这两个条件时，才能认为是加锁成功。
>条件1：客户端从超过半数（大于等于N/2+1）的Redis实例上成功获取到了锁；
>条件2：客户端获取锁的总耗时没有超过锁的有效时间。
>
>PS:
>
>N = 2X + 1   (N是最终部署机器数，X是容错机器数)
>
>1 容错
>  失败了多少个机器实例后我还是可以容忍的，所谓的容忍就是数据一致性还是可以Ok的，CP数据一致性还是可以满足
>  加入在集群环境中，redis失败1台，可接受。2X+1 = 2 * 1+1 =3，部署3台，死了1个剩下2个可以正常工作，那就部署3台。
>  加入在集群环境中，redis失败2台，可接受。2X+1 = 2 * 2+1 =5，部署5台，死了2个剩下3个可以正常工作，那就部署5台。
>
>2 为什么是奇数？
>  最少的机器，最多的产出效果
>  加入在集群环境中，redis失败1台，可接受。2N+2= 2 * 1+2 =4，部署4台
>  加入在集群环境中，redis失败2台，可接受。2N+2 = 2 * 2+2 =6，部署6台

### 代码实现

这里使用了3台服务器，并非官方推荐的5台服务器

~~~ java
@RestController
@Slf4j
public class RedLockController {

    public static final String CACHE_KEY_REDLOCK = "ZZYY_REDLOCK";

    @Autowired
    RedissonClient redissonClient1;

    @Autowired
    RedissonClient redissonClient2;

    @Autowired
    RedissonClient redissonClient3;

    @GetMapping(value = "/redlock")
    public void getlock() {
        //CACHE_KEY_REDLOCK为redis 分布式锁的key
        RLock lock1 = redissonClient1.getLock(CACHE_KEY_REDLOCK);
        RLock lock2 = redissonClient2.getLock(CACHE_KEY_REDLOCK);
        RLock lock3 = redissonClient3.getLock(CACHE_KEY_REDLOCK);

        RedissonRedLock redLock = new RedissonRedLock(lock1, lock2, lock3);
        boolean isLock;

        try {

            //waitTime 锁的等待时间处理,正常情况下 等5s
            //leaseTime就是redis key的过期时间,正常情况下等5分钟。
            isLock = redLock.tryLock(5, 300, TimeUnit.SECONDS);
            log.info("线程{}，是否拿到锁：{} ",Thread.currentThread().getName(),isLock);
            if (isLock) {
                //TODO if get lock success, do something;
                //暂停20秒钟线程
                try { TimeUnit.SECONDS.sleep(20); } catch (InterruptedException e) { e.printStackTrace(); }
            }
        } catch (Exception e) {
            log.error("redlock exception ",e);
        } finally {
            // 无论如何, 最后都要解锁
            redLock.unlock();
            System.out.println(Thread.currentThread().getName()+"\t"+"redLock.unlock()");
        }
    }
}
~~~

### Redisson源码分析

#### 缓存续命

**Redis 分布式锁过期了，但是业务逻辑还没处理完怎么办？**

使用守护线程来“续命”，简单来说就是额外起一个线程，定期检查线程是否还持有锁，如果有则延长过期时间。在Redisson 里面就实现了这个方案，使用“看门狗”定期检查（每1/3的锁时间检查1次），如果线程还持有锁，则刷新过期时间 `[在获取锁成功后，给锁加一个 watchdog，watchdog 会起一个定时任务，在锁没有被释放且快要过期的时候会续期]`

##### wactdog[看门狗] 源码分析

**1. 通过redisson新建出来的锁key，默认是30秒**

![image-20221129224009481](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292240554.png)

**2. 加锁的逻辑会进入到 org.redisson.RedissonLock#tryhAcquireAsync 中，在获取锁成功后，会进入scheduleExpirationRenewal**

![image-20221129224433255](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292244320.png)

**3. scheduleExpirationRenewal这里面初始化了一个定时器，dely 的时间是 internalLockLeaseTime/3。在 Redisson 中，internalLockLeaseTime 是 30s，也就是每隔 10s 续期一次，每次 30s。也就是客户端A加锁成功，就会启动一个watch dog看门狗，他是一个后台线程，会每隔10秒检查一下，如果客户端A还持有锁key，那么就会不断的延长锁key的生存时间，默认每次续命又从30秒新开始**

![image-20221129230159017](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292301074.png)

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292302555.png" alt="image-20221129230238488" style="zoom:50%;" />

**4. KEYS[1]代表的是你加锁的那个key；ARGV[2]代表的是加锁的客户端的ID；ARGV[1]就是锁key的默认生存时间**

![image-20221129231006244](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292310306.png)

#### 解锁

![image-20221129231612864](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292316924.png)