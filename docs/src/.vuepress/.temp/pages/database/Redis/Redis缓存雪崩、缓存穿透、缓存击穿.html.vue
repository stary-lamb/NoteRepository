<template><div><h2 id="缓存雪崩" tabindex="-1"><a class="header-anchor" href="#缓存雪崩" aria-hidden="true">#</a> 缓存雪崩</h2>
<h3 id="产生原因" tabindex="-1"><a class="header-anchor" href="#产生原因" aria-hidden="true">#</a> 产生原因</h3>
<ul>
<li>Redis主机挂了，Redis全盘崩溃</li>
<li>缓存中大量数据同时过期</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211280707661.png" alt="image-20221128070708520" style="zoom:67%;" />
<h3 id="解决方案" tabindex="-1"><a class="header-anchor" href="#解决方案" aria-hidden="true">#</a> 解决方案</h3>
<ul>
<li>redis缓存集群实现高可用
<ul>
<li>主从+哨兵</li>
<li>Redis Cluster</li>
</ul>
</li>
<li>本地缓存 + Hystrix或者阿里sentinel限流&amp;降级别</li>
<li>开启Redis持久化机制 AOF/RDB，尽快恢复缓存集群</li>
</ul>
<h2 id="缓存穿透" tabindex="-1"><a class="header-anchor" href="#缓存穿透" aria-hidden="true">#</a> 缓存穿透</h2>
<h3 id="产生原因-1" tabindex="-1"><a class="header-anchor" href="#产生原因-1" aria-hidden="true">#</a> 产生原因</h3>
<p>用户请求访问数据，在Redis和数据库中都查询不到该记录，但是每次请求都会打到数据库上，导致后台的数据库压力暴增，这种现象就是缓存穿透。简单来说，<strong>数据即不再缓存中，也不再数据库中</strong>。</p>
<ul>
<li>业务误操作，缓存中的数据和数据库的数据都被误删除了，所以导致缓存和数据库中都没有数据</li>
<li>黑客恶意攻击，故意大量访问某些读取不存在数据的业务</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211280715771.png" alt="image-20221128071512722" style="zoom:67%;" />
<h3 id="解决方案-1" tabindex="-1"><a class="header-anchor" href="#解决方案-1" aria-hidden="true">#</a> 解决方案</h3>
<h4 id="方案一-对象缓存或者缺省值" tabindex="-1"><a class="header-anchor" href="#方案一-对象缓存或者缺省值" aria-hidden="true">#</a> 方案一：对象缓存或者缺省值</h4>
<p>一旦发生缓存穿透，我们可以针对查询的数据，在Redis中缓存一个空值或者是和业务层协商确定的缺省值（例如，库存的缺省值可以设为0）。应用再发生请求查询时，就可以直接从Redis中读取空值或者缺省值，返回给业务应用，避免了把大量的请求发送给数据库出处理，保持数据库的正常运行。</p>
<p>**弊端：**如果每次都是发送不同的请求查询数据，由于存在空对象缓存和缓存的回写，Redis中的无关紧要的key也会也写也多。</p>
<h4 id="方案二-google布隆过滤器guava解决缓存穿透" tabindex="-1"><a class="header-anchor" href="#方案二-google布隆过滤器guava解决缓存穿透" aria-hidden="true">#</a> 方案二：Google布隆过滤器Guava解决缓存穿透</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211280754144.png" alt="image-20221128075406070" style="zoom: 67%;" />
<p>代码实现：</p>
<p><strong>取样本100W数据，查查不在100W范围内的其它10W数据是否存在</strong></p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code> <span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">BloomFilterDemo</span> <span class="token punctuation">{</span>

    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> _1W <span class="token operator">=</span> <span class="token number">10000</span><span class="token punctuation">;</span>
    <span class="token comment">//布隆过滤器里面预计要插入多少数据</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">int</span> size <span class="token operator">=</span> <span class="token number">100</span> <span class="token operator">*</span> _1W<span class="token punctuation">;</span>
    <span class="token comment">//误判率,它越小误判的个数也就越小 --->Guava误判率默认为0.03 如果误判率越小，程序的执行效率会越低</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">double</span> fpp <span class="token operator">=</span> <span class="token number">0.00001</span><span class="token punctuation">;</span>

    <span class="token comment">//构建布隆过滤器</span>
    <span class="token keyword">private</span> <span class="token keyword">static</span> <span class="token class-name">BloomFilter</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">></span></span> bloomFilter <span class="token operator">=</span> <span class="token class-name">BloomFilter</span><span class="token punctuation">.</span><span class="token function">create</span><span class="token punctuation">(</span><span class="token class-name">Funnels</span><span class="token punctuation">.</span><span class="token function">integerFunnel</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>size<span class="token punctuation">,</span>fpp<span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">void</span> <span class="token function">main</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> args<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">//1. 先往布隆过滤器里面插入100万的样本数据</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> size<span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            bloomFilter<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span>i<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>

        <span class="token comment">//故意取10万个不同的过滤器，看看有多少会被认为在过滤器里</span>
        <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">></span></span> list <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ArrayList</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token number">10</span> <span class="token operator">*</span> _1W<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> size<span class="token operator">+</span><span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> size <span class="token operator">+</span> <span class="token number">100000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>bloomFilter<span class="token punctuation">.</span><span class="token function">mightContain</span><span class="token punctuation">(</span>i<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span>i<span class="token operator">+</span><span class="token string">"\t"</span><span class="token operator">+</span><span class="token string">"被误判了"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                list<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span>i<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"误判的数量："</span><span class="token operator">+</span>list<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><blockquote>
<p>小结：从100W的数据样本中匹配的10w不在布隆过滤器的数据，总共误判了3033次，误判率仅为0.03</p>
</blockquote>
<h4 id="方案三-redis-布隆过滤器解决缓存穿透方案" tabindex="-1"><a class="header-anchor" href="#方案三-redis-布隆过滤器解决缓存穿透方案" aria-hidden="true">#</a> 方案三：Redis 布隆过滤器解决缓存穿透方案</h4>
<p><strong>白名单架构说明：</strong></p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211290711971.png" alt="image-20221129071058748" style="zoom:67%;" />
<p><strong>代码实现：</strong></p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">RedissonBloomFilterDemo2</span> <span class="token punctuation">{</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token keyword">int</span> _1W <span class="token operator">=</span> <span class="token number">10000</span><span class="token punctuation">;</span>

    <span class="token comment">//布隆过滤器里面预计要插入多少数据</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">int</span> size <span class="token operator">=</span> <span class="token number">100</span> <span class="token operator">*</span> _1W<span class="token punctuation">;</span>
    <span class="token comment">//误判率，它越小误判个数也就越少</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">double</span> fpp <span class="token operator">=</span> <span class="token number">0.03</span><span class="token punctuation">;</span>

    <span class="token keyword">static</span> <span class="token class-name">RedissonClient</span> redissonClient <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token keyword">static</span> <span class="token class-name">RBloomFilter</span> rBloomFilter <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>

    <span class="token keyword">static</span> <span class="token punctuation">{</span>
        <span class="token class-name">Config</span> config <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Config</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        config<span class="token punctuation">.</span><span class="token function">useSingleServer</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">setAddress</span><span class="token punctuation">(</span><span class="token string">"redis://1.12.241.34:6379"</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">setPassword</span><span class="token punctuation">(</span><span class="token string">"!CJY123456"</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">setDatabase</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">//构建 Redisson</span>
        redissonClient <span class="token operator">=</span> <span class="token class-name">Redisson</span><span class="token punctuation">.</span><span class="token function">create</span><span class="token punctuation">(</span>config<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">//通过Redisson构建RBloomFilter</span>
        rBloomFilter <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getBloomFilter</span><span class="token punctuation">(</span><span class="token string">"phoneListBloomFilter"</span><span class="token punctuation">,</span><span class="token keyword">new</span> <span class="token class-name">StringCodec</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        rBloomFilter<span class="token punctuation">.</span><span class="token function">tryInit</span><span class="token punctuation">(</span>size<span class="token punctuation">,</span>fpp<span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token comment">//1. 测试布隆过滤器有+redis有</span>
        rBloomFilter<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token string">"10086"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        redissonClient<span class="token punctuation">.</span><span class="token function">getBucket</span><span class="token punctuation">(</span><span class="token string">"10086"</span><span class="token punctuation">,</span><span class="token keyword">new</span> <span class="token class-name">StringCodec</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token string">"chinamobile10086"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token comment">//2. 测试 布隆过滤器有+redis无</span>
        rBloomFilter<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token string">"10087"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token comment">//3. 测试 布隆过滤器无，redis无</span>
    <span class="token punctuation">}</span>


    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">void</span> <span class="token function">main</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> args<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">//String phoneListById = getPhoneListById("10086");</span>
        <span class="token comment">//String phoneListById = getPhoneListById("10087");</span>
        <span class="token class-name">String</span> phoneListById <span class="token operator">=</span> <span class="token function">getPhoneListById</span><span class="token punctuation">(</span><span class="token string">"10088"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"------查询出来的结果： "</span><span class="token operator">+</span>phoneListById<span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token comment">//暂停几秒钟线程</span>
        <span class="token keyword">try</span> <span class="token punctuation">{</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">.</span><span class="token function">sleep</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">InterruptedException</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span> e<span class="token punctuation">.</span><span class="token function">printStackTrace</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token punctuation">}</span>
        redissonClient<span class="token punctuation">.</span><span class="token function">shutdown</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">private</span> <span class="token keyword">static</span> <span class="token class-name">String</span> <span class="token function">getPhoneListById</span><span class="token punctuation">(</span><span class="token class-name">String</span> <span class="token class-name">IDNumber</span><span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token class-name">String</span> result <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token class-name">IDNumber</span> <span class="token operator">==</span><span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>

        <span class="token comment">//1. 先去布隆过滤器里面查询</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>rBloomFilter<span class="token punctuation">.</span><span class="token function">contains</span><span class="token punctuation">(</span><span class="token class-name">IDNumber</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token class-name">RBucket</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span></span> rBucket <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getBucket</span><span class="token punctuation">(</span><span class="token class-name">IDNumber</span><span class="token punctuation">,</span> <span class="token keyword">new</span> <span class="token class-name">StringCodec</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            result <span class="token operator">=</span> rBucket<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>result <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token keyword">return</span> <span class="token string">"i come from redis: "</span><span class="token operator">+</span>result<span class="token punctuation">;</span>
            <span class="token punctuation">}</span><span class="token keyword">else</span> <span class="token punctuation">{</span>
                result <span class="token operator">=</span> <span class="token function">getPhoneListByMySQL</span><span class="token punctuation">(</span><span class="token class-name">IDNumber</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">if</span> <span class="token punctuation">(</span>result <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
                <span class="token comment">//重新将数据更新回Redis</span>
                redissonClient<span class="token punctuation">.</span><span class="token function">getBucket</span><span class="token punctuation">(</span><span class="token class-name">IDNumber</span><span class="token punctuation">,</span><span class="token keyword">new</span> <span class="token class-name">StringCodec</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span>result<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token keyword">return</span> <span class="token string">"i come from mysql: "</span><span class="token operator">+</span>result<span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token keyword">return</span> result<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">private</span> <span class="token keyword">static</span> <span class="token class-name">String</span> <span class="token function">getPhoneListByMySQL</span><span class="token punctuation">(</span><span class="token class-name">String</span> idNumber<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> <span class="token string">"chinamobile"</span><span class="token operator">+</span>idNumber<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h4 id="guava-布隆过滤器-vs-redis-布隆过滤器" tabindex="-1"><a class="header-anchor" href="#guava-布隆过滤器-vs-redis-布隆过滤器" aria-hidden="true">#</a> Guava 布隆过滤器 VS Redis 布隆过滤器</h4>
<p><strong>Guava 布隆过滤器</strong></p>
<ul>
<li>优点：基于JVM内存的一种布隆过滤器（基于本地缓存）</li>
<li>缺点：重启即失效，不支持分布式环境，只适用于单机环境</li>
</ul>
<p><strong>Redis 布隆过滤器</strong></p>
<ul>
<li>优点：可扩展性Bloom过滤器，若一旦Bloom过滤器达到容量，就会在其上创建一个新的过滤器；不存在重启即失效或者定时任务维护的成本</li>
<li>缺点：需要网络IO</li>
</ul>
<h2 id="缓存击穿" tabindex="-1"><a class="header-anchor" href="#缓存击穿" aria-hidden="true">#</a> 缓存击穿</h2>
<h3 id="产生原因-2" tabindex="-1"><a class="header-anchor" href="#产生原因-2" aria-hidden="true">#</a> 产生原因</h3>
<p>大量请求同时查询一个key时，此时这个key正好失效了，导致大量的请求都打到数据库上面去，导致数据库的压力剧增</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211292003802.png" alt="image-20221129200340454" style="zoom:67%;" />
<h3 id="解决方案-2" tabindex="-1"><a class="header-anchor" href="#解决方案-2" aria-hidden="true">#</a> 解决方案</h3>
<ul>
<li>
<p>互斥锁方案，保证同一时间只有一个业务线程更新缓存，未能获取互斥锁的请求，要么等待锁释放后重新读取缓存，要么就返回空值或者默认值</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token keyword">public</span> <span class="token class-name">User</span> <span class="token function">findUserById2</span><span class="token punctuation">(</span><span class="token class-name">Integer</span> id<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">User</span> user <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
        <span class="token class-name">String</span> key <span class="token operator">=</span> <span class="token constant">CACHE_KEY_USER</span> <span class="token operator">+</span> id<span class="token punctuation">;</span>
        <span class="token comment">//1.先从redis中查询是否有数据，如果有直接返回结果，没有查询mysql</span>
        user <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token class-name">User</span><span class="token punctuation">)</span> redisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token keyword">if</span> <span class="token punctuation">(</span>user <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token comment">//2.大厂用，对于高QPS优化，进来先加锁，保证一个请求操作，让外面redis等待一下，避免击穿redis</span>
            <span class="token keyword">synchronized</span> <span class="token punctuation">(</span><span class="token class-name">UserService</span><span class="token punctuation">.</span><span class="token keyword">class</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                user <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token class-name">User</span><span class="token punctuation">)</span> redisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token comment">//3. 2查redis还是null，可以去查mysql（mysql有数据）</span>
                <span class="token keyword">if</span> <span class="token punctuation">(</span>user <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token comment">//4.查询mysql，拿数据</span>
                    user <span class="token operator">=</span> userMapper<span class="token punctuation">.</span><span class="token function">selectByPrimaryKey</span><span class="token punctuation">(</span>id<span class="token punctuation">)</span><span class="token punctuation">;</span>
                    <span class="token keyword">if</span> <span class="token punctuation">(</span>user <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                        <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
                    <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>
                        <span class="token comment">//将mysql的数据回写redis，保证数据的一致性</span>
                        redisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">setIfAbsent</span><span class="token punctuation">(</span>key<span class="token punctuation">,</span> user<span class="token punctuation">,</span><span class="token number">7L</span><span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">DAYS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                    <span class="token punctuation">}</span>
                <span class="token punctuation">}</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span>
        <span class="token keyword">return</span> user<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li>
<li>
<p>不给热点数据设置过期时间，由后台异步更新缓存，或者在热点数据准备要过期前，提前通知后台线程更新缓存以及重新设置过期时间</p>
</li>
<li>
<p>设置两块缓存，如果A缓存没有，则去查询B缓存，两者过期时间不一致B比A过期时间长</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@PostConstruct</span>
    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">initJHSAB</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token keyword">new</span> <span class="token class-name">Thread</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-></span> <span class="token punctuation">{</span>
            <span class="token comment">//模拟定时器，定时把数据库的特价商品，刷新到redis中</span>
            <span class="token keyword">while</span> <span class="token punctuation">(</span><span class="token boolean">true</span><span class="token punctuation">)</span><span class="token punctuation">{</span>
                <span class="token comment">//模拟从数据库读取100件特价商品，用于加载到聚划算的页面中</span>
                <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Product</span><span class="token punctuation">></span></span> list<span class="token operator">=</span><span class="token keyword">this</span><span class="token punctuation">.</span><span class="token function">products</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token comment">//先更新B缓存</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">delete</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_B</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForList</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">leftPushAll</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_B</span><span class="token punctuation">,</span>list<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">expire</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_B</span><span class="token punctuation">,</span><span class="token number">20L</span><span class="token punctuation">,</span><span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">DAYS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token comment">//再更新A缓存</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">delete</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_A</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForList</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">leftPushAll</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_A</span><span class="token punctuation">,</span>list<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">expire</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_A</span><span class="token punctuation">,</span><span class="token number">15L</span><span class="token punctuation">,</span><span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">DAYS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token comment">//间隔一分钟 执行一遍</span>
                <span class="token keyword">try</span> <span class="token punctuation">{</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">MINUTES</span><span class="token punctuation">.</span><span class="token function">sleep</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">InterruptedException</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span> e<span class="token punctuation">.</span><span class="token function">printStackTrace</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token punctuation">}</span>

                log<span class="token punctuation">.</span><span class="token function">info</span><span class="token punctuation">(</span><span class="token string">"runJhs定时刷新.............."</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span><span class="token punctuation">,</span><span class="token string">"t1"</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">start</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

<span class="token keyword">public</span> <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Product</span><span class="token punctuation">></span></span> <span class="token function">findAB</span><span class="token punctuation">(</span><span class="token keyword">int</span> page<span class="token punctuation">,</span> <span class="token keyword">int</span> size<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Product</span><span class="token punctuation">></span></span> list<span class="token operator">=</span><span class="token keyword">null</span><span class="token punctuation">;</span>
        <span class="token keyword">long</span> start <span class="token operator">=</span> <span class="token punctuation">(</span>page <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token operator">*</span> size<span class="token punctuation">;</span>
        <span class="token keyword">long</span> end <span class="token operator">=</span> start <span class="token operator">+</span> size <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">;</span>
        <span class="token keyword">try</span> <span class="token punctuation">{</span>
            <span class="token comment">//采用redis list数据结构的lrange命令实现分页查询</span>
            list <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForList</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">range</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_A</span><span class="token punctuation">,</span> start<span class="token punctuation">,</span> end<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token class-name">CollectionUtils</span><span class="token punctuation">.</span><span class="token function">isEmpty</span><span class="token punctuation">(</span>list<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                log<span class="token punctuation">.</span><span class="token function">info</span><span class="token punctuation">(</span><span class="token string">"=========A缓存已经失效了，记得人工修补，B缓存自动延续5天"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token comment">//用户先查询缓存A(上面的代码)，如果缓存A查询不到（例如，更新缓存的时候删除了），再查询缓存B</span>
                <span class="token keyword">this</span><span class="token punctuation">.</span>redisTemplate<span class="token punctuation">.</span><span class="token function">opsForList</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">range</span><span class="token punctuation">(</span><span class="token class-name">Constants</span><span class="token punctuation">.</span><span class="token constant">JHS_KEY_B</span><span class="token punctuation">,</span> start<span class="token punctuation">,</span> end<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            log<span class="token punctuation">.</span><span class="token function">info</span><span class="token punctuation">(</span><span class="token string">"查询结果：{}"</span><span class="token punctuation">,</span> list<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">Exception</span> ex<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token comment">//这里的异常，一般是redis瘫痪 ，或 redis网络timeout</span>
            log<span class="token punctuation">.</span><span class="token function">error</span><span class="token punctuation">(</span><span class="token string">"exception:"</span><span class="token punctuation">,</span> ex<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token comment">//TODO 走DB查询</span>
        <span class="token punctuation">}</span>
        <span class="token keyword">return</span> list<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>


</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li>
</ul>
<blockquote>
<p>小结：解决缓存击穿的方法 —— 互斥更新、随机避退、差异失效时间</p>
</blockquote>
</div></template>


