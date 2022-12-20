<template><div><h2 id="基本介绍" tabindex="-1"><a class="header-anchor" href="#基本介绍" aria-hidden="true">#</a> 基本介绍</h2>
<p>布隆过滤器（Bloom Filter）是 1970 年由布隆提出的，<strong>它实际上是一个很长的二进制数组+一系列 Hash 算法映射函数，主要用于判断一个元素是否在集合中</strong>。</p>
<p>通常我们会遇到很多要判断一个元素是否在某个集合中的业务场景，一般想到的是将集合中所有元素保存起来，然后比较确定，像<code v-pre>链表[O(n)]</code>、<code v-pre>树[O(logn)]</code>、<code v-pre>散列表[O(1)]</code>等等数据结构几个都是这种思路，但是随着集合中元素的增加，需要的存储空间也会呈线性增长，最终达到瓶颈。同时检索的速度也会越来越慢，布隆过滤器就应运而生了。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211240624565.png" alt="" loading="lazy"></p>
<div style="text-align:center;color: #999;padding: 2px;">布隆过滤器结构</div>
<h2 id="布隆过滤器特点" tabindex="-1"><a class="header-anchor" href="#布隆过滤器特点" aria-hidden="true">#</a> 布隆过滤器特点</h2>
<ul>
<li>高效地插入和查询，占用空间少，返回结果是不确定的</li>
<li>一个元素如果判断结果为存在的时候元素不一定存在，但是判断结果不存在的时候则一定不存在。</li>
<li>布隆过滤器可以添加元素，但是不能删除元素。因为删除掉元素会导致误判率增加</li>
<li>误判只会发生在过滤器没有添加过的元素，对于添加过的元素不会发生误判</li>
</ul>
<blockquote>
<p>小结：</p>
<ul>
<li>有，是很可能有</li>
<li>无，是肯定无：可以保证的是，如果布隆过滤器判断一个元素不在一个集合中，那这个元素一定不会在集合中</li>
</ul>
</blockquote>
<h2 id="原理" tabindex="-1"><a class="header-anchor" href="#原理" aria-hidden="true">#</a> 原理</h2>
<p>布隆过滤器(Bloom Filter)是一种专门来解决去重问题的高级数据结构。实质就是一个大型位数组和几个不同的无偏 Hash 函数(无偏表示分布均匀)。由一个初值为零的 bit 数组和多个 Hash 函数构成，用来快速判断某个数据是否存在。但是跟 HyperLogLog 一样，它的数据不是精确的，也存在着一定的误判率。</p>
<h3 id="初始化" tabindex="-1"><a class="header-anchor" href="#初始化" aria-hidden="true">#</a> 初始化</h3>
<p>布隆过滤器本质上是由长度为 m 的位向量或位列表（仅包含 0 或 1 位值的列表）组成，最初所有的值均设置为 0</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211240702960.png" alt="image-20221124070227904" loading="lazy"></p>
<div style="text-align:center;color: #999;padding: 2px;">布隆过滤器 初始化</div>
<h3 id="添加" tabindex="-1"><a class="header-anchor" href="#添加" aria-hidden="true">#</a> 添加</h3>
<p>当我们想布隆过滤器中添加数据时，为了尽量避免 Hash 冲突，会使用多个 Hash 函数对 key 进行 Hash 运算，算得一个整数索引值，然后对位数组长度进行取模运算得到一个位置，每个 Hash 函数都会得到一个不同的位置，再把位数组的这个几个位置都置为 1 就完成了添加的操作。</p>
<p>🌰：添加一个字符串 bulongguolvqi</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211240714367.png" alt="image-20221124071421313" loading="lazy"></p>
<div style="text-align:center;color: #999;padding: 2px;">布隆过滤器 添加操作</div>
<h3 id="判断是否存在" tabindex="-1"><a class="header-anchor" href="#判断是否存在" aria-hidden="true">#</a> 判断是否存在</h3>
<p>向布隆过滤器查询某个 key 是否存在时，先把这个 key 通过相同的<strong>多个 Hash 函数进行运算，查看对应的位置是否都为 1，只要有一个位置为 0，那么说明布隆过滤器中这个 key 不存在，如果这几个位置全都是 1，那么说明极有可能存在</strong>，有可能这些位置的 1 是因为其他 key 所导致的，也就是前面所说的 Hash 冲突。</p>
<p>🌰：添加字符串 bulongguolvqi 数据之后，1/3/5 这几个位置都置为 1 了，但此时查询从未添加过的 key <code v-pre>index-key</code>，它有可能计算后坑位也就是 1/3/5，此时就产生了误判。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211240732773.png" alt="image-20221124073238718" loading="lazy"></p>
<h3 id="使用布隆过滤不能删除的原因" tabindex="-1"><a class="header-anchor" href="#使用布隆过滤不能删除的原因" aria-hidden="true">#</a> 使用布隆过滤不能删除的原因</h3>
<p>布隆过滤器的误判指的是多个输入进行 Hash 运算之后再相同的 bit 位置置于 1 了，这就无法判断究竟是哪个输入产生的，通俗来说就是相同 bit 位被多次映射置为 1 了，所以这种情况也就造成布隆过滤器不能删除的问题，它每一个 bit 并不是独占的，很有可能是多个元素共享了某一位，倘如直接删除这一位的话，会影响到其他的元素。</p>
<h3 id="小结" tabindex="-1"><a class="header-anchor" href="#小结" aria-hidden="true">#</a> 小结</h3>
<ol>
<li>使用时最好不要让实际元素数量远大于初始化数量</li>
<li>当实际元素数量超过初始化数量时，应对布隆过滤器进行重建，重新分配一个 size 更大的过滤器，再将所以的历史元素批量 add 进去</li>
</ol>
<h2 id="优缺点及使用场景" tabindex="-1"><a class="header-anchor" href="#优缺点及使用场景" aria-hidden="true">#</a> 优缺点及使用场景</h2>
<h3 id="优缺点" tabindex="-1"><a class="header-anchor" href="#优缺点" aria-hidden="true">#</a> 优缺点</h3>
<ul>
<li>优点：高效插入和查询，占用空间少</li>
<li>缺点：
<ul>
<li>不能删除元素，删除会导致误判率的增加</li>
<li>存在误判，不同的数据可能出来相同的 Hash 值</li>
</ul>
</li>
</ul>
<h3 id="应用场景" tabindex="-1"><a class="header-anchor" href="#应用场景" aria-hidden="true">#</a> 应用场景</h3>
<ul>
<li>
<p>黑白名单</p>
<p>把所有黑名单都放在布隆过滤器当中，在收到邮件时，判断邮件地址是否存在布隆过滤器中即可。</p>
</li>
<li>
<p>解决缓存穿透问题</p>
<p>我们可以在把数据写入数据库的时，使用布隆过滤器做个标记。当缓存缺失后，应用查询数据库时，可以通过布隆过滤器快速判断数据是否存在。如果不存在，就再去数据库中查询了。这样一来，即使发生缓存穿透了，大量的请求只会擦好像 Redis 和布隆过滤器，而不会积压到数据库，也就不会影响数据库的正常运行。布隆过滤器可以使用 Redis 实现，本身就能承担较大的并发访问压力。</p>
</li>
</ul>
<p><RouterLink to="/database/Redis/Redis%E7%BC%93%E5%AD%98%E9%9B%AA%E5%B4%A9%E3%80%81%E7%BC%93%E5%AD%98%E7%A9%BF%E9%80%8F%E3%80%81%E7%BC%93%E5%AD%98%E5%87%BB%E7%A9%BF.html">具体实现请看缓存雪崩、缓存穿透、缓存击穿</RouterLink></p>
<h2 id="布谷鸟过滤" tabindex="-1"><a class="header-anchor" href="#布谷鸟过滤" aria-hidden="true">#</a> 布谷鸟过滤</h2>
<p>为了解决布隆过滤器不能删除元素的问题，布谷鸟过滤器横空出世。论文《Cuckoo Filter：Better Than Bloom》作者将布谷鸟过滤器和布隆过滤器进行了深入的对比。相比布谷鸟过滤器而言布隆过滤器有以下不足：查询性能弱、空间利用效率低、不支持反向操作（删除）以及不支持计数。</p>
</div></template>


