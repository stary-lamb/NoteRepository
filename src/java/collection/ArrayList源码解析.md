---
title: ArrayLit 源码解析
date: 2023-06-14
---

## 基本介绍

ArrayList 实现了 List 接口，是顺序容器，即元素存放的数据与放进去的顺序相同，允许放入`null`元素，底层通过**数组实现**。

每个 ArrayList 都有一个容量(capacity)，表示底层数组的实际大小，容器内存储元素的个数不能多于当前容量。

当向容器中添加元素时，如果容量不足，容器会自动增大底层数组的大小。ArrayList中的数组是一个Object数组，以便能够容纳任何类型的对象。

![ArrayList_base](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306140754749.png)

size(), isEmpty(), get(), set()方法均能在常数时间内完成，add()方法的时间开销跟插入位置有关，addAll()方法的时间开销跟添加元素的个数成正比。其余方法大都是线性时间。

为追求效率，ArrayList没有实现同步(synchronized)，如果需要多个线程并发访问，用户可以手动同步，也可使用Vector替代。

## ArraryList 源码

### 全局变量

~~~ java
//用于定于初始的大小
 private static final int DEFAULT_CAPACITY = 10;
//默认初始容量。
 private static final Object[] EMPTY_ELEMENTDATA = {};
//用于空实例的共享空数组实例
 private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};
//操作数组
transient Object[] elementData;
//ArrayList的大小（它包含的元素数）
private int size;
~~~



### 构造函数

~~~ java
 	/**
     * 带初始容量参数的构造函数（用户可以在创建ArrayList对象时自己指定集合的初始大小）
     */
    public ArrayList(int initialCapacity) {
        if (initialCapacity > 0) {
            // 如果传入的参数大于0，创建initialCapacity大小的数组
            this.elementData = new Object[initialCapacity];
        } else if (initialCapacity == 0) {
            // 如果传入的参数等于0，创建空数组
            this.elementData = EMPTY_ELEMENTDATA;
        } else {
            throw new IllegalArgumentException("Illegal Capacity: "+ initialCapacity);
        }
    }

    /**
     * 默认无参构造函数
     * DEFAULTCAPACITY_EMPTY_ELEMENTDATA 为0.初始化为10，也就是说初始其实是空数组 当添加第一个元素的时候数组容量才变成10
     */
    public ArrayList() {
        this.elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
    }

      /**
     * 构造一个包含指定集合的元素的列表，按照它们由集合的迭代器返回的顺序。
     */
    public ArrayList(Collection<? extends E> c) {
        // 将指定集合转换为数组
        elementData = c.toArray();
        // 如果elementData数组的长度不为0
        if ((size = elementData.length) != 0) {
            // 如果elementData不是Object类型数据（c.toArray可能返回的不是Object类型的数组所以加上下面的语句用于判断）
            if (elementData.getClass() != Object[].class)
                // 将原来不是Object类型的elementData数组的内容，赋值给新的Object类型的elementData数组
                elementData = Arrays.copyOf(elementData, size, Object[].class);
        } else {
           // 其他情况，用空数组代替
            this.elementData = EMPTY_ELEMENTDATA;
        }
    }
~~~

### 通过add()看自动扩容

每当向数组中添加元素时，都要去检查添加后元素的个数是否会超出当前数组的长度，如果超出，数组将会进行扩容，以满足添加数据的需求。数组扩容通过一个公开的方法`ensureCapacity(int minCapacity)`来实现。在实际添加大量元素前，我们也可以使用`ensureCapacity`来手动增加`ArrayList`实例的容量，以减少递增式再分配的数量。

数组进行扩容时，会将老数组中的元素重新拷贝一份到新的数组中，每次数组容量的增长大约是其原容量的1.5倍。这种操作的代价是很高的，因此在实际使用时，我们应该尽量避免数组容量的扩张。

当我们可预知要保存的元素的多少时，要在构造`ArrayList`实例时，就指定其容量，以避免数组扩容的发生。或者根据实际需求，通过调用`ensureCapacity`方法来手动增加 ArrayList 实例的容量。

**1. 调用add()**

```java
/**
 * 将指定的元素追加到此列表的末尾。
 */
public boolean add(E e) {
     // 添加元素之前，先调用ensureCapacityInternal方法，如果是空数据
    ensureCapacityInternal(size + 1);  // Increments modCount!!
    elementData[size++] = e;
    return true;
}
```

**2. 确保 ArrayList 内部数组具有足够的容量以容纳指定数量的元素容量**

~~~ java
	/**
	 * 	确保 ArrayList 内部数组具有足够的容量以容纳指定数量的元素，并在需要时对内部数组进行扩容。
	 */
    private void ensureCapacityInternal(int minCapacity) {
        ensureExplicitCapacity(calculateCapacity(elementData, minCapacity));
    }
~~~

**3. 计算容量，如果是空数组，则使用默认容量与最小容量比较，取较大值**

~~~~java
	/**
	 * 计算数组的容量
	 */
	private static int calculateCapacity(Object[] elementData, int minCapacity) {
        if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
            // 如果当前数组为空数组，则返回默认容量（DEFAULT_CAPACITY）和最小容量（minCapacity）中的较大值 
            // DEFAULT_CAPACITY =10
            return Math.max(DEFAULT_CAPACITY, minCapacity);
        }
        // 否则，直接返回最小容量（minCapacity）
        return minCapacity;
    }
~~~~

**4. 增加修改计数器，同时用最小容量-数组长度判断是否需要扩容**

~~~ java
	// 判断是否需要扩容
    private void ensureExplicitCapacity(int minCapacity) {
        // 用于在进行容量修改时增加修改次数计数器。这通常与迭代器等相关，以检测在迭代期间是否对数组进行了结构性修改。
        modCount++;

        // overflow-conscious code
        if (minCapacity - elementData.length > 0)
            // 调用grow方法进行扩容，调用此方法代表已经开始扩容了
            grow(minCapacity);
    }
~~~

**5. ArraryList 扩容**

~~~ java
    /**
     * ArrayList 扩容的核心方法
     */
    private void grow(int minCapacity) {
         // oldCapacity为旧容量，newCapacity为新容量
        int oldCapacity = elementData.length;
        // 将oldCapacity 右移一位，其效果相当于oldCapacity /2，
        // 我们知道位运算的速度远远快于整除运算，整句运算式的结果就是将新容量更新为旧容量的1.5倍，
        int newCapacity = oldCapacity + (oldCapacity >> 1);
        // 然后检查新容量是否大于最小需要容量，若还是小于最小需要容量，那么就把最小需要容量当作数组的新容量，
        if (newCapacity - minCapacity < 0)
            newCapacity = minCapacity;
        // 检查新容量是否超出了数组的最大容量（MAX_ARRAY_SIZE）。
        // 如果超出了最大容量，则调用 hugeCapacity(minCapacity) 方法来判断新容量应该是最大容量还是指定的最小容量。
        if (newCapacity - MAX_ARRAY_SIZE > 0)
            newCapacity = hugeCapacity(minCapacity);
        // 使用 Arrays.copyOf 方法将原始数组（elementData）复制到具有新容量的新数组中，并将新数组赋值给 elementData，以完成扩容操作
        elementData = Arrays.copyOf(elementData, newCapacity);
    }

   	/**
     * 要分配的最大数组大小
     */
    private static final int MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8;

	// 确定要分配的数组的巨大容量。
    private static int hugeCapacity(int minCapacity) {
        // 方法检查最小容量是否小于 0。如果是负数，表示溢出，即超出了整数类型的表示范围，此时抛出 OutOfMemoryError 错误。
        if (minCapacity < 0) 
            throw new OutOfMemoryError();
        // 如果最小容量大于最大数组容量（MAX_ARRAY_SIZE），则返回整数类型的最大值（Integer.MAX_VALUE），表示分配一个尽可能大的数组容量。
	   // 否则，最小容量小于等于最大数组容量，返回最大数组容量（MAX_ARRAY_SIZE），表示分配一个限制在最大容量范围内的数组。
        return (minCapacity > MAX_ARRAY_SIZE) ?
            Integer.MAX_VALUE :
            MAX_ARRAY_SIZE;
    }

~~~

**扩容过程如下图所示：**

![image-20230614102251812](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306141022030.png)

> 同时我们可以通过`ensureCapacity()`方法来对数组的容量进行修改
>
> ~~~ java
> 	/**
>      * 如有必要，增加此ArrayList实例的容量，以确保它至少能容纳元素的数
>      *
>      * @param   minCapacity   所需的最小容量
>      */
>     public void ensureCapacity(int minCapacity) {
>         // 如果是true，minExpand的值为0，如果是false,minExpand的值为10
>         int minExpand = (elementData != DEFAULTCAPACITY_EMPTY_ELEMENTDATA)
>             // any size if not default element table
>             ? 0
>             // larger than default for default empty table. It's already
>             // supposed to be at default size.
>             : DEFAULT_CAPACITY;
>         // 如果最小容量大于已有的最大容量
>         if (minCapacity > minExpand) {
>             ensureExplicitCapacity(minCapacity);
>         }
>         
>     }
> ~~~

### add()，addAll()

#### add()

`add(E e)` 方法是将元素 `e` 添加到列表的末尾，等效于 `add(size(), e)`。这个方法不需要指定要插入元素的索引，因为它总是将元素添加到列表的末尾。

`add(int index, E e)` 方法是将元素 `e` 插入到指定索引 `index` 处，并将原来在该位置及其后面的所有元素向右移动一个索引位置。如果索引 `index` 大于当前列表的大小，则此方法将抛出 `IndexOutOfBoundsException` 异常，因为需要先对元素进行移动，然后完成插入操作，也就意味着该方法有着线性的时间复杂度。

因此，如果你想要在一个指定的位置插入元素，可以使用 `add(int index, E e)` 方法；如果你想要将元素添加到列表的末尾，则可以使用 `add(E e)` 方法。

~~~ java
	/**
     * 将指定的元素追加到此列表的末尾。
     */
	public boolean add(E e) {
        ensureCapacityInternal(size + 1);  // Increments modCount!!
        elementData[size++] = e;
        return true;
    }

 	/**
     * 在此列表中的指定位置插入指定的元素。
     *先调用 rangeCheckForAdd 对index进行界限检查；然后调用 ensureCapacityInternal 方法保证capacity足够大；
     *再将从index开始之后的所有成员后移一个位置；将element插入index位置；最后size加1。
     */
	public void add(int index, E element) {
        rangeCheckForAdd(index);

        ensureCapacityInternal(size + 1);  // Increments modCount!!
        System.arraycopy(elementData, index, elementData, index + 1,
                         size - index);
        elementData[index] = element;
        size++;
    }
~~~

#### addAll()

`addAll()`方法能够一次添加多个元素，根据位置不同也有两个版本，一个是在末尾添加的`addAll(Collection<? extends E> c)`方法，一个是从指定位置开始插入的`addAll(int index, Collection<? extends E> c)`方法。

跟`add()`方法类似，在插入之前也需要进行空间检查，如果需要则自动扩容；如果从指定位置插入，也会存在移动元素的情况。 `addAll()`的时间复杂度不仅跟插入元素的多少有关，也跟插入的位置相关。

~~~ java
	/**
     * 按指定集合的Iterator返回的顺序将指定集合中的所有元素追加到此列表的末尾。
     */
    public boolean addAll(Collection<? extends E> c) {
        Object[] a = c.toArray();
        int numNew = a.length;
        ensureCapacityInternal(size + numNew);  // Increments modCount
        System.arraycopy(a, 0, elementData, size, numNew);
        size += numNew;
        return numNew != 0;
    }

	/**
     * 将指定集合中的所有元素插入到此列表中，从指定的位置开始。
     */
    public boolean addAll(int index, Collection<? extends E> c) {
        rangeCheckForAdd(index);

        Object[] a = c.toArray();
        int numNew = a.length;
        ensureCapacityInternal(size + numNew);  // Increments modCount

        int numMoved = size - index;
        if (numMoved > 0)
            System.arraycopy(elementData, index, elementData, index + numNew,
                             numMoved);

        System.arraycopy(a, 0, elementData, index, numNew);
        size += numNew;
        return numNew != 0;
    }
~~~

### Set()

ArrayList 底层是一个数组，那么`set()`方法也就变得非常简单，直接对数组的指定位置赋值即可。

~~~ java
public E set(int index, E element) {
    rangeCheck(index);//下标越界检查
    E oldValue = elementData(index);
    elementData[index] = element;//赋值到指定位置，复制的仅仅是引用
    return oldValue;
}
~~~

### get()

`get()`方法同样很简单，唯一要注意的是由于底层数组是Object[]，得到元素后需要进行类型转换。

```java
public E get(int index) {
    rangeCheck(index);
    return (E) elementData[index];//注意类型转换
}
```

#### remove()

`remove()`方法也有两个版本，一个是`remove(int index)`删除指定位置的元素，另一个是`remove(Object o)`删除第一个满足`o.equals(elementData[index])`的元素。删除操作是`add()`操作的逆过程，需要将删除点之后的元素向前移动一个位置。需要注意的是为了让GC起作用，必须显式的为最后一个位置赋`null`值。

```java
    /**
     * 删除该列表中指定位置的元素。 将任何后续元素移动到左侧（从其索引中减去一个元素）。
     */
    public E remove(int index) {
        rangeCheck(index);

        modCount++;
        E oldValue = elementData(index);

        int numMoved = size - index - 1;
        if (numMoved > 0)
            System.arraycopy(elementData, index+1, elementData, index,
                             numMoved);
        elementData[--size] = null; // clear to let GC do its work
      //从列表中删除的元素
        return oldValue;
    }

    /**
     * 从列表中删除指定元素的第一个出现（如果存在）。 如果列表不包含该元素，则它不会更改。
     *返回true，如果此列表包含指定的元素
     */
    public boolean remove(Object o) {
        if (o == null) {
            for (int index = 0; index < size; index++)
                if (elementData[index] == null) {
                    fastRemove(index);
                    return true;
                }
        } else {
            for (int index = 0; index < size; index++)
                if (o.equals(elementData[index])) {
                    fastRemove(index);
                    return true;
                }
        }
        return false;
    }
```

关于Java GC这里需要特别说明一下，**有了垃圾收集器并不意味着一定不会有内存泄漏**。对象能否被GC的依据是是否还有引用指向它，上面代码中如果不手动赋`null`值，除非对应的位置被其他元素覆盖，否则原来的对象就一直不会被回收。

### trimToSize()

ArrayList 还给我们提供了将底层数组的容量调整为当前列表保存的实际元素的大小的功能。它可以通过trimToSize方法来实现。代码如下:

~~~ java
    /**
     * 修改这个ArrayList实例的容量是列表的当前大小。 应用程序可以使用此操作来最小化ArrayList实例的存储。
     */
    public void trimToSize() {
        modCount++;
        if (size < elementData.length) {
            elementData = (size == 0)
              ? EMPTY_ELEMENTDATA
              : Arrays.copyOf(elementData, size);
        }
    }
~~~

#### indexOf(), lastIndexOf()

获取元素的索引位置:

~~~ java
/**
     *返回此列表中指定元素的首次出现的索引，如果此列表不包含此元素，则为-1
     */
    public int indexOf(Object o) {
        if (o == null) {
            for (int i = 0; i < size; i++)
                if (elementData[i]==null)
                    return i;
        } else {
            for (int i = 0; i < size; i++)
                //equals()方法比较
                if (o.equals(elementData[i]))
                    return i;
        }
        return -1;
    }

    /**
     * 返回此列表中指定元素的最后一次出现的索引，如果此列表不包含元素，则返回-1。.
     */
    public int lastIndexOf(Object o) {
        if (o == null) {
            for (int i = size-1; i >= 0; i--)
                if (elementData[i]==null)
                    return i;
        } else {
            for (int i = size-1; i >= 0; i--)
                if (o.equals(elementData[i]))
                    return i;
        }
        return -1;
    }
~~~

### Fail-Fast机制

ArrayList也采用了快速失败的机制，通过记录modCount参数来实现。在面对并发的修改时，迭代器很快就会完全失败，而不是冒着在将来某个不确定时间发生任意不确定行为的风险。
