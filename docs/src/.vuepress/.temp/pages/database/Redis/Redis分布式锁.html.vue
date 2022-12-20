<template><div><h2 id="可靠的分布式锁的具备的条件" tabindex="-1"><a class="header-anchor" href="#可靠的分布式锁的具备的条件" aria-hidden="true">#</a> 可靠的分布式锁的具备的条件</h2>
<p><strong>1.独占性：任何时刻只能有且仅有一个线程持有</strong></p>
<p><strong>2.高可用：若Redis集群环境下，不能因为某一个节点挂了而出现获取锁喝释放锁是吧的情况</strong></p>
<p><strong>3.防死锁：杜绝死锁，必须有超时控制机制或者撤销操作，有个兜底终止跳出方案</strong></p>
<p><strong>4.不乱抢：防止张冠李戴，不能私下unlock别人的锁，只能自己加锁释放</strong></p>
<p><strong>5.重入性：同一个节点的同一个线程如果获取锁之后，它也可以再次获取这个锁</strong></p>
<h2 id="分布式锁的实现方式" tabindex="-1"><a class="header-anchor" href="#分布式锁的实现方式" aria-hidden="true">#</a> 分布式锁的实现方式</h2>
<ul>
<li>MySQL，基于唯一索引 [不推荐]</li>
<li>zookeeper，基于临时有序节点</li>
<li>Redis，基于setnx命令</li>
</ul>
<blockquote>
<p>PS：</p>
<ul>
<li>Redis 在单机的条件是CP，在集群模式下是AP</li>
<li>zookeeper保证的是CP</li>
</ul>
<p>C（一致性）、A（可用性）、P（分区容错性）</p>
</blockquote>
<h2 id="setnx-分布式锁" tabindex="-1"><a class="header-anchor" href="#setnx-分布式锁" aria-hidden="true">#</a> setnx 分布式锁</h2>
<h3 id="命令" tabindex="-1"><a class="header-anchor" href="#命令" aria-hidden="true">#</a> 命令</h3>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>setnx key value 
expire key <span class="token punctuation">[</span>EX seconds<span class="token punctuation">]</span> <span class="token punctuation">[</span>PX milliseconds<span class="token punctuation">]</span> <span class="token punctuation">[</span>NX<span class="token operator">|</span>XX<span class="token punctuation">]</span>
等同于 <span class="token builtin class-name">set</span> key value <span class="token punctuation">[</span>EX seconds<span class="token punctuation">]</span> <span class="token punctuation">[</span>PX milliseconds<span class="token punctuation">]</span> <span class="token punctuation">[</span>NX<span class="token operator">|</span>XX<span class="token punctuation">]</span>
EX：key在多少秒之后过期
PX：key在多少毫秒之后过期
NX：当key不存在的时候，才创建key，效果等同于setnx
XX：当key存在的时候，覆盖可以
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><blockquote>
<p>弊端：setnx+expire不安全，两条命令非原子性的</p>
</blockquote>
<h3 id="实现思路" tabindex="-1"><a class="header-anchor" href="#实现思路" aria-hidden="true">#</a> 实现思路</h3>
<p>加锁：使用key的值可以根据业务的设置，value可以使用 uuid+当前线程 来保证唯一，用于标识加锁的客户端，保证加锁和解锁都是同一个客户端；同时在加锁的过程为了防止服务器发生异常，在代码层面当中走不到finally块无法保证锁释放，需要加入一个过期时间限定key</p>
<p>解锁：如果使用finally块的判断+del删除操作不是原子性的，我们通过Redis调用Lua脚本通过eval命令保证代码执行的原子性</p>
<p>代码实现：</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@RestController</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">GoodController</span>
<span class="token punctuation">{</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token class-name">String</span> <span class="token constant">REDIS_LOCK_KEY</span> <span class="token operator">=</span> <span class="token string">"redisLockPay"</span><span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token keyword">private</span> <span class="token class-name">StringRedisTemplate</span> stringRedisTemplate<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Value</span><span class="token punctuation">(</span><span class="token string">"${server.port}"</span><span class="token punctuation">)</span>
    <span class="token keyword">private</span> <span class="token class-name">String</span> serverPort<span class="token punctuation">;</span>


    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">"/buy_goods"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">String</span> <span class="token function">buy_Goods</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token punctuation">{</span>
        <span class="token class-name">String</span> value <span class="token operator">=</span> <span class="token constant">UUID</span><span class="token punctuation">.</span><span class="token function">randomUUID</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token class-name">Thread</span><span class="token punctuation">.</span><span class="token function">currentThread</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">getName</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token keyword">try</span> <span class="token punctuation">{</span>
            <span class="token class-name">Boolean</span> flag <span class="token operator">=</span> stringRedisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">setIfAbsent</span><span class="token punctuation">(</span><span class="token constant">REDIS_LOCK_KEY</span><span class="token punctuation">,</span> value<span class="token punctuation">,</span><span class="token number">30L</span><span class="token punctuation">,</span><span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

            <span class="token keyword">if</span><span class="token punctuation">(</span><span class="token operator">!</span>flag<span class="token punctuation">)</span>
            <span class="token punctuation">{</span>
                <span class="token keyword">return</span> <span class="token string">"抢夺锁失败，请下次尝试"</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>

            <span class="token class-name">String</span> result <span class="token operator">=</span> stringRedisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token string">"goods:001"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">int</span> goodsNumber <span class="token operator">=</span> result <span class="token operator">==</span> <span class="token keyword">null</span> <span class="token operator">?</span> <span class="token number">0</span> <span class="token operator">:</span> <span class="token class-name">Integer</span><span class="token punctuation">.</span><span class="token function">parseInt</span><span class="token punctuation">(</span>result<span class="token punctuation">)</span><span class="token punctuation">;</span>

            <span class="token keyword">if</span><span class="token punctuation">(</span>goodsNumber <span class="token operator">></span> <span class="token number">0</span><span class="token punctuation">)</span>
            <span class="token punctuation">{</span>
                <span class="token keyword">int</span> realNumber <span class="token operator">=</span> goodsNumber <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">;</span>
                stringRedisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token string">"goods:001"</span><span class="token punctuation">,</span>realNumber <span class="token operator">+</span> <span class="token string">""</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"你已经成功秒杀商品，此时还剩余："</span> <span class="token operator">+</span> realNumber <span class="token operator">+</span> <span class="token string">"件"</span><span class="token operator">+</span><span class="token string">"\t 服务器端口："</span><span class="token operator">+</span>serverPort<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">return</span> <span class="token string">"你已经成功秒杀商品，此时还剩余："</span> <span class="token operator">+</span> realNumber <span class="token operator">+</span> <span class="token string">"件"</span><span class="token operator">+</span><span class="token string">"\t 服务器端口："</span><span class="token operator">+</span>serverPort<span class="token punctuation">;</span>
            <span class="token punctuation">}</span><span class="token keyword">else</span><span class="token punctuation">{</span>
                <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"商品已经售罄/活动结束/调用超时，欢迎下次光临"</span><span class="token operator">+</span><span class="token string">"\t 服务器端口："</span><span class="token operator">+</span>serverPort<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token keyword">return</span> <span class="token string">"商品已经售罄/活动结束/调用超时，欢迎下次光临"</span><span class="token operator">+</span><span class="token string">"\t 服务器端口："</span><span class="token operator">+</span>serverPort<span class="token punctuation">;</span>
        <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
            <span class="token class-name">Jedis</span> jedis <span class="token operator">=</span> <span class="token class-name">RedisUtils</span><span class="token punctuation">.</span><span class="token function">getJedis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

            <span class="token class-name">String</span> script <span class="token operator">=</span> <span class="token string">"if redis.call('get', KEYS[1]) == ARGV[1] "</span> <span class="token operator">+</span>
                    <span class="token string">"then "</span> <span class="token operator">+</span>
                    <span class="token string">"return redis.call('del', KEYS[1]) "</span> <span class="token operator">+</span>
                    <span class="token string">"else "</span> <span class="token operator">+</span>
                    <span class="token string">"   return 0 "</span> <span class="token operator">+</span>
                    <span class="token string">"end"</span><span class="token punctuation">;</span>

            <span class="token keyword">try</span> <span class="token punctuation">{</span>
                <span class="token class-name">Object</span> result <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">eval</span><span class="token punctuation">(</span>script<span class="token punctuation">,</span> <span class="token class-name">Collections</span><span class="token punctuation">.</span><span class="token function">singletonList</span><span class="token punctuation">(</span><span class="token constant">REDIS_LOCK_KEY</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token class-name">Collections</span><span class="token punctuation">.</span><span class="token function">singletonList</span><span class="token punctuation">(</span>value<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token string">"1"</span><span class="token punctuation">.</span><span class="token function">equals</span><span class="token punctuation">(</span>result<span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"------del REDIS_LOCK_KEY success"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span><span class="token keyword">else</span><span class="token punctuation">{</span>
                    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"------del REDIS_LOCK_KEY error"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
            <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
                <span class="token keyword">if</span><span class="token punctuation">(</span><span class="token keyword">null</span> <span class="token operator">!=</span> jedis<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    jedis<span class="token punctuation">.</span><span class="token function">close</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
            <span class="token punctuation">}</span>

        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">RedisUtils</span>
<span class="token punctuation">{</span>
    <span class="token keyword">private</span> <span class="token keyword">static</span> <span class="token class-name">JedisPool</span> jedisPool<span class="token punctuation">;</span>

    <span class="token keyword">static</span> <span class="token punctuation">{</span>
        <span class="token class-name">JedisPoolConfig</span> jedisPoolConfig<span class="token operator">=</span><span class="token keyword">new</span> <span class="token class-name">JedisPoolConfig</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        jedisPoolConfig<span class="token punctuation">.</span><span class="token function">setMaxTotal</span><span class="token punctuation">(</span><span class="token number">20</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        jedisPoolConfig<span class="token punctuation">.</span><span class="token function">setMaxIdle</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        jedisPool<span class="token operator">=</span><span class="token keyword">new</span> <span class="token class-name">JedisPool</span><span class="token punctuation">(</span>jedisPoolConfig<span class="token punctuation">,</span><span class="token string">"192.168.111.147"</span><span class="token punctuation">,</span><span class="token number">6379</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token class-name">Jedis</span> <span class="token function">getJedis</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">Exception</span> <span class="token punctuation">{</span>
        <span class="token keyword">if</span><span class="token punctuation">(</span><span class="token keyword">null</span><span class="token operator">!=</span>jedisPool<span class="token punctuation">)</span><span class="token punctuation">{</span>
            <span class="token keyword">return</span> jedisPool<span class="token punctuation">.</span><span class="token function">getResource</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">Exception</span><span class="token punctuation">(</span><span class="token string">"Jedispool was not init"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="总结" tabindex="-1"><a class="header-anchor" href="#总结" aria-hidden="true">#</a> 总结</h3>
<p>使用Redis实现分布式锁可能会存在锁丢失的问题，在集群环境中，我们的分布式锁先加到主节点上，然后在还没有这个数据还没同步到从节点时，主节点宕机，集群哨兵监听到主节点宕机然后进行主从切换，从节点恢复对外服务之后，这个时候上面没有锁，这把锁可以会被其他的服务获取到就会导致同一时刻可能有两个服务都认为自己获取到了锁，可能就会导致一些业务的异常。</p>
<h2 id="使用redisson实现分布式锁" tabindex="-1"><a class="header-anchor" href="#使用redisson实现分布式锁" aria-hidden="true">#</a> 使用Redisson实现分布式锁</h2>
<h3 id="设计理念" tabindex="-1"><a class="header-anchor" href="#设计理念" aria-hidden="true">#</a> 设计理念</h3>
<p>该方案也是基于（set 加锁、Lua 脚本解锁）进行改良的，所以redis之父antirez 只描述了差异的地方，大致方案如下。
假设我们有N个Redis主节点，例如 N = 5这些节点是完全独立的，我们不使用复制或任何其他隐式协调系统，为了取到锁客户端执行以下操作：</p>
<table>
<thead>
<tr>
<th style="text-align:center">序号</th>
<th>操作</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">1</td>
<td>获取当前时间，以毫秒为单位；</td>
</tr>
<tr>
<td style="text-align:center">2</td>
<td>依次尝试从5个实例，使用相同的 key 和随机值（例如 UUID）获取锁。当向Redis 请求获取锁时，客户端应该设置一个超时时间，这个超时时间应该小于锁的失效时间。例如你的锁自动失效时间为 10 秒，则超时时间应该在 5-50 毫秒之间。这样可以防止客户端在试图与一个宕机的 Redis 节点对话时长时间处于阻塞状态。如果一个实例不可用，客户端应该尽快尝试去另外一个 Redis 实例请求获取锁；</td>
</tr>
<tr>
<td style="text-align:center">3</td>
<td>客户端通过当前时间减去步骤 1 记录的时间来计算获取锁使用的时间。当且仅当从大多数（N/2+1，这里是 3 个节点）的 Redis 节点都取到锁，并且获取锁使用的时间小于锁失效时间时，锁才算获取成功；</td>
</tr>
<tr>
<td style="text-align:center">4</td>
<td>如果取到了锁，其真正有效时间等于初始有效时间减去获取锁所使用的时间（步骤 3 计算的结果）。</td>
</tr>
<tr>
<td style="text-align:center">5</td>
<td>如果由于某些原因未能获得锁（无法在至少 N/2 + 1 个 Redis 实例获取锁、或获取锁的时间超过了有效时间），客户端应该在所有的 Redis 实例上进行解锁（即便某些Redis实例根本就没有加锁成功，防止某些节点获取到锁但是客户端没有得到响应而导致接下来的一段时间不能被重新获取锁）。</td>
</tr>
</tbody>
</table>
<blockquote>
<p>该方案为了解决数据不一致的问题，直接舍弃了异步复制只使用 master 节点，同时由于舍弃了 slave，为了保证可用性，引入了 N 个节点，官方建议是 5台机器。
客户端只有在满足下面的这两个条件时，才能认为是加锁成功。
条件1：客户端从超过半数（大于等于N/2+1）的Redis实例上成功获取到了锁；
条件2：客户端获取锁的总耗时没有超过锁的有效时间。</p>
<p>PS:</p>
<p>N = 2X + 1   (N是最终部署机器数，X是容错机器数)</p>
<p>1 容错
失败了多少个机器实例后我还是可以容忍的，所谓的容忍就是数据一致性还是可以Ok的，CP数据一致性还是可以满足
加入在集群环境中，redis失败1台，可接受。2X+1 = 2 * 1+1 =3，部署3台，死了1个剩下2个可以正常工作，那就部署3台。
加入在集群环境中，redis失败2台，可接受。2X+1 = 2 * 2+1 =5，部署5台，死了2个剩下3个可以正常工作，那就部署5台。</p>
<p>2 为什么是奇数？
最少的机器，最多的产出效果
加入在集群环境中，redis失败1台，可接受。2N+2= 2 * 1+2 =4，部署4台
加入在集群环境中，redis失败2台，可接受。2N+2 = 2 * 2+2 =6，部署6台</p>
</blockquote>
<h3 id="代码实现" tabindex="-1"><a class="header-anchor" href="#代码实现" aria-hidden="true">#</a> 代码实现</h3>
<p>这里使用了3台服务器，并非官方推荐的5台服务器</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@RestController</span>
<span class="token annotation punctuation">@Slf4j</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">RedLockController</span> <span class="token punctuation">{</span>

    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token class-name">String</span> <span class="token constant">CACHE_KEY_REDLOCK</span> <span class="token operator">=</span> <span class="token string">"ZZYY_REDLOCK"</span><span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">RedissonClient</span> redissonClient1<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">RedissonClient</span> redissonClient2<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">RedissonClient</span> redissonClient3<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span>value <span class="token operator">=</span> <span class="token string">"/redlock"</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">getlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">//CACHE_KEY_REDLOCK为redis 分布式锁的key</span>
        <span class="token class-name">RLock</span> lock1 <span class="token operator">=</span> redissonClient1<span class="token punctuation">.</span><span class="token function">getLock</span><span class="token punctuation">(</span><span class="token constant">CACHE_KEY_REDLOCK</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">RLock</span> lock2 <span class="token operator">=</span> redissonClient2<span class="token punctuation">.</span><span class="token function">getLock</span><span class="token punctuation">(</span><span class="token constant">CACHE_KEY_REDLOCK</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">RLock</span> lock3 <span class="token operator">=</span> redissonClient3<span class="token punctuation">.</span><span class="token function">getLock</span><span class="token punctuation">(</span><span class="token constant">CACHE_KEY_REDLOCK</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token class-name">RedissonRedLock</span> redLock <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">RedissonRedLock</span><span class="token punctuation">(</span>lock1<span class="token punctuation">,</span> lock2<span class="token punctuation">,</span> lock3<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">boolean</span> isLock<span class="token punctuation">;</span>

        <span class="token keyword">try</span> <span class="token punctuation">{</span>

            <span class="token comment">//waitTime 锁的等待时间处理,正常情况下 等5s</span>
            <span class="token comment">//leaseTime就是redis key的过期时间,正常情况下等5分钟。</span>
            isLock <span class="token operator">=</span> redLock<span class="token punctuation">.</span><span class="token function">tryLock</span><span class="token punctuation">(</span><span class="token number">5</span><span class="token punctuation">,</span> <span class="token number">300</span><span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            log<span class="token punctuation">.</span><span class="token function">info</span><span class="token punctuation">(</span><span class="token string">"线程{}，是否拿到锁：{} "</span><span class="token punctuation">,</span><span class="token class-name">Thread</span><span class="token punctuation">.</span><span class="token function">currentThread</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">getName</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>isLock<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>isLock<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token comment">//TODO if get lock success, do something;</span>
                <span class="token comment">//暂停20秒钟线程</span>
                <span class="token keyword">try</span> <span class="token punctuation">{</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">.</span><span class="token function">sleep</span><span class="token punctuation">(</span><span class="token number">20</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">InterruptedException</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span> e<span class="token punctuation">.</span><span class="token function">printStackTrace</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token punctuation">}</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">Exception</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            log<span class="token punctuation">.</span><span class="token function">error</span><span class="token punctuation">(</span><span class="token string">"redlock exception "</span><span class="token punctuation">,</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
            <span class="token comment">// 无论如何, 最后都要解锁</span>
            redLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">Thread</span><span class="token punctuation">.</span><span class="token function">currentThread</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">getName</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">"\t"</span><span class="token operator">+</span><span class="token string">"redLock.unlock()"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="redisson源码分析" tabindex="-1"><a class="header-anchor" href="#redisson源码分析" aria-hidden="true">#</a> Redisson源码分析</h3>
<h4 id="缓存续命" tabindex="-1"><a class="header-anchor" href="#缓存续命" aria-hidden="true">#</a> 缓存续命</h4>
<p><strong>Redis 分布式锁过期了，但是业务逻辑还没处理完怎么办？</strong></p>
<p>使用守护线程来“续命”，简单来说就是额外起一个线程，定期检查线程是否还持有锁，如果有则延长过期时间。在Redisson 里面就实现了这个方案，使用“看门狗”定期检查（每1/3的锁时间检查1次），如果线程还持有锁，则刷新过期时间 <code v-pre>[在获取锁成功后，给锁加一个 watchdog，watchdog 会起一个定时任务，在锁没有被释放且快要过期的时候会续期]</code></p>
<h5 id="wactdog-看门狗-源码分析" tabindex="-1"><a class="header-anchor" href="#wactdog-看门狗-源码分析" aria-hidden="true">#</a> wactdog[看门狗] 源码分析</h5>
<p><strong>1. 通过redisson新建出来的锁key，默认是30秒</strong></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292240554.png" alt="image-20221129224009481" loading="lazy"></p>
<p><strong>2. 加锁的逻辑会进入到 org.redisson.RedissonLock#tryhAcquireAsync 中，在获取锁成功后，会进入scheduleExpirationRenewal</strong></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292244320.png" alt="image-20221129224433255" loading="lazy"></p>
<p><strong>3. scheduleExpirationRenewal这里面初始化了一个定时器，dely 的时间是 internalLockLeaseTime/3。在 Redisson 中，internalLockLeaseTime 是 30s，也就是每隔 10s 续期一次，每次 30s。也就是客户端A加锁成功，就会启动一个watch dog看门狗，他是一个后台线程，会每隔10秒检查一下，如果客户端A还持有锁key，那么就会不断的延长锁key的生存时间，默认每次续命又从30秒新开始</strong></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292301074.png" alt="image-20221129230159017" loading="lazy"></p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292302555.png" alt="image-20221129230238488" style="zoom:50%;" />
<p><strong>4. KEYS[1]代表的是你加锁的那个key；ARGV[2]代表的是加锁的客户端的ID；ARGV[1]就是锁key的默认生存时间</strong></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292310306.png" alt="image-20221129231006244" loading="lazy"></p>
<h4 id="解锁" tabindex="-1"><a class="header-anchor" href="#解锁" aria-hidden="true">#</a> 解锁</h4>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292316924.png" alt="image-20221129231612864" loading="lazy"></p>
</div></template>


