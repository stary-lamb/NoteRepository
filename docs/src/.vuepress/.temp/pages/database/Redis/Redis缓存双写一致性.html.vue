<template><div><h2 id="缓存双写一致性" tabindex="-1"><a class="header-anchor" href="#缓存双写一致性" aria-hidden="true">#</a> 缓存双写一致性</h2>
<p>我们在使用缓存之后，就可能存在缓存与数据库双存储双写，<strong>当我们双写，就会出现数据一致性的问题</strong> 即是当要进行双写的时候，我们是先更新缓存 Redis 还是 先更新我们的数据库？</p>
<p><strong>缓存双写一致性要确保：</strong></p>
<ul>
<li>当 Redis 中有数据的时候，Redis 中的数据与数据库中的数据要保持一致。</li>
<li>当 Redis 中没有数据的时候，数据库中的数据是最新值。</li>
</ul>
<p><strong>缓存按照操作来分，有细分2种</strong></p>
<ul>
<li>只读缓存</li>
<li>读写缓存
<ul>
<li>同步直写策略：写缓存时也同步写数据库，缓存和数据库中的数据⼀致</li>
<li>对于读写缓存来说，要想保证缓存和数据库中的数据⼀致，就要采⽤同步直写策略</li>
</ul>
</li>
</ul>
<h2 id="先更新数据库-再更新缓存" tabindex="-1"><a class="header-anchor" href="#先更新数据库-再更新缓存" aria-hidden="true">#</a> 先更新数据库，再更新缓存</h2>
<p>🌰比如「请求 A 」和「请求 B 」两个请求，同时更新「同一条」数据，则可能出现这样的顺序：</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082104208.png" alt="image-20221208210435151" style="zoom:50%;" />
<p>A 请求先将数据库的数据更新为 1，然后 <strong>A 受网络波动等因素更新缓存还没结束</strong>，这是请求 B 将数据库的数据更新为 2，紧接着也把缓存更新为 2，然后 A 请求才更新缓存为 1。</p>
<p>此时，数据库中的数据是 2，而缓存中的数据却是 1，<strong>出现了缓存和数据库中的数据不一致的现象</strong>。</p>
<h2 id="先删除缓存-再更新数据库" tabindex="-1"><a class="header-anchor" href="#先删除缓存-再更新数据库" aria-hidden="true">#</a> 先删除缓存，再更新数据库</h2>
<p>🌰比如「请求 A 」和「请求 B 」两个请求，「请求 A 」更新数据库的数据，「请求 B 」读取与 请求A 同一条数据，则可能出现这样的顺序：</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082156050.png" alt="image-20221208215619992" style="zoom:67%;" />
<p>A 请求先成功删除了 redis 里面的数据，然后去 mysql 更新该值为2，<strong>但 A 受网络波动等因素 mysql 更新还没有结束</strong>，B 突然出现要来读取缓存数据，此时 redis 中的数据是空，所以缓存未命中，请求B继续到 mysql 中读，此时读取到的是旧值 1，同时将这个旧值又重新回写的 redis 当中。</p>
<p>此时数据库中的数据为 2，而 缓存中的数据为 1，<strong>出现了缓存和数据库中的数据不一致的现象</strong>。</p>
<h4 id="延时双删策略" tabindex="-1"><a class="header-anchor" href="#延时双删策略" aria-hidden="true">#</a> 延时双删策略</h4>
<p><strong>我们可以通过第一次删除缓存值后，延迟一段时间再次进行删除，来避免上述问题，这种方法也称为 “延迟双删”。</strong></p>
<p>步骤如下：</p>
<ol>
<li>先让 线程A 先成功删除缓存中的数据，线程A 再去更新mysql</li>
<li>让线程睡眠一定的时间</li>
<li>再让 线程A 把缓存中的数据删除</li>
</ol>
<p>加上睡眠时间的意义就是为了能让 线程B 能够先从数据库读取数据，再把缺失的数据写入到缓存当中，然后 线程A 在进行删除，但是 线程A sleep的时间，需要大于线程B读取数据再写入缓存时间，这样一来，其它线程读取数据时，就会发现缓存缺失，就会从数据库中读取到最新的数据值。</p>
<blockquote>
<p><strong>1. 删除该休眠需要定义为多久？</strong></p>
<p>在业务程序运行的时候，统计下线程读数据和写缓存的操作时间，自行评估自己的项目的读数据业务逻辑的耗时，以此为基础来进行估算。然后写数据的休眠时间则在读数据业务逻辑的耗时基础上加百毫秒即可。</p>
<p><strong>2. 如果在mysql主从读写分离架构是否出现上述问题，若出现该如何解决？</strong></p>
<p>（1）请求A进行写操作，删除缓存
（2）请求A将数据写入数据库了，
（3）请求B查询缓存发现，缓存没有值
（4）请求B去从库查询，这时，还没有完成主从同步，因此查询到的是旧值
（5）请求B将旧值写入缓存
（6）数据库完成主从同步，从库变为新值 上述情形，就是数据不一致的原因。还是使用双删延时策略。</p>
<p>只是，睡眠时间修改为在主从同步的延时时间基础上，加几百ms</p>
<p><strong>3. 这种同步淘汰策略，吞吐量降低怎么办？</strong></p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082149603.png" alt="image-20221208214956538" style="zoom:50%;" />
</blockquote>
<h2 id="先更新数据库-在删除缓存" tabindex="-1"><a class="header-anchor" href="#先更新数据库-在删除缓存" aria-hidden="true">#</a> 先更新数据库，在删除缓存</h2>
<p>🌰比如「请求 A 」和「请求 B 」两个请求，「请求 A 」更新数据库的数据，「请求 B 」读取与 请求A 同一条数据，则可能出现这样的顺序：</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082156289.png" alt="image-20221208215635230" style="zoom:67%;" />
<p>A 请求先成功更新了 redis 里面的数据，然后去缓存中删除数据，<strong>但 A 受网络波动等因素 缓存删除还没有结束</strong>，B 突然出现要来读取缓存数据，此时 redis 中的数据是旧值1。</p>
<h3 id="解决方案" tabindex="-1"><a class="header-anchor" href="#解决方案" aria-hidden="true">#</a> 解决方案</h3>
<h4 id="消息队列" tabindex="-1"><a class="header-anchor" href="#消息队列" aria-hidden="true">#</a> 消息队列</h4>
<ol>
<li>可以把要删除的缓存值或者是要更新的数据库值暂存到消息队列中（例如使用Kafka/RabbitMQ等）。</li>
<li>当程序没有能够成功地删除缓存值或者是更新数据库值时，可以从消息队列中重新读取这些值，然后再次进行删除或更新。</li>
<li>如果能够成功地删除或更新，我们就要把这些值从消息队列中去除，以免重复操作，此时，我们也可以保证数据库和缓存的数据一致了，否则还需要再次进行重试</li>
<li>如果重试超过的一定次数后还是没有成功，我们就需要向业务层发送报错信息了，通知运维人员。</li>
</ol>
<h4 id="订阅-mysql-binlog-再操作缓存" tabindex="-1"><a class="header-anchor" href="#订阅-mysql-binlog-再操作缓存" aria-hidden="true">#</a> 订阅 MySQL binlog，再操作缓存</h4>
<p>「<strong>先更新数据库，再删缓存</strong>」的策略的第一步是更新数据库，那么更新数据库成功，就会产生一条变更日志，记录在 binlog 里。</p>
<p>于是我们就可以通过订阅 binlog 日志，拿到具体要操作的数据，然后再执行缓存删除，阿里巴巴开源的 Canal 中间件就是基于这个实现的。</p>
<p>Canal 模拟 MySQL 主从复制的交互协议，把自己伪装成一个 MySQL 的从节点，向 MySQL 主节点发送 dump 请求，MySQL 收到请求后，就会开始推送 Binlog 给 Canal，Canal 解析 Binlog 字节流之后，转换为便于读取的结构化数据，供下游程序订阅使用。</p>
<p>下图是 Canal 的工作原理：</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212082243251.png" alt="image-20221208224323199" loading="lazy"></p>
<h4 id="小结" tabindex="-1"><a class="header-anchor" href="#小结" aria-hidden="true">#</a> 小结</h4>
<p>​	<strong>如果要想保证「先更新数据库，再删缓存」策略第二个操作能执行成功，我们可以使用「消息队列来重试缓存的删除」，或者「订阅 MySQL binlog 再操作缓存」，这两种方法有一个共同的特点，都是采用异步操作缓存。</strong></p>
<h2 id="先删缓存-再更新数据库-与-先更新数据库-再删缓存-选择" tabindex="-1"><a class="header-anchor" href="#先删缓存-再更新数据库-与-先更新数据库-再删缓存-选择" aria-hidden="true">#</a> 先删缓存，再更新数据库 与 先更新数据库，再删缓存 选择</h2>
<p>在大多数业务场景下，我们会把Redis作为只读缓存使用。假如定位是只读缓存来说，理论上我们既可以先删除缓存值再更新数据库，也可以先更新数据库再删除缓存，但是没有完美方案，两害相衡趋其轻的原则。</p>
<p><strong>优先使用先更新数据库，再删除缓存的方案。理由如下：</strong></p>
<ol>
<li>先删除缓存值再更新数据库，有可能导致请求因缓存缺失而访问数据库，给数据库带来压力，严重导致打满 mysql。</li>
<li>如果业务应用中读取数据库和写缓存的时间不好估算，那么，延迟双删中的等待时间就不好设置。</li>
</ol>
<blockquote>
<p><strong>如果使用先更新数据库，再删除缓存的方案</strong>
如果业务层要求必须读取一致性的数据，那么我们就需要在更新数据库时，先在Redis缓存客户端暂存并发读请求，等数据库更新完、缓存值删除后，再读取数据，从而保证数据一致性。</p>
</blockquote>
<h2 id="小结-1" tabindex="-1"><a class="header-anchor" href="#小结-1" aria-hidden="true">#</a> 小结</h2>
<table>
<thead>
<tr>
<th>操作顺序</th>
<th>是否有发请求</th>
<th>潜在问题</th>
<th>现象</th>
<th>解决方案</th>
</tr>
</thead>
<tbody>
<tr>
<td>先删除缓存，再更新数据库</td>
<td>无</td>
<td>缓存删除成功，但数据库更新失败</td>
<td>应用从数据库中读取到旧数据</td>
<td>重试数据库更新</td>
</tr>
<tr>
<td></td>
<td>有</td>
<td>缓存删除后，尚未更新数据库，有并发请求</td>
<td>并发请求从数据库读取到旧值，并且更新到缓存，导致后续请求都读取到旧值</td>
<td>延迟双删</td>
</tr>
<tr>
<td>先更新数据库，再删除缓存</td>
<td>无</td>
<td>数据库更新成功，但缓存删除失败</td>
<td>应用从缓存中读取到旧数据</td>
<td>重试缓存删除</td>
</tr>
<tr>
<td></td>
<td>有</td>
<td>数据库更新成功后，尚未删除缓存，有并发请求</td>
<td>并发请求从缓存中读取到旧值</td>
<td>等待缓存删除完成，期间会有不一致数据短暂存在</td>
</tr>
</tbody>
</table>
</div></template>


