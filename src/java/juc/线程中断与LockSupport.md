---
title: 线程中断与LockSupport
date: 2023-06-10
---

## 线程中断机制

### 中断基本介绍

一个线程不应该由其他线程来强制中断或停止，而是应该由线程自己自行停止。所以，Thread.stop, Thread.suspend, Thread.resume 都已经被废弃了。

其次在Java中没有办法立即停止一条线程，然而停止线程却显得尤为重要，如取消一个耗时操作。因此，Java提供了一种用于停止线程的机制——中断。

**中断只是一种协作机制，Java没有给中断增加任何语法，中断的过程完全需要程序员自己实现。**

若要中断一个线程，你需要手动调用该线程的interrupt方法，**该方法也仅仅是将线程对象的中断标识设成true**；

接着你需要自己写代码不断地检测当前线程的标识位，如果为true，表示别的线程要求这条线程中断，
此时究竟该做什么需要你自己写代码实现。

每个线程对象中都有一个标识，用于表示线程是否被中断；该标识位为true表示中断，为false表示未中断；

通过调用线程对象的interrupt方法将该线程的标识位设为true；可以在别的线程中调用，也可以在自己的线程中调用。

### 中断相关API方法

| public void interrupt()             | 实例方法，<br/>实例方法interrupt()仅仅是设置线程的中断状态为true，不会停止线程 |
| ----------------------------------- | ------------------------------------------------------------ |
| public static boolean interrupted() | 静态方法，Thread.interrupted();  <br/>判断线程是否被中断，并清除当前中断状态<br/>这个方法做了两件事：<br/>1 返回当前线程的中断状态<br/>2 将当前线程的中断状态设为false<br/> <br/>这个方法有点不好理解，因为连续调用两次的结果可能不一样。 |
| public boolean isInterrupted()      | 实例方法，<br/>判断当前线程是否被中断（通过检查中断标志位）  |

### 使用中断标识停止线程

在需要中断的线程中不断监听中断状态，一旦发生中断，就执行相应的中断处理业务逻辑。

- 修改状态
- 停止程序的运行

#### 方法

##### 通过一个volatile变量实现

~~~ java

public class InterruptDemo {
private static volatile boolean isStop = false;

public static void main(String[] args) {
    new Thread(() -> {
        while(true)
        {
            if(isStop)
            {
                System.out.println(Thread.currentThread().getName()+"线程------isStop = true,自己退出了");
                break;
            }
            System.out.println("-------hello interrupt");
        }
    },"t1").start();

    //暂停几秒钟线程
    try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
    isStop = true;
}
}
~~~

##### 通过 AtomicBoolean 实现

~~~ java
public class StopThreadDemo {
    private final static AtomicBoolean atomicBoolean = new AtomicBoolean(true);

    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            while(atomicBoolean.get())
            {
                try { TimeUnit.MILLISECONDS.sleep(500); } catch (InterruptedException e) { e.printStackTrace(); }
                System.out.println("-----hello");
            }
        }, "t1");
        t1.start();

        try { TimeUnit.SECONDS.sleep(3); } catch (InterruptedException e) { e.printStackTrace(); }

        atomicBoolean.set(false);
    }
}
~~~

##### 通过Thread类自带的中断api方法实现

- interrupt()：设置线程的中断状态为true，不会停止线程
- ，Thread.interrupted()：判断线程是否被中断，并清除当前中断状态

~~~~ java
public class InterruptDemo {
    public static void main(String[] args)
    {
        Thread t1 = new Thread(() -> {
            while(true)
            {
                if(Thread.currentThread().isInterrupted())
                {
                    System.out.println("-----t1 线程被中断了，break，程序结束");
                    break;
                }
                System.out.println("-----hello");
            }
        }, "t1");
        t1.start();

        System.out.println("**************"+t1.isInterrupted());
        //暂停5毫秒
        try { TimeUnit.MILLISECONDS.sleep(5); } catch (InterruptedException e) { e.printStackTrace(); }
        t1.interrupt();
        System.out.println("**************"+t1.isInterrupted());
    }
}
~~~~

#### 当前线程的中断标识为true，是不是就立刻停止？

具体来说，当对一个线程，调用 interrupt() 时：

1. 如果线程处于正常活动状态，那么会将该线程的中断标志设置为 true，仅此而已。

   被设置中断标志的线程将继续正常运行，不受影响。所以， interrupt() 并不能真正的中断线程，需要被调用的线程自己进行配合才行。

2. 如果线程处于被阻塞状态（例如处于sleep, wait, join 等状态），在别的线程中调用当前线程对象的interrupt方法，

   那么线程将立即退出被阻塞状态，并抛出一个InterruptedException异常。

   ![image-20230610163801372](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101638517.png)

~~~ java
public class InterruptDemo2 {
    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(() -> {
            for (int i=0;i<300;i++) {
                System.out.println("-------"+i);
            }
            System.out.println("after t1.interrupt()--第2次---: "+Thread.currentThread().isInterrupted());
        },"t1");
        t1.start();

        System.out.println("before t1.interrupt()----: "+t1.isInterrupted());
        //实例方法interrupt()仅仅是设置线程的中断状态位设置为true，不会停止线程
        t1.interrupt();
        //活动状态,t1线程还在执行中
        try { TimeUnit.MILLISECONDS.sleep(3); } catch (InterruptedException e) { e.printStackTrace(); }
        System.out.println("after t1.interrupt()--第1次---: "+t1.isInterrupted());
        //非活动状态,t1线程不在执行中，已经结束执行了。
        try { TimeUnit.MILLISECONDS.sleep(3000); } catch (InterruptedException e) { e.printStackTrace(); }
        System.out.println("after t1.interrupt()--第3次---: "+t1.isInterrupted());
    }
}
~~~

> 中断只是一种协同机制，修改中断标识位仅此而已，不是立刻stop打断

#### 静态方法Thread.interrupted()

 ![image-20230610163932579](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101639661.png)

~~~ java
/**
 * 作用是测试当前线程是否被中断（检查中断标志），返回一个boolean并清除中断状态，
 * 第二次再调用时中断状态已经被清除，将返回一个false。
 */
public class InterruptDemo
{

    public static void main(String[] args) throws InterruptedException
    {
        System.out.println(Thread.currentThread().getName()+"---"+Thread.interrupted());
        System.out.println(Thread.currentThread().getName()+"---"+Thread.interrupted());
        System.out.println("111111");
        Thread.currentThread().interrupt();
        System.out.println("222222");
        System.out.println(Thread.currentThread().getName()+"---"+Thread.interrupted());
        System.out.println(Thread.currentThread().getName()+"---"+Thread.interrupted());
    }
}
~~~

##### 都会返回中断状态，两者对比

方法的注释也清晰的表达了“中断状态将会根据传入的ClearInterrupted参数值确定是否重置”。

- 静态方法interrupted将会清除中断状态（传入的参数ClearInterrupted为true），

- 实例方法isInterrupted则不会（传入的参数ClearInterrupted为false）。

![image-20230610164020373](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101640485.png)

![image-20230610164145573](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101641789.png)

## LockSupport

LockSupport用来创建锁和其他同步类的基本线程阻塞原语。简而言之，当调用LockSupport.park时，表示当前线程将会等待，直至获得许可，当调用LockSupport.unpark时，必须把等待获得许可的线程作为参数进行传递，好让此线程继续运行。

## 线程等待唤醒机制

### 三种让线程等待和唤醒的方法

1. 使用Object中的wait()方法让线程等待，使用Object中的notify()方法唤醒线程
2. 使用JUC包中Condition的await()方法让线程等待，使用signal()方法唤醒线程
3. LockSupport类可以阻塞当前线程以及唤醒指定被阻塞的线程

### Object类中的wait和notify方法实现线程等待和唤醒

- **正常调用**

  ~~~ java
  package com.atguigu.juc.prepare;
  
  import java.util.concurrent.TimeUnit;
  
  /**
   * 要求：t1线程等待3秒钟，3秒钟后t2线程唤醒t1线程继续工作
   *
   * 1 正常程序演示
   *
   */
  public class LockSupportDemo {
      public static void main(String[] args) {
          Object objectLock = new Object(); //同一把锁，类似资源类
  
          new Thread(() -> {
              synchronized (objectLock) {
                  try {
                      objectLock.wait();
                  } catch (InterruptedException e) {
                      e.printStackTrace();
                  }
              }
              System.out.println(Thread.currentThread().getName()+"\t"+"被唤醒了");
          },"t1").start();
  
          //暂停几秒钟线程
          try { TimeUnit.SECONDS.sleep(3L); } catch (InterruptedException e) { e.printStackTrace(); }
  
          new Thread(() -> {
              synchronized (objectLock) {
                  objectLock.notify();
              }
          },"t2").start();
      }
  }
  
  ~~~

- **异常1：wait方法和notify方法，两个都去掉同步代码块**

  ![image-20230610164900167](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101649891.png)

~~~ java
/**
 * 要求：t1线程等待3秒钟，3秒钟后t2线程唤醒t1线程继续工作
 * 以下异常情况：
 * 2 wait方法和notify方法，两个都去掉同步代码块后看运行效果
 *   2.1 异常情况
 *   Exception in thread "t1" java.lang.IllegalMonitorStateException at java.lang.Object.wait(Native Method)
 *   Exception in thread "t2" java.lang.IllegalMonitorStateException at java.lang.Object.notify(Native Method)
 *   2.2 结论
 *   Object类中的wait、notify、notifyAll用于线程等待和唤醒的方法，都必须在synchronized内部执行（必须用到关键字synchronized）。
 */
public class LockSupportDemo
{

    public static void main(String[] args)//main方法，主线程一切程序入口
    {
        Object objectLock = new Object(); //同一把锁，类似资源类

        new Thread(() -> {
             // 变更地方
                try {
                    objectLock.wait();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            System.out.println(Thread.currentThread().getName()+"\t"+"被唤醒了");
        },"t1").start();

        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(3L); } catch (InterruptedException e) { e.printStackTrace(); }

        new Thread(() -> {
            // 变更地方
            objectLock.notify();
        },"t2").start();
    }
}
~~~

- **异常2：将notify放在wait方法前面**

  程序无法执行，无法唤醒

  ~~~ java
   
  package com.atguigu.juc.prepare;
  
  import java.util.concurrent.TimeUnit;
  
  /**
   * @auther zzyy
   * @create 2020-04-13 17:12
   *
   * 要求：t1线程等待3秒钟，3秒钟后t2线程唤醒t1线程继续工作
   *
   * 3 将notify放在wait方法前先执行，t1先notify了，3秒钟后t2线程再执行wait方法
   *   3.1 程序一直无法结束
   *   3.2 结论
   *   先wait后notify、notifyall方法，等待中的线程才会被唤醒，否则无法唤醒
   */
  public class LockSupportDemo
  {
  
      public static void main(String[] args)//main方法，主线程一切程序入口
      {
          Object objectLock = new Object(); //同一把锁，类似资源类
  
          new Thread(() -> {
              synchronized (objectLock) {
                  objectLock.notify();
              }
              System.out.println(Thread.currentThread().getName()+"\t"+"通知了");
          },"t1").start();
  
          //t1先notify了，3秒钟后t2线程再执行wait方法
          try { TimeUnit.SECONDS.sleep(3L); } catch (InterruptedException e) { e.printStackTrace(); }
  
          new Thread(() -> {
              synchronized (objectLock) {
                  try {
                      objectLock.wait();
                  } catch (InterruptedException e) {
                      e.printStackTrace();
                  }
              }
              System.out.println(Thread.currentThread().getName()+"\t"+"被唤醒了");
          },"t2").start();
      }
  }
  ~~~

> 小结：
>
> 1. wait和notify方法必须要在同步块或者方法里面，且成对出现使用
> 2. 先wait后notify才OK

### ondition接口中的await后signal方法实现线程的等待和唤醒

- **正常调用**

~~~ java
public class LockSupportDemo2 {
    public static void main(String[] args) {
        Lock lock = new ReentrantLock();
        Condition condition = lock.newCondition();

        new Thread(() -> {
            lock.lock();
            try
            {
                System.out.println(Thread.currentThread().getName()+"\t"+"start");
                condition.await();
                System.out.println(Thread.currentThread().getName()+"\t"+"被唤醒");
            } catch (InterruptedException e) {
                e.printStackTrace();
            } finally {
                lock.unlock();
            }
        },"t1").start();

        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(3L); } catch (InterruptedException e) { e.printStackTrace(); }

        new Thread(() -> {
            lock.lock();
            try
            {
                condition.signal();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                lock.unlock();
            }
            System.out.println(Thread.currentThread().getName()+"\t"+"通知了");
        },"t2").start();

    }
}
~~~

- **异常1：去掉lock/unlock**

​	condition.await();和 condition.signal();都触发了 IllegalMonitorStateException异常。

​	结论：
​	lock、unlock对里面才能正确调用调用condition中线程等待和唤醒的方法

![image-20230610165226429](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101652524.png)

~~~ java
/**
 * 异常：
 * condition.await();和condition.signal();都触发了IllegalMonitorStateException异常
 *
 * 原因：调用condition中线程等待和唤醒的方法的前提是，要在lock和unlock方法中,要有锁才能调用
 */
public class LockSupportDemo2
{
    public static void main(String[] args)
    {
        Lock lock = new ReentrantLock();
        Condition condition = lock.newCondition();

        new Thread(() -> {
            try
            {
                System.out.println(Thread.currentThread().getName()+"\t"+"start");
                condition.await();
                System.out.println(Thread.currentThread().getName()+"\t"+"被唤醒");
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        },"t1").start();

        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(3L); } catch (InterruptedException e) { e.printStackTrace(); }

        new Thread(() -> {
            try
            {
                condition.signal();
            } catch (Exception e) {
                e.printStackTrace();
            }
            System.out.println(Thread.currentThread().getName()+"\t"+"通知了");
        },"t2").start();

    }
}
~~~

- **异常2：先signal后await**

  线程无法被唤醒

~~~ java
/**
 * 异常：
 * 程序无法运行
 *
 * 原因：先await()后signal才OK，否则线程无法被唤醒
 */
public class LockSupportDemo2
{
    public static void main(String[] args)
    {
        Lock lock = new ReentrantLock();
        Condition condition = lock.newCondition();

        new Thread(() -> {
            lock.lock();
            try
            {
                condition.signal();
                System.out.println(Thread.currentThread().getName()+"\t"+"signal");
            } catch (Exception e) {
                e.printStackTrace();
            }finally {
                lock.unlock();
            }
        },"t1").start();

        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(3L); } catch (InterruptedException e) { e.printStackTrace(); }

        new Thread(() -> {
            lock.lock();
            try
            {
                System.out.println(Thread.currentThread().getName()+"\t"+"等待被唤醒");
                condition.await();
                System.out.println(Thread.currentThread().getName()+"\t"+"被唤醒");
            } catch (Exception e) {
                e.printStackTrace();
            }finally {
                lock.unlock();
            }
        },"t2").start();

    }
}
~~~

> 小结：
>
> 1. Condtion中的线程等待和唤醒方法之前，需要先获取锁
> 2. 一定要先await后signal，不要反了

### Object和Condition使用的限制条件

1. 线程先要获得并持有锁，必须在锁块(synchronized或lock)中
2. 必须要先等待后唤醒，线程才能够被唤醒

### LockSupport类中的park等待和unpark唤醒

通过park()和unpark(thread)方法来实现阻塞和唤醒线程的操作。

LockSupport是用来创建锁和其他同步类的基本线程阻塞原语。

LockSupport类使用了一种名为Permit（许可）的概念来做到阻塞和唤醒线程的功能，每个线程都有一个许可(permit)，permit只有两个值1和零，默认是零。

可以把许可看成是一种(0,1)信号量（Semaphore），但与 Semaphore 不同的是，许可的累加上限是1。

#### 主要方法

**阻塞：**

- park() /park(Object blocker) 

  - 调用LockSupport.park()时

     ![image-20230610165612313](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101656509.png)

    permit默认是零，所以一开始调用park()方法，当前线程就会阻塞，直到别的线程将当前线程的permit设置为1时，park方法会被唤醒，然后会将permit再次设置为零并返回。

  - 阻塞当前线程/阻塞传入的具体线程

**唤醒：**

- unpark(Thread thread) 

  - LockSupport.unpark(thread);

     ![image-20230610165704788](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101657879.png)

    调用unpark(thread)方法后，就会将thread线程的许可permit设置成1(注意多次调用unpark方法，不会累加，permit值还是1)会自动唤醒thread线程，即之前阻塞中的LockSupport.park()方法会立即返回。

  - 唤醒处于阻塞状态的指定线程

#### 代码

- **正常+无锁块要求**

~~~ java
public class LockSupportDemo {
    public static void main(String[] args) {
        //正常使用+不需要锁块
Thread t1 = new Thread(() -> {
    System.out.println(Thread.currentThread().getName()+" "+"1111111111111");
    LockSupport.park();
    System.out.println(Thread.currentThread().getName()+" "+"2222222222222------end被唤醒");
},"t1");
t1.start();

//暂停几秒钟线程
try { TimeUnit.SECONDS.sleep(3); } catch (InterruptedException e) { e.printStackTrace(); }

LockSupport.unpark(t1);
System.out.println(Thread.currentThread().getName()+"   -----LockSupport.unparrk() invoked over");

    }
}
~~~

- **先唤醒，后等待**

~~~ java
public class T1 {
    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            try { TimeUnit.SECONDS.sleep(3); } catch (InterruptedException e) { e.printStackTrace(); }
            System.out.println(Thread.currentThread().getName()+"\t"+System.currentTimeMillis());
            LockSupport.park();
            System.out.println(Thread.currentThread().getName()+"\t"+System.currentTimeMillis()+"---被叫醒");
        },"t1");
        t1.start();

        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }

        LockSupport.unpark(t1);
        System.out.println(Thread.currentThread().getName()+"\t"+System.currentTimeMillis()+"---unpark over");
    }
}
~~~

![image-20230610165941411](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101659528.png)

> LockSupport.park();与 LockSupport.unpark(t1);一定要成双成对出现，出现等待一定要唤醒。

### Thread.sleep()和Object.wait()的区别

Thread.sleep()和Object.wait()的区别，这是一个烂大街的题目了，大家应该都能说上来两点。

- Thread.sleep()不会释放占有的锁，Object.wait()会释放占有的锁；
- Thread.sleep()必须传入时间，Object.wait()可传可不传，不传表示一直阻塞下去；
- Thread.sleep()到时间了会自动唤醒，然后继续执行；
- Object.wait()不带时间的，需要另一个线程使用Object.notify()唤醒；
- Object.wait()带时间的，假如没有被notify，到时间了会自动唤醒，这时又分好两种情况，一是立即获取到了锁，线程自然会继续执行；二是没有立即获取锁，线程进入同步队列等待获取锁；

> 其实，他们俩最大的区别就是Thread.sleep()不会释放锁资源，Object.wait()会释放锁资源。

### Object.wait()和Condition.await()的区别

Object.wait()和Condition.await()的原理是基本一致的，不同的是Condition.await()底层是调用LockSupport.park()来实现阻塞当前线程的。

实际上，它在阻塞当前线程之前还干了两件事，一是把当前线程添加到条件队列中，二是“完全”释放锁，也就是让state状态变量变为0，然后才是调用LockSupport.park()阻塞当前线程。

### Thread.sleep()和LockSupport.park()的区别

LockSupport.park()还有几个兄弟方法——parkNanos()、parkUtil()等，我们这里说的park()方法统称这一类方法。

- 从功能上来说，Thread.sleep()和LockSupport.park()方法类似，都是阻塞当前线程的执行，且都不会释放当前线程占有的锁资源；
- Thread.sleep()没法从外部唤醒，只能自己醒过来；
- LockSupport.park()方法可以被另一个线程调用LockSupport.unpark()方法唤醒；
- Thread.sleep()方法声明上抛出了InterruptedException中断异常，所以调用者需要捕获这个异常或者再抛出；
- LockSupport.park()方法不需要捕获中断异常；
- Thread.sleep()本身就是一个native方法；
- LockSupport.park()底层是调用的Unsafe的native方法；

### Object.wait()和LockSupport.park()的区别

二者都会阻塞当前线程的运行，他们有什么区别呢? 经过上面的分析相信你一定很清楚了，真的吗? 往下看！

- Object.wait()方法需要在synchronized块中执行；
- LockSupport.park()可以在任意地方执行；
- Object.wait()方法声明抛出了中断异常，调用者需要捕获或者再抛出；
- LockSupport.park()不需要捕获中断异常；
- Object.wait()不带超时的，需要另一个线程执行notify()来唤醒，但不一定继续执行后续内容；
- LockSupport.park()不带超时的，需要另一个线程执行unpark()来唤醒，一定会继续执行后续内容；

park()/unpark()底层的原理是“二元信号量”，你可以把它相像成只有一个许可证的Semaphore，只不过这个信号量在重复执行unpark()的时候也不会再增加许可证，最多只有一个许可证。

### LockSupport.park()会释放锁资源吗?

不会，它只负责阻塞当前线程，释放锁资源实际上是在Condition的await()方法中实现的。

