<template><div><h2 id="线程模型" tabindex="-1"><a class="header-anchor" href="#线程模型" aria-hidden="true">#</a> 线程模型</h2>
<h3 id="redis-是单线程还是多线程" tabindex="-1"><a class="header-anchor" href="#redis-是单线程还是多线程" aria-hidden="true">#</a> Redis 是单线程还是多线程</h3>
<p><strong>Q：Redis 是单线程还是多线程</strong></p>
<p>A：Redis在3.X版本中使用的单线程的方式，从Redis 4.X之后逐步引入多线程的方式来解决网络IO问题，但Redis的工作线程仍然为单线程。</p>
<h3 id="redis-是单线程" tabindex="-1"><a class="header-anchor" href="#redis-是单线程" aria-hidden="true">#</a> Redis 是单线程</h3>
<p>Redis的单线程主要是指 Redis 的网络IO和键值对读写是由一个线程来完成，Redis在处理客户端的请求时（socket 读）、解析、执行、内容返回（socket 写）等都是由一个顺序串行的主线程处理，也是Redis对外提供键值存储服务的主要流程，但Redis的其他功能，<strong>比如持久化，异步删除、集群数据同步等等，其实都是额外的线程来执行的。</strong></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211162025622.png" alt="image-20221116202537430" loading="lazy"></p>
<blockquote>
<p>小结：<strong>Redis工作线程时单线程的，对于整个Redis来说，是多线程的</strong></p>
</blockquote>
<h3 id="redis-引入多线的心路历程" tabindex="-1"><a class="header-anchor" href="#redis-引入多线的心路历程" aria-hidden="true">#</a> Redis 引入多线的心路历程</h3>
<p><strong>一、 Redis 3.x单线程但性能依旧很快的主要原因</strong></p>
<ul>
<li>基于内存操作：Redis 的所有数据都存在内存中，因此所有的运算都是内存级别的，所以它的性能比较高</li>
<li>数据结构简单：Redis的数据结构是专门设计的，而这些简单的数据结构的查找和操作的时间复杂度大部分都是O(1)，因此性能比较高</li>
<li>多路复用和非阻塞I/O：Redis使用I/O多路复用功能来监听多个socket连接客户端，这样就可以使用一个线程来处理多个请求，减少线程切换带来的开销，同时也避免了I/O阻塞操作</li>
<li>避免上下文的切换：因为是单线程模型，因此避免了不必要的上下文切换和多线程的竞争，这就省去了多线程切换带来的时间和性能上的消耗，而且单线程不会导致死锁问题的发生</li>
</ul>
<blockquote>
<p>Redis 4.0 之前一直采用单线程的主要原因有以下三点：</p>
<ol>
<li>单线程模型使得 Redis 的开发和维护更简单，因为单线程模型方便开发和调试</li>
<li>使用单线程模型也并发的处理多客户端的请求，主要使用的是多路复用和非阻塞 IO</li>
<li>Redis是基于内存操作，<strong>它主要性能瓶颈来源于内存和网络带宽而并非CPU</strong></li>
</ol>
</blockquote>
<p><strong>二、 Redis 4.0 引入多线程</strong></p>
<p><strong>单线程的不足之处：</strong></p>
<p>🌰：正常情况下使用del指令可以很快的删除数据，而当被删除的 key 是一个非常大的对象时，例如包含了成千上万个元素的hash集合时，那么del指令就会造成Redis主线程的卡顿。</p>
<p><strong>解决方案：</strong></p>
<p>在Redis 4.0中引入了多线程来实现数据的异步惰性删除等功能，但是其处理读写请求仍然只有一个线程。</p>
<p>🌰：当需要删除大key的时候执行 unlink key/flushdb async/flushall async，把删除工作交给后台线程（BIO）异步删除数据。</p>
<blockquote>
<p>Redis之父antirez一直强调&quot;Lazy Redis is better Redis&quot;. 而lazy free（惰性删除）本质就是把某些cost（占主线程cpu时间片）较高的删除操作，从redis主线程剥离让BIO子线程来处理，极大地减少主线程阻塞时间，从而减少删除导致的性能和稳定性问题</p>
</blockquote>
<p><strong>三、Redis 6.0 真正的多线程</strong></p>
<p>Redis瓶颈在于网络IO问题，I/O的读和写本身是堵塞的，比如当 socket 中有数据时，Redis会通过调用先将数据从内核态空间拷贝到用户态当中，再交给Redis调用，而这个拷贝的过程就是阻塞的，当数据量越大时拷贝所需要的时间就越多，而这些操作都是基于单线程完成的。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211162124901.png" alt="image-20221116212447846" loading="lazy"></p>
<p>在 Redis 6.0 中新增多线程的功能来提高I/O的读写性能，主要实现思路是将主线程的IO读写任务拆分给一组独立的线程去执行，使用多个socket的读写可以并行化，同时采用多路 I/O 复用技术可以让单个线程高效的处理多个连接请求（尽量减少网络IO的时间消耗），将最耗时的socket的读取、请求解析、写入单独外包出去，剩下的命令执行仍然由主线程串行执行并和内存的数据交互。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211162128529.png" alt="image-20221116212852483" loading="lazy"></p>
<blockquote>
<p>PS：在Redis 6.0 中多线程默认是关闭的，需要在Redis.config中开启</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202211172037525.png" alt="image-20221117203752309" loading="lazy"></p>
<p>1.设置io-thread-do-reads配置项为yes，表示启动多线程。
2。设置线程个数。关于线程数的设置，官方的建议是如果为 4 核的 CPU，建议线程数设置为 2 或 3，如果为 8 核 CPU 建议线程数设置为 6，线程数一定要小于机器核数，线程数并不是越大越好。</p>
</blockquote>
<h2 id="io多路复用模型" tabindex="-1"><a class="header-anchor" href="#io多路复用模型" aria-hidden="true">#</a> IO多路复用模型</h2>
<h3 id="基本介绍" tabindex="-1"><a class="header-anchor" href="#基本介绍" aria-hidden="true">#</a> 基本介绍</h3>
<p>I/O：网络 I/O</p>
<p>多路：多个客户端连接（连接就是套接字描述符，即 socket 或者 channel）</p>
<p>复用：复用一个或多个线程，也就是说一个或者一组线程处理多个 TCP连接，使用单进程就能够实现同时处理多个客户短端连接</p>
<p>一句话总结就是，一个服务进程可以同时处理多个套接字描述符</p>
<h3 id="unix网络编程中的五种io模型" tabindex="-1"><a class="header-anchor" href="#unix网络编程中的五种io模型" aria-hidden="true">#</a> Unix网络编程中的五种IO模型</h3>
<ul>
<li>Blocking IO - 阻塞IO</li>
<li>NoneBlocking IO - 非阻塞IO</li>
<li>IO multiplexing - IO多路复用</li>
<li>signal driven IO - 信号驱动IO</li>
<li>asynchronous IO - 异步IO</li>
</ul>
<h4 id="阻塞io" tabindex="-1"><a class="header-anchor" href="#阻塞io" aria-hidden="true">#</a> 阻塞IO</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111017698.png" alt="image-20221211101734620" style="zoom:50%;" />
<ol>
<li>用户进程调用 revcfrom 系统调用请求内核是否有新的网络数据。</li>
<li>如果没有数据，就阻塞等待直到有数据到来。</li>
<li>当内核将所有数据全部准备好了，它就会将数据从内核中拷贝到用户内存，并返回相关结果。</li>
<li>用户进程处理相关数据，并解除阻塞状态，重新运行。</li>
</ol>
<h4 id="非阻塞io" tabindex="-1"><a class="header-anchor" href="#非阻塞io" aria-hidden="true">#</a> 非阻塞IO</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/image-20221220174206987.png" alt="image-20221220174206987" style="zoom:67%;" />
<ol>
<li>用户进程调用 revcfrom 系统调用请求内核是否有新的网络数据。</li>
<li>如果没有数据，内核直接返回没有数据，用户进程不再阻塞。</li>
<li>用户进程会通过轮询的方式反复调用 recvform 来请求内核是否有新的网络数据。</li>
<li>当内核将所有数据全部准备好了，它就会将数据从内核中拷贝到用户内存，并返回相关结果。</li>
<li>用户进程处理相关的数据。</li>
</ol>
<h4 id="io多路复用" tabindex="-1"><a class="header-anchor" href="#io多路复用" aria-hidden="true">#</a> IO多路复用</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111508912.png" alt="image-20221211150739140" style="zoom:67%;" />
<ol>
<li>用户进程调用 select 或者 poll 阻塞等待数据，并等待多个套接字中的任何一个变为可读。</li>
<li>当内核中的数据准备完毕之后，会把可读套接字可读返回</li>
<li>再调用 recvfrom 把数据从内核复制到进程中，这一阶段也是为阻塞的。</li>
</ol>
<h4 id="信号驱动io" tabindex="-1"><a class="header-anchor" href="#信号驱动io" aria-hidden="true">#</a> 信号驱动IO</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111525359.png" alt="image-20221211152515278" style="zoom:67%;" />
<ol>
<li>进程调用 sigaction 系统调用，内核立即返回，应用进程可以继续执行，也就是说等待数据阶段应用进程是非阻塞的。</li>
<li>内核在数据准备完毕后向应用进程发送 SIGIO 信号，</li>
<li>进行相关信号处理</li>
<li>进程调用 recvfrom 将数据从内核复制到进程中，这一阶段也是为阻塞的。</li>
</ol>
<h4 id="异步io" tabindex="-1"><a class="header-anchor" href="#异步io" aria-hidden="true">#</a> 异步IO</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111536263.png" alt="image-20221211153641189" style="zoom:67%;" />
<p>进程调用 aio_read 系统调用会立即返回，应用进程继续执行，不会被阻塞，内核会在所有操作完成之后向应用进程发送信号。</p>
<h4 id="五大io模型比较" tabindex="-1"><a class="header-anchor" href="#五大io模型比较" aria-hidden="true">#</a> 五大IO模型比较</h4>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111543403.png" alt="image-20221211154308326" style="zoom: 80%;" />
<h3 id="redis中的io多路复用" tabindex="-1"><a class="header-anchor" href="#redis中的io多路复用" aria-hidden="true">#</a> Redis中的IO多路复用</h3>
<h4 id="基本介绍-1" tabindex="-1"><a class="header-anchor" href="#基本介绍-1" aria-hidden="true">#</a> 基本介绍</h4>
<p>Redis 是跑在单线程中的，所有的操作都是按照顺序线性执行的，但是由于读写操作等待用户输入或输出都是阻塞的，所以 I/O 操作在一般情况下往往不能直接返回，这会导致某一文件的 I/O 阻塞导致整个进程无法对其它客户提供服务，而 I/O 多路复用就是为了解决这个问题而出现。</p>
<p>I/O 多路复用机制，就是说通过一种机制，可以<strong>监视多个描述符</strong>，一旦某个描述符就绪（一般是读就绪或写就绪），能够通知程序进行相应的读写操作。这种机制的使用需要 select 、 poll 、 epoll 来配合。多个连接共用一个阻塞对象，应用程序只需要在一个阻塞对象上等待，无需阻塞等待所有连接。当某条连接有新的数据可以处理时，操作系统通知应用程序，线程从阻塞状态返回，开始进行业务处理。</p>
<p>Redis 利用 epoll 来实现IO多路复用，<strong>将连接信息和事件放到队列中</strong>，一次放到文件事件<strong>分派器</strong>，事件分派器将事件分发给<strong>事件处理器</strong>。</p>
<p>Redis 服务采用 Reactor 的方式来实现文件事件处理器（每一个网络连接其实都对应一个文件描述符）</p>
<p>Redis 基于 Reactor 模式开发了网络事件处理器，这个处理器被称为文件事件处理器。它的组成结构为4部分：</p>
<ul>
<li>多个套接字、</li>
<li>IO多路复用程序、</li>
<li>文件事件分派器、</li>
<li>事件处理器</li>
</ul>
<blockquote>
<p><strong>文件事件分派器队列的消费是单线程的，所以解释了 Redis 为什么基于单线程+IO多路复用的</strong></p>
</blockquote>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111622731.png" alt="image-20221211162223619" loading="lazy"></p>
<h4 id="reactor-设计模式" tabindex="-1"><a class="header-anchor" href="#reactor-设计模式" aria-hidden="true">#</a> Reactor 设计模式</h4>
<p><code v-pre>Reactor 模式</code>，是指通过一个或多个输入同时传递给服务处理器的服务请求的事件驱动处理模式。服务端程序处理传入多路请求，并将它们同步分派给请求对应的处理线程，Reactor 模式也叫 Dispatcher 模式。即 I/O 多了复用统一监听事件，收到事件后分发(Dispatch 给某进程)，是编写高性能网络服务器的必备技术。</p>
<p><strong>Reactor 模式中有 2 个关键组成：</strong></p>
<ol>
<li>Reactor：Reactor 在一个单独的线程中运行，负责监听和分发事件，分发给适当的处理程序来对 IO 事件做出反应。 它就像公司的电话接线员，它接听来自客户的电话并将线路转移到适当的联系人。</li>
<li>Handlers：处理程序执行 I/O 事件要完成的实际事件，类似于客户想要与之交谈的公司中的实际办理人。Reactor 通过调度适当的处理程序来响应 I/O 事件，处理程序执行非阻塞操作。</li>
</ol>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212111841779.png" alt="image-20221211184106638" style="zoom:67%;" />
<h4 id="select" tabindex="-1"><a class="header-anchor" href="#select" aria-hidden="true">#</a> select</h4>
<p><strong>select 是 Linux 最早的I/O多路复用的方案</strong></p>
<p><strong>select 函数接口的定义：</strong></p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">include</span> <span class="token string">&lt;sys/select.h></span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">include</span> <span class="token string">&lt;sys/time.h></span></span>

<span class="token comment">// 最大支持1024个连接</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">FD_SETSIZE</span> <span class="token expression"><span class="token number">1024</span></span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">NFDBITS</span> <span class="token expression"><span class="token punctuation">(</span><span class="token number">8</span> <span class="token operator">*</span> <span class="token keyword">sizeof</span><span class="token punctuation">(</span><span class="token keyword">unsigned</span> <span class="token keyword">long</span><span class="token punctuation">)</span><span class="token punctuation">)</span></span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">__FDSET_LONGS</span> <span class="token expression"><span class="token punctuation">(</span>FD_SETSIZE<span class="token operator">/</span>NFDBITS<span class="token punctuation">)</span></span></span>

<span class="token comment">/**
* 数据结构 (bitmap)
* fd_set保存了相关的socket事件
*/</span>
<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token punctuation">{</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> fds_bits<span class="token punctuation">[</span>__FDSET_LONGS<span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span> fd_set<span class="token punctuation">;</span>

<span class="token comment">/**
* select是一个阻塞函数
*/</span>
<span class="token comment">// 返回值就绪描述符的数目</span>
<span class="token keyword">int</span> <span class="token function">select</span><span class="token punctuation">(</span>
    <span class="token keyword">int</span> max_fd<span class="token punctuation">,</span>  <span class="token comment">// 最大的文件描述符值，遍历时取0-max_fd</span>
    fd_set <span class="token operator">*</span>readset<span class="token punctuation">,</span>  <span class="token comment">// 读事件列表</span>
    fd_set <span class="token operator">*</span>writeset<span class="token punctuation">,</span>  <span class="token comment">// 写事件列表</span>
    fd_set <span class="token operator">*</span>exceptset<span class="token punctuation">,</span>  <span class="token comment">// 异常列表</span>
    <span class="token keyword">struct</span> <span class="token class-name">timeval</span> <span class="token operator">*</span>timeout  <span class="token comment">// 阻塞超时时间</span>
<span class="token punctuation">)</span>

<span class="token function">FD_ZERO</span><span class="token punctuation">(</span><span class="token keyword">int</span> fd<span class="token punctuation">,</span> fd_set<span class="token operator">*</span> fds<span class="token punctuation">)</span>   <span class="token comment">// 清空集合</span>
<span class="token function">FD_SET</span><span class="token punctuation">(</span><span class="token keyword">int</span> fd<span class="token punctuation">,</span> fd_set<span class="token operator">*</span> fds<span class="token punctuation">)</span>    <span class="token comment">// 将给定的描述符加入集合</span>
<span class="token function">FD_ISSET</span><span class="token punctuation">(</span><span class="token keyword">int</span> fd<span class="token punctuation">,</span> fd_set<span class="token operator">*</span> fds<span class="token punctuation">)</span>  <span class="token comment">// 判断指定描述符是否在集合中 </span>
<span class="token function">FD_CLR</span><span class="token punctuation">(</span><span class="token keyword">int</span> fd<span class="token punctuation">,</span> fd_set<span class="token operator">*</span> fds<span class="token punctuation">)</span>    <span class="token comment">// 将给定的描述符从文件中删除  </span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>slect 函数的执行流程：</strong></p>
<ol>
<li>从用户空间拷贝fd_set（注册的事件集合）到内核空间</li>
<li>遍历所有fd文件，并将当前进程挂到每个fd的等待队列中，当某个fd文件设备收到消息后，会唤醒设备等待队列上睡眠的进程，那么当前进程就会被唤醒</li>
<li>如果遍历完所有的fd没有I/O事件，则当前进程进入睡眠，当有某个fd文件有I/O事件或当前进程睡眠超时后，当前进程重新唤醒再次遍历所有fd文件</li>
</ol>
<h5 id="小结" tabindex="-1"><a class="header-anchor" href="#小结" aria-hidden="true">#</a> 小结</h5>
<p><strong>select 函数的缺点：</strong></p>
<ol>
<li>bitmap最大1024位，一个进程最多只能处理1024个客户端</li>
<li>&amp;rset不可重用，每次socket有数据就相应的位会被置位</li>
<li>select 调用需要传入 fd 数组，需要拷贝一份到内核，高并发场景下这样的拷贝消耗的资源是惊人的。</li>
<li>select并没有通知用户态哪一个socket有数据，仍然需要O(n)的遍历。select 仅仅返回可读文件描述符的个数，具体哪个可读还是要用户自己遍历。</li>
</ol>
<h4 id="poll" tabindex="-1"><a class="header-anchor" href="#poll" aria-hidden="true">#</a> poll</h4>
<p>poll本质上和select没有区别，它将用户传入的数组拷贝到内核空间，然后查询每个fd对应的设备状态， <strong>但是它没有最大连接数的限制</strong>，原因是它是基于链表来存储的</p>
<p>poll 函数接口：</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">include</span> <span class="token string">&lt;poll.h></span></span>
<span class="token comment">// 数据结构</span>
<span class="token keyword">struct</span> <span class="token class-name">pollfd</span> <span class="token punctuation">{</span>
    <span class="token keyword">int</span> fd<span class="token punctuation">;</span>                         <span class="token comment">// 需要监视的文件描述符</span>
    <span class="token keyword">short</span> events<span class="token punctuation">;</span>                   <span class="token comment">// 需要内核监视的事件</span>
    <span class="token keyword">short</span> revents<span class="token punctuation">;</span>                  <span class="token comment">// 实际发生的事件，1：表示有事件发生，0：没有事件发生</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>

<span class="token comment">// 阻塞方法</span>
<span class="token keyword">int</span> <span class="token function">poll</span><span class="token punctuation">(</span><span class="token keyword">struct</span> <span class="token class-name">pollfd</span> fds<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>   <span class="token comment">// 需要监听的文件描述符列表</span>
         <span class="token class-name">nfds_t</span> nfds<span class="token punctuation">,</span>           <span class="token comment">// 文件描述符个数</span>
         <span class="token keyword">int</span> timeout            <span class="token comment">// 超时时间</span>
        <span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>poll执行流程：</strong></p>
<ol>
<li>创建 pollpd 数组，向其中添加关注的fd信息，数组大小自定义。</li>
<li>调用 poll 函数，将 pollfd 数组拷贝到内核空间，转链表存储，无上限。</li>
<li>内核遍历 fd，判断是否就绪。</li>
<li>数据就绪或超时后，拷贝 pollfd 数组到用户空间，返回就绪 fd 数量 n。</li>
<li>用户进程判断 n 是否大于0。</li>
<li>大于0则遍历 pollfd 数组，找到就绪的fd。</li>
</ol>
<h5 id="小结-1" tabindex="-1"><a class="header-anchor" href="#小结-1" aria-hidden="true">#</a> 小结</h5>
<p><strong>poll 解决的问题：</strong></p>
<ol>
<li>poll使用pollfd数组来代替 select 中的bitmap，数组没有1024的限制，可以一次管理更多的client。</li>
<li>当 pollfds 数组中有事件发生，相应的 revents 置位为1，遍历的时候又置位回零，实现了pollfd 数组的重用。</li>
</ol>
<p><strong>poll 缺点：</strong></p>
<p><strong>poll 本质原理还是select的方法，还存在select中原来的问题</strong></p>
<ol>
<li>pollfds数组拷贝到了内核态，仍然有开销</li>
<li>poll并没有通知用户态哪一个socket有数据，仍然需要O(n)的遍历</li>
</ol>
<h4 id="epoll" tabindex="-1"><a class="header-anchor" href="#epoll" aria-hidden="true">#</a> epoll</h4>
<p>epoll 可以理解为event pool，不同与select、poll的轮询机制，epoll采用的是事件驱动机制，每个fd上有注册有回调函数，当网卡接收到数据时会回调该函数，同时将该fd的引用放入rdlist就绪列表中。</p>
<p>当调用 epoll_wait 检查是否有事件发生时，只需要检查 eventpoll 对象中的rdlist双链表中是否有epitem元素即可。如果rdlist不为空，则把发生的事件复制到用户态，同时将事件数量返回给用户。</p>
<p><strong>epoll 函数定义：</strong></p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">include</span> <span class="token string">&lt;sys/epoll.h></span></span>

<span class="token comment">// 数据结构</span>
<span class="token comment">// 每一个epoll对象都有一个独立的eventpoll结构体</span>
<span class="token comment">// 用于存放通过epoll_ctl方法向epoll对象中添加进来的事件</span>
<span class="token comment">// epoll_wait检查是否有事件发生时，只需要检查eventpoll对象中的rdlist双链表中是否有epitem元素即可</span>
<span class="token keyword">struct</span> <span class="token class-name">eventpoll</span> <span class="token punctuation">{</span>
    <span class="token comment">/*红黑树的根节点，这颗树中存储着所有添加到epoll中的需要监控的事件*/</span>
    <span class="token keyword">struct</span> <span class="token class-name">rb_root</span>  rbr<span class="token punctuation">;</span>
    <span class="token comment">/*双链表中则存放着将要通过epoll_wait返回给用户的满足条件的事件*/</span>
    <span class="token keyword">struct</span> <span class="token class-name">list_head</span> rdlist<span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>

<span class="token comment">// API</span>
<span class="token comment">// 内核中间加一个 ep 对象，把所有需要监听的socket都放到ep对象中</span>
<span class="token keyword">int</span> <span class="token function">epoll_create</span><span class="token punctuation">(</span><span class="token keyword">int</span> size<span class="token punctuation">)</span><span class="token punctuation">;</span> 
<span class="token comment">// epoll_ctl 负责把 socket 增加、删除到内核红黑树</span>
<span class="token keyword">int</span> <span class="token function">epoll_ctl</span><span class="token punctuation">(</span><span class="token keyword">int</span> epfd<span class="token punctuation">,</span>  <span class="token comment">// 创建的ep对象</span>
              <span class="token keyword">int</span> op<span class="token punctuation">,</span>    <span class="token comment">// 操作类型 新增、删除等</span>
              <span class="token keyword">int</span> fd<span class="token punctuation">,</span>    <span class="token comment">// 要操作的对象</span>
              <span class="token keyword">struct</span> <span class="token class-name">epoll_event</span> <span class="token operator">*</span>event  <span class="token comment">// 事件</span>
             <span class="token punctuation">)</span><span class="token punctuation">;</span> 
<span class="token comment">// epoll_wait 负责检测可读队列，没有可读 socket 则阻塞进程</span>
<span class="token keyword">int</span> <span class="token function">epoll_wait</span><span class="token punctuation">(</span><span class="token keyword">int</span> epfd<span class="token punctuation">,</span> <span class="token keyword">struct</span> <span class="token class-name">epoll_event</span> <span class="token operator">*</span> events<span class="token punctuation">,</span> <span class="token keyword">int</span> maxevents<span class="token punctuation">,</span> <span class="token keyword">int</span> timeout<span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>epoll的三步调用流程</strong></p>
<ul>
<li>调用epoll_create()创建一个ep对象，即红黑树的根节点，返回一个文件句柄</li>
<li>调用epoll_ctl()向这个ep对象（红黑树）中添加、删除、修改感兴趣的事件</li>
<li>调用epoll_wait()等待，当有事件发生时网卡驱动会调用fd上注册的函数并将该fd添加到rdlist中，解除阻塞</li>
</ul>
<p><strong>epoll的执行流程：</strong></p>
<ol>
<li>当有数据的时候，会把相应的文件描述符 “置位”，但是epool没有 revent 标志位，所以并不是真正的置位。这个时候会把有数据的文件描述符放到队首。</li>
<li>epoll 会返回有数据的文件描述符的个数</li>
<li>根据返回的个数 读取前N个文件描述符即可</li>
<li>读取、处理</li>
</ol>
<h5 id="小结-2" tabindex="-1"><a class="header-anchor" href="#小结-2" aria-hidden="true">#</a> 小结</h5>
<p>多路复用快的原因在于，操作系统提供了这样的系统调用，使得原来的 while 循环里多次系统调用，变成了<strong>一次系统调用 + 内核层遍历这些文件描述符</strong>。</p>
<p>epoll是现在最先进的IO多路复用器，Redis、Nginx，linux中的Java NIO都使用的是epoll。</p>
<p>这里“多路”指的是多个网络连接，“复用”指的是复用同一个线程。</p>
<ol>
<li>一个socket的生命周期中只有一次从用户态拷贝到内核态的过程，开销小</li>
<li>使用event事件通知机制，每次socket中有数据会主动通知内核，并加入到就绪链表中，不需要遍历所有的socket</li>
</ol>
<p>在多路复用IO模型中，会有一个内核线程不断地去轮询多个 socket 的状态，<strong>只有当真正读写事件发送时，才真正调用实际的IO读写操作</strong>。因为在多路复用IO模型中，只需要使用一个线程就可以管理多个socket，系统不需要建立新的进程或者线程，也不必维护这些线程和进程，并且只有真正有读写事件进行时，才会使用IO资源，所以它大大减少来资源占用。</p>
<p>多路I/O复用模型是利用 select、poll、epoll 可以同时监察多个流的 I/O 事件的能力，在空闲的时候，会把当前线程阻塞掉，当有一个或多个流有 I/O 事件时，就从阻塞态中唤醒，于是程序就会轮询一遍所有的流（epoll 是只轮询那些真正发出了事件的流），并且只依次顺序的处理就绪的流，这种做法就避免了大量的无用操作。</p>
<p>采用多路 I/O 复用技术可以让单个线程高效的处理多个连接请求（尽量减少网络 IO 的时间消耗），且 Redis 在内存中操作数据的速度非常快，也就是说内存内的操作不会成为影响Redis性能的瓶颈。</p>
<h4 id="select、poll、epoll三种方法的对比" tabindex="-1"><a class="header-anchor" href="#select、poll、epoll三种方法的对比" aria-hidden="true">#</a> select、poll、epoll三种方法的对比</h4>
<table>
<thead>
<tr>
<th></th>
<th>select</th>
<th>poll</th>
<th>epoll</th>
</tr>
</thead>
<tbody>
<tr>
<td>操作方式</td>
<td>遍历</td>
<td>遍历</td>
<td>回调</td>
</tr>
<tr>
<td>数据结构</td>
<td>bitmap</td>
<td>数组</td>
<td>红黑树</td>
</tr>
<tr>
<td>最大连接数</td>
<td>1024（x86）或 2048 （x64）</td>
<td>无上限</td>
<td>无上限</td>
</tr>
<tr>
<td>最大支持文件描述符数</td>
<td>一般有最大限制</td>
<td>65535</td>
<td>65535</td>
</tr>
<tr>
<td>fd拷贝</td>
<td>每次调用select，都需要把fd集合从用户态拷贝到内核态</td>
<td>每次调用poll，都需要把fd集合从用户态拷贝到内核态</td>
<td>fd首次调用epoll_ctl拷贝，每次调用epoll_wait不拷贝</td>
</tr>
<tr>
<td>工作效率</td>
<td>每次调用的都进行遍历，时间复杂度为O(n)</td>
<td>次调用的都进行遍历，时间复杂度为O(n)</td>
<td>事件通知方式，每当fd就绪，系统注册的回调函数，将就绪的fd放到 readyList里面，时间复杂度为O(1)</td>
</tr>
</tbody>
</table>
</div></template>


