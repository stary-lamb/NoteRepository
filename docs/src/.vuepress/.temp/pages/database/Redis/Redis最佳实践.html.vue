<template><div><h2 id="redis键值设计" tabindex="-1"><a class="header-anchor" href="#redis键值设计" aria-hidden="true">#</a> Redis键值设计</h2>
<h3 id="优雅的key结构" tabindex="-1"><a class="header-anchor" href="#优雅的key结构" aria-hidden="true">#</a> 优雅的key结构</h3>
<p>Redis的Key虽然可以自定义，但最好遵循下面的几个最佳实践约定：</p>
<ul>
<li>遵循基本格式：[业务名称]:[数据名]:[id]</li>
<li>长度不超过44字节</li>
<li>不包含特殊字符</li>
</ul>
<p>例如：我们的登录业务，保存用户信息，其key可以设计成如下格式：</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102039.png" alt="image-20220521120213631" loading="lazy"></p>
<p>这样设计的好处：</p>
<ul>
<li>可读性强</li>
<li>避免key冲突</li>
<li>方便管理</li>
<li>更节省内存： key是string类型，底层编码包含int、embstr和raw三种。embstr在小于44字节使用，采用连续内存空间，内存占用更小。当字节数大于44字节时，会转为raw模式存储，在raw模式下，内存空间不是连续的，而是采用一个指针指向了另外一段内存空间，在这段空间里存储SDS内容，这样空间不连续，访问的时候性能也就会收到影响，还有可能产生内存碎片</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102045.png" alt="image-20220521122320482" style="zoom:67%;" />
<h3 id="尽量避免-bigkey" tabindex="-1"><a class="header-anchor" href="#尽量避免-bigkey" aria-hidden="true">#</a> 尽量避免 BigKey</h3>
<p>BigKey 通常以 Key 的大小和 Key 中成员的数量来综合判定，例如：</p>
<ul>
<li>Key 本身的数据量过大：一个 String类型的 Key，它的值为5 MB</li>
<li>Key 中的成员数过多：一个ZSET类型的Key，它的成员数量为10,000个</li>
<li>Key 中成员的数据量过大：一个 Hash类型的 Key，它的成员数量虽然只有1,000个但这些成员的Value（值）总大小为100 MB</li>
</ul>
<p>那么如何判断元素的大小呢？redis也给我们提供了命令</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102042.png" alt="image-20220521124650117" style="zoom:67%;" />
<p>推荐值：</p>
<ul>
<li>单个 key 的 value 小于10KB</li>
<li>对于集合类型的 key，建议元素数量小于1000</li>
</ul>
<h4 id="bigkey的危害" tabindex="-1"><a class="header-anchor" href="#bigkey的危害" aria-hidden="true">#</a> BigKey的危害</h4>
<ul>
<li>网络阻塞
<ul>
<li>对BigKey执行读请求时，少量的QPS就可能导致带宽使用率被占满，导致Redis实例，乃至所在物理机变慢</li>
</ul>
</li>
<li>数据倾斜
<ul>
<li>BigKey所在的Redis实例内存使用率远超其他实例，无法使数据分片的内存资源达到均衡</li>
</ul>
</li>
<li>Redis阻塞
<ul>
<li>对元素较多的hash、list、zset等做运算会耗时较旧，使主线程被阻塞</li>
</ul>
</li>
<li>CPU压力
<ul>
<li>对BigKey的数据序列化和反序列化会导致CPU的使用率飙升，影响Redis实例和本机其它应用</li>
</ul>
</li>
</ul>
<h4 id="如何发现bigkey" tabindex="-1"><a class="header-anchor" href="#如何发现bigkey" aria-hidden="true">#</a> 如何发现BigKey</h4>
<h5 id="_1-redis-cli-bigkeys" tabindex="-1"><a class="header-anchor" href="#_1-redis-cli-bigkeys" aria-hidden="true">#</a> 1. redis-cli --bigkeys</h5>
<p>利用redis-cli提供的--bigkeys参数，可以遍历分析所有key，并返回Key的整体统计信息与每个数据的Top1的big key</p>
<p>命令：<code v-pre>redis-cli -a 密码 --bigkeys</code></p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102050.png" alt="image-20220521133359507" style="zoom:67%;" />
<h5 id="_2-scan扫描" tabindex="-1"><a class="header-anchor" href="#_2-scan扫描" aria-hidden="true">#</a> 2. scan扫描</h5>
<p>自己编程，利用scan扫描Redis中的所有key，利用strlen、hlen等命令判断key的长度（此处不建议使用MEMORY USAGE）</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102047.png" alt="image-20220521133703245" loading="lazy"></p>
<p>scan 命令调用完后每次会返回2个元素，第一个是下一次迭代的光标，第一次光标会设置为0，当最后一次scan 返回的光标等于0时，表示整个scan遍历结束了，第二个返回的是List，一个匹配的key的数组</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token keyword">import</span> <span class="token import"><span class="token namespace">com<span class="token punctuation">.</span>heima<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">JedisConnectionFactory</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">org<span class="token punctuation">.</span>junit<span class="token punctuation">.</span>jupiter<span class="token punctuation">.</span>api<span class="token punctuation">.</span></span><span class="token class-name">AfterEach</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">org<span class="token punctuation">.</span>junit<span class="token punctuation">.</span>jupiter<span class="token punctuation">.</span>api<span class="token punctuation">.</span></span><span class="token class-name">BeforeEach</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">org<span class="token punctuation">.</span>junit<span class="token punctuation">.</span>jupiter<span class="token punctuation">.</span>api<span class="token punctuation">.</span></span><span class="token class-name">Test</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">redis<span class="token punctuation">.</span>clients<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span></span><span class="token class-name">Jedis</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">redis<span class="token punctuation">.</span>clients<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span></span><span class="token class-name">ScanResult</span></span><span class="token punctuation">;</span>

<span class="token keyword">import</span> <span class="token import"><span class="token namespace">java<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">HashMap</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">java<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">List</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">java<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">Map</span></span><span class="token punctuation">;</span>

<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">JedisTest</span> <span class="token punctuation">{</span>
    <span class="token keyword">private</span> <span class="token class-name">Jedis</span> jedis<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@BeforeEach</span>
    <span class="token keyword">void</span> <span class="token function">setUp</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">// 1.建立连接</span>
        <span class="token comment">// jedis = new Jedis("192.168.150.101", 6379);</span>
        jedis <span class="token operator">=</span> <span class="token class-name">JedisConnectionFactory</span><span class="token punctuation">.</span><span class="token function">getJedis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 2.设置密码</span>
        jedis<span class="token punctuation">.</span><span class="token function">auth</span><span class="token punctuation">(</span><span class="token string">"123321"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 3.选择库</span>
        jedis<span class="token punctuation">.</span><span class="token function">select</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">final</span> <span class="token keyword">static</span> <span class="token keyword">int</span> <span class="token constant">STR_MAX_LEN</span> <span class="token operator">=</span> <span class="token number">10</span> <span class="token operator">*</span> <span class="token number">1024</span><span class="token punctuation">;</span>
    <span class="token keyword">final</span> <span class="token keyword">static</span> <span class="token keyword">int</span> <span class="token constant">HASH_MAX_LEN</span> <span class="token operator">=</span> <span class="token number">500</span><span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testScan</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">int</span> maxLen <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
        <span class="token keyword">long</span> len <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>

        <span class="token class-name">String</span> cursor <span class="token operator">=</span> <span class="token string">"0"</span><span class="token punctuation">;</span>
        <span class="token keyword">do</span> <span class="token punctuation">{</span>
            <span class="token comment">// 扫描并获取一部分key</span>
            <span class="token class-name">ScanResult</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span></span> result <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">scan</span><span class="token punctuation">(</span>cursor<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token comment">// 记录cursor</span>
            cursor <span class="token operator">=</span> result<span class="token punctuation">.</span><span class="token function">getCursor</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span></span> list <span class="token operator">=</span> result<span class="token punctuation">.</span><span class="token function">getResult</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>list <span class="token operator">==</span> <span class="token keyword">null</span> <span class="token operator">||</span> list<span class="token punctuation">.</span><span class="token function">isEmpty</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token keyword">break</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token comment">// 遍历</span>
            <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token class-name">String</span> key <span class="token operator">:</span> list<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token comment">// 判断key的类型</span>
                <span class="token class-name">String</span> type <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">type</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">switch</span> <span class="token punctuation">(</span>type<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token keyword">case</span> <span class="token string">"string"</span><span class="token operator">:</span>
                        len <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">strlen</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                        maxLen <span class="token operator">=</span> <span class="token constant">STR_MAX_LEN</span><span class="token punctuation">;</span>
                        <span class="token keyword">break</span><span class="token punctuation">;</span>
                    <span class="token keyword">case</span> <span class="token string">"hash"</span><span class="token operator">:</span>
                        len <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">hlen</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                        maxLen <span class="token operator">=</span> <span class="token constant">HASH_MAX_LEN</span><span class="token punctuation">;</span>
                        <span class="token keyword">break</span><span class="token punctuation">;</span>
                    <span class="token keyword">case</span> <span class="token string">"list"</span><span class="token operator">:</span>
                        len <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">llen</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                        maxLen <span class="token operator">=</span> <span class="token constant">HASH_MAX_LEN</span><span class="token punctuation">;</span>
                        <span class="token keyword">break</span><span class="token punctuation">;</span>
                    <span class="token keyword">case</span> <span class="token string">"set"</span><span class="token operator">:</span>
                        len <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">scard</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                        maxLen <span class="token operator">=</span> <span class="token constant">HASH_MAX_LEN</span><span class="token punctuation">;</span>
                        <span class="token keyword">break</span><span class="token punctuation">;</span>
                    <span class="token keyword">case</span> <span class="token string">"zset"</span><span class="token operator">:</span>
                        len <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">zcard</span><span class="token punctuation">(</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
                        maxLen <span class="token operator">=</span> <span class="token constant">HASH_MAX_LEN</span><span class="token punctuation">;</span>
                        <span class="token keyword">break</span><span class="token punctuation">;</span>
                    <span class="token keyword">default</span><span class="token operator">:</span>
                        <span class="token keyword">break</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
                <span class="token keyword">if</span> <span class="token punctuation">(</span>len <span class="token operator">>=</span> maxLen<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">printf</span><span class="token punctuation">(</span><span class="token string">"Found big key : %s, type: %s, length or size: %d %n"</span><span class="token punctuation">,</span> key<span class="token punctuation">,</span> type<span class="token punctuation">,</span> len<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span> <span class="token keyword">while</span> <span class="token punctuation">(</span><span class="token operator">!</span>cursor<span class="token punctuation">.</span><span class="token function">equals</span><span class="token punctuation">(</span><span class="token string">"0"</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    
    <span class="token annotation punctuation">@AfterEach</span>
    <span class="token keyword">void</span> <span class="token function">tearDown</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>jedis <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            jedis<span class="token punctuation">.</span><span class="token function">close</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>

<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h5 id="_3-第三方工具" tabindex="-1"><a class="header-anchor" href="#_3-第三方工具" aria-hidden="true">#</a> 3. 第三方工具</h5>
<ul>
<li>利用第三方工具，如 Redis-Rdb-Tools 分析RDB快照文件，全面分析内存使用情况</li>
<li><a href="https://github.com/sripathikrishnan/redis-rdb-tools" target="_blank" rel="noopener noreferrer">https://github.com/sripathikrishnan/redis-rdb-tools<ExternalLinkIcon/></a></li>
</ul>
<h5 id="_4-网络监控" tabindex="-1"><a class="header-anchor" href="#_4-网络监控" aria-hidden="true">#</a> 4. 网络监控</h5>
<ul>
<li>自定义工具，监控进出Redis的网络数据，超出预警值时主动告警</li>
<li>一般阿里云搭建的云服务器就有相关监控页面</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102075.png" alt="image-20220521140415785" style="zoom:67%;" />
<h4 id="如何删除bigkey" tabindex="-1"><a class="header-anchor" href="#如何删除bigkey" aria-hidden="true">#</a> 如何删除BigKey</h4>
<p>BigKey内存占用较多，即便时删除这样的key也需要耗费很长时间，导致Redis主线程阻塞，引发一系列问题。</p>
<ul>
<li>redis 3.0 及以下版本
<ul>
<li>如果是集合类型，则遍历BigKey的元素，先逐个删除子元素，最后删除BigKey</li>
</ul>
</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102167.png" alt="image-20220521140621204" style="zoom:67%;" />
<ul>
<li>Redis 4.0以后
<ul>
<li>Redis在4.0后提供了异步删除的命令：unlink</li>
</ul>
</li>
</ul>
<h3 id="恰当的数据类型" tabindex="-1"><a class="header-anchor" href="#恰当的数据类型" aria-hidden="true">#</a> 恰当的数据类型</h3>
<h4 id="🌰1-比如存储一个user对象-我们有三种存储方式" tabindex="-1"><a class="header-anchor" href="#🌰1-比如存储一个user对象-我们有三种存储方式" aria-hidden="true">#</a> 🌰1：比如存储一个User对象，我们有三种存储方式：</h4>
<h5 id="方式一-json字符串" tabindex="-1"><a class="header-anchor" href="#方式一-json字符串" aria-hidden="true">#</a> 方式一：json字符串</h5>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token builtin class-name">set</span> user:1 <span class="token punctuation">{</span> <span class="token string">"name"</span><span class="token builtin class-name">:</span> <span class="token string">"Jack"</span>, <span class="token string">"age"</span><span class="token builtin class-name">:</span> <span class="token number">21</span> <span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>优点：实现简单粗暴</p>
<p>缺点：数据耦合，不够灵活</p>
<h5 id="方式二-字段打散" tabindex="-1"><a class="header-anchor" href="#方式二-字段打散" aria-hidden="true">#</a> 方式二：字段打散</h5>
<table>
<thead>
<tr>
<th style="text-align:center">user:1:name</th>
<th style="text-align:center">Jack</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">user:1:age</td>
<td style="text-align:center">21</td>
</tr>
</tbody>
</table>
<p>优点：可以灵活访问对象任意字段</p>
<p>缺点：占用空间大、没办法做统一控制</p>
<h5 id="方式三-hash-推荐" tabindex="-1"><a class="header-anchor" href="#方式三-hash-推荐" aria-hidden="true">#</a> 方式三：hash（推荐）</h5>
<div>
<table>
	<tr>
		<td rowspan="2">user:1</td>
        <td>name</td>
        <td>jack</td>
	</tr>
	<tr>
		<td>age</td>
		<td>21</td>
	</tr>
</table>
</div>
<p>优点：底层使用ziplist，空间占用小，可以灵活访问对象的任意字段</p>
<p>缺点：代码相对复杂</p>
<h4 id="🌰2-假如有hash类型的key-其中有100万对field和value-field是自增id-这个key存在什么问题-如何优化" tabindex="-1"><a class="header-anchor" href="#🌰2-假如有hash类型的key-其中有100万对field和value-field是自增id-这个key存在什么问题-如何优化" aria-hidden="true">#</a> 🌰2：假如有hash类型的key，其中有100万对field和value，field是自增id，这个key存在什么问题？如何优化？</h4>
<div>
<table>
	<tr style="color:red">
		<td>key</td>
        <td>field</td>
        <td>value</td>
	</tr>
	<tr>
		<td rowspan="3">someKey</td>
		<td>id:0</td>
        <td>value0</td>
	</tr>
    <tr>
		<td>.....</td>
        <td>.....</td>
	</tr>
    <tr>
        <td>id:999999</td>
        <td>value999999</td>
    </tr>
</table>
</div>
存在的问题：
<ul>
<li>
<p>hash的entry数量超过500时，会使用哈希表而不是ZipList，内存占用较多</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102169.png" alt="image-20220521142943350" loading="lazy"></p>
</li>
<li>
<p>可以通过hash-max-ziplist-entries配置entry上限。但是如果entry过多就会导致BigKey问题</p>
</li>
</ul>
<h5 id="方案一-拆分为string类型" tabindex="-1"><a class="header-anchor" href="#方案一-拆分为string类型" aria-hidden="true">#</a> 方案一：拆分为string类型</h5>
<div>
<table>
	<tr style="color:red">
		<td>key</td>
        <td>value</td>
	</tr>
	<tr>
		<td>id:0</td>
        <td>value0</td>
	</tr>
    <tr>
		<td>.....</td>
        <td>.....</td>
	</tr>
    <tr>
        <td>id:999999</td>
        <td>value999999</td>
    </tr>
</table>
</div>
<p>存在的问题：</p>
<ul>
<li>string结构底层没有太多内存优化，内存占用较多</li>
</ul>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102180.png" alt="image-20220521143458010" loading="lazy"></p>
<ul>
<li>想要批量获取这些数据比较麻烦</li>
</ul>
<h5 id="方案二-拆分为小的hash" tabindex="-1"><a class="header-anchor" href="#方案二-拆分为小的hash" aria-hidden="true">#</a> 方案二：拆分为小的hash</h5>
<p>将 id / 100 作为key， 将id % 100 作为field，这样每100个元素为一个Hash</p>
<div>
<table>
	<tr style="color:red">
		<td>key</td>
        <td>field</td>
        <td>value</td>
	</tr>
	<tr>
        <td rowspan="3">key:0</td>
		<td>id:00</td>
        <td>value0</td>
	</tr>
    <tr>
		<td>.....</td>
        <td>.....</td>
	</tr>
    <tr>
        <td>id:99</td>
        <td>value99</td>
    </tr>
    <tr>
        <td rowspan="3">key:1</td>
		<td>id:00</td>
        <td>value100</td>
	</tr>
    <tr>
		<td>.....</td>
        <td>.....</td>
	</tr>
    <tr>
        <td>id:99</td>
        <td>value199</td>
    </tr>
    <tr>
    	<td colspan="3">....</td>
    </tr>
    <tr>
        <td rowspan="3">key:9999</td>
		<td>id:00</td>
        <td>value999900</td>
	</tr>
    <tr>
		<td>.....</td>
        <td>.....</td>
	</tr>
    <tr>
        <td>id:99</td>
        <td>value999999</td>
    </tr>
</table>
</div>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102182.png" alt="image-20220521144339377" loading="lazy"></p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token keyword">package</span> <span class="token namespace">com<span class="token punctuation">.</span>heima<span class="token punctuation">.</span>test</span><span class="token punctuation">;</span>

<span class="token keyword">import</span> <span class="token import"><span class="token namespace">com<span class="token punctuation">.</span>heima<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">JedisConnectionFactory</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">org<span class="token punctuation">.</span>junit<span class="token punctuation">.</span>jupiter<span class="token punctuation">.</span>api<span class="token punctuation">.</span></span><span class="token class-name">AfterEach</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">org<span class="token punctuation">.</span>junit<span class="token punctuation">.</span>jupiter<span class="token punctuation">.</span>api<span class="token punctuation">.</span></span><span class="token class-name">BeforeEach</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">org<span class="token punctuation">.</span>junit<span class="token punctuation">.</span>jupiter<span class="token punctuation">.</span>api<span class="token punctuation">.</span></span><span class="token class-name">Test</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">redis<span class="token punctuation">.</span>clients<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span></span><span class="token class-name">Jedis</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">redis<span class="token punctuation">.</span>clients<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span></span><span class="token class-name">Pipeline</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">redis<span class="token punctuation">.</span>clients<span class="token punctuation">.</span>jedis<span class="token punctuation">.</span></span><span class="token class-name">ScanResult</span></span><span class="token punctuation">;</span>

<span class="token keyword">import</span> <span class="token import"><span class="token namespace">java<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">HashMap</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">java<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">List</span></span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token import"><span class="token namespace">java<span class="token punctuation">.</span>util<span class="token punctuation">.</span></span><span class="token class-name">Map</span></span><span class="token punctuation">;</span>

<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">JedisTest</span> <span class="token punctuation">{</span>
    <span class="token keyword">private</span> <span class="token class-name">Jedis</span> jedis<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@BeforeEach</span>
    <span class="token keyword">void</span> <span class="token function">setUp</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">// 1.建立连接</span>
        <span class="token comment">// jedis = new Jedis("192.168.150.101", 6379);</span>
        jedis <span class="token operator">=</span> <span class="token class-name">JedisConnectionFactory</span><span class="token punctuation">.</span><span class="token function">getJedis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 2.设置密码</span>
        jedis<span class="token punctuation">.</span><span class="token function">auth</span><span class="token punctuation">(</span><span class="token string">"123321"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 3.选择库</span>
        jedis<span class="token punctuation">.</span><span class="token function">select</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testSetBigKey</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span></span> map <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> <span class="token number">650</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"hello_"</span> <span class="token operator">+</span> i<span class="token punctuation">,</span> <span class="token string">"world!"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        jedis<span class="token punctuation">.</span><span class="token function">hmset</span><span class="token punctuation">(</span><span class="token string">"m2"</span><span class="token punctuation">,</span> map<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testBigHash</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span></span> map <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> <span class="token number">100000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"key_"</span> <span class="token operator">+</span> i<span class="token punctuation">,</span> <span class="token string">"value_"</span> <span class="token operator">+</span> i<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        jedis<span class="token punctuation">.</span><span class="token function">hmset</span><span class="token punctuation">(</span><span class="token string">"test:big:hash"</span><span class="token punctuation">,</span> map<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testBigString</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> <span class="token number">100000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            jedis<span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token string">"test:str:key_"</span> <span class="token operator">+</span> i<span class="token punctuation">,</span> <span class="token string">"value_"</span> <span class="token operator">+</span> i<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testSmallHash</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">int</span> hashSize <span class="token operator">=</span> <span class="token number">100</span><span class="token punctuation">;</span>
        <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span></span> map <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span>hashSize<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> <span class="token number">100000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">int</span> k <span class="token operator">=</span> <span class="token punctuation">(</span>i <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token operator">/</span> hashSize<span class="token punctuation">;</span>
            <span class="token keyword">int</span> v <span class="token operator">=</span> i <span class="token operator">%</span> hashSize<span class="token punctuation">;</span>
            map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"key_"</span> <span class="token operator">+</span> v<span class="token punctuation">,</span> <span class="token string">"value_"</span> <span class="token operator">+</span> v<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>v <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                jedis<span class="token punctuation">.</span><span class="token function">hmset</span><span class="token punctuation">(</span><span class="token string">"test:small:hash_"</span> <span class="token operator">+</span> k<span class="token punctuation">,</span> map<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@AfterEach</span>
    <span class="token keyword">void</span> <span class="token function">tearDown</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>jedis <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            jedis<span class="token punctuation">.</span><span class="token function">close</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="总结" tabindex="-1"><a class="header-anchor" href="#总结" aria-hidden="true">#</a> 总结</h3>
<ul>
<li>Key的最佳实践
<ul>
<li>固定格式：[业务名]:[数据名]:[id]</li>
<li>足够简短：不超过44字节</li>
<li>不包含特殊字符</li>
</ul>
</li>
<li>Value的最佳实践：
<ul>
<li>合理的拆分数据，拒绝BigKey</li>
<li>选择合适数据结构</li>
<li>Hash结构的entry数量不要超过1000</li>
<li>设置合理的超时时间</li>
</ul>
</li>
</ul>
<h2 id="批处理优化" tabindex="-1"><a class="header-anchor" href="#批处理优化" aria-hidden="true">#</a> 批处理优化</h2>
<h3 id="pipeline" tabindex="-1"><a class="header-anchor" href="#pipeline" aria-hidden="true">#</a> Pipeline</h3>
<p><strong>我们的客户端与redis服务器是这样交互的</strong></p>
<p><strong>单个命令的执行流程</strong></p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102185.png" alt="image-20220521151459880" style="zoom:67%;" />
<p><strong>N条命令的执行流程</strong></p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102203.png" alt="image-20220521151524621" style="zoom:67%;" />
<p>redis处理指令是很快的，主要花费的时候在于网络传输。于是乎很容易想到将多条指令批量的传输给redis</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102993.png" alt="image-20220521151902080" style="zoom:67%;" />
<h4 id="mset" tabindex="-1"><a class="header-anchor" href="#mset" aria-hidden="true">#</a> MSet</h4>
<p>Redis提供了很多Mxxx这样的命令，可以实现批量插入数据，例如：</p>
<ul>
<li>mset</li>
<li>hmset</li>
</ul>
<p>利用mset批量插入10万条数据</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@Test</span>
<span class="token keyword">void</span> <span class="token function">testMxx</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> arr <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">String</span><span class="token punctuation">[</span><span class="token number">2000</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    <span class="token keyword">int</span> j<span class="token punctuation">;</span>
    <span class="token keyword">long</span> b <span class="token operator">=</span> <span class="token class-name">System</span><span class="token punctuation">.</span><span class="token function">currentTimeMillis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> <span class="token number">100000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        j <span class="token operator">=</span> <span class="token punctuation">(</span>i <span class="token operator">%</span> <span class="token number">1000</span><span class="token punctuation">)</span> <span class="token operator">&lt;&lt;</span> <span class="token number">1</span><span class="token punctuation">;</span>
        arr<span class="token punctuation">[</span>j<span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token string">"test:key_"</span> <span class="token operator">+</span> i<span class="token punctuation">;</span>
        arr<span class="token punctuation">[</span>j <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token string">"value_"</span> <span class="token operator">+</span> i<span class="token punctuation">;</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>j <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            jedis<span class="token punctuation">.</span><span class="token function">mset</span><span class="token punctuation">(</span>arr<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">long</span> e <span class="token operator">=</span> <span class="token class-name">System</span><span class="token punctuation">.</span><span class="token function">currentTimeMillis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"time: "</span> <span class="token operator">+</span> <span class="token punctuation">(</span>e <span class="token operator">-</span> b<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h4 id="pipeline-1" tabindex="-1"><a class="header-anchor" href="#pipeline-1" aria-hidden="true">#</a> Pipeline</h4>
<p>MSET虽然可以批处理，但是却只能操作部分数据类型，因此如果有对复杂数据类型的批处理需要，建议使用Pipeline</p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token annotation punctuation">@Test</span>
<span class="token keyword">void</span> <span class="token function">testPipeline</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 创建管道</span>
    <span class="token class-name">Pipeline</span> pipeline <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">pipelined</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">long</span> b <span class="token operator">=</span> <span class="token class-name">System</span><span class="token punctuation">.</span><span class="token function">currentTimeMillis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span> i <span class="token operator">&lt;=</span> <span class="token number">100000</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">// 放入命令到管道</span>
        pipeline<span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span><span class="token string">"test:key_"</span> <span class="token operator">+</span> i<span class="token punctuation">,</span> <span class="token string">"value_"</span> <span class="token operator">+</span> i<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>i <span class="token operator">%</span> <span class="token number">1000</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token comment">// 每放入1000条命令，批量执行</span>
            pipeline<span class="token punctuation">.</span><span class="token function">sync</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">long</span> e <span class="token operator">=</span> <span class="token class-name">System</span><span class="token punctuation">.</span><span class="token function">currentTimeMillis</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token string">"time: "</span> <span class="token operator">+</span> <span class="token punctuation">(</span>e <span class="token operator">-</span> b<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="集群下的批处理" tabindex="-1"><a class="header-anchor" href="#集群下的批处理" aria-hidden="true">#</a> 集群下的批处理</h3>
<p>如MSET或Pipeline这样的批处理需要在一次请求中携带多条命令，而此时如果Redis是一个集群，那批处理命令的多个key必须落在一个插槽中，否则就会导致执行失败。大家可以想一想这样的要求其实很难实现，因为我们在批处理时，可能一次要插入很多条数据，这些数据很有可能不会都落在相同的节点上，这就会导致报错了</p>
<p>这个时候，我们可以找到4种解决方案</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102025.png" alt="1653126446641" style="zoom:67%;" />
<p>第一种方案：串行执行，所以这种方式没有什么意义，当然，执行起来就很简单了，缺点就是耗时过久。</p>
<p>第二种方案：串行slot，简单来说，就是执行前，客户端先计算一下对应的key的slot，一样slot的key就放到一个组里边，不同的，就放到不同的组里边，然后对每个组执行pipeline的批处理，他就能串行执行各个组的命令，这种做法比第一种方法耗时要少，但是缺点呢，相对来说复杂一点，所以这种方案还需要优化一下</p>
<p>第三种方案：并行slot，相较于第二种方案，在分组完成后串行执行，第三种方案，就变成了并行执行各个命令，所以他的耗时就非常短，但是实现呢，也更加复杂。</p>
<p>第四种：hash_tag，redis计算key的slot的时候，其实是根据key的有效部分来计算的，通过这种方式就能一次处理所有的key，这种方式耗时最短，实现也简单，但是如果通过操作key的有效部分，那么就会导致所有的key都落在一个节点上，产生数据倾斜的问题，所以我们推荐使用第三种方式。</p>
<h4 id="串行化执行代码实践" tabindex="-1"><a class="header-anchor" href="#串行化执行代码实践" aria-hidden="true">#</a> 串行化执行代码实践</h4>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">JedisClusterTest</span> <span class="token punctuation">{</span>

    <span class="token keyword">private</span> <span class="token class-name">JedisCluster</span> jedisCluster<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@BeforeEach</span>
    <span class="token keyword">void</span> <span class="token function">setUp</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token comment">// 配置连接池</span>
        <span class="token class-name">JedisPoolConfig</span> poolConfig <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">JedisPoolConfig</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        poolConfig<span class="token punctuation">.</span><span class="token function">setMaxTotal</span><span class="token punctuation">(</span><span class="token number">8</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        poolConfig<span class="token punctuation">.</span><span class="token function">setMaxIdle</span><span class="token punctuation">(</span><span class="token number">8</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        poolConfig<span class="token punctuation">.</span><span class="token function">setMinIdle</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        poolConfig<span class="token punctuation">.</span><span class="token function">setMaxWaitMillis</span><span class="token punctuation">(</span><span class="token number">1000</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">HashSet</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">HostAndPort</span><span class="token punctuation">></span></span> nodes <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashSet</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        nodes<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">HostAndPort</span><span class="token punctuation">(</span><span class="token string">"192.168.150.101"</span><span class="token punctuation">,</span> <span class="token number">7001</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        nodes<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">HostAndPort</span><span class="token punctuation">(</span><span class="token string">"192.168.150.101"</span><span class="token punctuation">,</span> <span class="token number">7002</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        nodes<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">HostAndPort</span><span class="token punctuation">(</span><span class="token string">"192.168.150.101"</span><span class="token punctuation">,</span> <span class="token number">7003</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        nodes<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">HostAndPort</span><span class="token punctuation">(</span><span class="token string">"192.168.150.101"</span><span class="token punctuation">,</span> <span class="token number">8001</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        nodes<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">HostAndPort</span><span class="token punctuation">(</span><span class="token string">"192.168.150.101"</span><span class="token punctuation">,</span> <span class="token number">8002</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        nodes<span class="token punctuation">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">HostAndPort</span><span class="token punctuation">(</span><span class="token string">"192.168.150.101"</span><span class="token punctuation">,</span> <span class="token number">8003</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        jedisCluster <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">JedisCluster</span><span class="token punctuation">(</span>nodes<span class="token punctuation">,</span> poolConfig<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testMSet</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        jedisCluster<span class="token punctuation">.</span><span class="token function">mset</span><span class="token punctuation">(</span><span class="token string">"name"</span><span class="token punctuation">,</span> <span class="token string">"Jack"</span><span class="token punctuation">,</span> <span class="token string">"age"</span><span class="token punctuation">,</span> <span class="token string">"21"</span><span class="token punctuation">,</span> <span class="token string">"sex"</span><span class="token punctuation">,</span> <span class="token string">"male"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testMSet2</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span></span> map <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token number">3</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"name"</span><span class="token punctuation">,</span> <span class="token string">"Jack"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"age"</span><span class="token punctuation">,</span> <span class="token string">"21"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"sex"</span><span class="token punctuation">,</span> <span class="token string">"Male"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">//对Map数据进行分组。根据相同的slot放在一个分组</span>
        <span class="token comment">//key就是slot，value就是一个组</span>
        <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">,</span> <span class="token class-name">List</span><span class="token punctuation">&lt;</span><span class="token class-name">Map<span class="token punctuation">.</span>Entry</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span><span class="token punctuation">></span><span class="token punctuation">></span></span> result <span class="token operator">=</span> map<span class="token punctuation">.</span><span class="token function">entrySet</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
                <span class="token punctuation">.</span><span class="token function">stream</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
                <span class="token punctuation">.</span><span class="token function">collect</span><span class="token punctuation">(</span><span class="token class-name">Collectors</span><span class="token punctuation">.</span><span class="token function">groupingBy</span><span class="token punctuation">(</span>
                        entry <span class="token operator">-></span> <span class="token class-name">ClusterSlotHashUtil</span><span class="token punctuation">.</span><span class="token function">calculateSlot</span><span class="token punctuation">(</span>entry<span class="token punctuation">.</span><span class="token function">getKey</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">)</span>
                <span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">//串行的去执行mset的逻辑</span>
        <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Map<span class="token punctuation">.</span>Entry</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span><span class="token punctuation">></span></span> list <span class="token operator">:</span> result<span class="token punctuation">.</span><span class="token function">values</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> arr <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">String</span><span class="token punctuation">[</span>list<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">*</span> <span class="token number">2</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
            <span class="token keyword">int</span> j <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
            <span class="token keyword">for</span> <span class="token punctuation">(</span><span class="token keyword">int</span> i <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span> i <span class="token operator">&lt;</span> list<span class="token punctuation">.</span><span class="token function">size</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span> i<span class="token operator">++</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                j <span class="token operator">=</span> i<span class="token operator">&lt;&lt;</span><span class="token number">2</span><span class="token punctuation">;</span>
                <span class="token class-name">Map<span class="token punctuation">.</span>Entry</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span></span> e <span class="token operator">=</span> list<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                arr<span class="token punctuation">[</span>j<span class="token punctuation">]</span> <span class="token operator">=</span> e<span class="token punctuation">.</span><span class="token function">getKey</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                arr<span class="token punctuation">[</span>j <span class="token operator">+</span> <span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> e<span class="token punctuation">.</span><span class="token function">getValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            jedisCluster<span class="token punctuation">.</span><span class="token function">mset</span><span class="token punctuation">(</span>arr<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@AfterEach</span>
    <span class="token keyword">void</span> <span class="token function">tearDown</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>jedisCluster <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            jedisCluster<span class="token punctuation">.</span><span class="token function">close</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>Spring集群环境下批处理代码</strong></p>
<div class="language-java line-numbers-mode" data-ext="java"><pre v-pre class="language-java"><code>   <span class="token annotation punctuation">@Test</span>
    <span class="token keyword">void</span> <span class="token function">testMSetInCluster</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token punctuation">></span></span> map <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">HashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">></span></span><span class="token punctuation">(</span><span class="token number">3</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"name"</span><span class="token punctuation">,</span> <span class="token string">"Rose"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"age"</span><span class="token punctuation">,</span> <span class="token string">"21"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        map<span class="token punctuation">.</span><span class="token function">put</span><span class="token punctuation">(</span><span class="token string">"sex"</span><span class="token punctuation">,</span> <span class="token string">"Female"</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        stringRedisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">multiSet</span><span class="token punctuation">(</span>map<span class="token punctuation">)</span><span class="token punctuation">;</span>


        <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">></span></span> strings <span class="token operator">=</span> stringRedisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">multiGet</span><span class="token punctuation">(</span><span class="token class-name">Arrays</span><span class="token punctuation">.</span><span class="token function">asList</span><span class="token punctuation">(</span><span class="token string">"name"</span><span class="token punctuation">,</span> <span class="token string">"age"</span><span class="token punctuation">,</span> <span class="token string">"sex"</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        strings<span class="token punctuation">.</span><span class="token function">forEach</span><span class="token punctuation">(</span><span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token operator">::</span><span class="token function">println</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>原理分析</strong></p>
<p>在RedisAdvancedClusterAsyncCommandsImpl 类中</p>
<p>首先根据slotHash算出来一个partitioned的map，map中的key就是slot，而他的value就是对应的对应相同slot的key对应的数据</p>
<p>通过 RedisFuture&lt; String&gt; mset = super.mset(op);进行异步的消息发送</p>
<div class="language-Java line-numbers-mode" data-ext="Java"><pre v-pre class="language-Java"><code>@Override
public RedisFuture&lt;String&gt; mset(Map&lt;K, V&gt; map) {

    Map&lt;Integer, List&lt;K&gt;&gt; partitioned = SlotHash.partition(codec, map.keySet());

    if (partitioned.size() &lt; 2) {
        return super.mset(map);
    }

    Map&lt;Integer, RedisFuture&lt;String&gt;&gt; executions = new HashMap&lt;&gt;();

    for (Map.Entry&lt;Integer, List&lt;K&gt;&gt; entry : partitioned.entrySet()) {

        Map&lt;K, V&gt; op = new HashMap&lt;&gt;();
        entry.getValue().forEach(k -&gt; op.put(k, map.get(k)));

        RedisFuture&lt;String&gt; mset = super.mset(op);
        executions.put(entry.getKey(), mset);
    }

    return MultiNodeExecution.firstOfAsync(executions);
}
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="服务器端优化-持久化配置" tabindex="-1"><a class="header-anchor" href="#服务器端优化-持久化配置" aria-hidden="true">#</a> 服务器端优化-持久化配置</h2>
<p>Redis的持久化虽然可以保证数据安全，但也会带来很多额外的开销，因此持久化请遵循下列建议：</p>
<ul>
<li>用来做缓存的Redis实例尽量不要开启持久化功能</li>
<li>建议关闭RDB持久化功能，使用AOF持久化</li>
<li>利用脚本定期在slave节点做RDB，实现数据备份</li>
<li>设置合理的rewrite阈值，避免频繁的bgrewrite</li>
<li>配置no-appendfsync-on-rewrite = yes，禁止在rewrite期间做aof，避免因AOF引起的阻塞</li>
<li>部署有关建议：
<ul>
<li>Redis实例的物理机要预留足够内存，应对fork和rewrite</li>
<li>单个Redis实例内存上限不要太大，例如4G或8G。可以加快fork的速度、减少主从同步、数据迁移压力</li>
<li>不要与CPU密集型应用部署在一起</li>
<li>不要与高硬盘负载应用一起部署。例如：数据库、消息队列</li>
</ul>
</li>
</ul>
<h2 id="服务器端优化-慢查询优化" tabindex="-1"><a class="header-anchor" href="#服务器端优化-慢查询优化" aria-hidden="true">#</a> 服务器端优化-慢查询优化</h2>
<h3 id="什么是慢查询" tabindex="-1"><a class="header-anchor" href="#什么是慢查询" aria-hidden="true">#</a> 什么是慢查询</h3>
<p>并不是很慢的查询才是慢查询，而是：在Redis执行时耗时超过某个阈值的命令，称为慢查询。</p>
<p>慢查询的危害：由于Redis是单线程的，所以当客户端发出指令后，他们都会进入到redis底层的queue来执行，如果此时有一些慢查询的数据，就会导致大量请求阻塞，从而引起报错，所以我们需要解决慢查询问题。</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102102.png" alt="1653129590210" style="zoom:67%;" />
<p>慢查询的阈值可以通过配置指定：</p>
<p>slowlog-log-slower-than：慢查询阈值，单位是微秒。默认是10000，建议1000</p>
<p>慢查询会被放入慢查询日志中，日志的长度有上限，可以通过配置指定：</p>
<p>slowlog-max-len：慢查询日志（本质是一个队列）的长度。默认是128，建议1000</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102185.png" alt="1653130457771" style="zoom:67%;" />
<p>修改这两个配置可以使用：config set命令：</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102330.png" alt="1653130475979" style="zoom:50%;" />
<h3 id="如何查看慢查询" tabindex="-1"><a class="header-anchor" href="#如何查看慢查询" aria-hidden="true">#</a> 如何查看慢查询</h3>
<p>知道了以上内容之后，那么咱们如何去查看慢查询日志列表呢：</p>
<ul>
<li>slowlog len：查询慢查询日志长度</li>
<li>slowlog get [n]：读取n条慢查询日志</li>
<li>slowlog reset：清空慢查询列表</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102831.png" alt="1653130858066" style="zoom:50%;" />
<h2 id="服务器端优化-命令及安全配置" tabindex="-1"><a class="header-anchor" href="#服务器端优化-命令及安全配置" aria-hidden="true">#</a> 服务器端优化-命令及安全配置</h2>
<p>安全可以说是服务器端一个非常重要的话题，如果安全出现了问题，那么一旦这个漏洞被一些坏人知道了之后，并且进行攻击，那么这就会给咱们的系统带来很多的损失，所以我们这节课就来解决这个问题。</p>
<p>Redis会绑定在0.0.0.0:6379，这样将会将Redis服务暴露到公网上，而Redis如果没有做身份认证，会出现严重的安全漏洞.
漏洞重现方式：<a href="https://cloud.tencent.com/developer/article/1039000" target="_blank" rel="noopener noreferrer">https://cloud.tencent.com/developer/article/1039000<ExternalLinkIcon/></a></p>
<p>为什么会出现不需要密码也能够登录呢，主要是Redis考虑到每次登录都比较麻烦，所以Redis就有一种ssh免秘钥登录的方式，生成一对公钥和私钥，私钥放在本地，公钥放在redis端，当我们登录时服务器，再登录时候，他会去解析公钥和私钥，如果没有问题，则不需要利用redis的登录也能访问，这种做法本身也很常见，但是这里有一个前提，前提就是公钥必须保存在服务器上，才行，但是Redis的漏洞在于在不登录的情况下，也能把秘钥送到Linux服务器，从而产生漏洞</p>
<p>漏洞出现的核心的原因有以下几点：</p>
<ul>
<li>Redis未设置密码</li>
<li>利用了Redis的config set命令动态修改Redis配置</li>
<li>使用了Root账号权限启动Redis</li>
</ul>
<p>所以：如何解决呢？我们可以采用如下几种方案</p>
<p>为了避免这样的漏洞，这里给出一些建议：</p>
<ul>
<li>Redis一定要设置密码</li>
<li>禁止线上使用下面命令：keys、flushall、flushdb、config set等命令。可以利用rename-command禁用。</li>
<li>bind：限制网卡，禁止外网网卡访问</li>
<li>开启防火墙</li>
<li>不要使用Root账户启动Redis</li>
<li>尽量不是有默认的端口</li>
</ul>
<h2 id="服务器端优化-redis内存划分和内存配置" tabindex="-1"><a class="header-anchor" href="#服务器端优化-redis内存划分和内存配置" aria-hidden="true">#</a> 服务器端优化-Redis内存划分和内存配置</h2>
<p>当Redis内存不足时，可能导致Key频繁被删除、响应时间变长、QPS不稳定等问题。当内存使用率达到90%以上时就需要我们警惕，并快速定位到内存占用的原因。</p>
<p><strong>有关碎片问题分析</strong></p>
<p>Redis底层分配并不是这个key有多大，他就会分配多大，而是有他自己的分配策略，比如8,16,20等等，假定当前key只需要10个字节，此时分配8肯定不够，那么他就会分配16个字节，多出来的6个字节就不能被使用，这就是我们常说的 碎片问题</p>
<p><strong>进程内存问题分析：</strong></p>
<p>这片内存，通常我们都可以忽略不计</p>
<p><strong>缓冲区内存问题分析：</strong></p>
<p>一般包括客户端缓冲区、AOF缓冲区、复制缓冲区等。客户端缓冲区又包括输入缓冲区和输出缓冲区两种。这部分内存占用波动较大，所以这片内存也是我们需要重点分析的内存问题。</p>
<table>
<thead>
<tr>
<th><strong>内存占用</strong></th>
<th><strong>说明</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>数据内存</td>
<td>是Redis最主要的部分，存储Redis的键值信息。主要问题是BigKey问题、内存碎片问题</td>
</tr>
<tr>
<td>进程内存</td>
<td>Redis主进程本身运⾏肯定需要占⽤内存，如代码、常量池等等；这部分内存⼤约⼏兆，在⼤多数⽣产环境中与Redis数据占⽤的内存相⽐可以忽略。</td>
</tr>
<tr>
<td>缓冲区内存</td>
<td>一般包括客户端缓冲区、AOF缓冲区、复制缓冲区等。客户端缓冲区又包括输入缓冲区和输出缓冲区两种。这部分内存占用波动较大，不当使用BigKey，可能导致内存溢出。</td>
</tr>
</tbody>
</table>
<p>于是我们就需要通过一些命令，可以查看到Redis目前的内存分配状态：</p>
<ul>
<li>info memory：查看内存分配的情况</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102591.png" alt="1653132073570" style="zoom:50%;" />
<ul>
<li>memory xxx：查看key的主要占用情况</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102576.png" alt="1653132098823" style="zoom:50%;" />
<p>接下来我们看到了这些配置，最关键的缓存区内存如何定位和解决呢？</p>
<p>内存缓冲区常见的有三种：</p>
<ul>
<li>复制缓冲区：主从复制的repl_backlog_buf，如果太小可能导致频繁的全量复制，影响性能。通过replbacklog-size来设置，默认1mb</li>
<li>AOF缓冲区：AOF刷盘之前的缓存区域，AOF执行rewrite的缓冲区。无法设置容量上限</li>
<li>客户端缓冲区：分为输入缓冲区和输出缓冲区，输入缓冲区最大1G且不能设置。输出缓冲区可以设置</li>
</ul>
<p>以上复制缓冲区和AOF缓冲区 不会有问题，最关键就是客户端缓冲区的问题</p>
<p>客户端缓冲区：指的就是我们发送命令时，客户端用来缓存命令的一个缓冲区，也就是我们向redis输入数据的输入端缓冲区和redis向客户端返回数据的响应缓存区，输入缓冲区最大1G且不能设置，所以这一块我们根本不用担心，如果超过了这个空间，redis会直接断开，因为本来此时此刻就代表着redis处理不过来了，我们需要担心的就是输出端缓冲区</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102565.png" alt="1653132410073" loading="lazy"></p>
<p>我们在使用redis过程中，处理大量的big value，那么会导致我们的输出结果过多，如果输出缓存区过大，会导致redis直接断开，而默认配置的情况下， 其实他是没有大小的，这就比较坑了，内存可能一下子被占满，会直接导致咱们的redis断开，所以解决方案有两个</p>
<p>1、设置一个大小</p>
<p>2、增加我们带宽的大小，避免我们出现大量数据从而直接超过了redis的承受能力</p>
<h2 id="服务器端集群优化-集群还是主从" tabindex="-1"><a class="header-anchor" href="#服务器端集群优化-集群还是主从" aria-hidden="true">#</a> 服务器端集群优化-集群还是主从</h2>
<p>集群虽然具备高可用特性，能实现自动故障恢复，但是如果使用不当，也会存在一些问题：</p>
<ul>
<li>集群完整性问题</li>
<li>集群带宽问题</li>
<li>数据倾斜问题</li>
<li>客户端性能问题</li>
<li>命令的集群兼容性问题</li>
<li>lua和事务问题</li>
</ul>
<p><strong>问题1、在Redis的默认配置中，如果发现任意一个插槽不可用，则整个集群都会停止对外服务：</strong></p>
<p>大家可以设想一下，如果有几个slot不能使用，那么此时整个集群都不能用了，我们在开发中，其实最重要的是可用性，所以需要把如下配置修改成no，即有slot不能使用时，我们的redis集群还是可以对外提供服务</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212131102593.png" alt="1653132740637" style="zoom:50%;" />
<p><strong>问题2、集群带宽问题</strong></p>
<p>集群节点之间会不断的互相Ping来确定集群中其它节点的状态。每次Ping携带的信息至少包括：</p>
<ul>
<li>插槽信息</li>
<li>集群状态信息</li>
</ul>
<p>集群中节点越多，集群状态信息数据量也越大，10个节点的相关信息可能达到1kb，此时每次集群互通需要的带宽会非常高，这样会导致集群中大量的带宽都会被ping信息所占用，这是一个非常可怕的问题，所以我们需要去解决这样的问题</p>
<p><strong>解决途径：</strong></p>
<ul>
<li>避免大集群，集群节点数不要太多，最好少于1000，如果业务庞大，则建立多个集群。</li>
<li>避免在单个物理机中运行太多Redis实例</li>
<li>配置合适的cluster-node-timeout值</li>
</ul>
<p><strong>问题3、命令的集群兼容性问题</strong></p>
<p>有关这个问题咱们已经探讨过了，当我们使用批处理的命令时，redis要求我们的key必须落在相同的slot上，然后大量的key同时操作时，是无法完成的，所以客户端必须要对这样的数据进行处理，这些方案我们之前已经探讨过了，所以不再这个地方赘述了。</p>
<p><strong>问题4、lua和事务的问题</strong></p>
<p>lua和事务都是要保证原子性问题，如果你的key不在一个节点，那么是无法保证lua的执行和事务的特性的，所以在集群模式是没有办法执行lua和事务的</p>
<p><strong>那我们到底是集群还是主从</strong></p>
<p>单体Redis（主从Redis）已经能达到万级别的QPS，并且也具备很强的高可用特性。如果主从能满足业务需求的情况下，所以如果不是在万不得已的情况下，尽量不搭建Redis集群</p>
</div></template>


