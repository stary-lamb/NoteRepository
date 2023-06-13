---
title: FutureTask & CompletableFuture
date: 2022-12-24
---

## FutureTask

### FutureTask 基本介绍

FutureTask 为 Future 提供了基础实现，如获取任务执行结果(get)和取消任务(cancel)等。如果任务尚未完成，获取任务执行结果时将会阻塞。一旦执行结束，任务就不能被重启或取消(除非使用runAndReset执行计算)。FutureTask 常用来封装 Callable 和 Runnable，也可以作为一个任务提交到线程池中执行。除了作为一个独立的类之外，此类也提供了一些功能性函数供我们创建自定义 task 类使用。FutureTask 的线程安全由CAS来保证。

### FutureTask 类关系图

FutureTask 实现了 RunnableFuture接口，则 RunnableFuture接口 继承了 Runnable接口 和 Future接口，所以 FutureTask 既能当做一个 Runnable直接被Thread执行，也能作为 Future 用来得到 Callable 的计算结果。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212241024925.png" alt="image-20221224102402878" style="zoom:50%;" />



### 相关 API

#### get()

FutureTask 通过get()方法获取任务执行结果。

**缺点：一旦调用了get()方法，不管是否计算完成都会导致阻塞。**

~~~ java
public class FutureTaskDemo {
    public static void main(String[] args) throws ExecutionException, InterruptedException, TimeoutException {
        FutureTask<Integer> futureTask = new FutureTask<>(() -> {
            System.out.println(Thread.currentThread().getName() + "\t" + "----come in");
            TimeUnit.SECONDS.sleep(5);
            return 1024;
        });

        new Thread(futureTask,"t1").start();


        System.out.println(futureTask.get());//不见不散，，只要出现get方法，不管是否计算完成都阻塞等待结果出来在运行
        //System.out.println(futureTask.get(2L,TimeUnit.SECONDS));//过时不候，推荐使用

        System.out.println("主线程继续干活");
    }
}
~~~

#### isDone()

isDone() 通过判断任务是否结束，我们可以通过轮询的方式去判断任务是否结束，从而去获取对应的值。

**缺点：轮询的方式会耗费无谓的CPU资源，而且也不见得能及时地得到计算结果。**

~~~ java
public class FutureTaskDemo {
    public static void main(String[] args) throws ExecutionException, InterruptedException, TimeoutException {
        FutureTask<Integer> futureTask = new FutureTask<>(() -> {
            System.out.println(Thread.currentThread().getName() + "\t" + "----come in");
            TimeUnit.SECONDS.sleep(5);
            return 1024;
        });

        new Thread(futureTask,"t1").start();

        while (true) {
            if (futureTask.isDone()) {
                System.out.println("-----result:"+futureTask.get());
                break;
            }else {
                System.out.println("还在计算中，别催，越催越慢，再催熄火");
            }
        }
    }
}
~~~

### FutureTask小结

FutureTask能很好的应用于有返回的异步调用；但是如果出现如下需求时则显得捉襟见肘：

- 无法手动完成：当调用远程服务时，如果发现远程服务出现问题，你需要将最近一次正常结果返回；这时使用Future就无法满足该需求。
- 无法添加回调方法：当调用远程服务结束后需要调用其它方法时，如果使用Future，则需要不断循环调用isDone方法判断是否完成；然后调用get获得结果接着调用其它方法。
- 无法将多任务合并获得结果：当需要并行调用多个远程服务时，在获得返回结果时需要不断循环调用各future的isDone方法。
- 没有异常处理：Future API没有提供异常处理方法。

## CompletableFuture 

### CompletableFuture 基本介绍

CompletableFuture 是对 Future 的扩展和增强，可以帮助我们简化异步编程的复杂性，并且提供了函数式编程的能力，可以通过回调的方式处理计算结果，也提供了转换和组合 CompletableFuture 方法。

它可能代表一个明确完成的 Future，也有可能代表一个完成阶段（CompletionStage），它支持在计算完成以后触发一些函数或执行某些动作。

### CompletableFuture 类关系图

`CompletionStage`接口：代表异步计算过程中的某一个阶段，一个阶段完成以后可能会触发另外一个阶段，有些类似Linux系统的管道分隔符传参数。

![image-20221224141119935](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202212241435221.png)

### 异步操作

`CompletableFuture`提供了四个静态方法来创建一个异步操作

~~~ java
//runAsync 无 返回值
public static CompletableFuture<Void> runAsync(Runnable runnable)
public static CompletableFuture<Void> runAsync(Runnable runnable, Executor executor)

//supplyAsync 有 返回值 
public static <U> CompletableFuture<U> supplyAsync(Supplier<U> supplier)
public static <U> CompletableFuture<U> supplyAsync(Supplier<U> supplier, Executor executor)

~~~

这四个方法的区别：

- runAsync() 以Runnable函数式接口类型为参数，没有返回结果；
- supplyAsync() 以Supplier函数式接口类型为参数，返回结果类型为U；Supplier接口的 get() 是有返回值的(会阻塞)
- 使用没有指定Executor的方法时，内部使用ForkJoinPool.commonPool() 作为它的线程池执行异步代码。如果指定线程池，则使用指定的线程池运行。
- 默认情况下 CompletableFuture 会使用公共的 ForkJoinPool线程池，这个线程池默认创建的线程数是 CPU 的核数（也可以通过 JVM option:-Djava.util.concurrent.ForkJoinPool.common.parallelism 来设置 ForkJoinPool线程池 的线程数）。如果所有 CompletableFuture 共享一个线程池，那么一旦有任务执行一些很慢的 I/O 操作，就会导致线程池中所有线程都阻塞在 I/O 操作上，从而造成线程饥饿，进而影响整个系统的性能。所以，强烈建议你要根据不同的业务类型创建不同的线程池，以避免互相干扰。

#### 无返回值

~~~ java
public class CompletableFutureDemo2 {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
            System.out.println(Thread.currentThread().getName() + "\t" + "-----come in");
            //暂停几秒钟线程
            try {
                TimeUnit.SECONDS.sleep(1);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("-----task is over");
        });
        System.out.println(future.get());
    }
}
~~~

#### 有返回值

~~~ java
public class CompletableFutureDemo2 {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        CompletableFuture<Integer> completableFuture = CompletableFuture.supplyAsync(() -> {
            System.out.println(Thread.currentThread().getName() + "\t" + "-----come in");
            //暂停几秒钟线程
            try {
                TimeUnit.SECONDS.sleep(1);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            return ThreadLocalRandom.current().nextInt(100);
        });

        System.out.println(completableFuture.get());
    }
}
~~~

### 常用方法

#### 获得结果和触发计算

**获得结果**

- public T get()：阻塞等待

- public T get(long timeout, TimeUnit unit)：设置超时时间

- public T getNow(T valueIfAbsent)：没有计算完成的情况下，给我一个替代结果

  ~~~ java
  /**
   * 立即获取结果不阻塞
   *  1. 计算完，返回计算完成后的结果
   *	2. 没算完，返回设定的valueIfAbsent值
   */
  public class CompletableFutureDemo2{
      
      public static void main(String[] args) throws ExecutionException, InterruptedException{
          CompletableFuture<Integer> completableFuture = CompletableFuture.supplyAsync(() -> {
              try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
              return 533;
          });
  
          //去掉注释上面计算没有完成，返回444
          //开启注释上满计算完成，返回计算结果
          try { TimeUnit.SECONDS.sleep(2); } catch (InterruptedException e) { e.printStackTrace(); }
  
          System.out.println(completableFuture.getNow(444));
      }
  }
  ~~~

- public T join()：与 get() 方法一样，都会导致阻塞；它们之间的区别就是 get方法需要抛出异常，join方法不用抛异常

  ~~~ java
  public class CompletableFutureDemo2{
      
      public static void main(String[] args) throws ExecutionException, InterruptedException{ 
          System.out.println(CompletableFuture.supplyAsync(() -> "abc").thenApply(r -> r + "123").join());
      }
  }
  ~~~

**触发计算**

public boolean complete(T value)：是否打断get方法,返回括号值

~~~ java
public class CompletableFutureDemo2{
    public static void main(String[] args) throws ExecutionException, InterruptedException{
        
        CompletableFuture<Integer> completableFuture = CompletableFuture.supplyAsync(() -> {
            try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
            return 533;
        });

        //注释掉暂停线程，get还没有算完只能返回complete方法设置的444；暂停2秒 钟线程，异步线程能够计算完成返回get
        try { TimeUnit.SECONDS.sleep(2); } catch (InterruptedException e) { e.printStackTrace(); }

        //当调用CompletableFuture.get()被阻塞的时候,complete方法就是结束阻塞并get()获取设置的complete里面的值.
        System.out.println(completableFuture.complete(444)+"\t"+completableFuture.get());
    }
}
~~~

#### 对计算结果进行处理

**thenApply**

计算结果存在依赖关系，这两个线程串行化。

由于存在依赖关系(当前步错，不走下一步)，当前步骤有异常的话就叫停。

~~~~ java
public class CompletableFutureDemo2{
    
public static void main(String[] args) throws ExecutionException, InterruptedException{
    //当一个线程依赖另一个线程时用 thenApply 方法来把这两个线程串行化,
    CompletableFuture.supplyAsync(() -> {
        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
        System.out.println("111");
        return 1024;
    }).thenApply(f -> {
        System.out.println("222");
        return f + 1;
    }).thenApply(f -> {
        //int age = 10/0; // 异常情况：那步出错就停在那步。
        System.out.println("333");
        return f + 1;
    }).whenCompleteAsync((v,e) -> {
        System.out.println("*****v: "+v);
    }).exceptionally(e -> {
        e.printStackTrace();
        return null;
    });

    System.out.println("-----主线程结束，END");

    // 主线程不要立刻结束，否则CompletableFuture默认使用的线程池会立刻关闭:
    try { TimeUnit.SECONDS.sleep(2); } catch (InterruptedException e) { e.printStackTrace(); }
	} 
}
~~~~



**handle**

有异常也可以往下一步走，根据带的异常参数可以进一步处理。

~~~~ java
public class CompletableFutureDemo2{
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        //当一个线程依赖另一个线程时用 handle 方法来把这两个线程串行化,
        // 异常情况：有异常也可以往下一步走，根据带的异常参数可以进一步处理
        CompletableFuture.supplyAsync(() -> {
            //暂停几秒钟线程
            try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }
            System.out.println("111");
            return 1024;
        }).handle((f,e) -> {
            int age = 10/0;
            System.out.println("222");
            return f + 1;
        }).handle((f,e) -> {
            System.out.println("333");
            return f + 1;
        }).whenCompleteAsync((v,e) -> {
            System.out.println("*****v: "+v);
        }).exceptionally(e -> {
            e.printStackTrace();
            return null;
        });

        System.out.println("-----主线程结束，END");

        // 主线程不要立刻结束，否则CompletableFuture默认使用的线程池会立刻关闭:
        try { TimeUnit.SECONDS.sleep(2); } catch (InterruptedException e) { e.printStackTrace(); }
    }
}
~~~~

#### 对计算结果进行消费

**thenAccept**

任务 A 执行完执行 B，B 需要 A 的结果，但是任务 B 无返回值

~~~~ java
public class CompletableFutureAPIDemo {
    public static void main(String[] args) throws ExecutionException, InterruptedException, TimeoutException {
        CompletableFuture.supplyAsync(() -> {
            return 1;
        }).thenApply(f -> {
            return f+2;
        }).thenApply(f -> {
            return f+3;
        }).thenAccept(r -> System.out.println(r));


        System.out.println(CompletableFuture.supplyAsync(() -> "resultA").thenRun(() -> {}).join());


        System.out.println(CompletableFuture.supplyAsync(() -> "resultA").thenAccept(resultA -> {}).join());


        System.out.println(CompletableFuture.supplyAsync(() -> "resultA").thenApply(resultA -> resultA + " resultB").join());
    }
}
~~~~



**thenRun**

任务 A 执行完执行 B，并且 B 不需要 A 的结果



**thenApply**

任务 A 执行完执行 B，B 需要 A 的结果，同时任务 B 有返回值

#### 对计算速度进行选用

**applyToEither**

~~~ java
public class CompletableFutureAPIDemo {
    public static void main(String[] args) throws ExecutionException, InterruptedException, TimeoutException {
       System.out.println(CompletableFuture.supplyAsync(() -> {
            //暂停几秒钟线程
            try {
                TimeUnit.SECONDS.sleep(1);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            return 1;
        }).applyToEither(CompletableFuture.supplyAsync(() -> {
           //睡眠2秒，此时上面计算完毕返回1
           /* 
           try {
                TimeUnit.SECONDS.sleep(2);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }*/
           //不睡眠，上面还没计算完毕，直接返回2
            return 2;
        }), r -> {
            return r;
        }).join());

        //暂停几秒钟线程
        try { TimeUnit.SECONDS.sleep(3); } catch (InterruptedException e) { e.printStackTrace(); }
    }
}
~~~

#### 对计算结果进行合并

两个 CompletionStage 任务都完成后，最终能把两个任务的结果一起交给 thenCombine 来处理

**thenCombine**

~~~~ java
public class CompletableFutureAPIDemo {
    public static void main(String[] args) throws ExecutionException, InterruptedException, TimeoutException {
       System.out.println(CompletableFuture.supplyAsync(() -> {
            return 10;
        }).thenCombine(CompletableFuture.supplyAsync(() -> {
            return 20;
        }), (r1, r2) -> {
            return r1 + r2;
        }).join());
    }
}
~~~~

### 小结

**CompletableFuture 的优点**

- 异步任务结束时，会自动回调某个对象的方法；
- 异步任务出错时，会自动回调某个对象的方法；
- 主线程设置好回调后，不再关心异步任务的执行，异步任务之间可以顺序执行
