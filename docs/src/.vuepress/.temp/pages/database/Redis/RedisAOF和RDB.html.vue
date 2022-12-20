<template><div><h2 id="rdb" tabindex="-1"><a class="header-anchor" href="#rdb" aria-hidden="true">#</a> RDB</h2>
<p>RDB全称Redis Database Backup file（Redis数据备份文件），也被叫做Redis数据快照。简单来说就是把内存中的所有数据都记录到磁盘中。当Redis实例故障重启后，从磁盘读取快照文件，恢复数据。快照文件称为RDB文件，默认是保存在当前运行目录。</p>
<p>RDB 持久化既可以手动执行，也可以根据服务器配置选项定期执行。</p>
<h3 id="执行时机" tabindex="-1"><a class="header-anchor" href="#执行时机" aria-hidden="true">#</a> 执行时机</h3>
<ul>
<li>
<p><strong>SAVE</strong></p>
<p>SAVE 命令会阻塞 Redis 服务进程，直到RDB文件创建完毕为止，在服务器中阻塞期间，服务器不能处理任何的命令请求。</p>
</li>
<li>
<p><strong>BGSVAE</strong></p>
<p>BGSVAE 命令会派生出一个子线程，然后由子线程负责创建 RDB 文件，服务器进程（父进程）继续处理命令请求。</p>
</li>
<li>
<p><strong>停机时</strong></p>
<p>Redis停机时会执行一次save命令，实现RDB持久化。</p>
</li>
<li>
<p><strong>触发RDB条件</strong></p>
<p>Redis允许用户通过设置服务器配置的 svae 选项，让服务器每隔一段时间自动执行一次 BGSAVE 命令。</p>
<p>用户可以通过 save 选项设置多个保存条件，只要其中任意一个条件被满足，服务器就会执行 BGSAVE命令</p>
<p>🌰：可以在redis.conf文件中找到，格式如下：</p>
<div class="language-properties line-numbers-mode" data-ext="properties"><pre v-pre class="language-properties"><code><span class="token comment"># 900秒内，如果至少有1个key被修改，则执行bgsave ， 如果是save "" 则表示禁用RDB</span>
<span class="token key attr-name">save</span> <span class="token value attr-value">900 1  </span>
<span class="token key attr-name">save</span> <span class="token value attr-value">300 10  </span>
<span class="token comment">#代表60秒内至少执行1000次修改则触发RDB</span>
<span class="token key attr-name">save</span> <span class="token value attr-value">60 10000 </span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li>
</ul>
<p>RDB的其它配置也可以在redis.conf文件中设置：</p>
<div class="language-properties line-numbers-mode" data-ext="properties"><pre v-pre class="language-properties"><code><span class="token comment"># 是否压缩 ,建议不开启，压缩也会消耗cpu，磁盘的话不值钱</span>
<span class="token key attr-name">rdbcompression</span> <span class="token value attr-value">yes</span>

<span class="token comment"># RDB文件名称</span>
<span class="token key attr-name">dbfilename</span> <span class="token value attr-value">dump.rdb  </span>

<span class="token comment"># 文件保存的路径目录</span>
<span class="token key attr-name">dir</span> <span class="token value attr-value">./ </span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="rdb-触发条件的底层原理" tabindex="-1"><a class="header-anchor" href="#rdb-触发条件的底层原理" aria-hidden="true">#</a> RDB 触发条件的底层原理</h3>
<p><strong>1. 如果用户没有主动设置 save选项，那么服务器会为save选项设置默认条件</strong></p>
<div class="language-properties line-numbers-mode" data-ext="properties"><pre v-pre class="language-properties"><code><span class="token key attr-name">save</span> <span class="token value attr-value">900 1  </span>
<span class="token key attr-name">save</span> <span class="token value attr-value">300 10  </span>
<span class="token key attr-name">save</span> <span class="token value attr-value">60 10000 </span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>2. 服务程序会根据 save 选项所设置的保存条件，设置服务器的状态 redisServer 结构的saveparams 属性</strong></p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">struct</span> <span class="token class-name">redisServer</span> <span class="token punctuation">{</span>
    	<span class="token comment">//	 ...</span>
    	<span class="token comment">// 记录保存条件的数组	</span>
        <span class="token keyword">struct</span> <span class="token class-name">saveparam</span> <span class="token operator">*</span>saveparams<span class="token punctuation">;</span>   <span class="token comment">/* Save points array for RDB */</span>
    	<span class="token comment">// 修改计数器</span>
    	<span class="token class-name">time_t</span> lastsave<span class="token punctuation">;</span>                <span class="token comment">/* Unix time of last successful save */</span>
    	<span class="token comment">// 上一次执行保存的时间</span>
    	<span class="token keyword">long</span> <span class="token keyword">long</span> dirty<span class="token punctuation">;</span> 
        <span class="token comment">//   ...</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>3. saveparams 属性是一个数组，数组中每一个元素都是一个 saveparams 结构，每个 saveparam 结构都保存了一个 save 选项设置的保存条件</strong></p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">struct</span> <span class="token class-name">saveparam</span> <span class="token punctuation">{</span>
    <span class="token comment">// 秒数</span>
    <span class="token class-name">time_t</span> seconds<span class="token punctuation">;</span>
    <span class="token comment">// 修改数</span>
    <span class="token keyword">int</span> changes<span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>4. dirty 计数器记录距离上一次成功执行 SAVE 命令或 BGSAVE 命令之后，服务器对数据库状态（服务器中的所有的数据库）进行了多少次修改（包括写入、删除、更新等操作）</strong></p>
<p>当服务器成功执行一个数据库的修改命令之后，程序就会对 dirty 计数器进行更新；命令修改了多少次数据库，ditry 计数器的值就增加多少</p>
<p><strong>5. lastsave 属性是一个 UNIX 时间戳，记录了服务器上一次成功执行 SVAE 命令或者 BGSVAE 命令的时间</strong></p>
<p><strong>6. Redis 的服务器周期性操作函数 serverCron 默认每隔100毫秒就会执行一次，该函数用于对正在运行的服务器进行维护，它其中一项就是检查 save 选项所设置的保存条件是否满足，如果满足的话，就执行一次 BGSAVE</strong></p>
<h3 id="rdb原理" tabindex="-1"><a class="header-anchor" href="#rdb原理" aria-hidden="true">#</a> RDB原理</h3>
<p>BASAVE 开始时会fork主进程得到子进程，子进程共享主进程的内存数据。完成fork后读取内存数据并写入 RDB 文件。</p>
<p>fork采用的是 copy-on-write(写时复制) 技术：</p>
<ul>
<li>当主进程执行读操作时，访问共享内存；</li>
<li>当主进程执行写操作时，则会拷贝一份数据，执行写操作。</li>
</ul>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120656861.png" alt="image-20221212065615679" loading="lazy"></p>
<h2 id="aof" tabindex="-1"><a class="header-anchor" href="#aof" aria-hidden="true">#</a> AOF</h2>
<p>AOF（Append Only File）追加文件，通过保存 Redis 服务器所执行的写命令来记录数据状态。由于 RDB 执行的间隔时间长，两次 RDB写入数据有丢失的风险，所以 Redis 提供了 AOF 的功能，Redis 处理的每一条写命令都会保存在 AOF 文件，可以看作是命令日志文件。</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120703252.png" alt="image-20221212070358190" style="zoom: 80%;" />
<h3 id="aof-持久化的实现" tabindex="-1"><a class="header-anchor" href="#aof-持久化的实现" aria-hidden="true">#</a> AOF 持久化的实现</h3>
<p>AOF 持久化功能的实现可以分为命令追加（append）、文件写入、文件同步（sync）三个步骤。</p>
<h4 id="命令追加" tabindex="-1"><a class="header-anchor" href="#命令追加" aria-hidden="true">#</a> 命令追加</h4>
<p>当 AOF 持久化功能处于打开状态，服务器在执行完一个写命令之后，会议协议格式将被执行的写命令追加到服务器状态的 aof buf缓冲区的末尾：</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">struct</span> <span class="token class-name">redisServer</span><span class="token punctuation">{</span>
    <span class="token comment">// .....</span>
    <span class="token comment">// AOF 缓冲区</span>
    sds aof_buf<span class="token punctuation">;</span>
    <span class="token comment">// .....</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h4 id="aof-文件的写入与同步" tabindex="-1"><a class="header-anchor" href="#aof-文件的写入与同步" aria-hidden="true">#</a> AOF 文件的写入与同步</h4>
<p>Redis 的服务器进程就是一个事件循环（loop），里面处理文件事件，时间事件等等。因为服务器在处理文件事件时可能执行写命令，使得一些内容被追加到 aof_buf 缓冲区里面，所以在服务器每次结束一个事件循环之前，它都会调用 <code v-pre>flushAppendOnlyFile</code> 函数，考虑是否需要将 aof_buf 缓冲区的内容写入和保存到 AOF 文件里面。</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code># 伪代码表示写入过程
def <span class="token function">eventLoop</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span>
	
	<span class="token keyword">while</span> True<span class="token operator">:</span>
	
		# 处理文件事件，接收命令请求以及发送命令回复
		# 处理命令请求时可能会有新的内容被追加到 aof_buf 缓冲区中
		<span class="token function">processFileEvents</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
         
         # 处理时间事件
         <span class="token function">processTimeEvents</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
            
         # 考虑是否要将 aof_buf 中的内容写入和保存到 AOF 文件里面
         <span class="token function">fulshAppendOnlyFile</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code v-pre>fulshAppendOnlyFile</code> 函数的行为由服务器配置的 appendfsync 选项的值来决定，各个不同的值产生的行为如下：</p>
<ul>
<li><code v-pre>always</code>：将 aof_buf 缓冲区的所有内容写入并同步到 AOF 文件中。</li>
<li><code v-pre>everysec</code>：将 aof_buf 缓冲区中所有的内容写入到 AOF 文件，如果上次同步 AOF 文件的时间距离现在超过一秒钟，那么造成对 AOF 文件进行同步，并且这个同步操作是由一个线程专门负责执行的。[默认方案]</li>
<li><code v-pre>no</code>：将 aof_buf 缓冲区的所有内容写入到 AOF 文件，但并不对 AOF 文件进行同步，何时同步由操作系统来决定。、</li>
</ul>
<p><strong>三种策略的对比：</strong></p>
<table>
<thead>
<tr>
<th style="text-align:center">配置</th>
<th style="text-align:center">刷盘时机</th>
<th style="text-align:center">优点</th>
<th style="text-align:center">缺点</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Always</td>
<td style="text-align:center">同步刷盘</td>
<td style="text-align:center">可靠性高，几乎不丢数据</td>
<td style="text-align:center">性能影响大</td>
</tr>
<tr>
<td style="text-align:center">everysec</td>
<td style="text-align:center">每秒刷盘</td>
<td style="text-align:center">性能适中</td>
<td style="text-align:center">最多丢失1秒数据</td>
</tr>
<tr>
<td style="text-align:center">no</td>
<td style="text-align:center">操作系统控制</td>
<td style="text-align:center">性能最高</td>
<td style="text-align:center">可靠性差，可能丢失大量数据</td>
</tr>
</tbody>
</table>
<h3 id="aof-文件的载入和还原" tabindex="-1"><a class="header-anchor" href="#aof-文件的载入和还原" aria-hidden="true">#</a> AOF 文件的载入和还原</h3>
<p><strong>Redis 读取 AOF 文件并还原数据库状态的步骤如下：</strong></p>
<ol>
<li>**创建一个不带网络连接的客户端，来执行 AOF 文件保存的写命令。**因为 Redis 命令只能在客户端上下文中执行，而载入 AOF 文件时所使用的命令直接来源于 AOF 文件而不是网络连接，所以服务器使用一个没有网络连接的伪客户端执行 AOF 文件保存的写命令，其效果与有网络的客户端执行效果一致。</li>
<li>从 AOF 文件中分析并读取出一条写命令。</li>
<li>使用伪客户端执行被读取的写命令。</li>
<li>一直执行步骤2 和 步骤3，直到 AOF 文件中所有写命令都被处理完毕为止。</li>
</ol>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120742735.png" alt="image-20221212074256680" style="zoom: 67%;" />
<h3 id="aof-重写" tabindex="-1"><a class="header-anchor" href="#aof-重写" aria-hidden="true">#</a> AOF 重写</h3>
<p>AOF 持久化是通过保存被执行的写命令来记录数据库状态的，所有随着服务器运行时间的流逝，AOF 文件中的内容会越来越多，文件体积也会越来越大，如果不加以控制的话，体积过大的 AOF 文件很可能会对 Redis 服务器、甚至整个宿主计算机造成影响，并且 AOF 文件来进行数据还原的所需的时间就越来越长。</p>
<p>Redis 提供了 AOF 文件重写（rewite）功能，通过该功能，Redis 服务器可以创建一个新的 AOF 文件替代现有的 AOF 文件，新旧两个 AOF 文件所保存的数据库状态相同，但新的 AOF 文件不会包含任何浪费空间的冗余命令。</p>
<p>🌰： 服务器对 animals 键执行了以下命令：</p>
<div class="language-properties line-numbers-mode" data-ext="properties"><pre v-pre class="language-properties"><code><span class="token comment"># 重写之前</span>
<span class="token key attr-name">sadd</span> <span class="token value attr-value">animals "Cat"</span>

<span class="token key attr-name">sadd</span> <span class="token value attr-value">animals "Dog" "Panda" "Tiger"</span>

<span class="token key attr-name">srem</span> <span class="token value attr-value">animals "Cat"</span>

<span class="token key attr-name">sadd</span> <span class="token value attr-value">animals "Lion" "Cat"</span>

<span class="token comment"># 重写之后</span>
<span class="token key attr-name">sadd</span> <span class="token value attr-value">animals "Dog" "Panda" "Tiger" "Lion" "Cat"</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>我们可以通过调用 <code v-pre>BGEWIRTEAOF</code> 命令来后台重写AOF文件，Redisy也会在触发阈值时自动去重写AOF文件。阈值也可以在redis.conf中配置：</strong></p>
<div class="language-properties line-numbers-mode" data-ext="properties"><pre v-pre class="language-properties"><code><span class="token comment"># AOF文件比上次文件 增长超过多少百分比则触发重写</span>
<span class="token key attr-name">auto-aof-rewrite-percentage</span> <span class="token value attr-value">100</span>
<span class="token comment"># AOF文件体积最小多大以上才触发重写 </span>
<span class="token key attr-name">auto-aof-rewrite-min-size</span> <span class="token value attr-value">64mb </span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>AOF的重写流程：</strong></p>
<ol>
<li>redis 主进程通过fork创建子进程。</li>
<li>子进程根据redis内存中的数据创建数据库重建命令序列于临时文件中。</li>
<li>父进程继续响应客户端请求，并将其中的写请求继续追加至原来的AOF文件中，额外的，这些新的写请求会被放置在一个缓冲队列中；</li>
<li>子进程重写完成后会通知父进程，父进程把缓冲队列中的命令写入临时文件中；</li>
<li>父进程用临时文件替换老的aof文件</li>
</ol>
<h2 id="混合持久化" tabindex="-1"><a class="header-anchor" href="#混合持久化" aria-hidden="true">#</a> 混合持久化</h2>
<p>RDB 和 AOF 持久化各有利弊，RDB 可能会导致一定时间内的数据丢失，而 AOF 由于文件较大则会影响 Redis 的启动速度，为了能同时使用 RDB 和 AOF 各种的优点，Redis 4.0 之后新增了混合持久化的方式。</p>
<p>在开启混合持久化的情况下，AOF 重写时会把 Redis 的持久化数据，以 RDB 的格式写入到 AOF 文件的开头，之后的数据再以 AOF 的格式化追加的文件的末尾。</p>
<p><strong>我们可以通过命令或者修改配置文件来开启混合持久化</strong></p>
<ul>
<li>
<p>命令</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code># 查询是否开启混合持久化
<span class="token macro property"><span class="token directive-hash">#</span> <span class="token directive keyword">yes</span> <span class="token expression">表示已经开启混合持久化，no 表示关闭，Redis <span class="token number">5.0</span> 默认值为 yes</span></span>
config get aof<span class="token operator">-</span>use<span class="token operator">-</span>rdb<span class="token operator">-</span>preamble
# 开启混合持久化
config set aof<span class="token operator">-</span>use<span class="token operator">-</span>rdb<span class="token operator">-</span>preamble yes    
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li>
<li>
<p>配置文件</p>
<p>在 redis.conf 文件，把配置文件中的 <code v-pre>aof-use-rdb-preamble no</code> 改为 <code v-pre>aof-use-rdb-preamble yes</code> 如下图所示：</p>
<p><img src="https://pic4.zhimg.com/80/v2-5fa91060a7ce8e28073a9e0509e84c2b_720w.webp" alt="img" loading="lazy"></p>
<p><strong>混合持久化的加载流程：</strong></p>
<ol>
<li>判断是否开启 AOF 持久化，开启继续执行后续流程，未开启执行加载 RDB 文件的流程；</li>
<li>判断 appendonly.aof 文件是否存在，文件存在则执行后续流程；</li>
<li>判断 AOF 文件开头是 RDB 的格式, 先加载 RDB 内容再加载剩余的 AOF 内容；</li>
<li>判断 AOF 文件开头不是 RDB 的格式，直接以 AOF 格式加载整个文件。</li>
</ol>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212120818250.png" alt="image-20221212081830179" style="zoom:67%;" />
<h4 id="小结" tabindex="-1"><a class="header-anchor" href="#小结" aria-hidden="true">#</a> 小结</h4>
<p><strong>混合持久化优点：</strong></p>
</li>
<li>
<p>混合持久化结合了 RDB 和 AOF 持久化的优点，开头为 RDB 的格式，使得 Redis 可以更快的启动，同时结合 AOF 的优点，有减低了大量数据丢失的风险。</p>
<p><strong>混合持久化缺点：</strong></p>
</li>
<li>
<p>AOF 文件中添加了 RDB 格式的内容，使得 AOF 文件的可读性变得很差；</p>
</li>
<li>
<p>兼容性差，如果开启混合持久化，那么此混合持久化 AOF 文件，就不能用在 Redis 4.0 之前版本了。</p>
</li>
</ul>
<h2 id="持久化最佳实践" tabindex="-1"><a class="header-anchor" href="#持久化最佳实践" aria-hidden="true">#</a> 持久化最佳实践</h2>
<p>持久化虽然保证了数据不丢失，但同时拖慢了 Redis 的运行速度，那怎么更合理的使用 Redis 的持久化功能呢？</p>
<p><strong>Redis 持久化的最佳实践可从以下几个方面考虑。</strong></p>
<p><strong>1. 控制持久化开关</strong></p>
<p>使用者可根据实际的业务情况考虑，如果对数据的丢失不敏感的情况下，可考虑关闭 Redis 的持久化，这样所以的键值操作都在内存中，就可以保证最高效率的运行 Redis 了。 持久化关闭操作：</p>
<ul>
<li>关闭 RDB 持久化，使用命令： <code v-pre>config set save &quot;&quot;</code></li>
<li>关闭 AOF 和 混合持久化，使用命令： <code v-pre>config set appendonly no</code></li>
</ul>
<p><strong>2. 主从部署</strong></p>
<p>使用主从部署，一台用于响应主业务，一台用于数据持久化，这样就可能让 Redis 更加高效的运行。</p>
<p><strong>3. 使用混合持久化</strong></p>
<p>混合持久化结合了 RDB 和 AOF 的优点，Redis 5.0 默认是开启的。</p>
<p><strong>4. 使用配置更高的机器</strong></p>
<p>Redis 对 CPU 的要求并不高，反而是对内存和磁盘的要求很高，因为 Redis 大部分时候都在做读写操作，使用更多的内存和更快的磁盘，对 Redis 性能的提高非常有帮助。</p>
</div></template>


