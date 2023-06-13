---
title: Java对象内存布局和对象头
date: 2023-06-10
---

## 对象在堆内存中布局

对象内部结构分为：对象头、实例数据、对齐填充（保证8个字节的倍数）。

对象头分为对象标记（markOop）和类元信息（klassOop），类元信息存储的是指向该对象类元数据（klass）的首地址。

![image-20230610145847936](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101459235.png)

### 对象头

#### 对象标记 Mark Word

默认存储对象的HashCode、分代年龄和锁标志位等信息。

这些信息都是与对象自身定义无关的数据，所以MarkWord被设计成一个非固定的数据结构以便在极小的空间内存存储尽量多的数据。

它会根据对象的状态复用自己的存储空间，也就是说在运行期间MarkWord里存储的数据会随着锁标志位的变化而变化。

![image-20230610150647006](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101506069.png) 

​               ![image-20230610150713480](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101507551.png)     

在64位系统中，Mark Word占了8个字节，类型指针占了8个字节，一共是16个字节

![image-20230610150746664](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101508506.png)       

 #### 类元信息(又叫类型指针)

对象指向它的类元数据的指针，虚拟机通过这个指针来确定这个对象是哪个类的实例。

![image-20230610150907584](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101509698.png)

#### 对象头的大小

在64位系统中，Mark Word占了8个字节，类型指针占了8个字节，一共是16个字节。

### 实例数据

在实例数据当中存放类的属性(Field)数据信息，包括父类的属性信息，如果是数组的实例部分还包括数组的长度，这部分内存按4字节对齐。

#### 对齐填充

虚拟机要求对象起始地址必须是8字节的整数倍。填充数据不是必须存在的，仅仅是为了字节对齐这部分内存按8字节补充对齐。

## 对象头的 MarkWord

### 32位虚拟机对象头

32位虚拟机对象头不是很重要，主要看64位虚拟机的对象头信息



![image-20230610151211622](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101512698.png)

### 64位对象头信息

![image-20230610151325882](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101513957.png)

**markword(64位)分布图，对象布局、GC回收和后面的锁升级就是对象标记MarkWord里面标志位的变化**

![](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306101515316.png)