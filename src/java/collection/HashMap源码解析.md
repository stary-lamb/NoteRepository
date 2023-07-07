---
title: HashMap 源码解析
date: 2023-06-14
---

## 基本介绍

HashMap 主要用来存放键值对，它基于哈希表的 Map 接口实现，是常用的 Java 集合之一，是非线程安全的。

`HashMap` 可以存储 null 的 key 和 value，但 null 作为键只能有一个，null 作为值可以有多个

JDK1.8 之前 HashMap 由 数组+链表 组成的，数组是 HashMap 的主体，链表则是主要为了解决哈希冲突而存在的（“拉链法”解决冲突）。 

JDK1.8 以后的 `HashMap` 在解决哈希冲突时有了较大的变化，当链表长度大于等于阈值（默认为 8）（将链表转换成红黑树前会判断，如果当前数组的长度小于 64，那么会选择先进行数组扩容，而不是转换为红黑树）时，将链表转化为红黑树，以减少搜索时间。

`HashMap` 默认的初始化大小为 16。之后每次扩充，容量变为原来的 2 倍。并且， `HashMap` 总是使用 2 的幂作为哈希表的大小。

> 在哈希表中，常见的解决哈希冲突的方法包括以下几种：
>
> 1. 开放地址法（Open addressing）：当发生哈希冲突时，使用一定的探测方法（如线性探测、二次探测、双重散列等）在哈希表中寻找下一个可用的空槽来存储冲突的元素。
> 2. **拉链法（Chaining）或链地址法（Separate chaining）**：每个哈希桶使用链表或其他数据结构（如红黑树）来存储冲突的元素。当发生哈希冲突时，将新的元素添加到对应桶的链表中。
> 3. 公共溢出区域法（Coalesced chaining）：将所有冲突的元素都存储在一个公共溢出区域中，而不是分散在各个桶中。通过链表或其他数据结构来组织和管理溢出区域的元素。
> 4. 其他解决方案：还有一些其他的解决哈希冲突的方法，如再哈希法（Rehashing）、建立二维表等。这些方法根据具体的情况和需求，采用不同的策略来处理哈希冲突。

## 底层数据结构

### JDK1.8 之前

JDK1.8 之前 HashMap 底层是 **数组和链表** 结合在一起使用也就是 **链表散列**。

HashMap 通过 key 的 hashCode 经过扰动函数处理过后得到 hash 值，然后通过 `(n - 1) & hash` 判断当前元素存放的位置（这里的 n 指的是数组的长度），如果当前位置存在元素的话，就判断该元素与要存入的元素的 hash 值以及 key 是否相同，如果相同的话，直接覆盖，不相同就通过拉链法解决冲突。

所谓扰动函数指的就是 HashMap 的 hash 方法。使用 hash 方法也就是扰动函数是为了防止一些实现比较差的 hashCode() 方法 换句话说使用扰动函数之后可以减少碰撞。

**JDK 1.8 HashMap 的 hash 方法源码:**

JDK 1.8 的 hash 方法 相比于 JDK 1.7 hash 方法更加简化，但是原理不变。

~~~~ java
  static final int hash(Object key) {
      int h;
      // key.hashCode()：返回散列值也就是hashcode
      // ^：按位异或
      // >>>:无符号右移，忽略符号位，空位都以0补齐
      return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
  }
~~~~

对比一下 JDK1.7 的 HashMap 的 hash 方法源码。

~~~ java
static int hash(int h) {
    // This function ensures that hashCodes that differ only by
    // constant multiples at each bit position have a bounded
    // number of collisions (approximately 8 at default load factor).

    h ^= (h >>> 20) ^ (h >>> 12);
    return h ^ (h >>> 7) ^ (h >>> 4);
}
~~~

相比于 JDK1.8 的 hash 方法 ，JDK 1.7 的 hash 方法的性能会稍差一点点，因为毕竟扰动了 4 次。

所谓 **“链地址法”** 就是：将链表和数组相结合。也就是说创建一个链表数组，数组中每一格就是一个链表。若遇到哈希冲突，则将冲突的值加到链表中即可。

![image-20230615084821119](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306150848923.png)

### JDK1.8 之后

相比于之前的版本，JDK1.8 以后在解决哈希冲突时有了较大的变化。

当链表长度大于阈值（默认为 8）时，会首先调用 `treeifyBin()`方法。这个方法会根据 HashMap 数组来决定是否转换为红黑树。

只有当数组长度大于或者等于 64 的情况下，才会执行转换红黑树操作，以减少搜索时间。否则，就是只是执行 `resize()` 方法对数组扩容。

![image-20230615085320876](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306150853930.png)

### 类的属性

- **loadFactor 负载因子**

  loadFactor 负载因子是控制数组存放数据的疏密程度，loadFactor 越趋近于 1，那么 数组中存放的数据(entry)也就越多，也就越密，也就是会让链表的长度增加，loadFactor 越小，也就是趋近于 0，数组中存放的数据(entry)也就越少，也就越稀疏。

  **loadFactor 太大导致查找元素效率低，太小导致数组的利用率低，存放的数据会很分散。loadFactor 的默认值为 0.75f 是官方给出的一个比较好的临界值**。

  给定的默认容量为 16，负载因子为 0.75。Map 在使用过程中不断的往里面存放数据，当数量超过了 16 * 0.75 = 12 就需要将当前 16 的容量进行扩容，而扩容这个过程涉及到 rehash、复制数据等操作，所以非常消耗性能。
  
- **threshold**

  **threshold = capacity * loadFactor**，**当 Size>threshold**的时候，那么就要考虑对数组的扩增了，也就是说，这个的意思就是 **衡量数组是否需要扩增的一个标准**。

~~~~ java
public class HashMap<K,V> extends AbstractMap<K,V> implements Map<K,V>, Cloneable, Serializable {
    // 序列号
    private static final long serialVersionUID = 362498820763181265L;
    // 默认的初始容量是16
    static final int DEFAULT_INITIAL_CAPACITY = 1 << 4;
    // 最大容量
    static final int MAXIMUM_CAPACITY = 1 << 30;
    // 默认的负载因子
    static final float DEFAULT_LOAD_FACTOR = 0.75f;
    // 当桶(bucket)上的结点数大于等于这个值时会转成红黑树
    static final int TREEIFY_THRESHOLD = 8;
    // 当桶(bucket)上的结点数小于等于这个值时树转链表
    static final int UNTREEIFY_THRESHOLD = 6;
    // 桶中结构转化为红黑树对应的table的最小容量
    static final int MIN_TREEIFY_CAPACITY = 64;
    // 存储元素的数组，总是2的幂次倍
    transient Node<k,v>[] table;
    // 存放具体元素的集
    transient Set<map.entry<k,v>> entrySet;
    // 存放元素的个数，注意这个不等于数组的长度。
    transient int size;
    // 每次扩容和更改map结构的计数器
    transient int modCount;
    // 阈值(容量*负载因子) 当实际大小超过阈值时，会进行扩容
    int threshold;
    // 负载因子
    final float loadFactor;
}
~~~~

### Node 节点类源码

~~~ java
// 继承自 Map.Entry<K,V>
static class Node<K,V> implements Map.Entry<K,V> {
       final int hash;// 哈希值，存放元素到hashmap中时用来与其他元素hash值比较
       final K key;//键
       V value;//值
       // 指向下一个节点
       Node<K,V> next;
       Node(int hash, K key, V value, Node<K,V> next) {
            this.hash = hash;
            this.key = key;
            this.value = value;
            this.next = next;
        }
        public final K getKey()        { return key; }
        public final V getValue()      { return value; }
        public final String toString() { return key + "=" + value; }
        // 重写hashCode()方法
        public final int hashCode() {
            return Objects.hashCode(key) ^ Objects.hashCode(value);
        }

        public final V setValue(V newValue) {
            V oldValue = value;
            value = newValue;
            return oldValue;
        }
        // 重写 equals() 方法
        public final boolean equals(Object o) {
            if (o == this)
                return true;
            if (o instanceof Map.Entry) {
                Map.Entry<?,?> e = (Map.Entry<?,?>)o;
                if (Objects.equals(key, e.getKey()) &&
                    Objects.equals(value, e.getValue()))
                    return true;
            }
            return false;
        }
}

~~~

### 树节点类源码

~~~ java
static final class TreeNode<K,V> extends LinkedHashMap.Entry<K,V> {
        TreeNode<K,V> parent;  // 父
        TreeNode<K,V> left;    // 左
        TreeNode<K,V> right;   // 右
        TreeNode<K,V> prev;    // needed to unlink next upon deletion
        boolean red;           // 判断颜色
        TreeNode(int hash, K key, V val, Node<K,V> next) {
            super(hash, key, val, next);
        }
        // 返回根节点
        final TreeNode<K,V> root() {
            for (TreeNode<K,V> r = this, p;;) {
                if ((p = r.parent) == null)
                    return r;
                r = p;
       }

~~~

## HashMap 源码

### 构造方法

HashMap 中有四个构造方法，它们分别如下：

~~~ java
    // 默认构造函数。
    public HashMap() {
        this.loadFactor = DEFAULT_LOAD_FACTOR; // all   other fields defaulted
     }

     // 包含另一个“Map”的构造函数
     public HashMap(Map<? extends K, ? extends V> m) {
         this.loadFactor = DEFAULT_LOAD_FACTOR;
         putMapEntries(m, false);//下面会分析到这个方法
     }

     // 指定“容量大小”的构造函数
     public HashMap(int initialCapacity) {
         this(initialCapacity, DEFAULT_LOAD_FACTOR);
     }

     // 指定“容量大小”和“负载因子”的构造函数
     public HashMap(int initialCapacity, float loadFactor) {
         if (initialCapacity < 0)
             throw new IllegalArgumentException("Illegal initial capacity: " + initialCapacity);
         if (initialCapacity > MAXIMUM_CAPACITY)
             initialCapacity = MAXIMUM_CAPACITY;
         if (loadFactor <= 0 || Float.isNaN(loadFactor))
             throw new IllegalArgumentException("Illegal load factor: " + loadFactor);
         this.loadFactor = loadFactor;
         // 初始容量暂时存放到 threshold ，在resize中再赋值给 newCap 进行table初始化
         this.threshold = tableSizeFor(initialCapacity);
     }

~~~

> PS：上述四个构造方法中，都初始化了负载因子 loadFactor，由于HashMap中没有 capacity 这样的字段，即使指定了初始化容量 initialCapacity ，也只是通过 tableSizeFor 将其扩容到与 initialCapacity 最接近的2的幂次方大小，然后暂时赋值给 threshold ，后续通过 resize 方法将 threshold 赋值给 newCap 进行 table 的初始化。



**putMapEntries 方法：**

~~~ java
final void putMapEntries(Map<? extends K, ? extends V> m, boolean evict) {
    int s = m.size();
    if (s > 0) {
        // 判断table是否已经初始化
        if (table == null) { // pre-size
            /*
             * 未初始化，s为m的实际元素个数，ft=s/loadFactor => s=ft*loadFactor, 跟我们前面提到的
             * 阈值=容量*负载因子 是不是很像，是的，ft指的是要添加s个元素所需的最小的容量
             */
            float ft = ((float)s / loadFactor) + 1.0F;
            int t = ((ft < (float)MAXIMUM_CAPACITY) ?
                    (int)ft : MAXIMUM_CAPACITY);
            /*
             * 根据构造函数可知，table未初始化，threshold实际上是存放的初始化容量，如果添加s个元素所
             * 需的最小容量大于初始化容量，则将最小容量扩容为最接近的2的幂次方大小作为初始化。
             * 注意这里不是初始化阈值
             */
            if (t > threshold)
                threshold = tableSizeFor(t);
        }
        // 已初始化，并且m元素个数大于阈值，进行扩容处理
        else if (s > threshold)
            resize();
        // 将m中的所有元素添加至HashMap中，如果table未初始化，putVal中会调用resize初始化或扩容
        for (Map.Entry<? extends K, ? extends V> e : m.entrySet()) {
            K key = e.getKey();
            V value = e.getValue();
            putVal(hash(key), key, value, false, evict);
        }
    }
}
]
~~~

### put()

HashMap 只提供了 put 用于添加元素，putVal 方法只是给 put 方法调用的一个方法，并没有提供给用户使用。

**对 putVal 方法添加元素的分析如下：**

1. 如果定位到的数组位置没有元素 就直接插入。
2. 如果定位到的数组位置有元素就和要插入的 key 比较，如果 key 相同就直接覆盖，如果 key 不相同，就判断 p 是否是一个树节点，如果是就调用`e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value)`将元素添加进入。如果不是就遍历链表插入(插入的是链表尾部)。

![image-20230706221527732](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202307062216647.png)

~~~~ java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    // table未初始化或者长度为0，进行扩容
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;
    // (n - 1) & hash 确定元素存放在哪个桶中，桶为空，新生成结点放入桶中(此时，这个结点是放在数组中)
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    // 桶中已经存在元素（处理hash冲突）
    else {
        Node<K,V> e; K k;
        //快速判断第一个节点table[i]的key是否与插入的key一样，若相同就直接使用插入的值p替换掉旧的值e。
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
                e = p;
        // 判断插入的是否是红黑树节点
        else if (p instanceof TreeNode)
            // 放入树中
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
        // 不是红黑树节点则说明为链表结点
        else {
            // 在链表最末插入结点
            for (int binCount = 0; ; ++binCount) {
                // 到达链表的尾部
                if ((e = p.next) == null) {
                    // 在尾部插入新结点
                    p.next = newNode(hash, key, value, null);
                    // 结点数量达到阈值(默认为 8 )，执行 treeifyBin 方法
                    // 这个方法会根据 HashMap 数组来决定是否转换为红黑树。
                    // 只有当数组长度大于或者等于 64 的情况下，才会执行转换红黑树操作，以减少搜索时间。否则，就是只是对数组扩容。
                    if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                        treeifyBin(tab, hash);
                    // 跳出循环
                    break;
                }
                // 判断链表中结点的key值与插入的元素的key值是否相等
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    // 相等，跳出循环
                    break;
                // 用于遍历桶中的链表，与前面的e = p.next组合，可以遍历链表
                p = e;
            }
        }
        // 表示在桶中找到key值、hash值与插入元素相等的结点
        if (e != null) {
            // 记录e的value
            V oldValue = e.value;
            // onlyIfAbsent为false或者旧值为null
            if (!onlyIfAbsent || oldValue == null)
                //用新值替换旧值
                e.value = value;
            // 访问后回调
            afterNodeAccess(e);
            // 返回旧值
            return oldValue;
        }
    }
    // 结构性修改
    ++modCount;
    // 实际大小大于阈值则扩容
    if (++size > threshold)
        resize();
    // 插入后回调
    afterNodeInsertion(evict);
    return null;
}
~~~~

**我们再来对比一下 JDK1.7 put 方法的代码**

**对于 put 方法的分析如下：**

- 如果定位到的数组位置没有元素 就直接插入。

- 如果定位到的数组位置有元素，遍历以这个元素为头结点的链表，依次和插入的 key 比较，如果 key 相同就直接覆盖，不同就采用头插法插入元素。

~~~~ java
public V put(K key, V value)
    if (table == EMPTY_TABLE) {
    inflateTable(threshold);
}
    if (key == null)
        return putForNullKey(value);
    int hash = hash(key);
    int i = indexFor(hash, table.length);
    for (Entry<K,V> e = table[i]; e != null; e = e.next) { // 先遍历
        Object k;
        if (e.hash == hash && ((k = e.key) == key || key.equals(k))) {
            V oldValue = e.value;
            e.value = value;
            e.recordAccess(this);
            return oldValue;
        }
    }

    modCount++;
    addEntry(hash, key, value, i);  // 再插入
    return null;
}
~~~~

### get()

当 HashMap 只存在数组，而数组中没有 Node 链表时，是 HashMap 查询数据性能最好的时候。

一旦发生大量的哈希冲突，就会产生 Node 链表，这个时候每次查询元素都可能遍历 Node 链表，从而降低查询数据的性能。

特别是在链表长度过长的情况下，性能明显下降，使用红黑树就很好地解决了这个问题，红黑树使得查询的平均复杂度降低到了 O(log(n))，链表越长，使用红黑树替换后的查询效率提升就越明显。  

![image-20230615103207854](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306151032921.png)

~~~~ java
public V get(Object key) {
    Node<K,V> e;
    return (e = getNode(hash(key), key)) == null ? null : e.value;
}

final Node<K,V> getNode(int hash, Object key) {
    Node<K,V>[] tab; Node<K,V> first, e; int n; K k;
    //数组不为null，数组长度大于0，根据hash计算出来的槽位的元素不为null
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (first = tab[(n - 1) & hash]) != null) {
        // 查找的元素在数组中，返回该元素
        if (first.hash == hash && // always check first node
            ((k = first.key) == key || (key != null && key.equals(k))))
            return first;
        // 查找的元素在链表或红黑树中
        if ((e = first.next) != null) {
            // 素在红黑树中，返回该元素
            if (first instanceof TreeNode)
                return ((TreeNode<K,V>)first).getTreeNode(hash, key);
            // 遍历链表，元素在链表中，返回该元素
            do {
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    return e;
            } while ((e = e.next) != null);
        }
    }
    // 找不到返回null
    return null;
}
~~~~

### remove()

![image-20230615104749926](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306151047998.png)

~~~ java
 public V remove(Object key) {
        Node<K,V> e;
        return (e = removeNode(hash(key), key, null, false, true)) == null ?
            null : e.value;
}
final Node<K,V> removeNode(int hash, Object key, Object value,
                               boolean matchValue, boolean movable) {
        Node<K,V>[] tab; Node<K,V> p; int n, index;
    	// 数组不为null，数组长度大于0，要删除的元素计算的槽位有元素
        if ((tab = table) != null && (n = tab.length) > 0 &&
            (p = tab[index = (n - 1) & hash]) != null) {
            Node<K,V> node = null, e; K k; V v;
            // 当前元素在数组中
            if (p.hash == hash &&
                ((k = p.key) == key || (key != null && key.equals(k))))
                node = p;
            // 元素在红黑树或链表中
            else if ((e = p.next) != null) {
                // 是树节点，从树种查找节点
                if (p instanceof TreeNode)
                    node = ((TreeNode<K,V>)p).getTreeNode(hash, key);
                else {
                    do {
                        // hash相同，并且key相同，找到节点并结束
                        if (e.hash == hash &&
                            ((k = e.key) == key ||
                             (key != null && key.equals(k)))) {
                            node = e;
                            break;
                        }
                        p = e;
                    } while ((e = e.next) != null);//遍历链表
                }
            }
            // 找到节点了，并且值也相同
            if (node != null && (!matchValue || (v = node.value) == value ||
                                 (value != null && value.equals(v)))) {
                // 是树节点，从树中移除
                if (node instanceof TreeNode)
                    ((TreeNode<K,V>)node).removeTreeNode(this, tab, movable);
                // 节点在数组中
                else if (node == p)
                    tab[index] = node.next;
                // 节点在链表中
                else
                    // 将节点删除
                    p.next = node.next;
                ++modCount;// 修改计数器+1，为迭代服务
                --size;// 数量-1
                afterNodeRemoval(node);// 什么都不做
                return node;// 返回删除的节点
            }
        }
        return null;
    }
~~~

### containsKey()

~~~ java
public boolean containsKey(Object key) {
    	// 查看上面的get的getNode
        return getNode(hash(key), key) != null;
}
~~~

### containsValue()

~~~ java
public boolean containsValue(Object value) {
        Node<K,V>[] tab; V v;
    	// 数组不为null并且长度大于0
        if ((tab = table) != null && size > 0) {
            // 数组不为null并且长度大于0
            for (int i = 0; i < tab.length; ++i) {
                for (Node<K,V> e = tab[i]; e != null; e = e.next) {
                    // 组不为null并且长度大于0
                    if ((v = e.value) == value ||
                        (value != null && value.equals(v)))
                        return true;
                }
            }
        }
    	// 找不到返回false
        return false;
}
~~~

### putAll()

![image-20230615105559240](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306151055316.png)

~~~~ java
public void putAll(Map<? extends K, ? extends V> m) {
        putMapEntries(m, true);
}

final void putMapEntries(Map<? extends K, ? extends V> m, boolean evict) {
    	// 获得插入整个m的元素数量
        int s = m.size();
        if (s > 0) {
            if (table == null) { // pre-size，当前map还没有初始化数组
                // m的容量 
                float ft = ((float)s / loadFactor) + 1.0F;
                // 判断容量是否大于最大值MAXIMUM_CAPACITY 
                int t = ((ft < (float)MAXIMUM_CAPACITY) ?
                         (int)ft : MAXIMUM_CAPACITY);
                // 容量达到了边界值，比如插入的m的定义容量是16，但当前map的边界值是12，需要对当前map进行重新计算边界值
                if (t > threshold)
                    threshold = tableSizeFor(t);
            }
            else if (s > threshold)
                resize();
            // 对m进行遍历，放到当前map中
            for (Map.Entry<? extends K, ? extends V> e : m.entrySet()) {
                K key = e.getKey();
                V value = e.getValue();
                putVal(hash(key), key, value, false, evict);
            }
        }
}
~~~~

#### clear()

~~~ java
public void clear() {
        Node<K,V>[] tab;
    	// 修改计数器+1，为迭代服务
        modCount++;
        if ((tab = table) != null && size > 0) {
            // 将数组的元素格式置为0，然后遍历数组，将每个槽位的元素置为null
            size = 0;
            for (int i = 0; i < tab.length; ++i)
                tab[i] = null;
        }
}
~~~

### replace()

~~~ java
public boolean replace(K key, V oldValue, V newValue) {
        Node<K,V> e; V v;
    	// 根据hash计算得到槽位的节点不为null，并且节点的值等于旧值
        if ((e = getNode(hash(key), key)) != null &&
            ((v = e.value) == oldValue || (v != null && v.equals(oldValue)))) {
            // 覆盖旧值
            e.value = newValue;
            afterNodeAccess(e);
            return true;
        }
        return false;
}

public V replace(K key, V value) {
        Node<K,V> e;
    	// 根据hash计算得到槽位的节点不为null
        if ((e = getNode(hash(key), key)) != null) {
            // 节点的旧值
            V oldValue = e.value;
            // 覆盖旧值
            e.value = value;
            afterNodeAccess(e);
            // 返回旧值
            return oldValue;
        }
    	// 找不到key对应的节点
        return null;
}
~~~

### resize()

进行扩容，会伴随着一次重新 hash 分配，并且会遍历 hash 表中所有的元素，是非常耗时的。在编写程序中，要尽量避免 resize。resize方法实际上是将 table 初始化和 table 扩容 进行了整合，底层的行为都是给 table 赋值一个新的数组。

~~~ java
static final int DEFAULT_INITIAL_CAPACITY = 1 << 4; // aka 16，默认大小

//元素的位置要么是在原位置，要么是在原位置再移动2次幂的位置
final Node<K,V>[] resize() {
    // 原先的数组，旧数组
    Node<K,V>[] oldTab = table;
    // 旧数组长度
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    // 阀值
    int oldThr = threshold;
    int newCap, newThr = 0;
    // 数组已经存在不需要进行初始化
    if (oldCap > 0) {
        // 旧数组容量超过最大容量限制，不扩容直接返回旧数组
        if (oldCap >= MAXIMUM_CAPACITY) {
            threshold = Integer.MAX_VALUE;
            return oldTab;
        }
        // 进行2倍扩容后的新数组容量小于最大容量和旧数组长度大于等于16
        else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY && oldCap >= DEFAULT_INITIAL_CAPACITY)
            newThr = oldThr << 1; // double threshold，重新计算阀值为原来的2倍
    }
    // 初始化数组
    else if (oldThr > 0) // initial capacity was placed in threshold，有阀值，初始容量的值为阀值
        // 创建对象时初始化容量大小放在threshold中，此时只需要将其作为新的数组容量
        newCap = oldThr;
    else { // 没有阈值 
        // 初始化的默认容量
        newCap = DEFAULT_INITIAL_CAPACITY;
        // 重新计算阀值
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);
    }
    // 有阀值，定义了新数组的容量，重新计算阀值
    if (newThr == 0) {
        // 创建时指定了初始化容量或者负载因子，在这里进行阈值初始化，
    	// 或者扩容前的旧容量小于16，在这里计算新的resize上限
        float ft = (float)newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY ? (int)ft : Integer.MAX_VALUE);
    }
    // 赋予新阀值
    threshold = newThr;
    @SuppressWarnings({"rawtypes","unchecked"})
        Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    table = newTab;
    // 如果旧数组有数据，进行数据移动，如果没有数据，返回一个空数组
    if (oldTab != null) {
        // 对旧数组进行遍历
        for (int j = 0; j < oldCap; ++j) {
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {
                // 将旧数组的所属位置的旧元素清空
                oldTab[j] = null;
                if (e.next == null)
                    // 当前节点是在数组上，后面没有链表，重新计算槽位
                    newTab[e.hash & (newCap - 1)] = e;
                else if (e instanceof TreeNode)
                    // 当前节点是红黑树，红黑树重定位，将红黑树拆分成2棵子树，拆分后的子树节点数小于等于6，则将树转化成链表
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);
                else {
                    Node<K,V> loHead = null, loTail = null;
                    Node<K,V> hiHead = null, hiTail = null;
                    Node<K,V> next;
                    // 遍历链表
                    do {
                        next = e.next;
                        // 不需要移位
                        if ((e.hash & oldCap) == 0) {
                            // 头节点是空的
                            if (loTail == null)
                                loHead = e;
                            else
                                // 头节点放置当前遍历到的元素
                                loTail.next = e;
                            // 尾节点重置为当前元素
                            loTail = e;
                        }
                        else {// 需要移位
                            if (hiTail == null)// 头节点是空的
                                hiHead = e;// 头节点放置当前遍历到的元素
                            else
                                hiTail.next = e;// 当前元素放到尾节点的后面
                            hiTail = e;// 尾节点重置为当前元素
                        }
                    } while ((e = next) != null);
                    // 不需要移位
                    if (loTail != null) {
                        loTail.next = null;
                        // 原位置
                        newTab[j] = loHead;
                    }
                    if (hiTail != null) {
                        hiTail.next = null;
                        // 移动到当前hash槽位 + oldCap的位置，即在原位置再移动2次幂的位置
                        newTab[j + oldCap] = hiHead;
                    }
                }
            }
        }
    }
    return newTab;
}
~~~

- **当前节点是数组，后面没有链表，重新计算槽位:位与操作的效率比效率高**

​	定位槽位：e.hash & (newCap - 1)  

> 我们用长度16, 待插入节点的hash值为21举例:  
>
> (1)取余: 21 % 16 = 5
> (2)位与:
> 	21: 0001 0101
> 			&
> 	15: 0000 1111
> 	5:  0000 0101  

- **遍历链表，对链表节点进行移位判断：(e.hash & oldCap) == 0**  

> 比如oldCap=8,hash是3，11，19，27时，
>
> 1. JDK1.8中(e.hash & oldCap)的结果是0，8，0，8，这样3，19组成新的链表，index为3；
>
>    而11，27组成新的链表，新分配的index为3+8；
>
> 2. JDK1.7中是(e.hash & newCap-1)，newCap是oldCap的两倍，也就是3，11，19，27对(16-1)与计算，也是0，8，0，8，
>
>    但由于是使用了单链表的头插入方式，即同一位置上新元素总会被放在链表的头部位置；这样先放在一个索引上的元素终会被放到Entry链的尾部(如果发生了hash冲突的话），这样index为3的链表是19，3，index为3+8的链表是 27，11。
>
>    也就是说1.7中经过resize后数据的顺序变成了倒叙，而1.8没有改变顺序。  

## HashSet

HashSet 是对 HashMap 做了一层包装，也就是说HashSet 里面有一个 HashMap (适配器模式)，对 HashSet 的函数调用都会转换成合适的 HashMap 方法。

~~~ java
public class HashSet<E> {
	......
	private transient HashMap<E,Object> map;//HashSet里面有一个HashMap
    // Dummy value to associate with an Object in the backing Map
    private static final Object PRESENT = new Object();
    public HashSet() {
        map = new HashMap<>();
    }
    ......
    public boolean add(E e) {//简单的方法转换
        return map.put(e, PRESENT)==null;
    }
    ......
}
~~~

