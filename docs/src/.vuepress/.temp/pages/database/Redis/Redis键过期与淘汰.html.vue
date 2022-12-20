<template><div><h2 id="redis-内存存满会出现的问题" tabindex="-1"><a class="header-anchor" href="#redis-内存存满会出现的问题" aria-hidden="true">#</a> Redis 内存存满会出现的问题</h2>
<p><strong>Redism默认的内存大小</strong></p>
<p>如果不设置内存大小或是设置最大内存大小为0，在64位的操作系统下不限制内存大小，在32位操作系统下最多使用3GB内存</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211300629597.png" alt="image-20221130062911071" loading="lazy"></p>
<p><strong>生产环境如何配置Redis的内存大小</strong></p>
<p>在生产环境当中，一般推荐把Redis内存设置为最大物理内存的四分之三</p>
<p><strong>修改Redis内存设置的方法</strong></p>
<ul>
<li>
<p>通过修改redis.conf来配置</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211300634913.png" alt="image-20221130062911071" loading="lazy"></p>
</li>
<li>
<p>通过命令修改</p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token comment">#修改内存大小</span>
config <span class="token builtin class-name">set</span> maxmemory <span class="token number">104857600</span>
<span class="token comment">#查看修改后的内存大小</span>
config get maxmemory 
<span class="token comment">#查看redis内存使用情况</span>
info memory
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li>
</ul>
<p><strong>Redis内存超过最大设置值会出现的问题</strong></p>
<p>将Redis配置文件的最大内存修改为1字节，通过set key value 可以发现当Redis内存超过最大值会抛出一个异常</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211300637882.png" alt="image-20221130063742845" loading="lazy"></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211300637980.png" alt="image-20221130063737943" loading="lazy"></p>
<h2 id="键过期删除策略" tabindex="-1"><a class="header-anchor" href="#键过期删除策略" aria-hidden="true">#</a> 键过期删除策略</h2>
<p>键过期策略针对的是设置了过期时间的key，因为你设置的key即使过期了，也不会立即被删除。</p>
<h3 id="定时删除" tabindex="-1"><a class="header-anchor" href="#定时删除" aria-hidden="true">#</a> 定时删除</h3>
<p>在设置键的过期时间的同时，创建一个定时器（timer），让定时器在键的过期时间来临时，立即执行对键的删除操作</p>
<p><strong>优点：</strong></p>
<p>定时删除策略对内存是友好的：通过使用定时器，定时删除策略可以保证过期键会尽快可能地被删除，并释放过期键所占用的内存</p>
<p><strong>缺点：</strong></p>
<p>对CPU不友好，在过期键比较多的情况下，删除过期键这一行为可能会占用相当一部分CPU时间，在内存不紧张但CPU时间非常紧张的情况下，将CPU时间用在删除和当前任务无关的过期键上，无疑会对服务器的响应时间和吞吐量造成影响。</p>
<blockquote>
<p>定时删除策略是以时间换取空间的方法</p>
</blockquote>
<h3 id="惰性删除" tabindex="-1"><a class="header-anchor" href="#惰性删除" aria-hidden="true">#</a> 惰性删除</h3>
<p>放任键过期不管，但是每次从键空间中获取键时，都检查取得的键释放过期，如果过期的话就删除该键，如果没有过期，就返回该键</p>
<p><strong>优点：</strong></p>
<p>惰性删除策略对CPU时间来说是友好的，程序只会在取出键时才对键进行过期检查，这可以保证删除过期键的操作只会在非做不可的情况下进行，并且删除的目标仅限于当前处理的检查，不会再删除其他无关的键上花费任何CPU的时间</p>
<p><strong>缺点：</strong></p>
<p>对内存不友好，如果一个键过期，而这个键又仍然保存在数据库中，那么只要这个过期键不被删除，它所占用的内存就不会释放。如果数据库中有非常多的过期键，而这些过期键恰好没有被访问到的话，那么它们就永远无法被删除（除非用户手动执行FlUSHDB），我们甚至可以将这种情况看作是一种内存泄漏——无用的垃圾数据占用了大量的内存，而服务器却不会自己去释放它们。</p>
<blockquote>
<p>惰性删除策略是时以空间换时间的方法</p>
</blockquote>
<h3 id="定期删除策略" tabindex="-1"><a class="header-anchor" href="#定期删除策略" aria-hidden="true">#</a> 定期删除策略</h3>
<p>每隔一段时间，程序就对数据库进行一次检查，删除里面的过期键。至于要删除多少过期键，以及要检查多少个数据库，则由算法决定。</p>
<p>定时策略是前两种策略一种整合和折中</p>
<ul>
<li>定期删除策略每隔一段时间执行一次删除过键的操作，并通过限制删除操作和执行的时长和频率来减少删除操作对CPU时间的影响</li>
<li>通过定期删除过期键，定时删除策略有效地减少了因为过期键而带来的内存浪费。</li>
</ul>
<p><strong>定期删除策略的难点：</strong></p>
<ul>
<li>如果删除操作执行得太频繁，或者执行的时间太长，定期删除策略就会退化成定时删除策略，以至于将CPU时间过多地消耗在删除键上面</li>
<li>如何删除操作执行得太少，或执行的时间太短，定期删除策略又会和惰性删除策略一样，出现浪费内存的情况</li>
</ul>
<h2 id="缓存淘汰策略" tabindex="-1"><a class="header-anchor" href="#缓存淘汰策略" aria-hidden="true">#</a> 缓存淘汰策略</h2>
<p>缓存淘汰策略是指当 Redis 内存超出设置的 maxmemory 的值时，会根据用户使用的缓存淘汰策略，删除一部分缓存（即使你的key没有设置过期时间，依然会被清除），从而腾出一部分内存空间，提供正常的读写服务。</p>
<h3 id="缓存淘汰策略的种类" tabindex="-1"><a class="header-anchor" href="#缓存淘汰策略的种类" aria-hidden="true">#</a> 缓存淘汰策略的种类</h3>
<ul>
<li>noeviction: 不会驱逐任何key <code v-pre>[配置文件默认使用]</code></li>
<li>allkeys-lru: 对所有key使用LRU算法进行删除 <code v-pre>[推荐使用]</code></li>
<li>volatile-lru: 对所有设置了过期时间的key使用LRU算法进行删除</li>
<li>allkeys-random: 对所有key随机删除</li>
<li>volatile-random: 对所有设置了过期时间的key随机删除</li>
<li>volatile-ttl: 删除马上要过期的key</li>
<li>allkeys-lfu: 对所有key使用LFU算法进行删除</li>
<li>volatile-lfu: 对所有设置了过期时间的key使用LFU算法进行删除</li>
</ul>
<blockquote>
<p>总结：</p>
<ul>
<li>二个纬度
<ul>
<li>过期键中筛选</li>
<li>所有键中筛选</li>
</ul>
</li>
<li>4个方面
<ul>
<li>LRU[最近最少使用]</li>
<li>LFU[最不经常使用页置换算法]</li>
<li>random</li>
<li>ttl</li>
</ul>
</li>
</ul>
</blockquote>
<h3 id="使用场景" tabindex="-1"><a class="header-anchor" href="#使用场景" aria-hidden="true">#</a> 使用场景</h3>
<ul>
<li>
<p>如果分为一般的热数据和冷数据，<strong>那么我们都推荐使用 allkeys-lru 策略</strong>，其中一部分key经常被读写，如果在不确定业务的情况下，allkeys-lru是一个比较好的选择（<strong>被淘汰的冷数据如果又要再次被访问，则可以通过业务逻辑代码重新读入缓存中</strong>）。</p>
</li>
<li>
<p><strong>如果各个key访问的频率差不多，则可以使用 allkeys-random 策略, 即读写所有元素的概率差不多。</strong></p>
</li>
<li>
<p>如果要让 redis 根据 ttl 来筛选要删除的key，请使用 volatile-ttl 策略。</p>
</li>
<li>
<p>volatile-lru 和 volatile-random 策略应用场景是: <strong>既有要过期的key,又有持久key的实例中。 对于这类场景，我们一般使用两个单独的redis。</strong></p>
</li>
</ul>
<h3 id="修改redis缓存淘汰策略" tabindex="-1"><a class="header-anchor" href="#修改redis缓存淘汰策略" aria-hidden="true">#</a> 修改Redis缓存淘汰策略</h3>
<p>进入redis.conf 找到 maxmemory-policy 就可以修改相关配置</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211300837879.png" alt="image-20221130083719819" loading="lazy"></p>
</div></template>


