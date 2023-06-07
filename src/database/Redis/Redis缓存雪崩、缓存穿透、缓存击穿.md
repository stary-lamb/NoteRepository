---
title: 缓存雪崩、缓存穿透、缓存击穿
date: 2022-11-24
---

## 缓存雪崩

### 产生原因

- Redis主机挂了，Redis全盘崩溃
- 缓存中大量数据同时过期

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211280707661.png" alt="image-20221128070708520" style="zoom:67%;" />

### 解决方案

- redis缓存集群实现高可用
  - 主从+哨兵
  - Redis Cluster
- 本地缓存 + Hystrix或者阿里sentinel限流&降级别
- 开启Redis持久化机制 AOF/RDB，尽快恢复缓存集群 

## 缓存穿透

### 产生原因

用户请求访问数据，在Redis和数据库中都查询不到该记录，但是每次请求都会打到数据库上，导致后台的数据库压力暴增，这种现象就是缓存穿透。简单来说，**数据即不再缓存中，也不再数据库中**。

- 业务误操作，缓存中的数据和数据库的数据都被误删除了，所以导致缓存和数据库中都没有数据
- 黑客恶意攻击，故意大量访问某些读取不存在数据的业务

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211280715771.png" alt="image-20221128071512722" style="zoom:67%;" />

### 解决方案

#### 方案一：对象缓存或者缺省值

一旦发生缓存穿透，我们可以针对查询的数据，在Redis中缓存一个空值或者是和业务层协商确定的缺省值（例如，库存的缺省值可以设为0）。应用再发生请求查询时，就可以直接从Redis中读取空值或者缺省值，返回给业务应用，避免了把大量的请求发送给数据库出处理，保持数据库的正常运行。

**弊端：**如果每次都是发送不同的请求查询数据，由于存在空对象缓存和缓存的回写，Redis中的无关紧要的key也会也写也多。

#### 方案二：Google布隆过滤器Guava解决缓存穿透

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211280754144.png" alt="image-20221128075406070" style="zoom: 67%;" />

代码实现：

**取样本100W数据，查查不在100W范围内的其它10W数据是否存在**

~~~ java
 public class BloomFilterDemo {

    public static final int _1W = 10000;
    //布隆过滤器里面预计要插入多少数据
    public static int size = 100 * _1W;
    //误判率,它越小误判的个数也就越小 --->Guava误判率默认为0.03 如果误判率越小，程序的执行效率会越低
    public static double fpp = 0.00001;

    //构建布隆过滤器
    private static BloomFilter<Integer> bloomFilter = BloomFilter.create(Funnels.integerFunnel(),size,fpp);

    public static void main(String[] args) {
        //1. 先往布隆过滤器里面插入100万的样本数据
        for (int i = 0; i < size; i++) {
            bloomFilter.put(i);
        }

        //故意取10万个不同的过滤器，看看有多少会被认为在过滤器里
        List<Integer> list = new ArrayList<>(10 * _1W);
        for (int i = size+1; i < size + 100000; i++) {
            if (bloomFilter.mightContain(i)) {
                System.out.println(i+"\t"+"被误判了");
                list.add(i);
            }
        }
        System.out.println("误判的数量："+list.size());
    }
}
~~~

> 小结：从100W的数据样本中匹配的10w不在布隆过滤器的数据，总共误判了3033次，误判率仅为0.03

#### 方案三：Redis 布隆过滤器解决缓存穿透方案

**白名单架构说明：**

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211290711971.png" alt="image-20221129071058748" style="zoom:67%;" />

**代码实现：**

~~~ java
public class RedissonBloomFilterDemo2 {
    public static final int _1W = 10000;

    //布隆过滤器里面预计要插入多少数据
    public static int size = 100 * _1W;
    //误判率，它越小误判个数也就越少
    public static double fpp = 0.03;

    static RedissonClient redissonClient = null;
    static RBloomFilter rBloomFilter = null;

    static {
        Config config = new Config();
        config.useSingleServer().setAddress("redis://1.12.241.34:6379").setPassword("!CJY123456").setDatabase(0);
        //构建 Redisson
        redissonClient = Redisson.create(config);
        //通过Redisson构建RBloomFilter
        rBloomFilter = redissonClient.getBloomFilter("phoneListBloomFilter",new StringCodec());

        rBloomFilter.tryInit(size,fpp);

        //1. 测试布隆过滤器有+redis有
        rBloomFilter.add("10086");
        redissonClient.getBucket("10086",new StringCodec()).set("chinamobile10086");

        //2. 测试 布隆过滤器有+redis无
        rBloomFilter.add("10087");

        //3. 测试 布隆过滤器无，redis无
    }


    public static void main(String[] args) {
        //String phoneListById = getPhoneListById("10086");
        //String phoneListById = getPhoneListById("10087");
        String phoneListById = getPhoneListById("10088");
        System.out.println("------查询出来的结果： "+phoneListById);

        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
        redissonClient.shutdown();
    }

    private static String getPhoneListById(String IDNumber){
        String result = null;
        if (IDNumber ==null) {
            return null;
        }

        //1. 先去布隆过滤器里面查询
        if (rBloomFilter.contains(IDNumber)) {
            RBucket<String> rBucket = redissonClient.getBucket(IDNumber, new StringCodec());
            result = rBucket.get();
            if (result != null) {
                return "i come from redis: "+result;
            }else {
                result = getPhoneListByMySQL(IDNumber);
                if (result == null) {
                    return null;
                }
                //重新将数据更新回Redis
                redissonClient.getBucket(IDNumber,new StringCodec()).set(result);
            }
            return "i come from mysql: "+result;
        }
        return result;
    }

    private static String getPhoneListByMySQL(String idNumber) {
        return "chinamobile"+idNumber;
    }
}
~~~

#### Guava 布隆过滤器 VS Redis 布隆过滤器

**Guava 布隆过滤器**

- 优点：基于JVM内存的一种布隆过滤器（基于本地缓存）
- 缺点：重启即失效，不支持分布式环境，只适用于单机环境

**Redis 布隆过滤器**

- 优点：可扩展性Bloom过滤器，若一旦Bloom过滤器达到容量，就会在其上创建一个新的过滤器；不存在重启即失效或者定时任务维护的成本
- 缺点：需要网络IO

## 缓存击穿

### 产生原因

大量请求同时查询一个key时，此时这个key正好失效了，导致大量的请求都打到数据库上面去，导致数据库的压力剧增

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292003802.png" alt="image-20221129200340454" style="zoom:67%;" />

### 解决方案

- 互斥锁方案，保证同一时间只有一个业务线程更新缓存，未能获取互斥锁的请求，要么等待锁释放后重新读取缓存，要么就返回空值或者默认值

  ~~~ java
  public User findUserById2(Integer id) {
          User user = null;
          String key = CACHE_KEY_USER + id;
          //1.先从redis中查询是否有数据，如果有直接返回结果，没有查询mysql
          user = (User) redisTemplate.opsForValue().get(key);
  
          if (user == null) {
              //2.大厂用，对于高QPS优化，进来先加锁，保证一个请求操作，让外面redis等待一下，避免击穿redis
              synchronized (UserService.class) {
                  user = (User) redisTemplate.opsForValue().get(key);
                  //3. 2查redis还是null，可以去查mysql（mysql有数据）
                  if (user == null) {
                      //4.查询mysql，拿数据
                      user = userMapper.selectByPrimaryKey(id);
                      if (user == null) {
                          return null;
                      } else {
                          //将mysql的数据回写redis，保证数据的一致性
                          redisTemplate.opsForValue().setIfAbsent(key, user,7L, TimeUnit.DAYS);
                      }
                  }
              }
          }
          return user;
      }
  ~~~

- 不给热点数据设置过期时间，由后台异步更新缓存，或者在热点数据准备要过期前，提前通知后台线程更新缓存以及重新设置过期时间

- 设置两块缓存，如果A缓存没有，则去查询B缓存，两者过期时间不一致B比A过期时间长

  ~~~ java
  @PostConstruct
      public void initJHSAB(){
          new Thread(() -> {
              //模拟定时器，定时把数据库的特价商品，刷新到redis中
              while (true){
                  //模拟从数据库读取100件特价商品，用于加载到聚划算的页面中
                  List<Product> list=this.products();
                  //先更新B缓存
                  this.redisTemplate.delete(Constants.JHS_KEY_B);
                  this.redisTemplate.opsForList().leftPushAll(Constants.JHS_KEY_B,list);
                  this.redisTemplate.expire(Constants.JHS_KEY_B,20L,TimeUnit.DAYS);
                  //再更新A缓存
                  this.redisTemplate.delete(Constants.JHS_KEY_A);
                  this.redisTemplate.opsForList().leftPushAll(Constants.JHS_KEY_A,list);
                  this.redisTemplate.expire(Constants.JHS_KEY_A,15L,TimeUnit.DAYS);
                  //间隔一分钟 执行一遍
                  try { TimeUnit.MINUTES.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
  
                  log.info("runJhs定时刷新..............");
              }
          },"t1").start();
      }
  
  public List<Product> findAB(int page, int size) {
          List<Product> list=null;
          long start = (page - 1) * size;
          long end = start + size - 1;
          try {
              //采用redis list数据结构的lrange命令实现分页查询
              list = this.redisTemplate.opsForList().range(Constants.JHS_KEY_A, start, end);
              if (CollectionUtils.isEmpty(list)) {
                  log.info("=========A缓存已经失效了，记得人工修补，B缓存自动延续5天");
                  //用户先查询缓存A(上面的代码)，如果缓存A查询不到（例如，更新缓存的时候删除了），再查询缓存B
                  this.redisTemplate.opsForList().range(Constants.JHS_KEY_B, start, end);
              }
              log.info("查询结果：{}", list);
          } catch (Exception ex) {
              //这里的异常，一般是redis瘫痪 ，或 redis网络timeout
              log.error("exception:", ex);
              //TODO 走DB查询
          }
          return list;
      }
  
  
  ~~~

> 小结：解决缓存击穿的方法 —— 互斥更新、随机避退、差异失效时间
