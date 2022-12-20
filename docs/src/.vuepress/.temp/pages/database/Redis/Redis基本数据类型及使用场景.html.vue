<template><div><h2 id="string" tabindex="-1"><a class="header-anchor" href="#string" aria-hidden="true">#</a> String</h2>
<h3 id="内部实现" tabindex="-1"><a class="header-anchor" href="#内部实现" aria-hidden="true">#</a> 内部实现</h3>
<p>String 类型的底层的数据结构实现主要是 <strong>int 和 SDS（简单动态字符串）</strong>。</p>
<p>字符串对象的内部编码（encoding）有 3 种 ：<strong>int、raw和 embstr</strong>。</p>
<h4 id="int" tabindex="-1"><a class="header-anchor" href="#int" aria-hidden="true">#</a> int</h4>
<p>当字符串键值的内容可以用一个64位有符号整型来表示且字符串长度小于等于20，Redis会将键值转化为long型来进行存储，此时即对应 OBJ_ENCODING_INT 编码类型，若不能使用整型来使用则将编码转换为 embstr 和 raw</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212081959310.png" alt="image-20221208195906257" loading="lazy"></p>
<h4 id="embstr" tabindex="-1"><a class="header-anchor" href="#embstr" aria-hidden="true">#</a> embstr</h4>
<p>对于长度小于 44的字符串，Redis 对键值采用OBJ_ENCODING_EMBSTR 方式，EMBSTR 顾名思义即：embedded string，表示嵌入式的String。从内存结构上来讲 即字符串 sds结构体与其对应的 redisObject 对象分配在同一块连续的内存空间，字符串sds嵌入在redisObject对象之中一样。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212081959481.png" alt="" loading="lazy"></p>
<h4 id="raw" tabindex="-1"><a class="header-anchor" href="#raw" aria-hidden="true">#</a> raw</h4>
<p>当字符串的键值为长度大于44的超长字符串时，Redis 则会将键值的内部编码方式改为OBJ_ENCODING_RAW格式，这与OBJ_ENCODING_EMBSTR编码方式的不同之处在于，此时动态字符串sds的内存与其依赖的redisObject的内存不再连续了。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082003754.png" alt="image-20221208200311698" loading="lazy"></p>
<blockquote>
<p>注意点: 字符串的编码转化为 raw 不一定时字符串长度大于44的超长字符，若对 embstr 对象进行修改时，会先转化为 raw 再进行修改，并且修改后的对象的编码值不再是 embstr 而是修改后的 raw。</p>
</blockquote>
<h3 id="常用命令" tabindex="-1"><a class="header-anchor" href="#常用命令" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>最常用
<ul>
<li>set key value</li>
<li>get key</li>
</ul>
</li>
<li>同时设置/获取多个键值
<ul>
<li>MSET key value [key value...]</li>
<li>MGET key [key...]</li>
</ul>
</li>
<li>数值增减
<ul>
<li>递增数字：INCR key</li>
<li>增加指定的整数：INCRBY key increment</li>
<li>递减数字：DECR key</li>
<li>减少指定的整数：DECRBY key decrement</li>
</ul>
</li>
<li>获取字符串长度
<ul>
<li>STRLEN key</li>
</ul>
</li>
<li>分布式锁
<ul>
<li>setnx key value</li>
<li>set key value [EX seconds] [PX milliseconds] [NX|XX]
<ul>
<li>EX：key在多少秒之后过去</li>
<li>PX：key在多少毫秒之后过期</li>
<li>NX：当key不存在的时候，才创建key，效果等同于setnx</li>
<li>XX：当key存在的时候，覆盖key</li>
</ul>
</li>
</ul>
</li>
</ul>
<h3 id="应用场景" tabindex="-1"><a class="header-anchor" href="#应用场景" aria-hidden="true">#</a> 应用场景</h3>
<p>🌰：给文章点赞、点赞视频、商品，统计阅读数量</p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token builtin class-name">set</span> items:1 <span class="token number">0</span>
INCR items:1
INCR items:1
INCR items:1
<span class="token comment">#获取点赞数或者阅读量</span>
get items:1
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="hash" tabindex="-1"><a class="header-anchor" href="#hash" aria-hidden="true">#</a> Hash</h2>
<h3 id="内部实现-1" tabindex="-1"><a class="header-anchor" href="#内部实现-1" aria-hidden="true">#</a> 内部实现</h3>
<p>Redis中的Hash结构相当于 Map&lt;String,Ma&lt;Object,Object&gt;&gt;</p>
<p>Hash 类型的底层数据结构是由<strong>压缩列表或哈希表</strong>实现的：</p>
<ul>
<li>如果哈希类型元素个数小于 <code v-pre>512</code> 个（默认值，可由 <code v-pre>hash-max-ziplist-entries</code> 配置），所有值小于 <code v-pre>64</code> 字节（默认值，可由 <code v-pre>hash-max-ziplist-value</code> 配置）的话，Redis 会使用<strong>压缩列表</strong>作为 Hash 类型的底层数据结构；</li>
<li>如果哈希类型元素不满足上面条件，Redis 会使用<strong>哈希表</strong>作为 Hash 类型的 底层数据结构</li>
</ul>
<blockquote>
<p>注意点：</p>
<ol>
<li>一旦从压缩列表转为了哈希表，Hash类型就会一直用哈希表进行保存而不会再转回压缩列表了，且在节省内存空间方面哈希表就没有压缩列表高效了。</li>
<li><strong>在 Redis 7.0 中，压缩列表数据结构已经废弃了，交由 listpack 数据结构来实现了</strong>。</li>
</ol>
</blockquote>
<h3 id="常用命令-1" tabindex="-1"><a class="header-anchor" href="#常用命令-1" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>一个设置一个字段值：HSET key field value</li>
<li>一次获取一个字段值：HGET key field</li>
<li>一次设置多个字段值：HMSET key field value [field value ...]</li>
<li>一次获取多个字段值：HMGET key field [field]</li>
<li>获取所有字段值：hgetall key</li>
<li>获取某个key内的全部数量：hlen</li>
<li>删除一个key：hdel</li>
</ul>
<h3 id="应用场景-1" tabindex="-1"><a class="header-anchor" href="#应用场景-1" aria-hidden="true">#</a> 应用场景</h3>
<p>🌰：购物车的实现</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211172237457.png" alt="image-20221117223737379" style="zoom:50%;" />
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#新增商品</span>
hset shopcar:uid1024 <span class="token number">334488</span> <span class="token number">1</span>
hset shopcar:uid1024 <span class="token number">334538</span> <span class="token number">1</span>
<span class="token comment">#增加商品数量</span>
hincrby shopcar:uid1024 <span class="token number">334488</span> <span class="token number">1</span>
<span class="token comment">#商品总数</span>
hlen shopcar:uid1024 
<span class="token comment">#全部选中</span>
hgetall shopcar:uid1024 
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="list" tabindex="-1"><a class="header-anchor" href="#list" aria-hidden="true">#</a> List</h2>
<h3 id="内部实现-2" tabindex="-1"><a class="header-anchor" href="#内部实现-2" aria-hidden="true">#</a> 内部实现</h3>
<p>一个双端链表的结构，容量是2的32次方减1个元素，大概40多亿，主要功能有push/pop等，一般用在栈、队列、消息队列等场景。</p>
<p>List 类型的底层数据结构是由<strong>quicklist</strong>实现的：</p>
<ul>
<li>如果列表的元素个数小于 <code v-pre>512</code> 个（默认值，可由 <code v-pre>list-max-ziplist-entries</code> 配置），列表每个元素的值都小于 <code v-pre>64</code> 字节（默认值，可由 <code v-pre>list-max-ziplist-value</code> 配置），Redis 会使用<strong>压缩列表</strong>作为 List 类型的底层数据结构；</li>
<li>如果列表的元素不满足上面的条件，Redis 会使用<strong>双向链表</strong>作为 List 类型的底层数据结构；</li>
</ul>
<blockquote>
<p>3.2 以前的版中，List 数据类型底层数据结构是由 ziplist+linkedList 实现的，在 3.2 之后 底层数据结构更改为 <strong>quicklist</strong> 实现了，替代了原有的双向链表和压缩列表</p>
</blockquote>
<h3 id="常用命令-2" tabindex="-1"><a class="header-anchor" href="#常用命令-2" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>向列表左边添加元素：LPUSH key value[value...]</li>
<li>向列表右边添加元素：RPUSH key value[value...]</li>
<li>查看列表：LRANGE key start stop</li>
<li>获取列表中元素的个数：LLEN key</li>
</ul>
<h3 id="应用场景-2" tabindex="-1"><a class="header-anchor" href="#应用场景-2" aria-hidden="true">#</a> 应用场景</h3>
<p><strong>🌰一：微信公众号订阅消息</strong></p>
<ol>
<li>
<p>两个公众号分别发布了文章11 和 22</p>
</li>
<li>
<p>自己关注了他们两个，只有发布了新文章，就会添加到我的List</p>
<p>LPUSH likearticle:1024 11 22</p>
</li>
<li>
<p>查看自己订阅的全部文章(查看0~10条数据，类似于分页)</p>
<p>LRANGE likearticle:1024 0 10</p>
</li>
</ol>
<p><strong>🌰二：商品评论列表</strong></p>
<ul>
<li>需求一：用户针对某一商品进行评论，一个商品会被不同的用户进行评论，保存商品评论时，要按时间顺序排序</li>
<li>需求二：用户在前端页面查询该商品的评论，需要按照时间顺序降序排序</li>
</ul>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#使用List存储商品评论信息，key是该商品的id，value是商品评论信息，商品编号为1001的商品评论key[items:comment:1001]</span>
lpush items:comment:1001 <span class="token punctuation">{</span><span class="token string">"id"</span>:1001,<span class="token string">"name"</span><span class="token builtin class-name">:</span><span class="token string">"huawei"</span>,<span class="token string">"date"</span><span class="token builtin class-name">:</span><span class="token string">"1600481283054"</span>,<span class="token string">"content"</span><span class="token builtin class-name">:</span><span class="token string">"lasjfdljsa;dasdasdasda,asdasdas,asdasdas"</span><span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="set" tabindex="-1"><a class="header-anchor" href="#set" aria-hidden="true">#</a> Set</h2>
<h3 id="内部实现-3" tabindex="-1"><a class="header-anchor" href="#内部实现-3" aria-hidden="true">#</a> 内部实现</h3>
<p>Set 类型的底层数据结构是由<strong>哈希表或整数集合</strong>实现的：</p>
<ul>
<li>如果集合中的元素都是整数且元素个数小于 <code v-pre>512</code> （默认值，<code v-pre>set-maxintset-entries</code>配置）个，Redis 会使用<strong>整数集合</strong>作为 Set 类型的底层数据结构；</li>
<li>如果集合中的元素不满足上面条件，则 Redis 使用<strong>哈希表</strong>作为 Set 类型的底层数据结构。</li>
</ul>
<h3 id="常用命令-3" tabindex="-1"><a class="header-anchor" href="#常用命令-3" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>添加元素：SADD key member[member]</li>
<li>删除元素：SREM key member[member]</li>
<li>遍历集合中的所有元素：SMEMBERS key</li>
<li>判断元素是否在集合中：SISMEMBER key member</li>
<li>获取集合中的元素总数：SCARD key</li>
<li>从集合中随机弹出一个元素，元素不删除：SRANDMEMBER key[数字]</li>
<li>从集合中随机弹出一个元素，出一个删一个：SPOP key[数字]</li>
<li>集合运算
<ul>
<li>A[abc123]、B[123ax]</li>
<li>集合的差集运算 A-B
<ul>
<li>属于A但不属于B的元素构建的集合</li>
<li>SDIFF key[key]</li>
</ul>
</li>
<li>集合的交集运算 A∩B
<ul>
<li>属于A同时也属于B的共同拥有元素构成的集合</li>
<li>SINTER key[key]</li>
</ul>
</li>
<li>集合的并集运算 A∪B
<ul>
<li>属于A或者属于B的元素并后的集合</li>
<li>SUNION key [key....]</li>
</ul>
</li>
</ul>
</li>
</ul>
<h3 id="应用场景-3" tabindex="-1"><a class="header-anchor" href="#应用场景-3" aria-hidden="true">#</a> 应用场景</h3>
<p><strong>🌰一：抽奖</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#用户点击立即参与抽奖按钮</span>
sadd key 用户id
<span class="token comment">#显示有多少人参与抽奖</span>
SCARD key
<span class="token comment">#抽奖（从set中任意选取N个中将人）</span>
SRANDMEMBER key <span class="token number">2</span>（随机抽奖2个人，元素不会删除<span class="token punctuation">[</span>有重复抽到的风险<span class="token punctuation">]</span>）
SPOP key <span class="token number">3</span>（随机抽奖3个人，元素会删除<span class="token punctuation">[</span>不存在重复抽到<span class="token punctuation">]</span>）
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>🌰二：点赞</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#新增点赞</span>
sadd pub:msgID 点赞用户ID1 点赞用户ID2
<span class="token comment">#取消点赞</span>
srem pub:msgID 点赞用户ID
<span class="token comment">#点赞用户数统计，就是常见的点赞红色数字</span>
scard pub:msgID
<span class="token comment">#判断某个朋友是否对楼主点赞过</span>
SISMEMBER pub:msgID 用户ID
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>🌰三：好友关注的社交关系</strong></p>
<ul>
<li>共同关注的人</li>
</ul>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>sadd s1 <span class="token number">1</span> <span class="token number">2</span> <span class="token number">3</span> <span class="token number">4</span> <span class="token number">5</span>
sadd s2 <span class="token number">3</span> <span class="token number">4</span> <span class="token number">5</span> <span class="token number">6</span> <span class="token number">7</span>

<span class="token comment"># 集合的交集运算 A∩B 来进行对比</span>
SINTER s1 s2
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><ul>
<li>我关注的人也关注了他</li>
</ul>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>sadd s1 <span class="token number">1</span> <span class="token number">2</span> <span class="token number">3</span> <span class="token number">4</span> <span class="token number">5</span> 
sadd s2 <span class="token number">3</span> <span class="token number">4</span> <span class="token number">5</span> <span class="token number">6</span> <span class="token number">7</span>

SISMEMBER s1 <span class="token number">3</span>
SISMEMBER s2 <span class="token number">3</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>🌰四：可能认识的人</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>sadd s1 <span class="token number">1</span> <span class="token number">2</span> <span class="token number">3</span> <span class="token number">4</span> <span class="token number">5</span> 
sadd s2 <span class="token number">3</span> <span class="token number">4</span> <span class="token number">5</span> <span class="token number">6</span> <span class="token number">7</span>

SINTER s1 s2
SDIFF s1 s2
SDIFF s2 s1
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="zset" tabindex="-1"><a class="header-anchor" href="#zset" aria-hidden="true">#</a> Zset</h2>
<h3 id="内部实现-4" tabindex="-1"><a class="header-anchor" href="#内部实现-4" aria-hidden="true">#</a> 内部实现</h3>
<p>Zset 类型的底层数据结构是由<strong>压缩列表或跳表</strong>实现的：</p>
<ul>
<li>如果有序集合的元素个数小于 <code v-pre>128</code> 个，并且每个元素的值小于 <code v-pre>64</code> 字节时，Redis 会使用<strong>压缩列表</strong>作为 Zset 类型的底层数据结构；</li>
<li>如果有序集合的元素不满足上面的条件，Redis 会使用<strong>跳表</strong>作为 Zset 类型的底层数据结构；</li>
</ul>
<h3 id="常用命令-4" tabindex="-1"><a class="header-anchor" href="#常用命令-4" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>向有序集合中加入一个元素和该元素的分数：ZADD key score member [score member....]</li>
<li>按照元素分数从小到大的顺序返回索引从satrt到stop之间的所有元素：ZRANGE key start stop[WITHSCORES]</li>
<li>获取元素的分数：ZSCORE key member</li>
<li>删除元素：ZREM key member [member...]</li>
<li>获取指定分数范围的元素：ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]</li>
<li>增加某个元素的分数：ZINCRBY key increment member</li>
<li>获取集合中元素的数量：ZCARD key</li>
<li>获取指定分数范围内的元素个数：ZCOUNT key min max</li>
<li>按照排名范围删除元素：ZREMRANGEBYRANK key start stop</li>
<li>获取元素的排名
<ul>
<li>从小到大：ZRANK key member</li>
<li>从大到小 ZREVRANK key member</li>
</ul>
</li>
</ul>
<h3 id="应用场景-4" tabindex="-1"><a class="header-anchor" href="#应用场景-4" aria-hidden="true">#</a> 应用场景</h3>
<p><strong>🌰：排行榜</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#思路：定义商品销售排行榜（sorted set集合），key为goods:sellsort，分数为商品销售数量</span>

<span class="token comment">#商品编号1001的销量是9，商品编号1002的销量是15</span>
zadd goods:sellsort <span class="token number">9</span> <span class="token number">1001</span> <span class="token number">15</span> <span class="token number">1002</span> 
<span class="token comment">#有一个客户又买了2件商品1001，商品编号1001销量加2</span>
zincrby goods:sellsort <span class="token number">2</span> <span class="token number">1001</span> 
<span class="token comment">#求商品销量前10名</span>
ZRANGE goods:sellsort <span class="token number">0</span> <span class="token number">10</span> withscores
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="bitmaps" tabindex="-1"><a class="header-anchor" href="#bitmaps" aria-hidden="true">#</a> Bitmaps</h2>
<p>Bitmaps，即位图。用String类型作为底层数据结构实现的一种统计二值状态的数据类型。它的本质是数组，基于String数据类型的按位操作，有多个二进制位组成，每个二进制位都对应一个偏移量（可以称之为索引或者位格）。BitMap支持的最大位数是2<sup>32</sup>位，它可以极大的节约存储空间，使用512M内存就可以存储多达42.9亿的字节信息（2<sup>32</sup>=4294967296）</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211190927065.png" alt="image-20221119092656857" loading="lazy"></p>
<h3 id="常用命令-5" tabindex="-1"><a class="header-anchor" href="#常用命令-5" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>给指定key的值的第offset赋值：setbit key offset value</li>
<li>获取指定key的第offset位：getbit key offset</li>
<li>返回指定key中[start,end]中为1的数量：bitcount key start end</li>
<li>对不同的二进制存储数据进行位运算(AND、OR、NOT、XOR)：bitop operation destkey key</li>
<li>返回指定key中第一次出现指定value(0/1)的位置：BITPOS [key] [value]</li>
</ul>
<h3 id="应用场景-5" tabindex="-1"><a class="header-anchor" href="#应用场景-5" aria-hidden="true">#</a> 应用场景</h3>
<p>🌰：签到统计</p>
<p>在签到统计的场景中，每一个用户的签到用1bit就可以表示，一个月（假设是31天）的签到情况用31<code v-pre>bit</code>就可以，而一年的签到也只需要用365<code v-pre>bit</code>，根本不用太复杂的集合类型。假如是亿级的系统，每天使用1个1亿位的<code v-pre>Bitmaps</code>约占12MB的内存(10<sup>8</sup>/1024/1024)，10天的BitMap的内存开销约为120M，内存压力不算大，但在实际使用时，最好要对Bitmaps设置过期时间，让Redis自动删除不再需要的签到记录以节省内存开销。</p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#统计33用户在2022-11月的签到情况</span>
setbit userID:33:202211 <span class="token number">0</span> <span class="token number">1</span>
setbit userID:33:202211 <span class="token number">2</span> <span class="token number">1</span>
<span class="token comment">#查看该用户在2022-11-2这天的签到情况</span>
getbit userID:33:202211 <span class="token number">1</span>
<span class="token comment">#统计该用户在11月的签到情况</span>
bitcount userID:33:202211
<span class="token comment">#查看首次打卡的时间</span>
BITPOS userID:33:202211 <span class="token number">0</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="hyperloglog" tabindex="-1"><a class="header-anchor" href="#hyperloglog" aria-hidden="true">#</a> HyperLogLog</h2>
<p>Redis HyoperLogLog 是用来做基数统计的算法，HyoperLogLog 的优点是在输入元素数量或者体积非常非常大时，计算基数所需空间总是固定的，并且是很小的，但它也存在缺点，HyoperLogLog是非精确统计，牺牲了准确率来换取空间，误差仅仅只是<code v-pre>0.81%</code>左右。</p>
<p>在Redis里面，每个HyoperLogLog键只需要花费<code v-pre>12KB</code>的内存，就可以计算接近**2<sup>64</sup>**个不同元素的基数，和计算基数收，元素越多越耗费内存的集合形成鲜明的对比，但HyoperLogLog只会根据输入元素来计算基数，而不会存储输入元素本身，所以HyperLogLog不能像集合那样，返回输入的各个元素。</p>
<h3 id="常用命令-6" tabindex="-1"><a class="header-anchor" href="#常用命令-6" aria-hidden="true">#</a> 常用命令</h3>
<ul>
<li>将所有元素添加到key中：pfadd key element</li>
<li>统计key的估算值(不精确)：pfcount key</li>
<li>合并key至新key：pgmerge new_key key1 key2</li>
</ul>
<h3 id="应用场景-6" tabindex="-1"><a class="header-anchor" href="#应用场景-6" aria-hidden="true">#</a> 应用场景</h3>
<ul>
<li>UV：Unique Visitor，独立访客，一般理解为客户端IP [需要做去重考虑]</li>
<li>PV：Page View，页面访问浏览量 [不用去重]</li>
<li>DAU：Daily Active User，日活跃用户量</li>
<li>MAU：Monthly Active User，月活跃用户量</li>
</ul>
<p>🌰：</p>
<p>需求：UV的统计需要去重，一个用户一天内的多次访问只能算作一次</p>
<p>​	 淘宝、天猫首页的UV，平均每天是1~1.5个亿左右</p>
<p>​	 每天存1.5亿的IP，访问来了后去查是否存在，不存在加入</p>
<p>代码实现：Conytroller</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@RestController</span>
<span class="token annotation punctuation">@Slf4j</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">HyperLogLogController</span> <span class="token punctuation">{</span>

    <span class="token annotation punctuation">@Resource</span>
    <span class="token keyword">private</span> <span class="token class-name">RedisTemplate</span> redisTemplate<span class="token punctuation">;</span>


    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"获取ip去重复后的首页访问量，总数统计"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/uv"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token keyword">long</span> <span class="token function">uv</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">//pfcount</span>
        <span class="token keyword">return</span> redisTemplate<span class="token punctuation">.</span><span class="token function">opsForHyperLogLog</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token string">"hll"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="geo" tabindex="-1"><a class="header-anchor" href="#geo" aria-hidden="true">#</a> GEO</h2>
<p>Redis在3.2版本以后增加了地理位置的处理，地理空间索引可以存储坐标并进行搜索，可用于查找给定半径或边界框内的附近点。</p>
<h3 id="常用命令-7" tabindex="-1"><a class="header-anchor" href="#常用命令-7" aria-hidden="true">#</a> 常用命令</h3>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#存储指定的地理空间位置，可以将一个或多个经度(longitude)、纬度(latitude)、位置名称(member)添加到指定的key中</span>
GEOADD key longitude latitude member <span class="token punctuation">[</span>longitude latitude member <span class="token punctuation">..</span>.<span class="token punctuation">]</span>

<span class="token comment">#从给定的key里返回所有指定名称(member)位置（经度和纬度）</span>
GEOPOS key member <span class="token punctuation">[</span>member <span class="token punctuation">..</span>.<span class="token punctuation">]</span>

<span class="token comment">#获取一个或多个位置元素的 geohash </span>
GEOHASH key member <span class="token punctuation">[</span>member<span class="token punctuation">..</span>.<span class="token punctuation">]</span>

<span class="token comment">#返回两个给定位置之间的距离 m米 km千米 ft英尺 mi英里</span>
GEODIST key member1 member2 <span class="token punctuation">[</span>m<span class="token operator">|</span>km<span class="token operator">|</span>ft<span class="token operator">|</span>mi<span class="token punctuation">]</span>

<span class="token comment">#给定的经纬度为中心，返回键包含的位置元素当中，与中心的距离不超过给定最大距离的所有位置元素</span>
<span class="token comment">#WITHDIST：在返回位置元素的同时，将位置元素与中心之间的距离也一并返回。距离的单位和用户给定的范围单位保持一致</span>
<span class="token comment">#WITHCOORD：将位置元素的经度和纬度也一并返回</span>
<span class="token comment">#WITHHASH：以52位有符号整数的形式，返回位置元素经过原始geohash编码的有序集合分值。这个选项主要用于底层应用或调试，实际中的作用不大。</span>
<span class="token comment">#COUNT：限定返回的记录数</span>
GEORADIUS key longitude latitude radius <span class="token operator">&lt;</span>M <span class="token operator">|</span> KM <span class="token operator">|</span> FT <span class="token operator">|</span> MI<span class="token operator">></span> <span class="token punctuation">[</span>WITHCOORD<span class="token punctuation">]</span> <span class="token punctuation">[</span>WITHDIST<span class="token punctuation">]</span> <span class="token punctuation">[</span>WITHHASH<span class="token punctuation">]</span> <span class="token punctuation">[</span>COUNT count <span class="token punctuation">[</span>ANY<span class="token punctuation">]</span><span class="token punctuation">]</span> <span class="token punctuation">[</span>ASC <span class="token operator">|</span> DESC<span class="token punctuation">]</span><span class="token punctuation">[</span>STORE key<span class="token punctuation">]</span> <span class="token punctuation">[</span>STOREDIST key<span class="token punctuation">]</span>

<span class="token comment">#找出位于指定范围内的元素，中心点是给定的位置元素决定</span>
GEORADIUSBYMEMBER key member radius <span class="token operator">&lt;</span>M <span class="token operator">|</span> KM <span class="token operator">|</span> FT <span class="token operator">|</span> MI<span class="token operator">></span> <span class="token punctuation">[</span>WITHCOORD<span class="token punctuation">]</span> <span class="token punctuation">[</span>WITHDIST<span class="token punctuation">]</span> <span class="token punctuation">[</span>WITHHASH<span class="token punctuation">]</span> <span class="token punctuation">[</span>COUNT count <span class="token punctuation">[</span>ANY<span class="token punctuation">]</span><span class="token punctuation">]</span> <span class="token punctuation">[</span>ASC <span class="token operator">|</span> DESC<span class="token punctuation">]</span> <span class="token punctuation">[</span>STORE key<span class="token punctuation">]</span> <span class="token punctuation">[</span>STOREDIST key<span class="token punctuation">]</span>	

</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="应用场景-7" tabindex="-1"><a class="header-anchor" href="#应用场景-7" aria-hidden="true">#</a> 应用场景</h3>
<p>🌰：微信附近的人、查找附近的酒店、附件的共享单车、</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@RestController</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">GeoController</span> <span class="token punctuation">{</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token class-name">String</span> <span class="token constant">CITY</span> <span class="token operator">=</span> <span class="token string">"city"</span><span class="token punctuation">;</span>
    <span class="token annotation punctuation">@Autowired</span>
    <span class="token keyword">private</span> <span class="token class-name">RedisTemplate</span> redisTemplate<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"新增天安门故宫长城纬度"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@PostMapping</span><span class="token punctuation">(</span><span class="token string">"/geoadd"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">String</span> <span class="token function">geoAdd</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">Point</span><span class="token punctuation">></span></span> map <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"天安门"</span><span class="token punctuation">,</span> <span class="token keyword">new</span> <span class="token class-name">Point</span><span class="token punctuation">(</span><span class="token number">116.403963</span><span class="token punctuation">,</span> <span class="token number">39.915119</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"故宫"</span><span class="token punctuation">,</span> <span class="token keyword">new</span> <span class="token class-name">Point</span><span class="token punctuation">(</span><span class="token number">116.403414</span><span class="token punctuation">,</span> <span class="token number">39.924091</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"长城"</span><span class="token punctuation">,</span> <span class="token keyword">new</span> <span class="token class-name">Point</span><span class="token punctuation">(</span><span class="token number">116.024067</span><span class="token punctuation">,</span> <span class="token number">40.362639</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        redisTemplate<span class="token punctuation">.</span><span class="token function">opsForGeo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token constant">CITY</span><span class="token punctuation">,</span> map<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> map<span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"获取地理位置坐标"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/geopos"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">Point</span> <span class="token function">position</span><span class="token punctuation">(</span><span class="token class-name">String</span> member<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Point</span><span class="token punctuation">></span></span> list <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForGeo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">position</span><span class="token punctuation">(</span><span class="token constant">CITY</span><span class="token punctuation">,</span> member<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> list<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"geohash算法生成的base32编码"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/geohash"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">String</span> <span class="token function">hash</span><span class="token punctuation">(</span><span class="token class-name">String</span> member<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span></span> list <span class="token operator">=</span> redisTemplate<span class="token punctuation">.</span><span class="token function">opsForGeo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">hash</span><span class="token punctuation">(</span><span class="token constant">CITY</span><span class="token punctuation">,</span> member<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> list<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"计算两个位置之间的距离"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/geodist"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">Distance</span> <span class="token function">distance</span><span class="token punctuation">(</span><span class="token class-name">String</span> member1<span class="token punctuation">,</span> <span class="token class-name">String</span> member2<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">Distance</span> distance <span class="token operator">=</span> redisTemplate<span class="token punctuation">.</span><span class="token function">opsForGeo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">distance</span><span class="token punctuation">(</span><span class="token constant">CITY</span><span class="token punctuation">,</span> member1<span class="token punctuation">,</span> member2<span class="token punctuation">,</span> <span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>DistanceUnit</span><span class="token punctuation">.</span><span class="token constant">KILOMETERS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> distance<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>


    <span class="token doc-comment comment">/**
     * 通过经度，纬度查找附近的
     * 北京王府井位置116.418017,39.914402,这里为了方便讲课，故意写死
     */</span>
    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"通过经度，纬度查找附近的"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/georadius"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">GeoResults</span> <span class="token function">radiusByxy</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">//这个坐标是北京王府井位置</span>
        <span class="token class-name">Circle</span> circle <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Circle</span><span class="token punctuation">(</span><span class="token number">116.418017</span><span class="token punctuation">,</span> <span class="token number">39.914402</span><span class="token punctuation">,</span> <span class="token class-name">Metrics</span><span class="token punctuation">.</span><span class="token constant">MILES</span><span class="token punctuation">.</span><span class="token function">getMultiplier</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">//返回50条</span>
        <span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>GeoRadiusCommandArgs</span> args <span class="token operator">=</span> <span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>GeoRadiusCommandArgs</span><span class="token punctuation">.</span><span class="token function">newGeoRadiusArgs</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">includeDistance</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">includeCoordinates</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">sortAscending</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">limit</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">GeoResults</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>GeoLocation</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span><span class="token punctuation">></span></span> geoResults<span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForGeo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">radius</span><span class="token punctuation">(</span><span class="token constant">CITY</span><span class="token punctuation">,</span>circle<span class="token punctuation">,</span> args<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> geoResults<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token doc-comment comment">/**
     * 通过地方查找附近
     */</span>
    <span class="token annotation punctuation">@ApiOperation</span><span class="token punctuation">(</span><span class="token string">"通过地方查找附近"</span><span class="token punctuation">)</span>
    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/georadiusByMember"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">GeoResults</span> <span class="token function">radiusByMember</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">String</span> member<span class="token operator">=</span><span class="token string">"天安门"</span><span class="token punctuation">;</span>
        <span class="token comment">//返回50条</span>
        <span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>GeoRadiusCommandArgs</span> args <span class="token operator">=</span> <span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>GeoRadiusCommandArgs</span><span class="token punctuation">.</span><span class="token function">newGeoRadiusArgs</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">includeDistance</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">includeCoordinates</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">sortAscending</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">limit</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">//半径10公里内</span>
        <span class="token class-name">Distance</span> distance<span class="token operator">=</span><span class="token keyword">new</span> <span class="token class-name">Distance</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">,</span> <span class="token class-name">Metrics</span><span class="token punctuation">.</span><span class="token constant">KILOMETERS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">GeoResults</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">RedisGeoCommands<span class="token punctuation">.</span>GeoLocation</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span><span class="token punctuation">></span></span> geoResults<span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForGeo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">radius</span><span class="token punctuation">(</span><span class="token constant">CITY</span><span class="token punctuation">,</span>member<span class="token punctuation">,</span> distance<span class="token punctuation">,</span>args<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> geoResults<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></div></template>


