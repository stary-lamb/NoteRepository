---
title: volatile 关键字
date: 2023-01-14
---

## 基本介绍

**volatile 两大特点：**

- 可见性
- 有序性

> volatile 关键字是不保证原子性

**volatile的内存语义**

- 当写一个 volatile 变量时，JMM会把该线程对应的本地内存中的共享变量值**立即刷新回主内存中**。
- 当读一个 volatile 变量时，JMM会把该线程对应的本地内存设置为无效，直接从主内存中读取共享变量。
- volatile 的写内存语义时直接刷新到主内存中，读的内存语义时直接从主内存中读取。

## 内存屏障

### 基本介绍

内存屏障（也称内存栅栏，内存栅障碍，屏障指令等）是一类同步屏障指令，是 CPU 或编译器在对内存随机访问的操作中的一个同步点，使得此点之前所有的读写操作都执行后才可以开始执行此点之后的操作，避免代码重排序。

内存屏障实质上就是一种 JVM 指令，Java 内存模型的重排规则会要求 Java 编译器在生成 JVM 指令时插入特定的内存屏障在指令，通过这些内存屏障指令，volatile 实现了 Java 内存模型中的可见性和有序性，但 volatile 无法保证原子性。



![image-20230107164942020](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202301071649083.png)

### 内存屏障的作用

1. 阻止屏障两边的指令重排序

   **重排序时不允许把内存屏障之后的指令重排序到内存屏障之前。简单来说，对一个 volatile 域的写，hanppens-before 于任意后续对这个 volatile 域的读，也叫写后读。**

2. 写数据时加入屏障，强制将线程私有工作内存的数据刷回主物理内存，即**内存屏障之前的所有写操作都要写回主内存**

3. 读数据时加入屏障，线程私有工作内存的数据失效，重新到主物理内存中获取最新数据，即**内存屏障之后的所有读操作都能获取内存屏障之前的所有写操作的最新结果（实现了可见性）**

### Java 四类内存屏障

**写**

1. **在每个 volatile 写操作的前面插入一个 StoreStore 屏障。**
   - 禁止重排序：一定是 Store1 的数据写出到主内存完成后，才能让 Store2 及其之后的写出操作的数据，被其他线程看到
   - 保证 Store1 指令写出去的数据，会强制被刷新回到主内存
2. **在每个 volatile 写操作的后面插入一个 StoreLoad 屏障。**
   - 禁止重排序：一定是 Store1 的数据写出到主内存完成后，才能让 Load2 来读取数据。
   - 强制把写缓冲区的数据刷回主内存中，让工作内存/CPU高速缓存当中的数据失效，重新到主内存中获取新的数据。

![image-20230120175634500](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202301201756907.png)

**读**

1. **在每个 volatile 读操作的后面插入一个 LoadLoad 屏障。**
   - 禁止重排序：访问 Load2 的读操作，一定不会重排打破 Load1之前
   - 保证 Load2 在读取的时候，自己缓存内到相应的数据失效，Load2 会去主内存中获取最新的数据。
2. **在每个 volatile 读操作的后面插入一个 LoadStore 屏障。**
   - 禁止重排序：一定是 Load1 读取数据完成后，才能让 Store 及其之后的写出操作的数据，被其它线程看到。

![image-20230120180534309](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202301201805386.png)

## volatile 特性

### 可见性

**可见性：**保证不同线程对这个变量进行操作时的可见性，即变量一旦改变所有线程立即可见。

#### 代码

- 不加 volatile，没有可见性，程序无法停止
- 加了 volatile，保证可见性，程序可以停止

~~~java
public class VolatileSeeDemo {
    static          boolean flag = true;       //不加volatile，没有可见性
    //volatile boolean flag = true;       //加了volatile，保证可见性

    public static void main(String[] args) {
        new Thread(() -> {
            System.out.println(Thread.currentThread().getName() + "\t" + "---come in");
            while (flag) {
                new Integer(308);
            }
            System.out.println("t1 over");
        }, "t1").start();

        try {
            TimeUnit.SECONDS.sleep(1);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        new Thread(() -> {
            flag = false;
        }, "t2").start();
    }
}
~~~

**说明：**

**1. 不加 volatie 可能出现的问题**

主线程修改了 flag 之后没有将其刷新到主内存，所以 t1 线程看不到

主线程将 flag 刷新到了主内存，但 t1 一直读取的是自己工作内存中 flag 的值，没有去主内存中更新获取 flag 最新的值

**2. 解决方案**

使用 volatile 关键字修饰共享变量，就可以解决上述的问题，被 volatile 修饰的变量有以下特点：

1. 线程中读取的时候，每次读取都会去主内存中读取共享变量的对应的值，然后将其复制到工作内存。
2. 线程中修改了工作内存中变量的副本，修改之后会立即刷新到主内存。

#### volatile 变量的读写过程

Java内存模型中定义的8种工作内存与主内存之间的原子操作

<font color=blue >read(读取) ——> load(加载) ——> use(使用) ——> assign(赋值) ——> store(存储) ——> write(写入) ——></font> <font color=red >lock(锁定) ——> unlock(解锁)</font>

![image-20230120200420952](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202301202004011.png)



read: **作用于主内存**，将变量的值从主内存传输到工作内存，主内存到工作内存

load: 作用于工作内存，将read从主内存传输的变量值放入工作**内存变量副本**中，即数据加载

use: 作用于工作内存，将工作内存变量副本的值传递给执行引擎，每当JVM遇到需要该变量的字节码指令时会执行该操作

assign: 作用于工作内存，将从执行引擎接收到的值赋值给工作内存变量，每当JVM遇到一个给变量赋值字节码指令时会执行该操作

store: 作用于工作内存，将赋值完毕的工作变量的值写回给主内存

write: **作用于主内存**，将store传输过来的变量值赋值给主内存中的变量

**由于上述只能保证单条指令的原子性，针对多条指令的组合性原子保证，没有大面积加锁，所以，JVM提供了另外两个原子指令：**

**lock: 作用于主内存**，将一个变量标记为一个线程独占的状态，只是写时候加锁，就只是锁了写变量的过程。

**unlock: 作用于主内存**，把一个处于锁定状态的变量释放，然后才能被其他线程占用

### 不保证原子性

多线程环境下，"数据计算"和"数据赋值"操作可能多次出现，即操作非原子。若数据在加载之后，若主内存count变量发生修改之后，由于线程工作内存中的值在此前已经加载，从而不会对变更操作做出相应变化，即私有内存和公共内存中变量不同步，进而导致数据不一致。

对于volatile变量，JVM只是保证从主内存加载到线程工作内存的值是最新的，也就是数据加载时是最新的。

**由此可见volatile解决的是变量读时的可见性问题，但无法保证原子性，对于多线程修改共享变量的场景必须使用加锁同步。**

![image-20230610061844230](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306100618419.png)

#### 代码

~~~~ java
public class VolatileNoAtomicDemo {
    public static void main(String[] args) throws InterruptedException {
        MyNumber myNumber = new MyNumber();

        for (int i = 1; i <= 10; i++) {
            new Thread(() -> {
                for (int j = 1; j <= 1000; j++) {
                    myNumber.addPlusPlus();
                }
            }, String.valueOf(i)).start();
        }

        //暂停几秒钟线程
        try {
            TimeUnit.SECONDS.sleep(1);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println(Thread.currentThread().getName() + "\t" + myNumber.number);
    }
}

class MyNumber {
    volatile int number = 0;

    public void addPlusPlus() {
        number++;
    }
}
~~~~

#### 从字节码角度说明

![image-20230610060754906](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306100608089.png)

原子性指的是一个操作是**不可中断**的，即使是在多线程环境下，一个操作一旦开始就不会被其他线程影响。

~~~ java
public void add()
{
        i++; //不具备原子性，该操作是先读取值，然后写回一个新值，相当于原来的值加上1，分3步完成
 }
~~~

**如果第二个线程在第一个线程读取旧值和写回新值期间读取i的域值**，那么第二个线程就会与第一个线程一起看到同一个值，并执行相同值的加1操作，这也就造成了线程安全失败，因此对于add方法必须使用synchronized修饰，以便保证线程安全.

#### 修改可见，但为什么不能保证原子性

volatile主要是对其中部分指令做了处理。

要use(使用)一个变量的时候必需load(载入），要载入的时候必需从主内存read(读取）这样就解决了读的可见性。 

写操作是把assign和store做了关联(在assign(赋值)后必需store(存储))。store(存储)后write(写入)。也就是做到了给一个变量赋值的时候一串关联指令直接把变量值写到主内存。

就这样通过用的时候直接从主内存取，在赋值到直接写回主内存做到了内存可见性。**注意蓝色框框的间隙**。

![image-20230610062352899](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306100623979.png)

>read-load-use 和 assign-store-write 成为了两个不可分割的原子操作，**但是在use和assign之间依然有极小的一段真空期**，有可能变量会被其他线程读取，**导致写丢失一次**
>
>但是无论在哪一个时间点主内存的变量和任一工作内存的变量的值都是相等的。这个特性就导致了volatile变量不适合参与到依赖当前值的运算，如i = i + 1; i++;之类的那么依靠可见性的特点 volatile 可以用在哪些地方呢？ 通**常volatile用做保存某个状态的boolean值or int值。**
>
>《深入理解Java虚拟机》提到：
>
>![image-20230610062545227](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306100625276.png)

### 禁止指令重排

#### 重排序基本介绍
重排序是指编译器和处理器为了优化程序性能而对指令序列进行重新排序的一种手段，有时候会改变程序语句的先后顺序

- 不存在数据依赖关系，可以重排序；
- 存在数据依赖关系，禁止重排序

但重排后的指令绝对不能改变原有的串行语义！这点在并发设计中必须要重点考虑！

重排序的分类和执行流程：

![image-20230610063015240](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306100630297.png)

- **编译器优化的重排序**： 编译器在不改变单线程串行语义的前提下，可以重新调整指令的执行顺序
- **指令级并行的重排序**： 处理器使用指令级并行技术来讲多条指令重叠执行，若不存在数据依赖性，处理器可以改变语句对应机器指令的执行顺序
- **内存系统的重排序**： 由于处理器使用缓存和读/写缓冲区，这使得加载和存储操作看上去可能是乱序执行

数据依赖性：若两个操作访问同一变量，且这两个操作中有一个为写操作，此时两操作间就存在数据依赖性。

- 案例 ：

  - **不存在数据依赖关系**，可以重排序===> 重排序OK 。

  |                           重排前                           |                           重排后                           |
  | :--------------------------------------------------------: | :--------------------------------------------------------: |
  | int a = 1;  //1<br/>int b = 20; //2<br/>int c = a + b; //3 | int b = 20;  //1<br/>int a = 1; //2<br/>int c = a + b; //3 |
  |  结论：编译器调整了语句的顺序，但是不影响程序的最终结果。  |                          重排序OK                          |

  - 存在数据依赖关系，禁止重排序===> 重排序发生，会导致程序运行结果不同。

编译器和处理器在重排序时，会遵守数据依赖性，不会改变存在依赖关系的两个操作的执行,但不同处理器和不同线程之间的数据性不会被编译器和处理器考虑，其只会作用于单处理器和单线程环境，下面三种情况，只要重排序两个操作的执行顺序，程序的执行结果就会被改变。

|  名称  |     代码示例      |             说明             |
| :----: | :---------------: | :--------------------------: |
| 写后读 | a = 1;<br/>b = a; | 写一个变量之后，再读这个位置 |
| 写后写 | a = 1;<br/>b = 2; | 写一个变量之后，再写这个变量 |
| 读后写 |    a = b;<br/>    | 读一个变量之后，再写这个变量 |

#### volatile 禁止指令重排

volatile 的底层实现是通过内存屏障，因此可以禁止指令重排序

| 第一个操作  | 第二个操作：普通读写 | 第二个操作：volatile读 | 第二个操作：volatile写 |
| ----------- | -------------------- | ---------------------- | ---------------------- |
| 普通读写    | 可以重排             | 可以重排               | 不可以重排             |
| volatile 读 | 不可以重排           | 不可以重排             | 不可以重排             |
| volatile 写 | 可以重排             | 不可以重排             | 不可以重排             |

- 当第一个操作为 **volatile 读**时，不论第二个操作是什么，都不能重排序。这个操作保证了 volatile 读之后的操作不会重排到 volatile 读之前。
- 当第二个操作为 **volatile 写**时，不论第一个操作是什么，都不能重排序。这个操作保证了 volatile 写之后的操作不会重排到 volatile 写之后。
- 当第一个操作为 **volatile 写**时，第二个操作为volatile读时，不能重排。

#### 四大屏障插入情况

- 在每一个volatile写操作前面插入一个StoreStore屏障

  **StoreStore屏障可以保证在volatile写之前，其前面的所有普通写操作都已经刷新到主内存中。**

- 在每一个volatile写操作后面插入一个StoreLoad屏障

  **StoreLoad屏障的作用是避免volatile写与后面可能有的volatile读/写操作重排序。**

- 在每一个volatile读操作后面插入一个LoadLoad屏障

  **LoadLoad屏障用来禁止处理器把上面的volatile读与下面的普通读重排序**。

- 在每一个volatile读操作后面插入一个LoadStore屏障

  **LoadStore屏障用来禁止处理器把上面的volatile读与下面的普通写重排序。**

> PS：具体插入情况，回内存屏障 —— Java 四类内存屏障

### volatile 正确打开方式

- **单一赋值可以，but含复合运算赋值不可以(i++之类)**

  - volatile int a = 10
  - volatile boolean flag = false

- **状态标志，判断业务是否结束**

  ~~~ java
  /**
   * 使用：作为一个布尔状态标志，用于指示发生了一个重要的一次性事件，例如完成初始化或任务结束
   * 理由：状态标志并不依赖于程序内任何其他状态，且通常只有一种状态转换
   * 例子：判断业务是否结束
   */
  public class UseVolatileDemo
  {
      private volatile static boolean flag = true;
  
      public static void main(String[] args)
      {
          new Thread(() -> {
              while(flag) {
                  //do something......
              }
          },"t1").start();
  
          //暂停几秒钟线程
          try { TimeUnit.SECONDS.sleep(2L); } catch (InterruptedException e) { e.printStackTrace(); }
  
          new Thread(() -> {
              flag = false;
          },"t2").start();
      }
  }
  ~~~

- **开销较低的读，写锁策略**

  ~~~ java
  public class UseVolatileDemo
  {
      /**
       * 使用：当读远多于写，结合使用内部锁和 volatile 变量来减少同步的开销
       * 理由：利用volatile保证读取操作的可见性；利用synchronized保证复合操作的原子性
       */
      public class Counter
      {
          private volatile int value;
  
          public int getValue()
          {
              return value;   //利用volatile保证读取操作的可见性
                }
          public synchronized int increment()
          {
              return value++; //利用synchronized保证复合操作的原子性
                 }
      }
  }
  ~~~

- DCL 双端锁 [单例模式] 

  ~~~ java
  
  public class SafeDoubleCheckSingleton
  {
      //通过volatile声明，实现线程安全的延迟初始化。
      private volatile static SafeDoubleCheckSingleton singleton;
      //私有化构造方法
      private SafeDoubleCheckSingleton(){
      }
      //双重锁设计
      public static SafeDoubleCheckSingleton getInstance(){
          if (singleton == null){
              //1.多线程并发创建对象时，会通过加锁保证只有一个线程能创建对象
              synchronized (SafeDoubleCheckSingleton.class){
                  if (singleton == null){
                      //隐患：多线程环境下，由于重排序，该对象可能还未完成初始化就被其他线程读取
                                        //原理:利用volatile，禁止 "初始化对象"(2) 和 "设置singleton指向内存空间"(3) 的重排序
                      singleton = new SafeDoubleCheckSingleton();
                  }
              }
          }
          //2.对象创建完毕，执行getInstance()将不需要获取锁，直接返回创建对象
          return singleton;
      }
  }
  ~~~

  
