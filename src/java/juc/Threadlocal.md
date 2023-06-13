---
title: ThreadLocal
date: 2023-06-10
---

## ThreadLocal 基本介绍

ThreadLocal 提供线程局部变量。这些变量与正常的变量不同，因为每一个线程在访问ThreadLocal实例的时候（通过其get或set方法）**都有自己的、独立初始化的变量副本**。

ThreadLocal实例通常是类中的私有静态字段，使用它的目的是希望将状态（例如，用户ID或事务ID）与线程关联起来。

**ThreadLocal的作用**

- 实现每一个线程都有自己专属的本地变量副本(自己用自己的变量不麻烦别人，不和其他人共享，人人有份，人各一份)，
- 主要解决了让每个线程绑定自己的值，通过使用get()和set()方法，获取默认值或将其值更改为当前线程所存的副本的值从而避免了线程安全问题。

![image-20230610140631062](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101407836.png)

### 需求

**1. 按照总销售额统计，方便集团公司做计划统计**

~~~ java

class MovieTicket {
    int number = 50;

    public synchronized void saleTicket() {
        if(number > 0) {
            System.out.println(Thread.currentThread().getName()+"\t"+"号售票员卖出第： "+(number--));
        }else{
            System.out.println("--------卖完了");
        }
    }
}

/**
 * @auther zzyy
 * @create 2021-03-23 15:03
 * 三个售票员卖完50张票务，总量完成即可，吃大锅饭，售票员每个月固定月薪
 */
public class ThreadLocalDemo {
    public static void main(String[] args) {
        MovieTicket movieTicket = new MovieTicket();

        for (int i = 1; i <=3; i++) {
            new Thread(() -> {
                for (int j = 0; j <20; j++) {
                    movieTicket.saleTicket();
                    try { TimeUnit.MILLISECONDS.sleep(10); } catch (InterruptedException e) { e.printStackTrace(); }
                }
            },String.valueOf(i)).start();
        }
    }
}
~~~



**2. 更换需求不参加总和计算，希望各自分灶吃饭，各凭销售本事提成，按照出单数各自统计**

~~~ java
class MovieTicket {
    int number = 50;

    public synchronized void saleTicket() {
        if (number > 0) {
            System.out.println(Thread.currentThread().getName() + "\t" + "---卖出第： " + (number--));
        } else {
            System.out.println("----卖光了");
        }
    }
}

class House {
    private String houseName;

    ThreadLocal<Integer> threadLocal = ThreadLocal.withInitial(() -> 0);

    public void saleHouse() {
        Integer value = threadLocal.get();
        ++value;
        threadLocal.set(value);
    }

    ThreadLocal<Integer> threadLocal2 = ThreadLocal.withInitial(() -> 100);

    public void saleHouse2() {
        Integer value = threadLocal2.get();
        ++value;
        threadLocal2.set(value);
    }
}

/**
 * 2  分灶吃饭，各个销售自己动手，丰衣足食
 */
public class ThreadLocalDemo {
    public static void main(String[] args) {
        House house = new House();

        new Thread(() -> {
            try {
                for (int j = 1; j <= 3; j++) {
                    house.saleHouse();
                    house.saleHouse2();
                }
                System.out.println(Thread.currentThread().getName() + "\t" + "---卖出： " + house.threadLocal.get());
                System.out.println(Thread.currentThread().getName() + "\t" + "---卖出： " + house.threadLocal2.get());
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                house.threadLocal.remove();//如果不清理自定义的 ThreadLocal 变量，可能会影响后续业务逻辑和造成内存泄露等问题
                house.threadLocal2.remove();
            }
        }, "t1").start();

        new Thread(() -> {
            try {
                for (int j = 1; j <= 5; j++) {
                    house.saleHouse();
                }
                System.out.println(Thread.currentThread().getName() + "\t" + "---卖出： " + house.threadLocal.get());
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                house.threadLocal.remove();
            }
        }, "t2").start();

        new Thread(() -> {
            try {
                for (int j = 1; j <= 8; j++) {
                    house.saleHouse();
                }
                System.out.println(Thread.currentThread().getName() + "\t" + "---卖出： " + house.threadLocal.get());
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                house.threadLocal.remove();
            }
        }, "t3").start();


        System.out.println(Thread.currentThread().getName() + "\t" + "---卖出： " + house.threadLocal.get());


        House bighouse = new House();

        new Thread(() -> {
            bighouse.saleHouse();
        }, "t1").start();

        new Thread(() -> {
            bighouse.saleHouse();
        }, "t2").start();

    }
}
~~~

#### 小结

1. 因为每个 Thread 内有自己的实例副本且该副本只由当前线程自己使用
2. 既然其它 Thread 不可访问，那就不存在多线程间共享的问题。
3. 统一设置初始值，但是每个线程对这个值的修改都是各自线程互相独立的

## 阿里规范

![image-20230610141721092](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101417150.png)

### 非线程安全的SimpleDateFormat

**官方文档：**

SimpleDateFormat 中的日期格式不是同步的。推荐（建议）为每个线程创建独立的格式实例。如果多个线程同时访问一个格式，则它必须保持外部同步。

![image-20230610141819136](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101418208.png)

将 SimpleDateFormat 定义为静态变量在多线程的场景会出现的问题，代码演示：

~~~ java
public class DateUtils {
    public static final SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    /**
     * 模拟并发环境下使用SimpleDateFormat的parse方法将字符串转换成Date对象
     * @param stringDate
     * @return
     * @throws Exception
     */
    public static Date parseDate(String stringDate)throws Exception {
        return sdf.parse(stringDate);
    }
    
    public static void main(String[] args) throws Exception {
        for (int i = 1; i <=30; i++) {
            new Thread(() -> {
                try {
                    System.out.println(DateUtils.parseDate("2020-11-11 11:11:11"));
                } catch (Exception e) {
                    e.printStackTrace();
                }
            },String.valueOf(i)).start();
        }
    }
}
~~~

![image-20230610142102668](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101421884.png)



**源码分析：**

SimpleDateFormat类内部有一个Calendar对象引用,它用来储存和这个`SimpleDateFormat`相关的日期信息,例如sdf.parse(dateStr),sdf.format(date) 诸如此类的方法参数传入的日期相关 String，Date 等等, 都是交由 Calendar 引用来储存的.这样就会导致一个问题**如果你的 SimpleDateFormat 是个 static 的, 那么多个 thread 之间就会共享这个 SimpleDateFormat, 同时也是共享这 个Calendar 引用**.

### 解决方案一

将SimpleDateFormat定义成局部变量。

缺点：每调用一次方法就会创建一个SimpleDateFormat对象，方法结束又要作为垃圾回收。

~~~~ java
public class DateUtils {
    
    public static void main(String[] args) throws Exception {
        for (int i = 1; i <=30; i++) {
            new Thread(() -> {
                try {
                    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                    System.out.println(sdf.parse("2020-11-11 11:11:11"));
                    sdf = null;
                } catch (Exception e) {
                    e.printStackTrace();
                }
            },String.valueOf(i)).start();
        }
    }
}
~~~~

### 解决方案二

使用 ThreadLocal。

~~~ java
public class DateUtils {
    private static final ThreadLocal<SimpleDateFormat>  sdf_threadLocal =
            ThreadLocal.withInitial(()-> new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"));

    /**
     * ThreadLocal可以确保每个线程都可以得到各自单独的一个SimpleDateFormat的对象，那么自然也就不存在竞争问题了。
     * @param stringDate
     * @return
     * @throws Exception
     */
    public static Date parseDateTL(String stringDate)throws Exception {
        return sdf_threadLocal.get().parse(stringDate);
    }

    public static void main(String[] args) throws Exception {
        for (int i = 1; i <=30; i++) {
            new Thread(() -> {
                try {
                    System.out.println(DateUtils.parseDateTL("2020-11-11 11:11:11"));
                } catch (Exception e) {
                    e.printStackTrace();
                }
            },String.valueOf(i)).start();
        }
    }
}
~~~

## Thread，ThreadLocal，ThreadLocalMap 之间的关系

### Thread 和 ThreadLocal

![image-20230610142922362](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101429414.png)



### ThreadLocal和ThreadLocalMap

![image-20230610142951464](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101429517.png)

### 三者之间的关系

1. `Thread`：
   - `Thread`是Java中表示线程的类，它封装了线程的执行上下文、状态和行为。
   - 每个`Thread`对象代表一个独立的执行线程，并且可以通过调用其`start()`方法启动线程的执行。
   - 每个线程在运行时都有一个相关联的`Thread`对象。
2. `ThreadLocal`：
   - `ThreadLocal`是Java中的一个类，用于在每个线程中维护独立的变量副本。
   - `ThreadLocal`提供了`get()`和`set()`方法，可以访问和操作与当前线程关联的变量副本。
   - 每个线程可以独立地修改自己的变量副本，而不会影响其他线程的副本。
   - `ThreadLocal`通常用于在多线程环境中实现线程安全的变量访问，每个线程都可以拥有自己的变量副本，避免了线程间的竞争和同步问题。
3. `ThreadLocalMap`：
   - `ThreadLocalMap`是`ThreadLocal`的内部类，用于存储每个线程的变量副本。
   - 每个`Thread`对象中都有一个`ThreadLocalMap`实例，用于存储当前线程的所有`ThreadLocal`变量和对应的值。
   - `ThreadLocalMap`使用哈希表的数据结构来实现，其中`ThreadLocal`对象作为键，对应的值存储在哈希表的条目中。
   - 当调用`ThreadLocal`的`get()`或`set()`方法时，实际上是通过当前线程的`ThreadLocalMap`来获取或设置对应的变量值。

![image-20230610143227307](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101433267.png)

> `ThreadLocalMap` 实际上就是一个以`ThreadLocal`实例为key，任意对象为value的Entry对象。
>
> 当我们为`threadLocal`变量赋值，实际上就是以当前`threadLocal`实例为key，值为value的Entry往这个`threadLocalMa`中存放
>
> 每个线程通过`Thread`对象表示，`ThreadLocal`用于在每个线程中维护独立的变量副本，而`ThreadLocalMap`作为`Thread`的内部类用于存储每个线程的变量副本。每个线程拥有自己的`ThreadLocalMap`，通过`ThreadLocal`对象在`ThreadLocalMap`中进行变量的存取操作，实现了线程之间的隔离和独立访问

## ThreadLocal 内存泄漏问题

内存泄漏：不再会被使用的对象或者变量占用的内存不能被回收，就是内存泄露。

### 为什么会出现内存泄漏

`ThreadLocalMap`从字面上就可以看出这是一个保存`ThreadLocal`对象的map(其实是以它为Key)，不过是经过了两层包装的`ThreadLocal`对象：

1. 第一层包装是使用 WeakReference<ThreadLocal<?>> 将ThreadLocal对象变成一个弱引用的对象；
2. 第二层包装是定义了一个专门的类 Entry 来扩展 WeakReference<ThreadLocal<?>>

![image-20230505224857538[]](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101451531.png)

> PS：在使用ThreadLocal的时候，强烈建议：**务必手动remove**

### 强、软、弱、虚

#### 强引用

当内存不足，JVM开始垃圾回收，**对于强引用的对象**，**就算是出现了OOM也不会对该对象进行回收，死都不收**。

强引用是我们最常见的普通对象引用，只要还有强引用指向一个对象，就能表明对象还“活着”，垃圾收集器不会碰这种对象。

在 Java 中最常见的就是强引用，把一个对象赋给一个引用变量，这个引用变量就是一个强引用。

当一个对象被强引用变量引用时，它处于可达状态，它是不可能被垃圾回收机制回收的，**即使该对象以后永远都不会被用到JVM也不会回收。因此强引用是造成Java内存泄漏的主要原因之一。**

对于一个普通的对象，如果没有其他的引用关系，只要超过了引用的作用域或者显式地将相应（强）引用赋值为 null，一般认为就是可以被垃圾收集的了(当然具体回收时机还是要看垃圾收集策略)。

#### 软引用

软引用是一种相对强引用弱化了一些的引用，需要用java.lang.ref.SoftReference类来实现，可以让对象豁免一些垃圾收集。

对于只有软引用的对象来说，

- **当系统内存充足时，它不会被回收**

- **当系统内存不足时，它才会被回收。**

软引用通常用在对内存敏感的程序中，比如高速缓存就有用到软引用，**内存够用的时候就保留，不够用就回收**！

#### 弱引用

弱引用需要用java.lang.ref.WeakReference类来实现，它比软引用的生存期更短，

对于只有弱引用的对象来说，只要垃圾回收机制一运行，不管JVM的内存空间是否足够，都会回收该对象占用的内存。 

#### 虚引用

虚引用需要java.lang.ref.PhantomReference类来实现。

顾名思义，就是形同虚设，与其他几种引用都不同，虚引用并不会决定对象的生命周期。

如果一个对象仅持有虚引用，那么它就和没有任何引用一样，在任何时候都可能被垃圾回收器回收，它不能单独使用也不能通过它访问对象，虚引用必须和引用队列 (ReferenceQueue)联合使用。

虚引用的主要作用是跟踪对象被垃圾回收的状态。 仅仅是提供了一种确保对象被 finalize以后，做某些事情的机制。 PhantomReference的get方法总是返回null，因此无法访问对应的引用对象。

其意义在于：说明一个对象已经进入finalization阶段，可以被gc回收，用来实现比finalization机制更灵活的回收操作。

换句话说，设置虚引用关联的唯一目的，就是在这个对象被收集器回收的时候收到一个系统通知或者后续添加进一步的处理。

## 总结

- ThreadLocal 并不解决线程间共享数据的问题，主要解决的问题是在多线程环境下的数据隔离问题
- ThreadLocal 适用于变量在线程间隔离且在方法间共享的场景
- ThreadLocal 通过隐式的在不同线程内创建独立实例副本避免了实例线程安全的问题
- 每个线程持有一个只属于自己的专属Map并维护了ThreadLocal对象与具体实例的映射，该Map由于只被持有它的线程访问，故不存在线程安全以及锁的问题
- ThreadLocalMap的Entry对ThreadLocal的引用为弱引用，避免了ThreadLocal对象无法被回收的问题
- 都会通过expungeStaleEntry，cleanSomeSlots,replaceStaleEntry这三个方法回收键为 null 的 Entry 对象的值（即为具体实例）以及 Entry 对象本身从而防止内存泄漏，属于安全加固的方法

