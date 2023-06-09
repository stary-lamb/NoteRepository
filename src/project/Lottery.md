---
title: 抽奖子系统
date: 2023-06-09
---



## DDD架构

### DDD架构图

**DDD架主要分为这几个层级：**

- **用户接口层**：面向前端提供服务适配，面向资源层提供资源适配。这一层聚集了接口适配相关的功能。
- **应用层职责**：实现服务组合和编排，适应业务流程快速变化的需求。这一层聚集了应用服务和事件相关的功能。
- **领域层**：实现领域的核心业务逻辑。这一层聚集了领域模型的聚合、聚合根、实体、值对象、领域服务和事件等领域对象，以及它们组合所形成的业务能力。
- **基础层**：贯穿所有层，为各层提供基础资源服务。这一层聚集了各种底层资源相关的服务和能力。

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202305291350346.png" alt="image-20230529135048185" style="zoom:67%;" />

### DDD代码结构

**DDD架构代码结构如图：**

![image-20230523102016187](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202305291354144.png)

- **Application（应用层）**
  - 应用服务位于应用层。用来**表述应用和用户行为，负责服务的组合、编排和转发，负责处理业务用例的执行顺序以及结果的拼装**。
  - 应用层的服务包括应用服务和领域事件相关服务。
  - 应用服务可对微服务内的领域服务以及微服务外的应用服务进行组合和编排，或者对基础层如文件、缓存等数据直接操作形成应用服务，对外提供粗粒度的服务。
  - 领域事件服务包括两类：领域事件的发布和订阅。通过事件总线和消息队列实现异步数据传输，实现微服务之间的解耦。
- **Domain（领域层）**：
  - 领域服务位于领域层，为完成领域中跨实体或值对象的操作转换而封装的服务，领域服务以与实体和值对象相同的方式参与实施过程。
  - 领域服务对**同一个实体的一个或多个方法进行组合和封装，或对多个不同实体的操作进行组合或编排**，对外暴露成领域服务。**领域服务封装了核心的业务逻辑**。实体自身的行为在实体类内部实现，向上封装成领域服务暴露。
  - 为隐藏领域层的业务逻辑实现，所有领域方法和服务等均须通过领域服务对外暴露。
  - 为实现微服务内聚合之间的解耦，原则上禁止跨聚合的领域服务调用和跨聚合的数据相互关联。
- **Infrastructure（基础层）**：
  - 基础服务位于基础层。**为各层提供资源服务（如数据库、缓存等），实现各层的解耦，降低外部资源变化对业务逻辑的影响**。
  - **基础服务主要为仓储服务**，通过依赖反转的方式为各层提供基础资源服务，领域服务和应用服务调用仓储服务接口，利用仓储实现持久化数据对象或直接访问基础资源。
- **Interfaces（用户接口层）**
  - 主要存放用户接口层与前端交互、展现数据相关的代码。
  - 前端应用通过这一层的接口，向应用服务获取展现所需的数据。
  - 这一层主要用来处理用户发送的 Restful 请求，解析用户输入的配置文件，并将数据传递给 Application 层。
  - 数据的组装、数据传输格式以及 Facade 接口等代码都会放在这一层目录里。

### 贫血模型和充血模型

#### 贫血模型

我们平时开发 Web 后端项目的时候，代码整体的架构如下。:

- UserEntity 和 UserMapper 组成了数据访问层。
- UserBo 和 UserService 组成了业务逻辑层。
- UserVo 和 UserController 组成接口层。21

我们可以发现，UserBo 是一个纯粹的数据结构，只包含数据，不包含任何业务逻辑。业务逻辑集中在 UserService 中。我们通过 UserService 来操作 UserBo。换句话说，Service 层的数据和业务逻辑，被分割为 BO 和 Service 两个类中。像 UserBo 这样，只包含数据，不包含业务逻辑的类，就叫作**贫血模型（Anemic Domain Model）**。同理，UserEntity、UserVo 都是基于贫血模型设计的。这种贫血模型将数据与操作分离，破坏了面向对象的封装特性，是一种典型的面向过程的编程风格。

#### 充血模型

贫血模型中，数据和业务逻辑被分割到不同的类中。**充血模型（Rich Domain Model）**正好相反，数据和对应的业务逻辑被封装到同一个类中。因此，这种充血模型满足面向对象的封装特性，是典型的面向对象编程风格。  

## 抽奖系统全流程

![抽奖.drawio](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306071456017.png)

~~~ java
/**
 * 活动抽奖流程编排
 *
 * @author chenjiaying
 * @date 2023/6/1 13:37
 */
@Service
@Slf4j
public class ActivityProcessImpl implements IActivityProcess {

    @Resource
    private IActivityPartake activityPartake;

    @Resource
    private IDrawExec drawExec;

    @Resource(name = "ruleEngineHandle")
    private EngineFilter engineFilter;

    @Resource
    private Map<Constants.Ids, IIdGenerator> idGeneratorMap;

    @Resource
    private KafkaProducer kafkaProducer;



    @Override
    public DrawProcessResult doDrawProcess(DrawProcessReq req) {

        // 1. 领取活动
        PartakeResult partakeResult = activityPartake.doPartake(new PartakeReq(req.getUId(), req.getActivityId()));
        if (!Constants.ResponseCode.SUCCESS.getCode().equals(partakeResult.getCode()) && !Constants.ResponseCode.NOT_CONSUMED_TAKE.getCode().equals(partakeResult.getCode())) {
            return new DrawProcessResult(partakeResult.getCode(), partakeResult.getInfo());
        }

        // 2.首次成功领取活动，发送MQ消息
        if (Constants.ResponseCode.SUCCESS.getCode().equals(partakeResult.getCode())) {
            ActivityPartakeRecordVO activityPartakeRecord = new ActivityPartakeRecordVO();
            activityPartakeRecord.setUId(req.getUId());
            activityPartakeRecord.setActivityId(req.getActivityId());
            activityPartakeRecord.setStockCount(partakeResult.getStockCount());
            activityPartakeRecord.setStockSurplusCount(partakeResult.getStockSurplusCount());
            // 发送 MQ 消息
            kafkaProducer.sendLotteryActivityPartakeRecord(activityPartakeRecord);
        }



        Long strategyId = partakeResult.getStrategyId();
        Long takeId = partakeResult.getTakeId();

        // 3. 执行抽奖
        DrawResult drawResult = drawExec.doDrawExec(new DrawReq(req.getUId(), strategyId));
        if (Constants.DrawState.FAIL.getCode().equals(drawResult.getDrawState())) {
            Result result = activityPartake.lockTackActivity(req.getUId(), req.getActivityId(), takeId);
            if (!Constants.ResponseCode.SUCCESS.getCode().equals(result.getCode())){
                return new DrawProcessResult(Constants.ResponseCode.UN_ERROR.getCode(), Constants.ResponseCode.UN_ERROR.getInfo());
            }
            return new DrawProcessResult(Constants.ResponseCode.LOSING_DRAW.getCode(), Constants.ResponseCode.LOSING_DRAW.getInfo());
        }
        DrawAwardVO drawAwardInfo = drawResult.getDrawAwardInfo();

        // 4. 结果落库
        DrawOrderVO drawOrderVO = buildDrawOrderVO(req, strategyId, takeId, drawAwardInfo);
        Result recordResult = activityPartake.recordDrawOrder(drawOrderVO);
        if (!Constants.ResponseCode.SUCCESS.getCode().equals(recordResult.getCode())) {
            return new DrawProcessResult(recordResult.getCode(),recordResult.getInfo());
        }

        // 5. 发生 MQ，触发发奖流程
        InvoiceVO invoiceVO = buildInvoiceVO(drawOrderVO);
        ListenableFuture<SendResult<String, Object>> future = kafkaProducer.sendLotteryInvoice(invoiceVO);
        future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
            @Override
            public void onSuccess(SendResult<String, Object> stringObjectSendResult) {
                // 5.1 MQ 消息发送完成，更新数据库表 user_strategy_export.mq_state = 1
                activityPartake.updateInvoiceMqState(invoiceVO.getUId(), invoiceVO.getOrderId(), Constants.MQState.COMPLETE.getCode());

            }

            @Override
            public void onFailure(Throwable throwable) {
                // 5.2 MQ 消息发送失败，更新数据库表 user_strategy_export.mq_state = 2 【等待定时任务扫码补偿MQ消息】
                activityPartake.updateInvoiceMqState(invoiceVO.getUId(), invoiceVO.getOrderId(), Constants.MQState.FAIL.getCode());
            }


        });

        // 6. 返回结果
        return new DrawProcessResult(Constants.ResponseCode.SUCCESS.getCode(), Constants.ResponseCode.SUCCESS.getInfo(), drawAwardInfo);
    }

    @Override
    public RuleQuantificationCrowdResult doRuleQuantificationCrowd(DecisionMatterReq req) {
        EngineResult engineResult = engineFilter.process(req);

        if (!engineResult.isSuccess()) {
            return new RuleQuantificationCrowdResult(Constants.ResponseCode.RULE_ERR.getCode(), Constants.ResponseCode.RULE_ERR.getInfo());
        }

        RuleQuantificationCrowdResult ruleQuantificationCrowdResult = new RuleQuantificationCrowdResult(Constants.ResponseCode.SUCCESS.getCode(), Constants.ResponseCode.SUCCESS.getInfo());
        ruleQuantificationCrowdResult.setActivityId(Long.valueOf(engineResult.getNodeValue()));
        return ruleQuantificationCrowdResult;
    }

    private DrawOrderVO buildDrawOrderVO(DrawProcessReq req, Long strategyId, Long takeId, DrawAwardVO drawAwardInfo) {
        long orderId = idGeneratorMap.get(Constants.Ids.SnowFlake).nextId();
        DrawOrderVO drawOrderVO = new DrawOrderVO();
        drawOrderVO.setUId(req.getUId());
        drawOrderVO.setTakeId(takeId);
        drawOrderVO.setActivityId(req.getActivityId());
        drawOrderVO.setOrderId(orderId);
        drawOrderVO.setStrategyId(strategyId);
        drawOrderVO.setStrategyMode(drawAwardInfo.getStrategyMode());
        drawOrderVO.setGrantType(drawAwardInfo.getGrantType());
        drawOrderVO.setGrantDate(drawAwardInfo.getGrantDate());
        drawOrderVO.setGrantState(Constants.GrantState.INIT.getCode());
        drawOrderVO.setAwardId(drawAwardInfo.getAwardId());
        drawOrderVO.setAwardType(drawAwardInfo.getAwardType());
        drawOrderVO.setAwardName(drawAwardInfo.getAwardName());
        drawOrderVO.setAwardContent(drawAwardInfo.getAwardContent());
        return drawOrderVO;
    }

    private InvoiceVO buildInvoiceVO(DrawOrderVO drawOrderVO) {
        InvoiceVO invoiceVO = new InvoiceVO();
        invoiceVO.setUId(drawOrderVO.getUId());
        invoiceVO.setOrderId(drawOrderVO.getOrderId());
        invoiceVO.setAwardId(drawOrderVO.getAwardId());
        invoiceVO.setAwardType(drawOrderVO.getAwardType());
        invoiceVO.setAwardName(drawOrderVO.getAwardName());
        invoiceVO.setAwardContent(drawOrderVO.getAwardContent());
        invoiceVO.setShippingAddress(null);
        invoiceVO.setExtInfo(null);
        return invoiceVO;
    }
}
~~~

## 抽奖模块

### 抽奖核心算法

在抽奖系统当中，目前有两种抽奖的算法：

- **总体概率算法**：一种奖品被抽完后，剩下奖品池中的奖品被抽中的概率会随着这种奖品被抽完而改变。
- **单项概率算法**：每一种奖品的概率都是固定的，不会随着该种奖品被抽完而改变被抽中的概率。

#### 总体概率算法

总体概率算法分别把A、B、C对应的概率值转换成阶梯范围值，A=(0~0.2]、B=(0.2-0.5]、C=(0.5-1.0]，当使用随机数方法生成一个随机数后，与阶梯范围值进行循环比对找到对应的区域，在循环匹配奖品，若随机概率 <= (累加概率+真实概率)，则返回对应奖品信息，反之则会继续循环，这个算法的总体时间复杂度为O(n)

![image-20230529162015903](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202305291620987.png)

**具体的代码实现：**

~~~ java
/**
 * 必中奖策略抽奖，排掉已经中奖的概率，重新计算中奖范围
 * @author chenjiaying
 * @date 2023/5/23 12:30
 */
@Component("entiretyRateRandomDrawAlgorithm")
public class EntiretyRateRandomDrawAlgorithm extends BaseAlgorithm {

    @Override
    public String randomDraw(Long strategyId, List<String> excludeAwardIds) {
        BigDecimal differenceDenominator = BigDecimal.ZERO;

        //排除掉不在抽奖范围的奖品ID集合
        List<AwardRateVO> differenceAwardRateList = new ArrayList<>();
        List<AwardRateVO> awardRateVOList = awardRateInfoMap.get(strategyId);
        for (AwardRateVO awardRateInfo : awardRateVOList) {
            String awardId = awardRateInfo.getAwardId();
            if (excludeAwardIds.contains(awardId)) {
                continue;
            }
            differenceAwardRateList.add(awardRateInfo);
            differenceDenominator = differenceDenominator.add(awardRateInfo.getAwardRate());
        }

        // 前置判断：奖品列表为0，返回null
        if (differenceAwardRateList.size()==0) {
            return null;
        }

        // 前置判断：奖品列表为1，直接返回
        if (differenceAwardRateList.size()==1) {
            return differenceAwardRateList.get(0).getAwardId();
        }

        // 获取随机概率值
        int randomVal = this.generateSecureRandomIntCode(100);

        // 循环获取奖品
        String awardId ="";
        int cursorVal =0;
        for (AwardRateVO awardRateInfo : differenceAwardRateList) {
            // (奖品的概率 / 总概率) * 100
            int rateVal = awardRateInfo.getAwardRate().divide(differenceDenominator, 2, BigDecimal.ROUND_HALF_UP).multiply(new BigDecimal(100)).intValue();
            // 随机概率 <= rateVal+累加概率 
            if (randomVal<=(cursorVal+rateVal)) {
                awardId = awardRateInfo.getAwardId();
                break;
            }
            cursorVal+=rateVal;
        }

        // 返回中奖结果
        return awardId;
    }
}
~~~

#### 单项概率算法

单项概率算法不涉及奖品概率重新计算的问题，那么也就是说我们分配好的概率结果是可以固定下来的。我们不需要在轮询匹配 O(n) 时间复杂度来处理中奖信息，而是可以根据概率值存放到 HashMap 或者自定义散列数组进行存放结果，这样就可以根据概率值直接定义中奖结果，时间复杂度由O(n)降低到O(1)。这样的设计在一般电商大促并发较高的情况下，达到优化接口响应时间的目的。

**代码实现：**

1. 根据不同种奖品的概率使用斐波那契散列方法，均为的散列在不同的位置，并定义相关的索引小标计算的方法。

~~~~ java
/**
 * 共用的算法逻辑抽象类
 *
 * @author chenjiaying
 * @date 2023/5/23 11:34
 */
public abstract class BaseAlgorithm implements IDrawAlgorithm {

    /**
     * 斐波那契散列增量，逻辑：黄金分割点：(√5 - 1) / 2 = 0.6180339887，Math.pow(2, 32) * 0.6180339887 = 0x61c88647
     */
    private final int HASH_INCREMENT = 0x61c88647;

    /**
     * 数组初始化长度
     */
    private final int RATE_TUPLE_LENGTH = 128;

    /**
     * 存放概率与奖品对应的散列结果，strategyId -> rateTuple
     */
    protected Map<Long, String[]> rateTupleMap = new ConcurrentHashMap<>();

    /**
     * 奖品区间概率值，strategyId -> [awardId->begin、awardId->end]
     */
    protected Map<Long, List<AwardRateVO>> awardRateInfoMap = new ConcurrentHashMap<>();

    @Override
    public synchronized void initRateTuple(Long strategyId, Integer strategyMode, List<AwardRateVO> awardRateInfoList) {

        // 前置判断
        if (isExist(strategyId)){
            return;
        }

        // 保存奖品的概率信息
        awardRateInfoMap.put(strategyId, awardRateInfoList);

        // 非单项概率，不必存入缓存，因为这部分抽奖算法需要实时处理中奖概率。
        if (!Constants.StrategyMode.SINGLE.getCode().equals(strategyMode)) {
            return;
        }

        String[] rateTuple = rateTupleMap.computeIfAbsent(strategyId, k -> new String[RATE_TUPLE_LENGTH]);

        int cursorVal = 0;
        for (AwardRateVO awardRateInfo : awardRateInfoList) {
            int realVal = awardRateInfo.getAwardRate().multiply(new BigDecimal(100)).intValue();

            // 循环填充概率范围值
            for (int i = cursorVal + 1; i <= (realVal + cursorVal); i++) {
                rateTuple[hasIdx(i)] = awardRateInfo.getAwardId();
            }

            cursorVal += realVal;
        }
    }

    @Override
    public boolean isExist(Long strategyId) {
        return rateTupleMap.containsKey(strategyId);
    }


    /**
     * 斐波那契（Fibonacci）散列法，计算哈希索引下标值
     *
     * @param val 值
     * @return 索引
     */
    protected int hasIdx(int val) {
        int hashCode = val * HASH_INCREMENT + HASH_INCREMENT;
        return hashCode & (RATE_TUPLE_LENGTH - 1);
    }

    /**
     * 生成百位随机抽奖码
     *
     * @return 随机值
     */
    protected int generateSecureRandomIntCode(int bound) {
        return new SecureRandom().nextInt(bound) + 1;
    }
}
~~~~

2. 通过对应的策略id查询到对应的奖品分布信息 ，通过获取随机方法以及索引下标的计算方法查询到对应索引下标的奖品信息，并返回对应中奖结果信息。

~~~ java
@Component("singleRateRandomDrawAlgorithm")
public class SingleRateRandomDrawAlgorithm extends BaseAlgorithm {


    @Override
    public String randomDraw(Long strategyId, List<String> excludeAwardIds) {

        // 获取策略对应的元组
        String[] rateTuple = super.rateTupleMap.get(strategyId);
        assert rateTuple !=null;

        // 随机索引
        int randomVal = this.generateSecureRandomIntCode(100);
        int idx = super.hasIdx(randomVal);

        // 返回结果
        String awardId = rateTuple[idx];

        //如果中奖ID命中排除奖品列表，则返回null
        if (excludeAwardIds.contains(awardId)) {
            return null;
        }

        return awardId;
    }
}
~~~

> 1. **为什么使用斐波那契散列法？**
>
> 斐波那契散列法的优点是简单、高效、均匀，它可以避免一些常见的散列函数缺陷。例如: 线性探测法容易产生聚集现象，平方探测法容易产生二次聚集现象，除留余数法容易产生冲突。斐波那契散列法的核心思想是将输入数据分成若干个长度为斐波那契数列的元素，然后将每个元素映射到散列表中的一个位置。
>
> 2. **为什么使用 0x61c88647 作为斐波那契增量？**
>
> 这个值是通过黄金分割点计算得到的，这个点的值是 `(sqrt(5) - 1) / 2`，大约是 `0.6180339887`，将这个点乘以 2 的 32 次方（即 `Math.pow(2, 32)`），然后将结果取整得到的就是 `0x61c88647`，同时这个值经过实践证明在大多数情况下可以获得较好的散列效果。
>
> 3.  int hashCode = val * HASH_INCREMENT + HASH_INCREMENT;
>     return hashCode & (RATE_TUPLE_LENGTH - 1);
>
>    `hashCode & (RATE_TUPLE_LENGTH - 1)` 的方式来计算哈希码对应的桶的索引。这种方式的原理是：由于哈希表的初始化长度一般是 2 的整数次幂，因此 `(RATE_TUPLE_LENGTH - 1)` 的二进制表示中，除了最高位，其余位都是 1。这样，当使用 `hashCode & (RATE_TUPLE_LENGTH - 1)` 的方式计算哈希码对应的桶的索引时，实际上是将哈希码的二进制表示的最低位与 `(RATE_TUPLE_LENGTH - 1)` 的二进制表示的最低位进行 AND 运算，从而得到哈希码对应的桶的索引。
>
>    `(RATE_TUPLE_LENGTH - 1)` 的二进制表示的除了最高位，其余位都是 1，因此 `hashCode & (RATE_TUPLE_LENGTH - 1)` 的结果等价于 `hashCode % RATE_TUPLE_LENGTH`，并且计算速度更快。因此，在这里使用 `(RATE_TUPLE_LENGTH - 1)` 的方式计算哈希码对应的桶的索引，可以提高哈希表的效率。

### 抽奖策略

**在抽奖策略当中使用了策略模式来处理策略模式的分配：**

1. 在 `IDrawAlgorithm` 分别定义: 

   - initRateTuple(Long strategyId, List< AwardRateInfo> awardRateInfoList)：初始化数据
   - isExistRateTuple(Long strategyId)：判断数据是否完成初始化判断数据是否完成初始化
   - randomDraw(Long strategyId,List< String> excludeAwardIds) ：生成随机数返回对应的获奖信息

2. `BaseAlgorithm` 实现 `IDrawAlgorithm`，整体的处理逻辑如下：

   - `initRateTuple( Long strategyId, Integer strategyMode, List<AwardRateVO> awardRateInfoList )`：

     - 首先通过策略ID去判断是否初始化元组中的信息，即判断奖品是否通过斐波那契散列到map中，若已经初始化完成，则 return 返回；

     - 未初始化，先把奖品的概率信息保存到以及 策略Id 为 key，保存对应的奖品信息；

     - 判断当前抽奖的模式是否为非单项概率模式【目前只有单项概率模式才要把奖品散列到斐波那契散列表中】，若是非单项概率的策略，则 return 返回；

     - 使用 Map 中 computeIfAbsent 的方法，判断是否存在对应的 strategyId 的数组，如果则获取对应数组中的值，如果不存在就创建一个长度为128 的 String 数组

     - 通过如下代码散列单项概率奖品的分布

       ![](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306081041027.png)

   - `isExist( Long strategyId )`：根据 `strategyId` 判断 rateTupleMap是否存在对应的初始化信息。

   - `hasIdx((Long strategyId)`：通过概率值计算哈希索引下标值

   - `generateSecureRandomIntCode( int bound )`：生成对应的随机数

3. `SingleRateRandomDrawAlgorithm` 和 `EntiretyRateRandomDrawAlgorithm` 分别继承了 `BaseAlgorithm` 获取已经完成初始化的数据并调用公共的方法，同时在两种不同的算法当中我们只要重写 randomDraw(Long strategyId,List< String> excludeAwardIds) 即可完成不同策略的实现操作，若后续有新增的方法，我们也是直接重写上述方法即可完成多策略的实现。

![image-20230529203922274](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202305292039336.png)



### 抽奖流程

- **抽奖的流程是相对固定，因此在这里使用了模板模式来处理抽奖过程。**

- **抽奖标准化流程：**

  1. 根据入参策略ID获取抽奖策略配置
  2. 校验和处理抽奖策略的数据初始化到内存
  3. 获取那些被排除掉的抽奖列表，这些奖品可能是已经奖品库存为空，或者因为风控策略不能给这个用户薅羊毛的奖品
  4. 执行抽奖算法
  5. 包装中奖结果

- **实现方式：**

  - DrawConfig：配置抽奖策略，SingleRateRandomDrawAlgorithm、EntiretyRateRandomDrawAlgorithm

  - DrawStrategySupport：提供抽奖策略数据支持，便于查询策略配置、奖品信息。通过这样的方式隔离职责。

  - AbstractDrawBase：抽象类定义模板方法流程，在抽象类的 `doDrawExec` 方法中，处理整个抽奖流程，并提供在流程中需要使用到的抽象方法，由 `DrawExecImpl` 服务逻辑中做具体实现。

  - AbsteractDrawExecImpl 继承 AbstractDrawBase 完成下相关的业务逻辑。


![image-20230529212101559](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202305292121628.png)

- **具体代码实现：**

  1. **IDrawExec：定义抽奖的方法**

     ~~~ java
     /**
     * 抽奖执行接口
     **/
     public interface IDrawExec {
     
         /**
          * 抽奖方法
          * @param req 抽奖参数；用户ID、策略ID
          * @return    中奖结果
          */
         DrawResult doDrawExec(DrawReq req);
     
     }
     ~~~

  2. **DrawConfig：抽奖策略配置类，提前将抽奖策略注入的 Map 容器当中**

     ~~~ java
     /**
      * 抽奖策略配置类
      */
     public class DrawConfig  {
         @Resource
         private IDrawAlgorithm entiretyRateRandomDrawAlgorithm;
     
         @Resource
         private IDrawAlgorithm singleRateRandomDrawAlgorithm;
     
         /**
          * 抽奖策略组
          */
         protected static Map<Integer,IDrawAlgorithm> drawAlgorithmGroup = new ConcurrentHashMap<>();
     
         @PostConstruct
         public void init(){
             drawAlgorithmGroup.put(Constants.StrategyMode.ENTIRETY.getCode(), entiretyRateRandomDrawAlgorithm);
             drawAlgorithmGroup.put(Constants.StrategyMode.SINGLE.getCode(), singleRateRandomDrawAlgorithm);
         }
     }
     ~~~

  3. **DrawStrategySupport：提供数据支撑，与数据层对接，如：查询策略信息、奖品信息**

     ~~~ java
     /**
      * 抽奖策略数据支撑，一些通用的数据服务
      */
     public class DrawStrategySupport extends DrawConfig{
     
         @Resource
         protected IStrategyRepository strategyRepository;
     
         /**
          * 查询策略配置信息
          *
          * @param strategyId 策略ID
          * @return 策略配置信息
          */
         protected StrategyRich queryStrategyRich(Long strategyId){
             return strategyRepository.queryStrategyRich(strategyId);
         }
     
         /**
          * 查询奖品详情信息
          *
          * @param awardId 奖品ID
          * @return 中奖详情
          */
         protected AwardBriefVO queryAwardInfoByAwardId(String awardId){
             return strategyRepository.queryAwardInfo(awardId);
         }
     }
     ~~~

  4. AbstractDrawBase：定义抽奖抽奖过程，主要实现了 IDrawExecd 接口中doDrawExe()，定义出标准的抽奖流程，同时定义了queryExcludeAwardIds()、drawAlgorithm() 两个抽象方法分别用于查询排除在外的奖品信息以及执行抽奖算法的方法

     ~~~ java
     /**
      * 定义抽象抽奖过程，模板模式
      */
     @Slf4j
     public abstract class AbstractDrawBase extends DrawStrategySupport implements IDrawExec {
     
         @Override
         public DrawResult doDrawExec(DrawReq req) {
     
             // 1. 获取抽奖策略
             StrategyRich strategyRich = super.queryStrategyRich(req.getStrategyId());
             StrategyBriefVO strategy = strategyRich.getStrategy();
     
     
             // 2. 校验抽奖策略是否已经初始化到内存
             this.checkAndInitRateData(req.getStrategyId(), strategy.getStrategyMode(), strategyRich.getStrategyDetailList());
     
             // 3. 获取不在抽奖范围内的列表，包括：奖品库存为空、风控策略、临时调整等
             List<String> excludeAwardIds = this.queryExcludeAwardIds(req.getStrategyId());
     
             // 4. 执行抽奖算法
             String awardId = this.drawAlgorithm(req.getStrategyId(), drawAlgorithmGroup.get(strategy.getStrategyMode()), excludeAwardIds);
     
             // 5. 包装中奖结果
             return buildDrawResult(req.getUId(), req.getStrategyId(), awardId, strategy);
         }
     
     
         /**
          * 获取不在抽奖范围内的列表，包括：奖品库存为空、风控策略、临时调整等，这类数据是含有业务逻辑的，所以需要由具体的实现方决定
          *
          * @param strategyId 策略ID
          * @return 排除的奖品ID集合
          */
         protected abstract List<String> queryExcludeAwardIds(Long strategyId);
     
     
         /**
          * 执行抽奖算法
          *
          * @param strategyId      策略ID
          * @param drawAlgorithm   抽奖算法
          * @param excludeAwardIds 排除的抽奖ID集合
          * @return 中奖奖品ID
          */
         protected abstract String drawAlgorithm(Long strategyId, IDrawAlgorithm drawAlgorithm, List<String> excludeAwardIds);
     
         /**
          * 校验抽奖策略是否已经初始化到内存
          *
          * @param strategyId         抽奖策略ID
          * @param strategyMode       抽奖策略模式
          * @param strategyDetailList 抽奖策略详情
          */
         private void checkAndInitRateData(Long strategyId, Integer strategyMode, List<StrategyDetailBriefVO> strategyDetailList) {
     
             // 根据抽奖策略模式，获取对应的抽奖服务
             IDrawAlgorithm drawAlgorithm = drawAlgorithmGroup.get(strategyMode);
     
             // 判断已处理过的的数据
             if (drawAlgorithm.isExist(strategyId)) {
                 return;
             }
     
             // 解析并初始化中奖概率到散列表
             List<AwardRateVO> awardRateInfoList = new ArrayList<>(strategyDetailList.size());
             for (StrategyDetailBriefVO strategyDetail : strategyDetailList) {
                 awardRateInfoList.add(new AwardRateVO(strategyDetail.getAwardId(), strategyDetail.getAwardRate()));
             }
     
             drawAlgorithm.initRateTuple(strategyId, strategyMode, awardRateInfoList);
         }
     
     
         /**
          * 包装抽奖结果
          *
          * @param uId        用户ID
          * @param strategyId 策略ID
          * @param awardId    奖品ID，null 情况：并发抽奖情况下，库存临界值1 -> 0，会有用户中奖结果为 null
          * @return 中奖结果
          */
         private DrawResult buildDrawResult(String uId, Long strategyId, String awardId, StrategyBriefVO strategy) {
             if (awardId == null) {
                 log.info("执行策略抽奖完成【未中奖】，用户：{} 策略ID：{}", uId, strategyId);
                 return new DrawResult(uId, strategyId, Constants.DrawState.FAIL.getCode());
             }
     
             AwardBriefVO award = super.queryAwardInfoByAwardId(awardId);
             DrawAwardVO drawAwardInfo = new DrawAwardVO(uId, award.getAwardId(), award.getAwardType(), award.getAwardName(), award.getAwardContent());
             drawAwardInfo.setStrategyMode(strategy.getStrategyMode());
             drawAwardInfo.setGrantType(strategy.getGrantType());
             drawAwardInfo.setGrantDate(strategy.getGrantDate());
             log.info("执行策略抽奖完成【已中奖】，用户：{} 策略ID：{} 奖品ID：{} 奖品名称：{}", uId, strategyId, awardId, award.getAwardName());
     
             return new DrawResult(uId, strategyId, Constants.DrawState.SUCCESS.getCode(), drawAwardInfo);
         }
     }
     ~~~

  5. DrawExecImpl：此方法是抽奖方法的实现，继承 AbstractDrawBase，并对抽象方法做出具体的实现。

     ~~~ java
     /**
      * 抽奖过程方法实现
      */
     @Service("drawExec")
     @Slf4j
     public class DrawExecImpl extends AbstractDrawBase {
     
         @Override
         protected List<String> queryExcludeAwardIds(Long strategyId) {
             List<String> awardList = strategyRepository.queryNoStockStrategyAwardList(strategyId);
             log.info("执行抽奖策略 strategyId：{}，无库存排除奖品列表ID集合 awardList：{}", strategyId, JSON.toJSONString(awardList));
             return awardList;
         }
     
         @Override
         protected String drawAlgorithm(Long strategyId, IDrawAlgorithm drawAlgorithm, List<String> excludeAwardIds) {
             // 执行抽奖
             String awardId = drawAlgorithm.randomDraw(strategyId, excludeAwardIds);
     
             if (awardId == null) {
                 return null;
             }
             /*
              * 扣减库存，暂时采用数据库行级锁的方式进行扣减库存，后续优化为 Redis 分布式锁扣减 decr/incr
              * 注意：通常数据库直接锁行记录的方式并不能支撑较大体量的并发，但此种方式需要了解，因为在分库分表下的正常数据流量下的个人数据记录中，是可以使用行级锁的，因为他只影响到自己的记录，不会影响到其他人
              */
             boolean isSuccess = strategyRepository.deductStock(strategyId, awardId);
     
             // 返回结果，库存扣减成功返回奖品ID，否则返回NULL 「在实际的业务场景中，如果中奖奖品库存为空，则会发送兜底奖品，比如各类券」
             return isSuccess ? awardId : null;
         }
     
     }
     ~~~


## 发奖模块

### 工厂模式处理不同奖品的发奖流程

**整体流程如下图所示：**

![image-20230608144449207](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306090953535.png)

1. IDistributionGoods：统一的发奖接口，在该接口中定义了 `doDistribution()` 配送方法

   ~~~ java
   /**
    * 配送货物接口，把各类奖品模拟成货物、配送代表着发货，包括虚拟奖品和失误奖品
    */
   public interface IDistributionGoods {
       /**
        * 奖品配送接口，奖品类型（1：文字描述、2：兑换码、3：优惠券、4：实物奖品）
        * @param req  物品信息
        * @return     配送结果
        */
       DistributionRes doDistribution(GoodsReq req);
   }
   
   ~~~

2. DistributionBase：配送货物继承共用类，在该类定义 `updateUserAwardState(String uId,Long orderId, String awardId,Integer grantState)` 用于更新用户领奖结果

   ~~~ java
   /**
    * 配送货物基础共用类
    */
   @Slf4j
   public abstract class DistributionBase {
   
       @Resource
       private IOrderRepository awardRepository;
   
       protected void updateUserAwardState(String uId,Long orderId, String awardId,Integer grantState){
           awardRepository.updateUserAwardState(uId, orderId, awardId, grantState);
       }
   }
   ~~~

3. CouponGoods、DescGoods、PhysicalGoods、RedeemCodeGoods：这四个类分别实现 IDistributionGoods 和继承 DistributionBase，实现 doDistribution()，并调用 DistributionBase 类中的 updateUserAwardState 方法。

~~~ java
/**
 * 优惠券商品
 */
@Component
@Slf4j
public class CouponGoods extends DistributionBase implements IDistributionGoods {

    @Override
    public DistributionRes doDistribution(GoodsReq req) {

        // 模拟调用优惠券发放接口
        log.info("模拟调用优惠券发放接口 uId：{} awardContent：{}", req.getUId(), req.getAwardContent());

        // 更新用户领奖结果
        super.updateUserAwardState(req.getUId(), req.getOrderId(), req.getAwardId(), Constants.GrantState.COMPLETE.getCode());

        return new DistributionRes(req.getUId(), Constants.AwardState.SUCCESS.getCode(), Constants.AwardState.SUCCESS.getInfo());
    }
}
~~~

4. 各类发奖奖品配置类，将各类奖品配送逻辑初始化到容器当中。

   ~~~ java
   /**
    * 各类发奖奖品配置类
    */
   public class GoodsConfig {
       /**
        * 奖品发放策略组
        */
       protected static Map<Integer, IDistributionGoods> goodsMap = new ConcurrentHashMap<>();
   
       @Resource
       private DescGoods descGoods;
   
       @Resource
       private RedeemCodeGoods redeemCodeGoods;
   
       @Resource
       private CouponGoods couponGoods;
   
       @Resource
       private PhysicalGoods physicalGoods;
   
       @PostConstruct
       public void init(){
           goodsMap.put(Constants.AwardType.DESC.getCode(), descGoods);
           goodsMap.put(Constants.AwardType.RedeemCodeGoods.getCode(), redeemCodeGoods);
           goodsMap.put(Constants.AwardType.CouponGoods.getCode(), couponGoods);
           goodsMap.put(Constants.AwardType.PhysicalGoods.getCode(), physicalGoods);
       }
   }
   
   ~~~

5. 工厂服务，从容器中获取对应的奖品的发货方法

   ~~~ java
   /**
    * 配送商品简单工厂，提供获取配送服务
    * @author chenjiaying
    * @date 2023/5/30 11:14
    */
   @Service
   public class DistributionGoodsFactory extends GoodsConfig {
   
       public IDistributionGoods getDistributionGoodsService(Integer awardType){
           return goodsMap.get(awardType);
       }
   }
   ~~~

### 执行流程

1. 用户抽奖完成之后，会奖抽奖的结果更新到数据库当中
2. 更新完抽奖之后，发送MQ，触发MQ的发奖过程
   - 若 MQ 发送消息成功，会将数据库表 `user_strategy_export.mq_state = 1` ,,同时监听器=监听到消息之后，会从消息中解析对应的消息对象，通过工厂类获取到发货工厂，执行发奖过程。
   - 若 MQ 发送消息失败，MQ 消息发送失败，更新数据库表 user_strategy_export.mq_state = 2 【等待定时任务扫码补偿MQ消息】。

~~~ java
 Long strategyId = partakeResult.getStrategyId();
        Long takeId = partakeResult.getTakeId();

        // 3. 执行抽奖
        DrawResult drawResult = drawExec.doDrawExec(new DrawReq(req.getUId(), strategyId));
        if (Constants.DrawState.FAIL.getCode().equals(drawResult.getDrawState())) {
            Result result = activityPartake.lockTackActivity(req.getUId(), req.getActivityId(), takeId);
            if (!Constants.ResponseCode.SUCCESS.getCode().equals(result.getCode())){
                return new DrawProcessResult(Constants.ResponseCode.UN_ERROR.getCode(), Constants.ResponseCode.UN_ERROR.getInfo());
            }
            return new DrawProcessResult(Constants.ResponseCode.LOSING_DRAW.getCode(), Constants.ResponseCode.LOSING_DRAW.getInfo());
        }
        DrawAwardVO drawAwardInfo = drawResult.getDrawAwardInfo();

        // 4. 结果落库
        DrawOrderVO drawOrderVO = buildDrawOrderVO(req, strategyId, takeId, drawAwardInfo);
        Result recordResult = activityPartake.recordDrawOrder(drawOrderVO);
        if (!Constants.ResponseCode.SUCCESS.getCode().equals(recordResult.getCode())) {
            return new DrawProcessResult(recordResult.getCode(),recordResult.getInfo());
        }

        // 5. 发生 MQ，触发发奖流程
        InvoiceVO invoiceVO = buildInvoiceVO(drawOrderVO);
        ListenableFuture<SendResult<String, Object>> future = kafkaProducer.sendLotteryInvoice(invoiceVO);
        future.addCallback(new ListenableFutureCallback<SendResult<String, Object>>() {
            @Override
            public void onSuccess(SendResult<String, Object> stringObjectSendResult) {
                // 5.1 MQ 消息发送完成，更新数据库表 user_strategy_export.mq_state = 1
                activityPartake.updateInvoiceMqState(invoiceVO.getUId(), invoiceVO.getOrderId(), Constants.MQState.COMPLETE.getCode());

            }

            @Override
            public void onFailure(Throwable throwable) {
                // 5.2 MQ 消息发送失败，更新数据库表 user_strategy_export.mq_state = 2 【等待定时任务扫码补偿MQ消息】
                activityPartake.updateInvoiceMqState(invoiceVO.getUId(), invoiceVO.getOrderId(), Constants.MQState.FAIL.getCode());
            }
        });
~~~

## 规则引擎模块

### 规则引擎

- 搭建一颗决策树，决策树的作用是：通过一系列条件的筛选，从而达到为不同人群匹配不同活动
- 筛选的过程，从规则树的根结点向下搜索至叶子节点，其中，内结点负责匹配条件，叶子结点确定最终的策略结果。

![13-02](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306091509246.png)

- 首先可以看下黑色框框的模拟指导树结构；`1`、`11`、`12`、`111`、`112`、`121`、`122`，这是一组树结构的ID，并由节点串联组合出一棵关系树。
- 接下来是类图部分，左侧是从`LogicFilter`开始定义适配的决策过滤器，`BaseLogic`是对接口的实现，提供最基本的通用方法。`UserAgeFilter`、`UserGenerFilter`，是两个具体的实现类用于判断`年龄`和`性别`。
- 最后则是对这颗可以被组织出来的决策树，进行执行的引擎。同样定义了引擎接口和基础的配置，在配置里面设定了需要的模式决策节点。



### 具体实现

![img](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306091552439.png)

1. LogicFilter：定义规则过滤器接口，提供获取逻辑决策器以及获取决策值的方法

   ~~~ java
   /**
    * 规则过滤器接口
    * @author chenjiaying
    * @date 2023/6/2 12:02
    */
   public interface LogicFilter {
   
       /**
        * 逻辑决策器
        * @param matterValue          决策值
        * @param treeNodeLineInfoList 决策节点
        * @return                     下一个节点Id
        */
       Long filter(String matterValue, List<TreeNodeLineVO> treeNodeLineInfoList);
   
       /**
        * 获取决策值
        *
        * @param decisionMatter 决策物料
        * @return               决策值
        */
       String matterValue(DecisionMatterReq decisionMatter);
   }
   ~~~

2. BaseLogic：实现LogicFilter的方法，在抽象方法中实现了接口方法，同时定义了基本的决策方法；`1、2、3、4、5`，`等于、小于、大于、小于等于、大于等于`的判断逻辑；同时定义了抽象方法，让每一个实现接口的类都必须按照规则提供`决策值`，这个决策值用于做逻辑比对。

   

   ~~~ java
   /**
    * 规则基础抽象类
    */
   public abstract class BaseLogic implements LogicFilter {
   
       @Override
       public Long filter(String matterValue, List<TreeNodeLineVO> treeNodeLineInfoList) {
   
           for (TreeNodeLineVO nodeLine : treeNodeLineInfoList) {
               if (decisionLogic(matterValue,nodeLine)) {
                   return nodeLine.getNodeIdTo();
               }
           }
           return Constants.Global.TREE_NULL_NODE;
       }
   
       /**
        * 获取规则比对值
        * @param decisionMatter 决策物料
        * @return 比对值
        */
       @Override
       public abstract String matterValue(DecisionMatterReq decisionMatter);
   
   
       private boolean decisionLogic(String matterValue,TreeNodeLineVO nodeLine){
           switch (nodeLine.getRuleLimitType()){
               case Constants.RuleLimitType.EQUAL:
                   return matterValue.equals(nodeLine.getRuleLimitValue());
               case Constants.RuleLimitType.GT:
                   return Double.parseDouble(matterValue)>Double.parseDouble(nodeLine.getRuleLimitValue());
               case Constants.RuleLimitType.LT:
                   return Double.parseDouble(matterValue)<Double.parseDouble(nodeLine.getRuleLimitValue());
               case Constants.RuleLimitType.GE:
                   return Double.parseDouble(matterValue)>=Double.parseDouble(nodeLine.getRuleLimitValue());
               case Constants.RuleLimitType.LE:
                   return Double.parseDouble(matterValue)<=Double.parseDouble(nodeLine.getRuleLimitValue());
               default:
                   return false;
           }
       }
   }
   ~~~

   4. 树节点逻辑实现类

      - 年龄规则

      ~~~ java
      /**
       * 年龄规则
       */
      @Component
      public class UserAgeFilter extends BaseLogic {
          @Override
          public String matterValue(DecisionMatterReq decisionMatter) {
              return decisionMatter.getValMap().get("age").toString();
          }
      }
      ~~~

      - 性别规则

      ~~~~ java
      /**
       * 性别规则
       */
      @Component
      public class UserGenderFilter extends BaseLogic {
      
          @Override
          public String matterValue(DecisionMatterReq decisionMatter) {
              return decisionMatter.getValMap().get("gender").toString();
          }
      }
      ~~~~

   5. EngineFilter：规则过滤器引擎接口，定义执行的方法。

      ```java
      /**
       * 规则过滤器引擎
       */
      public interface EngineFilter {
      
      
          /**
           * 规则过滤器接口
           * @param matter  规则决策物料
           * @return        规则决策结果
           */
          EngineResult process(final DecisionMatterReq matter);
      }
      ```

   6. EngineConfig：规则配置类，把过滤规则提前注入的 Map 中

      ~~~ java
      /**
       * 规则配置
       */
      public class EngineConfig {
      
          protected static Map<String, LogicFilter> logicFilterMap = new ConcurrentHashMap<>();
      
          @Resource
          private UserAgeFilter userAgeFilter;
          @Resource
          private UserGenderFilter userGenderFilter;
      
      
          @PostConstruct
          public void init() {
              logicFilterMap.put("userAge", userAgeFilter);
              logicFilterMap.put("userGender", userGenderFilter);
          }
      }
      ~~~

   7. EngineBase：主要提供决策树流程的处理过程，有点像通过链路的关系(`性别`、`年龄`)在二叉树中寻找果实节点的过程，同时提供一个抽象方法，执行决策流程的方法供外部去做具体的实现。

      ~~~ java
      /**
       * 规则引擎基础类
       * @author chenjiaying
       * @date 2023/6/2 13:42
       */
      @Slf4j
      public abstract class EngineBase extends EngineConfig implements EngineFilter{
      
          @Override
          public EngineResult process(DecisionMatterReq matter) {
              throw new RuntimeException("未实现规则引擎服务");
          }
      
          protected TreeNodeVO engineDecisionMaker(TreeRuleRich treeRuleRich,DecisionMatterReq matter){
              TreeRootVo treeRoot = treeRuleRich.getTreeRoot();
              Map<Long, TreeNodeVO> treeNodeMap = treeRuleRich.getTreeNodeMap();
      
              // 规则树根ID
              Long rootNodeId = treeRoot.getTreeRootNodeId();
              TreeNodeVO treeNodeInfo = treeNodeMap.get(rootNodeId);
      
              // 节点类型【nodeType】：1子叶 、2果实
              while (Constants.NodeType.STEM.equals(treeNodeInfo.getNodeType())){
                  String ruleKey = treeNodeInfo.getRuleKey();
                  LogicFilter logicFilter = logicFilterMap.get(ruleKey);
                  String matterValue = logicFilter.matterValue(matter);
                  Long nextNode = logicFilter.filter(matterValue, treeNodeInfo.getTreeNodeLineInfoList());
                  treeNodeInfo = treeNodeMap.get(nextNode);
                  log.info("决策树引擎=>{} userId：{} treeId：{} treeNode：{} ruleKey：{} matterValue：{}", treeRoot.getTreeName(), matter.getUserId(),
                          matter.getTreeId(), treeNodeInfo.getTreeNodeId(), ruleKey, matterValue);
              }
      
              return treeNodeInfo;
          }
      
      }
      ~~~

   8.  规则引擎处理器

      ~~~ java
      /**
       * 规则引擎处理器
       */
      @Service("ruleEngineHandle")
      public class RuleEngineHandle extends EngineBase {
      
          @Resource
          private IRuleRepository ruleRepository;
      
          @Override
          public EngineResult process(DecisionMatterReq matter) {
      
              // 决策规则树
              TreeRuleRich treeRuleRich = ruleRepository.queryTreeRuleRich(matter.getTreeId());
              if (treeRuleRich == null) {
                  throw new RuntimeException("Tree Rule is null!");
              }
      
              // 决策节点
              TreeNodeVO treeNodeInfo = engineDecisionMaker(treeRuleRich, matter);
      
              // 决策结果
              return new EngineResult(matter.getUserId(), treeNodeInfo.getTreeId(), treeNodeInfo.getTreeNodeId(), treeNodeInfo.getNodeValue());
          }
      }
      ~~~

## 活动模块

### Redis 实现分布式滑块锁

![1](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306092132094.png)



