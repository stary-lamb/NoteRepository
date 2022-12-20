<template><div><h2 id="kv键值对" tabindex="-1"><a class="header-anchor" href="#kv键值对" aria-hidden="true">#</a> KV键值对</h2>
<p><strong>Redis 是以KV的键值对的方式存储数据的数据库</strong>，其中<code v-pre>key</code>类型一般为字符串，而<code v-pre>value</code>类型则为redis对象(redisObject)。</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212031838558.png" alt="image-20221203183848492" style="zoom:67%;" />
<h3 id="redisobject" tabindex="-1"><a class="header-anchor" href="#redisobject" aria-hidden="true">#</a> RedisObject</h3>
<p>Redis 采用 redisObject 结构来统一五种不同的数据类型，这样所有的数据类型就都可以以相同的形式在函数间传递而不用使用特定的类型结构。同时，为了识别不同的数据类型，redisObject中定义了<code v-pre>type</code>和<code v-pre>encoding</code>字段对不同的数据类型加以区别。简单地说，redisObject就是string、hash、list、set、zset的父类，可以在函数间传递时隐藏具体的类型信息，同时我们也可以把它把想象为 Java 中的 Object 类，它也是所以类的父类。</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">/*src包中可以在 server.h 找到redisObejct结构 [当前版本为Redis 6.0.9]*/</span>
<span class="token keyword">struct</span> <span class="token class-name">redisObject</span> <span class="token punctuation">{</span>
    <span class="token comment">/*4位的 type 表示具体的数据类型 ——> 当前值的对象的数据类型 例如:[OBJ_STRING、OBJ_LIST、OBJ_HASH、OBJ_SET、OBJ_ZSET]*/</span>
    <span class="token keyword">unsigned</span> type<span class="token operator">:</span><span class="token number">4</span><span class="token punctuation">;</span>
    <span class="token comment">//4位的 encoding 表示当前值的对象的的数据类型的底层具体的数据结构</span>
    <span class="token keyword">unsigned</span> encoding<span class="token operator">:</span><span class="token number">4</span><span class="token punctuation">;</span>
    <span class="token comment">//当内存超限时采用LRU算法清除内存中的对象 [记录着对象最后一次被命令程序访问的时间]</span>
    <span class="token keyword">unsigned</span> lru<span class="token operator">:</span>LRU_BITS<span class="token punctuation">;</span> <span class="token comment">/* LRU time (relative to global lru_clock) or
                            * LFU data (least significant 8 bits frequency
                            * and most significant 16 bits access time). */</span>
    <span class="token comment">//对象的引用计数 ——> 记录对象引用次数</span>
    <span class="token keyword">int</span> refcount<span class="token punctuation">;</span>
    <span class="token comment">//指向真正的底层数据结构的指针</span>
    <span class="token keyword">void</span> <span class="token operator">*</span>ptr<span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">//不同物理类型定义的编码常量</span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_RAW</span> <span class="token expression"><span class="token number">0</span>     </span><span class="token comment">/* Raw representation */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_INT</span> <span class="token expression"><span class="token number">1</span>     </span><span class="token comment">/* Encoded as integer */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_HT</span> <span class="token expression"><span class="token number">2</span>      </span><span class="token comment">/* Encoded as hash table */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_ZIPMAP</span> <span class="token expression"><span class="token number">3</span>  </span><span class="token comment">/* No longer used: old hash encoding. */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_LINKEDLIST</span> <span class="token expression"><span class="token number">4</span> </span><span class="token comment">/* No longer used: old list encoding. */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_ZIPLIST</span> <span class="token expression"><span class="token number">5</span> </span><span class="token comment">/* No longer used: old list/hash/zset encoding. */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_INTSET</span> <span class="token expression"><span class="token number">6</span>  </span><span class="token comment">/* Encoded as intset */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_SKIPLIST</span> <span class="token expression"><span class="token number">7</span>  </span><span class="token comment">/* Encoded as skiplist */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_EMBSTR</span> <span class="token expression"><span class="token number">8</span>  </span><span class="token comment">/* Embedded sds string encoding */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_QUICKLIST</span> <span class="token expression"><span class="token number">9</span> </span><span class="token comment">/* Encoded as linked list of listpacks */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_STREAM</span> <span class="token expression"><span class="token number">10</span> </span><span class="token comment">/* Encoded as a radix tree of listpacks */</span></span>
<span class="token macro property"><span class="token directive-hash">#</span><span class="token directive keyword">define</span> <span class="token macro-name">OBJ_ENCODING_LISTPACK</span> <span class="token expression"><span class="token number">11</span> </span><span class="token comment">/* Encoded as a listpack */</span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="上帝视角看redis的数据结构" tabindex="-1"><a class="header-anchor" href="#上帝视角看redis的数据结构" aria-hidden="true">#</a> 上帝视角看Redis的数据结构</h3>
<p>从Redis的启动的过程了解Redis整体结构，redis 服务启动 ——&gt; redis数据库中有多少的key、key的过期时间等等 ——&gt; dict 全局的KV表 ——&gt; dictht key的落地从全局kv表中加载过来 ——&gt; dictEntry 从KV键值对抽取成一个个实体 ——&gt; 解析出相对的对象。</p>
<ul>
<li>redisDb 结构，表示 Redis 数据库的结构，结构体里存放了指向了 dict 结构的指针；</li>
<li>dict 结构，结构体里存放了 2 个哈希表，正常情况下都是用「哈希表1」，「哈希表2」只有在 rehash 的时候才用</li>
<li>ditctht 结构，表示哈希表的结构，结构里存放了哈希表数组，数组中的每个元素都是指向一个哈希表节点结构（dictEntry）的指针；</li>
<li>dictEntry 结构，表示哈希表节点的结构，结构里存放了 **void * key 和 void * value 指针， <em>key 指向的是 String 对象，而 <em>value 则可以指向 String 对象，也可以指向集合类型的对象，比如 List 对象、Hash 对象、Set 对象和 Zset 对象</em></em>。</li>
</ul>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212031556791.png" alt="image-20221203155628657" loading="lazy"></p>
<h2 id="简单动态字符串-sds" tabindex="-1"><a class="header-anchor" href="#简单动态字符串-sds" aria-hidden="true">#</a> 简单动态字符串 - SDS</h2>
<p>Redis 没有直接使用C语言传统的字符串表示（以空字符串<code v-pre>'\0'</code>为结尾的字符数组），而是自己构建了一种名为简单动态字符串（simple dynamic string，SDS）的抽象类型，并将SDS用作默认字符串的表示。</p>
<h3 id="redis-3-0-sds的结构" tabindex="-1"><a class="header-anchor" href="#redis-3-0-sds的结构" aria-hidden="true">#</a> Redis 3.0 SDS的结构</h3>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">struct</span> <span class="token class-name">sdshdr</span> <span class="token punctuation">{</span>
    <span class="token comment">//记录buf数组中已使用字节的数量</span>
    <span class="token comment">//等于SDS所保存字符串的长度</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> len<span class="token punctuation">;</span>

    <span class="token comment">//记录buf数组中未使用字节的数量</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> free<span class="token punctuation">;</span>

    <span class="token comment">//char数组，用于保存字符串</span>
    <span class="token keyword">char</span> buf<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>如下图所示为字符串&quot;qxjava&quot;在Redis中的存储形式：</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212032241047.png" alt="image-20221203224119984" loading="lazy"></p>
<ul>
<li>len 为6，表示这个 SDS 保存了一个长度为5的字符串；</li>
<li>free 为0，表示这个 SDS 没有剩余空间；</li>
<li>buf 是个char类型的数组，注意末尾保存了一个空字符'\0'</li>
</ul>
<blockquote>
<p>buf 尾部自动追加一个'\0'字符并不会计算在 SDS 的len中，这是为了遵循 C 字符串以空字符串结尾的惯例，使得 SDS 可以直接使用一部分string.h库中的函数，如strlen</p>
</blockquote>
<p>在 Redis3.x 版本中<strong>不同长度的字符串占用的头部是相同的</strong>，如果某一字符串很短但是头部却占用了更多的空间，这未免太浪费了。所以在Redis当中 SDS 分为五种级别的字符串：</p>
<h3 id="redis-6-0-sds结构" tabindex="-1"><a class="header-anchor" href="#redis-6-0-sds结构" aria-hidden="true">#</a> Redis 6.0 SDS结构</h3>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">/* src/sds.h 包 */</span>
<span class="token comment">// 注意：sdshdr5从未被使用，Redis中只是访问flags。</span>
<span class="token keyword">struct</span> <span class="token keyword">__attribute__</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>__packed__<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token class-name">sdshdr5</span> <span class="token punctuation">{</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> flags<span class="token punctuation">;</span> <span class="token comment">/* 低3位存储类型, 高5位存储长度 */</span>
    <span class="token keyword">char</span> buf<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
<span class="token keyword">struct</span> <span class="token keyword">__attribute__</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>__packed__<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token class-name">sdshdr8</span> <span class="token punctuation">{</span>
    <span class="token class-name">uint8_t</span> len<span class="token punctuation">;</span> <span class="token comment">/* 已使用 */</span>
    <span class="token class-name">uint8_t</span> alloc<span class="token punctuation">;</span> <span class="token comment">/* 总长度，用1字节存储 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> flags<span class="token punctuation">;</span> <span class="token comment">/* 低3位存储类型, 高5位预留 */</span>
    <span class="token keyword">char</span> buf<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span> <span class="token comment">/*字符串数组*/</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
<span class="token keyword">struct</span> <span class="token keyword">__attribute__</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>__packed__<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token class-name">sdshdr16</span> <span class="token punctuation">{</span>
    <span class="token class-name">uint16_t</span> len<span class="token punctuation">;</span> <span class="token comment">/* 已使用 */</span>
    <span class="token class-name">uint16_t</span> alloc<span class="token punctuation">;</span> <span class="token comment">/* 总长度，用2字节存储 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> flags<span class="token punctuation">;</span> <span class="token comment">/* 低3位存储类型, 高5位预留 */</span>
    <span class="token keyword">char</span> buf<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
<span class="token keyword">struct</span> <span class="token keyword">__attribute__</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>__packed__<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token class-name">sdshdr32</span> <span class="token punctuation">{</span>
    <span class="token class-name">uint32_t</span> len<span class="token punctuation">;</span> <span class="token comment">/* 已使用 */</span>
    <span class="token class-name">uint32_t</span> alloc<span class="token punctuation">;</span> <span class="token comment">/* 总长度，用4字节存储 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> flags<span class="token punctuation">;</span> <span class="token comment">/* 低3位存储类型, 高5位预留 */</span>
    <span class="token keyword">char</span> buf<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
<span class="token keyword">struct</span> <span class="token keyword">__attribute__</span> <span class="token punctuation">(</span><span class="token punctuation">(</span>__packed__<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token class-name">sdshdr64</span> <span class="token punctuation">{</span>
    <span class="token class-name">uint64_t</span> len<span class="token punctuation">;</span> <span class="token comment">/* 已使用 */</span>
    <span class="token class-name">uint64_t</span> alloc<span class="token punctuation">;</span> <span class="token comment">/* 总长度，用8字节存储 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> flags<span class="token punctuation">;</span> <span class="token comment">/* 低3位存储类型, 高5位预留 */</span>
    <span class="token keyword">char</span> buf<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><blockquote>
<p>SDS有四种类型uint8，uint16，uint32，uint64，分别表示len以及alloc字段的长度。如果是uint8类型，那么len和alloc字段能存储最为为2<sup>8</sup>，也就是256字节。这样在分配的内存很少的情况下，也能尽可能的节省字段的长度。</p>
</blockquote>
<h3 id="sds-与-c语言字符串的区别" tabindex="-1"><a class="header-anchor" href="#sds-与-c语言字符串的区别" aria-hidden="true">#</a> SDS 与 C语言字符串的区别</h3>
<h4 id="常数复杂度获取字符串长度" tabindex="-1"><a class="header-anchor" href="#常数复杂度获取字符串长度" aria-hidden="true">#</a> 常数复杂度获取字符串长度</h4>
<p>C语言本身并不记录自身的长度信息，获取字符串长度必须遍历整个字符串，对遇到的每个字符进行计数，直到遇到代表字符串结束符（\0）为止，这个操作的时间复制度为O(N)，而在 <strong>Redis 当中在 len 属性中记录了SDS本身的长度，所以获取一个SDS长度的复杂度仅为O(1)</strong>。我们可以通过 strlen key 的命令来获取 key 的字符串长度。</p>
<h4 id="杜绝缓冲区溢出" tabindex="-1"><a class="header-anchor" href="#杜绝缓冲区溢出" aria-hidden="true">#</a> 杜绝缓冲区溢出</h4>
<p>C语言本身没有存储字符串长度，在使用 <code v-pre>strcat</code> 函数拼接字符串的时候，默认为 dest 分配了足够多的内存空间，可以容纳所有的拼接内容，一旦没有分配到足够的长度，就会产生缓冲区溢出。在 Redis 中需要对SDS进行修改时，会先检查SDS的内存空间是否满足修改所需的要求，<strong>如果不满足会自动将SDS的空间扩展至执行修改所需的大小</strong>，然后才执行实际的修改操作，所以不会出现在C语言中缓冲区溢出的问题。</p>
<h4 id="减少修改字符串所带来的内存重新分配次数" tabindex="-1"><a class="header-anchor" href="#减少修改字符串所带来的内存重新分配次数" aria-hidden="true">#</a> 减少修改字符串所带来的内存重新分配次数</h4>
<p>C语言中拼接（strcat）字符串，在执行这个操作之前，程序会先通过内存分配扩展底层数组的空间大小 [不扩充，可能会出现缓冲区溢出问题]；截断字符串，在执行操作之后，程序会通过内存分配来释放字符串不在使用的那部分空间。</p>
<p>SDS 通过 <code v-pre>len</code>、<code v-pre>alloc</code> 两个属性，避免了C语言字符串的问题。通过未使用的空间，SDS实现了空间预分配和惰性空间释放两种优化策略。</p>
<ul>
<li>**空间预分配：**在对 SDS 修改之前，会先检查未使用的空间是否足够，如果足够则直接使用未使用的空间，而无须执行内存重分配；通过这种分配策略，SDS将连续增长N次。</li>
<li>**惰性释放空间：**需要缩短SDS保存的字符串时，程序并不会立即使用内存重分配来回收缩短后多出来的字节，而是使用alloc将这些字节记录起来，并等待将来使用；同时SDS也提供了相应的API，我们在有需要的时候，真正地释放SDS的未使用空间。</li>
</ul>
<h4 id="二进制安全" tabindex="-1"><a class="header-anchor" href="#二进制安全" aria-hidden="true">#</a> 二进制安全</h4>
<p>因为C语言是以 <code v-pre>\0</code>结尾的，而对于一些图片、音频、压缩文件这样的二进制文件可能包含着空字符串（'\0'），因此C语言无法正确的读取这些文件；而所有的SDS API都会以二进制的方式来处理SDS存放在buf数组里的数据，且SDS斌不是空字符串来判断字符的结束，而是通过len属性的值来判断。</p>
<h4 id="兼容部分c字符串函数" tabindex="-1"><a class="header-anchor" href="#兼容部分c字符串函数" aria-hidden="true">#</a> 兼容部分C字符串函数</h4>
<p>虽然 SDS 的API是二进制安全的，但它们一样遵守着C字符串以空字符串结尾的惯例，也在使得SDS可以重用一部分 &lt;String.h&gt; 库定义的函数，从而避免了重复造轮子。</p>
<h2 id="字典-哈希表-dict" tabindex="-1"><a class="header-anchor" href="#字典-哈希表-dict" aria-hidden="true">#</a> 字典/哈希表 - Dict</h2>
<p>字典，又称为符号表、关联数组或映射，是一种用于保存键值对的抽象数据结构。同时还是哈希键的底层实现之一，当一个哈希键包含多个哈希键值对比较多，又或1键值对中的元素都是比较长的字符串时，Redis就会使用字典作为哈希键的底层实现。</p>
<h3 id="字典的实现" tabindex="-1"><a class="header-anchor" href="#字典的实现" aria-hidden="true">#</a> 字典的实现</h3>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">/*字典*/</span>
<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">dict</span> <span class="token punctuation">{</span>
    <span class="token comment">/* 类型特定函数 */</span>
    dictType <span class="token operator">*</span>type<span class="token punctuation">;</span>
    
    <span class="token comment">/* 私有数据 */</span>
    <span class="token keyword">void</span> <span class="token operator">*</span>privdata<span class="token punctuation">;</span>
   
    <span class="token comment">/* 哈希表 */</span>
    dictht ht<span class="token punctuation">[</span><span class="token number">2</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
    
    <span class="token comment">/* rehash索引 */</span>
    <span class="token comment">/* 当rehash不存在时为-1 */</span>
    <span class="token keyword">long</span> rehashidx<span class="token punctuation">;</span> <span class="token comment">/* rehashing not in progress if rehashidx == -1 */</span>
    
    <span class="token comment">/* 目前正在运行的安全迭代器的数量 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> iterators<span class="token punctuation">;</span> <span class="token comment">/* number of iterators currently running */</span>
<span class="token punctuation">}</span> dict<span class="token punctuation">;</span>

<span class="token comment">/*哈希表 当前版本6.0.8 在Redis7.0 中已经取消了dicht结构*/</span>
<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">dictht</span> <span class="token punctuation">{</span>
    <span class="token comment">/* 哈希表数组 */</span>
    dictEntry <span class="token operator">*</span><span class="token operator">*</span>table<span class="token punctuation">;</span>
   
    <span class="token comment">/* 哈希表大小 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> size<span class="token punctuation">;</span>
    
    <span class="token comment">/* 哈希表大小掩码，用于计算索引值 */</span>
    <span class="token comment">/* 总是等于size-1 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> sizemask<span class="token punctuation">;</span>
    
    <span class="token comment">/* 该哈希表已有节点的数量 */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> used<span class="token punctuation">;</span>
<span class="token punctuation">}</span> dictht<span class="token punctuation">;</span>

<span class="token comment">/*哈希节点*/</span>
<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">dictEntry</span> <span class="token punctuation">{</span>
    <span class="token comment">/* 键 */</span>
    <span class="token keyword">void</span> <span class="token operator">*</span>key<span class="token punctuation">;</span>
    <span class="token comment">/* 值 */</span>
    <span class="token keyword">union</span> <span class="token punctuation">{</span>
        <span class="token keyword">void</span> <span class="token operator">*</span>val<span class="token punctuation">;</span>
        <span class="token class-name">uint64_t</span> u64<span class="token punctuation">;</span>
        <span class="token class-name">int64_t</span> s64<span class="token punctuation">;</span>
        <span class="token keyword">double</span> d<span class="token punctuation">;</span>
    <span class="token punctuation">}</span> v<span class="token punctuation">;</span>
    <span class="token comment">/* 指向下个哈希表节点，形成链表 */</span>
    <span class="token keyword">struct</span> <span class="token class-name">dictEntry</span> <span class="token operator">*</span>next<span class="token punctuation">;</span>
<span class="token punctuation">}</span> dictEntry<span class="token punctuation">;</span>

<span class="token comment">/*dictType实现了字典的多态*/</span>
<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">dictType</span> <span class="token punctuation">{</span>
    <span class="token class-name">uint64_t</span> <span class="token punctuation">(</span><span class="token operator">*</span>hashFunction<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">const</span> <span class="token keyword">void</span> <span class="token operator">*</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span><span class="token comment">// 哈希函数</span>
    <span class="token keyword">void</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token operator">*</span>keyDup<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>privdata<span class="token punctuation">,</span> <span class="token keyword">const</span> <span class="token keyword">void</span> <span class="token operator">*</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span><span class="token comment">// 复制键的函数</span>
    <span class="token keyword">void</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token operator">*</span>valDup<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>privdata<span class="token punctuation">,</span> <span class="token keyword">const</span> <span class="token keyword">void</span> <span class="token operator">*</span>obj<span class="token punctuation">)</span><span class="token punctuation">;</span><span class="token comment">// 复制值的函数</span>
    <span class="token keyword">int</span> <span class="token punctuation">(</span><span class="token operator">*</span>keyCompare<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>privdata<span class="token punctuation">,</span> <span class="token keyword">const</span> <span class="token keyword">void</span> <span class="token operator">*</span>key1<span class="token punctuation">,</span> <span class="token keyword">const</span> <span class="token keyword">void</span> <span class="token operator">*</span>key2<span class="token punctuation">)</span><span class="token punctuation">;</span><span class="token comment">// 键的比较</span>
    <span class="token keyword">void</span> <span class="token punctuation">(</span><span class="token operator">*</span>keyDestructor<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>privdata<span class="token punctuation">,</span> <span class="token keyword">void</span> <span class="token operator">*</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span><span class="token comment">// 键的销毁</span>
    <span class="token keyword">void</span> <span class="token punctuation">(</span><span class="token operator">*</span>valDestructor<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>privdata<span class="token punctuation">,</span> <span class="token keyword">void</span> <span class="token operator">*</span>obj<span class="token punctuation">)</span><span class="token punctuation">;</span><span class="token comment">// 值的销毁</span>
<span class="token punctuation">}</span> dictType<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="键冲突" tabindex="-1"><a class="header-anchor" href="#键冲突" aria-hidden="true">#</a> 键冲突</h3>
<p>Redis的哈希表使用链地址发来解决键冲突，每个哈希表节点都有一个next指针，多个哈希表节点可以用 next 指针构成一个单向链表，被分配到一个索引上的多个节点可以以哦那个这个单向链表连接起来，从而解决键冲突问题。’</p>
<p>🌰：假设程序要将键值对k2和v2添加到👇图中的哈希表里面，并且计算出k2的索引值为2那么键 k1 和 k2 将产生冲突</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212052302117.png" alt="image-20221205230241046" style="zoom:67%;" />
<p><strong>Redis通过链地址法解决键冲突</strong></p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212052303645.png" alt="image-20221205230357572" loading="lazy"></p>
<h3 id="渐进式-rehash" tabindex="-1"><a class="header-anchor" href="#渐进式-rehash" aria-hidden="true">#</a> 渐进式 rehash</h3>
<p>哈希表保存的键值对会逐渐增多或减少，为了让哈希表的<code v-pre>负载因子（load factor）</code>维持在一个合理的范围之内，当哈希表保存的键值对数量太多或者太少时，程序需要对哈希表的大小进行相应的<code v-pre>扩展</code>或者<code v-pre>收缩</code>，当然因为Redis的核心计算是单线程的，一次重新散列这么多的key会长时间造成服务不可用，所以<strong>Redis采用了分多次、渐进式地完成，也即是渐进式 rehash</strong>。</p>
<ul>
<li>
<p>**负载因子（load factor）的计算公式：**load_factor = ht[0].used / ht[0].size</p>
</li>
<li>
<p><strong>扩容：</strong></p>
<ul>
<li>服务器目前没有在执行 <em>BGSAVE</em> 命令 或者 <em>BGREWRITEAOE</em> 命令，并且哈希表的负载因子大于等于1</li>
<li>服务器目前正在执行 <em>BGSAVE</em> 命令 或者 <em>BGREWRITEAOE</em> 命令，并且哈希表的负载因子大于等于5</li>
</ul>
</li>
<li>
<p>**缩容：**当哈希表的负载因子小于0.1时，程序自动开始对哈希表执行收缩操作。</p>
</li>
<li>
<p><strong>渐进式 rehash 的详细步骤：</strong></p>
<ol>
<li>为 ht[1] 分配空间，让字典同时持有 ht[0] 和 ht[1] 两个哈希表</li>
<li>在字典中维持一个索引计数器变量 rehashidx，并将它的值设为0，表示rehash工作正式开始</li>
<li>在 rehash 进行期间，每次对字典执行添加、删除、查找或者更新操作时，程序除了指定的操作以外，还会顺带将 ht[0] 哈希表在 rehashidx 索引上的所有键值对 rehash 到 ht[1]，当 rehash 工作完成之后，程序将 rehashidx 属性的值增一</li>
<li>随着字典操作的不断执行，最终在某个时间点上，ht[0] 的所有键值对都会被 rehash 至 ht[1]，这时程序将rehashidx属性的值设为-1，表示rehash操作已完成。</li>
</ol>
<blockquote>
<p>渐进式 rehash 采用分而治之的思想，将rehash键值对所需的计算工作均摊到对字典的每个添加、删除、查找和更新的操作上，从而避免了集中式rehash而带来的庞大计算量。</p>
<p>进行渐进式 rehash 的过程中，字典会同时使用 ht[0] 和 ht[1] 两个哈希表，所以在渐进式 rehash 期间，字典的删除、查找、更新等操作会在两个哈希表上进行。🌰：在字典里面查找一个key，程序会从ht[0] 中查找，若没有找到的话，就会继续道 ht[1]里面查找。</p>
<p>此外，在执行渐进式 rehash 的期间，新添加到字典的键值对一律会被保存到 ht[1] 中，而 ht[0] 不会执行任何添加操作，保证 ht[0] 包含的键值对数量会只减不增，并随着 rehash 操作的执行而最终变为空表</p>
</blockquote>
</li>
</ul>
<h2 id="整数集合-intset" tabindex="-1"><a class="header-anchor" href="#整数集合-intset" aria-hidden="true">#</a> 整数集合 - IntSet</h2>
<p>整数集合（inset）是集合键的底层实现之一，当一个集合只包含整数值元素，并且这个集合元素数量不多时，Redis 就会使用整数集合作为集合键的底层实现。</p>
<p>Inset 的结构如下：</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">intset</span> <span class="token punctuation">{</span>
    <span class="token comment">// 编码方式</span>
    <span class="token class-name">uint32_t</span> encoding<span class="token punctuation">;</span>
    <span class="token comment">//集合包含的元素数量</span>
    <span class="token class-name">uint32_t</span> length<span class="token punctuation">;</span>
    <span class="token comment">// 保存元素的数组</span>
    <span class="token class-name">int8_t</span> contents<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span> intset<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><ul>
<li><code v-pre>encoding</code> 表示编码方式主要有三个取值  INSET_ENC_16、INSET_ENC_32、INSET_ENC_64
<ul>
<li>如 encoding 的值为 INSET_ENC_16，那么contents就是一个 int16_t 类型的数组，数组中每个项都是一个 int16_t类型的整数值（最小值为  -32 798，最大值为32 767）</li>
<li>如 encoding 的值为 INSET_ENC_32，那么contents就是一个 int32_t 类型的数组，数组中每个项都是一个 int32_t类型的整数值（最小值为   -2 147 483 648，最大值为2 147 483 647）</li>
<li>如 encoding 的值为 INSET_ENC_64，那么contents就是一个 int64_t 类型的数组，数组中每个项都是一个 int64_t类型的整数值（最小值为   -9 223 372 036 854 775 808，最大值为9 223 372 036 854 775 807）</li>
</ul>
</li>
<li><code v-pre>length</code> 记录了整数集合包含的元素数量，也即是 contents 数组的长度</li>
<li><code v-pre>contents数组</code> 整数集合的底层实现，集合中每个元素都是 contents 数组的一个数组项（item），各个项在数组中按值的大小从小到大有序地排列，并且数组中不包含任何重复项，并且 contents 数组真正的类型是取决于 encoding 属性的值</li>
</ul>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212062115117.png" alt="image-20221206211507834" loading="lazy"></p>
<h3 id="升级" tabindex="-1"><a class="header-anchor" href="#升级" aria-hidden="true">#</a> 升级</h3>
<p>当我们要将一个新元素添加到整数集合里面，并且新元素的类型比整数集合现有所有元素的类型要长时，整数集合需要先进行升级，然后才能将新元素添加到帧数集合里面。</p>
<p><strong>升级整数集合并添加元素共分为三步进行：</strong></p>
<ol>
<li>根据新元素的类型，扩展整数集合底层数组的空间大小，并为新元素分配空间</li>
<li>将底层数组现有的所有元素都转换成与新元素相同的类型，并将类型转换之后的元素放置到正确的位上，而且在放置元素的过程中，需要继续维持底层数组的有序性不变</li>
<li>将新元素添加到底层数组里面，改变整数集合 ecoding 属性的值，并将length的长度+1</li>
</ol>
<p><strong>升级之后新元素的摆放位置：</strong></p>
<p>引发升级的新元素的长度总是比整数集合现有所有元素的长度都大，所以这个新元素的要么大于所有现有元素，要么就小于所有现有元素</p>
<ul>
<li>新元素小于所有现有元素的情况下，新元素会被放置在底层数组的最开头（索引为0）</li>
<li>新元素大于所有现有元素的情况下，新元素会被放置在底层数组的最末尾（索引为length-1）</li>
</ul>
<p>🌰：假设现在的元素类型是int16，所有元素的取值范围都在区间[-32768,32767]，如果想触发intset的升级，将元素类型升级为int32，新加入元素的范围区间应该是[-2147483648,-32768)和(32767,2147483647)，如果新元素在前一个区间，那么它小于-32768，小于所有的int16，如果新元素在后一个区间，那么它大于32767，大于所有的int16。</p>
<blockquote>
<p><strong>升级的好处：</strong></p>
<ol>
<li>提升灵活性，因为C语言是静态类型语言，为了避免类型错误，通常不会将两种不同类型的值放同一数据结构里面，但在Redis中，因为整数集合可以通过自动升级底层数组来适应新元素，所以我们可以随意地将不同类型的整数添加到集合中，且不用担心类型出现错误</li>
<li>节约内存，整数集合升级的操作既可以让集合能同时保存三种不同的类型的值，又可以确保升级操作只会在有需要的时候进行，这可以尽量节省内存</li>
</ol>
</blockquote>
<h3 id="降级" tabindex="-1"><a class="header-anchor" href="#降级" aria-hidden="true">#</a> 降级</h3>
<p>在Redis的整数集合当中不支持降级的操作，一旦对数组进行了升级，编码就会一直保存升级后的状态。</p>
<h2 id="linkedlist" tabindex="-1"><a class="header-anchor" href="#linkedlist" aria-hidden="true">#</a> LinkedList</h2>
<p>链表提供了高效的的节点重排能力，以及顺序性节点访问方式，并且可以通过增删节点来灵活地调整链表的长度。在Redis 链表可以作为通用的数据结构可以被其他功能模块所使用，譬如：发布与订阅、慢查询、监视器等等。</p>
<blockquote>
<p>在Redis 3.2 之前 List 的底层数据结构使用的是压缩列表zipList、<strong>双向循环链表linkedList</strong>；但在之后List的底层数据结构变为了<strong>quickList</strong>。</p>
</blockquote>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">// src/adlist.h</span>

<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">listNode</span> <span class="token punctuation">{</span>
    <span class="token comment">// 前置节点</span>
    <span class="token keyword">struct</span> <span class="token class-name">listNode</span> <span class="token operator">*</span>prev<span class="token punctuation">;</span>
    <span class="token comment">// 后置节点</span>
    <span class="token keyword">struct</span> <span class="token class-name">listNode</span> <span class="token operator">*</span>next<span class="token punctuation">;</span>
    <span class="token comment">// 节点的值</span>
    <span class="token keyword">void</span> <span class="token operator">*</span>value<span class="token punctuation">;</span>
<span class="token punctuation">}</span> listNode<span class="token punctuation">;</span>

<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">list</span> <span class="token punctuation">{</span>
    <span class="token comment">// 表头节点</span>
    listNode <span class="token operator">*</span>head<span class="token punctuation">;</span>
    <span class="token comment">// 表尾节点</span>
    listNode <span class="token operator">*</span>tail<span class="token punctuation">;</span>
    <span class="token comment">// 链表所包含的节点数量</span>
    <span class="token keyword">void</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token operator">*</span>dup<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>ptr<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 节点值复制函数</span>
    <span class="token keyword">void</span> <span class="token punctuation">(</span><span class="token operator">*</span>free<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>ptr<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 节点值释放函数</span>
    <span class="token keyword">int</span> <span class="token punctuation">(</span><span class="token operator">*</span>match<span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token keyword">void</span> <span class="token operator">*</span>ptr<span class="token punctuation">,</span> <span class="token keyword">void</span> <span class="token operator">*</span>key<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 节点值对比函数</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> len<span class="token punctuation">;</span>
<span class="token punctuation">}</span> list<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>多个 listNode 可以通过 prev 和 next 指针组成双端链表，如下图：</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212062236721.png" alt="image-20221206223604666" loading="lazy"></p>
<p>list 结构为链表提供了表头指针 head、表尾指针 tail，以及链表长度计数器len，而dup、free、macth 成员则是实现多态链表所需的类型的特定函数</p>
<ul>
<li>dup 函数用于复制链表节点所保存的值</li>
<li>free 函数用于释放链表节点所保存的值</li>
<li>match 函数用于对比链表节点所保存的值和另一个输入是否相等</li>
</ul>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212062302238.png" alt="image-20221206230240178" loading="lazy"></p>
<h2 id="压缩列表-ziplist" tabindex="-1"><a class="header-anchor" href="#压缩列表-ziplist" aria-hidden="true">#</a> 压缩列表 - ZipList</h2>
<p>ziplist 是一个经过特殊编码的双向链表，旨在提高内存效率。 它可以存储字符串和整数值，存储整数时采用整数的二进制而不是字符串形式存储。 它能在 O(1) 的时间复杂度下在列表的任一侧进行<code v-pre>push</code>和<code v-pre>pop</code>操作。 但是，由于每个操作都需要重新分配 ziplist 使用的内存，因此实际复杂性与 ziplist 使用的内存量有关。</p>
<h3 id="ziplist-与-ziplist节点数据结构" tabindex="-1"><a class="header-anchor" href="#ziplist-与-ziplist节点数据结构" aria-hidden="true">#</a> ziplist 与 ziplist节点数据结构</h3>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">/* Create a new empty ziplist. */</span>
<span class="token keyword">unsigned</span> <span class="token keyword">char</span> <span class="token operator">*</span><span class="token function">ziplistNew</span><span class="token punctuation">(</span><span class="token keyword">void</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// header 和 end 需要的字节数</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> bytes <span class="token operator">=</span> ZIPLIST_HEADER_SIZE<span class="token operator">+</span>ZIPLIST_END_SIZE<span class="token punctuation">;</span>
    <span class="token comment">// 分配 bytes 长度的内存</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> <span class="token operator">*</span>zl <span class="token operator">=</span> <span class="token function">zmalloc</span><span class="token punctuation">(</span>bytes<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 赋值 zlbytes</span>
    <span class="token function">ZIPLIST_BYTES</span><span class="token punctuation">(</span>zl<span class="token punctuation">)</span> <span class="token operator">=</span> <span class="token function">intrev32ifbe</span><span class="token punctuation">(</span>bytes<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 赋值 zltail</span>
    <span class="token function">ZIPLIST_TAIL_OFFSET</span><span class="token punctuation">(</span>zl<span class="token punctuation">)</span> <span class="token operator">=</span> <span class="token function">intrev32ifbe</span><span class="token punctuation">(</span>ZIPLIST_HEADER_SIZE<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 赋值 zllen</span>
    <span class="token function">ZIPLIST_LENGTH</span><span class="token punctuation">(</span>zl<span class="token punctuation">)</span> <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token comment">// 赋值 zlend</span>
    zl<span class="token punctuation">[</span>bytes<span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> ZIP_END<span class="token punctuation">;</span>
    <span class="token keyword">return</span> zl<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><img src="C:\Users\Mr.chen\AppData\Roaming\Typora\typora-user-images\image-20221207211023176.png" alt="image-20221207211023176" style="zoom: 67%;" />
<p><strong>ziplist 节点</strong></p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token comment">/*
 * 保存 ziplist 节点信息的结构
 */</span>
<span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">zlentry</span> <span class="token punctuation">{</span>

    <span class="token comment">// prevrawlen ：前置节点的长度</span>
    <span class="token comment">// prevrawlensize ：编码 prevrawlen 所需的字节大小</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> prevrawlensize<span class="token punctuation">,</span> prevrawlen<span class="token punctuation">;</span>

    <span class="token comment">// len ：当前节点值的长度</span>
    <span class="token comment">// lensize ：编码 len 所需的字节大小</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> lensize<span class="token punctuation">,</span> len<span class="token punctuation">;</span>

    <span class="token comment">// 当前节点 header 的大小</span>
    <span class="token comment">// 等于 prevrawlensize + lensize</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> headersize<span class="token punctuation">;</span>

    <span class="token comment">// 当前节点值所使用的编码类型</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> encoding<span class="token punctuation">;</span>

    <span class="token comment">// 指向当前节点的指针</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> <span class="token operator">*</span>p<span class="token punctuation">;</span>

<span class="token punctuation">}</span> zlentry<span class="token punctuation">;</span>

</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212072114042.png" alt="image-20221207211458992" loading="lazy"></p>
<ul>
<li>
<p>**previous_entry_length：**以字节为单位，记录压缩列表中前一个节点的长度，通过这个值可以进行指针运算，计算出前一个节点的起始位置</p>
</li>
<li>
<p><strong>encoding 和 length：</strong><code v-pre>encoding</code> 和 <code v-pre>length</code> 两部分一起决定了 <code v-pre>content</code> 部分所保存的数据的类型（以及长度）。其中， <code v-pre>encoding</code> 域的长度为两个 bit ， 它的值可以是 <code v-pre>00</code> 、 <code v-pre>01</code> 、 <code v-pre>10</code> 和 <code v-pre>11</code></p>
<ul>
<li><code v-pre>00</code> 、 <code v-pre>01</code> 和 <code v-pre>10</code> 表示 <code v-pre>content</code> 部分保存着字符数组。</li>
<li><code v-pre>11</code> 表示 <code v-pre>content</code> 部分保存着整数。</li>
</ul>
<p>以 <code v-pre>00</code> 、 <code v-pre>01</code> 和 <code v-pre>10</code> 开头的字符数组的编码方式如下：</p>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212072118696.png" alt="img" style="zoom:67%;" />
<p>表格中的下划线 _ 表示留空，而变量 b 、 x 等则代表实际的二进制数据。为了方便阅读，多个字节之间用空格隔开。</p>
<p><code v-pre>11</code> 开头的整数编码如下：</p>
</li>
</ul>
<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212072119646.png" alt="img" style="zoom:67%;" />
<ul>
<li>**content：**负责保存节点的值，节点值可以是一个字节数组或者整数，值的类型和长度由节点 encoding 和 length 决定</li>
</ul>
<h3 id="连锁更新" tabindex="-1"><a class="header-anchor" href="#连锁更新" aria-hidden="true">#</a> 连锁更新</h3>
<p>在特殊情况下产生的连续多次空间扩展操作称之为 “连锁更新”，除了添加节点可能会引起连锁更新之外，删除节点也可能会引起连锁更新。</p>
<blockquote>
<p>连锁更新在最坏的情况下需要对压缩列表指向N次空间重分配操作，而每次空间重分配的最坏复杂度为 O(N)，所以连锁更新的最坏复杂度为 O(N<sup>2</sup>)</p>
<ul>
<li>连锁更新真正造成性能的问题的几率是很低的，原因如下:
<ul>
<li>压缩列表里面恰好有多个连续的，长度介于250字节至253字节之间的节点，连锁更新才有可能发生，在实际中，并不常见</li>
<li>出现连锁更新，但只要更新的节点数量不多，就不会对性能造成任何影响</li>
</ul>
</li>
</ul>
</blockquote>
<h2 id="快表-quicklist" tabindex="-1"><a class="header-anchor" href="#快表-quicklist" aria-hidden="true">#</a> 快表 - quicklist</h2>
<p>ziplist 存在两个问题：不能保存过多的元素，否则访问性能会下降；不能保存过大的元素，否则容易导致内存重新分配，甚至引起连锁更新，所以Redis在3.2之后新加入了 quicklist 结构。</p>
<p>qicklist 是一种以ziplist为结点的双端链表结构，宏观商，quicklist是一个链表，微观上，链表中的每个结点都是一个 ziplist。</p>
<p><strong>quicklist 的结构体定义如下：</strong></p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">quicklist</span> <span class="token punctuation">{</span>
    <span class="token comment">// quicklist 的链表头</span>
    quicklistNode <span class="token operator">*</span>head<span class="token punctuation">;</span>
    <span class="token comment">// quicklist 的链表尾</span>
    quicklistNode <span class="token operator">*</span>tail<span class="token punctuation">;</span>
    <span class="token comment">// 所有 ziplist 中的总元素个数</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> count<span class="token punctuation">;</span>        <span class="token comment">/* total count of all entries in all ziplists */</span>
    <span class="token comment">// quicklistNodes 的个数</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">long</span> len<span class="token punctuation">;</span>          <span class="token comment">/* number of quicklistNodes */</span>
  	 <span class="token comment">// ziplist大小设置，存放list-max-ziplist-size参数的值</span>
    <span class="token keyword">int</span> fill <span class="token operator">:</span> QL_FILL_BITS<span class="token punctuation">;</span>              <span class="token comment">/* fill factor for individual nodes */</span>
    <span class="token comment">//节点压缩深度设置，存放list-compress-depth参数的值</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> compress <span class="token operator">:</span> QL_COMP_BITS<span class="token punctuation">;</span> <span class="token comment">/* depth of end nodes not to compress;0=off */</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> bookmark_count<span class="token operator">:</span> QL_BM_BITS<span class="token punctuation">;</span>
    quicklistBookmark bookmarks<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span> quicklist<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>每个元素节点 quicklistNode 的定义如下：</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">quicklistNode</span> <span class="token punctuation">{</span>
    <span class="token comment">// 前一个 quicklistNode</span>
    <span class="token keyword">struct</span> <span class="token class-name">quicklistNode</span> <span class="token operator">*</span>prev<span class="token punctuation">;</span>
    <span class="token comment">// 后一个 quicklistNode</span>
    <span class="token keyword">struct</span> <span class="token class-name">quicklistNode</span> <span class="token operator">*</span>next<span class="token punctuation">;</span>
    <span class="token comment">// quicklistNode 指向的 ziplist</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">char</span> <span class="token operator">*</span>zl<span class="token punctuation">;</span>
    <span class="token comment">// ziplist 的字节大小</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> sz<span class="token punctuation">;</span>
    <span class="token comment">// ziplist 的元素个数</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> count<span class="token operator">:</span> <span class="token number">16</span><span class="token punctuation">;</span>
    <span class="token comment">// 编码方式，『原生字节数组』或「压缩存储」</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> encoding<span class="token operator">:</span> <span class="token number">2</span><span class="token punctuation">;</span>
    <span class="token comment">// 存储方式，NONE==1 or ZIPLIST==2</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> container<span class="token operator">:</span> <span class="token number">2</span><span class="token punctuation">;</span>
    <span class="token comment">// 数据是否被压缩</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> recompress<span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token comment">// 数据能否被压缩</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> attempted_compress<span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token comment">// 预留的 bit 位</span>
    <span class="token keyword">unsigned</span> <span class="token keyword">int</span> extra<span class="token operator">:</span> <span class="token number">10</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span> quicklistNode<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212072147097.png" alt="image-20221207214744041" loading="lazy"></p>
<p>在向 quicklist 添加一个元素的时候，不会像普通的链表那样，直接新建一个链表节点。而是会检查插入位置的压缩列表是否能容纳该元素，如果能容纳就直接保存到 quicklistNode 结构里的压缩列表，如果不能容纳，才会新建一个新的 quicklistNode 结构。</p>
<p>quicklist 会控制 quicklistNode 结构里的压缩列表的大小或者元素个数，来规避潜在的连锁更新的风险，但是这并没有完全解决连锁更新的问题。</p>
<h2 id="listpack-紧凑列表" tabindex="-1"><a class="header-anchor" href="#listpack-紧凑列表" aria-hidden="true">#</a> listpack 紧凑列表</h2>
<p><strong>listpack 紧凑列表，用一块连续的内存空间来紧凑保存数据，同时使用多种编码方式，表示不同长度的数据（字符串、整数）。</strong></p>
<p><strong>listpack解决的问题：</strong></p>
<ul>
<li>ziplist：不能保存过多的元素，否则访问性能会下降；不能保存过大的元素，否则容易导致内存重新分配，甚至引起连锁更新，所以引入了 quicklist</li>
<li>quicklist ：可以通过控制 quicklistNode 结构里的压缩列表的大小或者元素个数，来减少连锁更新带来的性能影响，但是并没有完全解决连锁更新的问题</li>
</ul>
<p>listpack最大特点: listpack 中每个节点不再包含前一个节点的长度了，压缩列表每个节点正因为需要保存前一个节点的长度字段，就会有连锁更新的隐患。</p>
<blockquote>
<p>在 Redis7.0已经完全取代<code v-pre>ziplist</code>作为 redis 底层存储数据结构之一。</p>
</blockquote>
<p><strong>listpack 结构设计：</strong></p>
<p>listpack 采用了压缩列表的很多优秀的设计，比如还是用一块连续的内存空间来紧凑地保存数据，并且为了节省内存的开销，listpack 节点会采用不同的编码方式保存不同大小的数据。</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212072206878.png" alt="image-20221207220617817" loading="lazy"></p>
<blockquote>
<p>listpack 每个列表项都只记录自己的长度，不会像 ziplist 的列表项会记录前一项的长度。所以在 listpack 中新增或修改元素，只会涉及到列表项自身的操作，不会影响后续列表项的长度变化，进而避免连锁更新。</p>
</blockquote>
<h2 id="跳跃表-zskiplist" tabindex="-1"><a class="header-anchor" href="#跳跃表-zskiplist" aria-hidden="true">#</a> 跳跃表 - ZSkipList</h2>
<p>跳跃表是一种有序的数据结构，它通过在每个节点中维持多个指向其他节点的指针，从而达到快速访问节点的目的。Redis使用跳跃表作为有序集合键的底层实现之一，如果一个有序集合包含的元素数量比较多，又或者有序集合中元素的成员是比较长的字符串时，Redis就会使用跳跃表来作为有序集合键的底层实现。跳跃表的性能可以保证在查找，删除，添加等操作的时候在对数期望时间内完成，这个性能是可以和平衡树来相比较的，而且在实现方面比平衡树要优雅，这就是跳跃表的长处。跳跃表的缺点就是需要的存储空间比较大，属于利用空间来换取时间数据结构。</p>
<div class="language-c line-numbers-mode" data-ext="c"><pre v-pre class="language-c"><code><span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token class-name">zskiplistNode</span><span class="token punctuation">{</span>
	<span class="token comment">//后退指针</span>
	<span class="token keyword">struct</span> <span class="token class-name">zskiplistNode</span> <span class="token operator">*</span>backward<span class="token punctuation">;</span>
	<span class="token comment">//分值</span>
	<span class="token keyword">double</span> score<span class="token punctuation">;</span>
	<span class="token comment">//成员对象</span>
	robj <span class="token operator">*</span>obj<span class="token punctuation">;</span>
	<span class="token comment">//层</span>
	<span class="token keyword">struct</span> <span class="token class-name">zkiplistLevel</span><span class="token punctuation">{</span>
		<span class="token comment">//前进指针</span>
		<span class="token keyword">struct</span> <span class="token class-name">zskiplistNode</span> <span class="token operator">*</span>forward<span class="token punctuation">;</span>
		<span class="token comment">//跨度</span>
		<span class="token keyword">unsigned</span> <span class="token keyword">int</span> span<span class="token punctuation">;</span>
	<span class="token punctuation">}</span>level<span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>zskiplistNode<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212072241782.png" alt="image-20221207224131708" style="zoom:67%;" />
<h3 id="跳表节点查询" tabindex="-1"><a class="header-anchor" href="#跳表节点查询" aria-hidden="true">#</a> 跳表节点查询</h3>
<p>在查询某个节点时，跳表会从头节点的最高层开始，查找下一个节点：</p>
<ul>
<li>访问下一个节点
<ul>
<li>当前节点的元素权重 &lt; 要查找的权重</li>
<li>当前节点的元素权重 = 要查找的权重，且节点数据&lt;要查找的数据</li>
</ul>
</li>
<li>访问当前节点 level 数组的下一层指针
<ul>
<li>当前节点的元素权重 &gt; 要查找的权重</li>
</ul>
</li>
</ul>
<h3 id="层数设置" tabindex="-1"><a class="header-anchor" href="#层数设置" aria-hidden="true">#</a> 层数设置</h3>
<ol>
<li>每层的节点数约是下一层节点数的一半。
<ul>
<li>好处：查找时类似于二分查找，查找复杂度可以减低到 O(logN)</li>
<li>坏处：每次插入/删除节点，都要调整后续节点层数，带来额外开销</li>
</ul>
</li>
<li><code v-pre>随机生成每个节点的层数</code>。Redis 跳表采用了这种方法。</li>
</ol>
<p>Redis 中，跳表节点层数是由 zslRandomLevel 函数决定。</p>
<div class="language-text line-numbers-mode" data-ext="text"><pre v-pre class="language-text"><code>int zslRandomLevel(void) {
    int level = 1;
    while ((random()&amp;0xFFFF) &lt; (ZSKIPLIST_P * 0xFFFF))
        level += 1;
    return (level&lt;ZSKIPLIST_MAXLEVEL) ? level : ZSKIPLIST_MAXLEVEL;
}
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>其中每层增加的概率是 0.25，最大层数是 32。</p>
<div class="language-text line-numbers-mode" data-ext="text"><pre v-pre class="language-text"><code>#define ZSKIPLIST_MAXLEVEL 32 /* Should be enough for 2^64 elements */
#define ZSKIPLIST_P 0.25      /* Skiplist P = 1/4 */
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="为什么zset用跳表而不用平衡树" tabindex="-1"><a class="header-anchor" href="#为什么zset用跳表而不用平衡树" aria-hidden="true">#</a> 为什么Zset用跳表而不用平衡树？</h3>
<p><strong>主要是从内存占用、对范围查找的支持、实现难易程度这三方面总结的原因：</strong></p>
<ul>
<li>它们不是非常内存密集型的。基本上由你决定。改变关于节点具有给定级别数的概率的参数将使其比 btree 占用更少的内存。</li>
<li>Zset 经常需要执行 ZRANGE 或 ZREVRANGE 的命令，即作为链表遍历跳表。通过此操作，跳表的缓存局部性至少与其他类型的平衡树一样好。</li>
<li>它们更易于实现、调试等。例如，由于跳表的简单性，我收到了一个补丁（已经在Redis master中），其中扩展了跳表，在 O(log(N) 中实现了 ZRANK。它只需要对代码进行少量修改。</li>
</ul>
<blockquote>
<ul>
<li><strong>从内存占用上来比较，跳表比平衡树更灵活一些</strong>。平衡树每个节点包含 2 个指针（分别指向左右子树），而跳表每个节点包含的指针数目平均为 1/(1-p)，具体取决于参数 p 的大小。如果像 Redis里的实现一样，取 p=1/4，那么平均每个节点包含 1.33 个指针，比平衡树更有优势。</li>
<li><strong>在做范围查找的时候，跳表比平衡树操作要简单</strong>。在平衡树上，我们找到指定范围的小值之后，还需要以中序遍历的顺序继续寻找其它不超过大值的节点。如果不对平衡树进行一定的改造，这里的中序遍历并不容易实现。而在跳表上进行范围查找就非常简单，只需要在找到小值之后，对第 1 层链表进行若干步的遍历就可以实现。</li>
<li><strong>从算法实现难度上来比较，跳表比平衡树要简单得多</strong>。平衡树的插入和删除操作可能引发子树的调整，逻辑复杂，而跳表的插入和删除只需要修改相邻节点的指针，操作简单又快速。</li>
</ul>
</blockquote>
</div></template>


