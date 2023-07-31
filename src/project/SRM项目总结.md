---
title: SRM 项目总结
date: 2023-06-12
---

## 商品申请单转商品订单使用锁

~~~ java
     private ReentrantLock lock = new ReentrantLock();

	@ApiOperation(value = "采购申请-商城申请转订单", notes = "采购申请-商城申请转订单")
    @PostMapping(value = "/mallRequestToOrder")
    public Result<?> mallRequestToOrder(@RequestBody PurchaseRequestHeadVO purchaseRequestHeadPage) {
        lock.lock();
        try {
            PurchaseRequestHead purchaseRequestHead = new PurchaseRequestHead();
            BeanUtils.copyProperties(purchaseRequestHeadPage, purchaseRequestHead);
            purchaseRequestHeadService.mallRequestToOrder(purchaseRequestHead);
            return Result.ok(purchaseRequestHeadPage);
        } catch (Exception e) {
            throw e;
        } finally {
            lock.unlock();
        }
    }
~~~



## 定时任务推送物流数据到中台

~~~ java
@Service("srmPushMallOrder2WMSJob")
public class SrmPushMallOrder2WMSJob implements JobRpcService {
    private final static Logger logger = LoggerFactory.getLogger(SrmPushMallOrder2WMSJob.class);
    /**
     * 分布式锁前缀
     */
    private final String LOCK_PREFIX = "purchaseOrderHeadService_schedule_srmPushMallOrder2WMSJob";
    /**
     * 分布式锁过期时间
     */
    private final long EXPIRE_TIME = 50000L;

    @Autowired
    private RedisUtil redisUtil;

    @Autowired
    private PurchaseOrderHeadService purchaseOrderHeadService;

    /**
     * 全局价格主数据定时任务更新job
     * selectWithoutElsAccount
     * @param parameter
     */
    @Override
    public void execute(String parameter) {
        //方法内的事务控制
        String requestId = "100000";
        try {
            if (redisUtil.tryGetDistributedLock(LOCK_PREFIX, requestId, EXPIRE_TIME)) {
                logger.info("srmPushMallOrder2WMSJob start");
                purchaseOrderHeadService.mall2WMS();
                logger.info("srmPushMallOrder2WMSJob end");
            } else {
                throw new ELSBootException(I18nUtil.translate("i18n_alert_umdWFzEHrLSiKRcWVxPVBRc_268e90d8"," 推送商城订单数据到wms正在执行，请不要重复执行"));
            }
        } catch (Exception e) {
            logger.info(Thread.currentThread().getName() + "推送商城订单数据到wms任务出现异常:", e);
            throw e;
        } finally {
            redisUtil.releaseDistributedLock(LOCK_PREFIX, requestId);
        }
    }


    /**
     * 风骚操作 避免数据库的定时任务无效或者被停掉(这个对系统来说不能被停掉的，所以必须执行)
     */
    @Scheduled(cron = "00 00 8 * * ?")
    public void doScheduled(){
        execute(null);
    }
}
~~~

> ps：`00 00 8 * * ?` 表示在每天的上午 8 点整触发任务。以下是对表达式的解析：
>
> - `00`：表示在每小时的第 0 分钟触发任务。
> - `00`：表示在每小时的第 0 秒触发任务。
> - `8`：表示在每天的第 8 小时触发任务。
> - `*`：表示在每月的任意日期触发任务。
> - `*`：表示在每周的任意星期触发任务。
> - `?`：表示不指定具体的日期。
>
> 综上所述，该定时任务表达式表示在每天的上午 8 点整触发任务。注意，该表达式是基于 Quartz 的 Cron 表达式语法，其中 `?` 用于指定不关心的字段，比如日期字段和星期字段无法同时指定具体值。

## 使用HHttpClient 对接接口

**1. 添加 pom.xml**

~~~ xml
		<dependency>
			<groupId>org.apache.httpcomponents</groupId>
			<artifactId>httpclient</artifactId>
			<version>4.5.13</version>
		</dependency>
~~~

**2. 写HttpUtil工具类**

~~~ java
public class HttpUtil {

    private static final Logger logger = LoggerFactory.getLogger(HttpUtil.class);
    private static PoolingHttpClientConnectionManager connMgr = new PoolingHttpClientConnectionManager();
    private static RequestConfig requestConfig;

    public HttpUtils() {
    }

    /**
     * 情况方法直接放这里就行
     */
    

    static {
        connMgr.setMaxTotal(100);
        connMgr.setDefaultMaxPerRoute(connMgr.getMaxTotal());
        Builder configBuilder = RequestConfig.custom();
        configBuilder.setConnectTimeout(60000);
        configBuilder.setSocketTimeout(70000);
        configBuilder.setConnectionRequestTimeout(30000);
        requestConfig = configBuilder.build();
    }
    
    
    /**
     * Post请求
     * @param apiUrl 请求链接
     * @param params 请求类型：x-www-form-urlencoded
     * @return
     */
    public static String doPost(String apiUrl, Map<String, Object> params) {
        long start = System.currentTimeMillis();
        CloseableHttpResponse response = null;
        String httpStr = null;
        int statusCode = -999;
        //创建http实例
        CloseableHttpClient httpClient = HttpClients.createDefault();
        //创建httpPost实例
        HttpPost httpPost = new HttpPost(apiUrl);
        try {
            httpPost.setConfig(requestConfig);
            List<NameValuePair> pairList = new ArrayList();
            Iterator i$ = params.entrySet().iterator();

            while(i$.hasNext()) {
                Entry<String, Object> entry = (Entry)i$.next();
                NameValuePair pair = new BasicNameValuePair((String)entry.getKey(), entry.getValue().toString());
                pairList.add(pair);
            }
            httpPost.setEntity(new UrlEncodedFormEntity(pairList, Charset.forName("UTF-8")));
            response = httpClient.execute(httpPost);
            statusCode = response.getStatusLine().getStatusCode();
            HttpEntity entity = response.getEntity();
            httpStr = EntityUtils.toString(entity, "UTF-8");
        } catch (Exception e) {
            logger.info("HttpUtil发生错误:" + e.getMessage());
            e.printStackTrace();
        } finally {
            if (response != null) {
                try {
                    EntityUtils.consume(response.getEntity());
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

            logger.info("request path:{}, param:{},response code:{},result:{},cost {} ms", new Object[]{apiUrl, params.toString(), statusCode, httpStr, System.currentTimeMillis() - start});
        }

        return httpStr;
    }
}
~~~



## CompletableFuture+多线程 处理接口响应时间过长

### 优化之前

~~~ java
private List<RequestMatchInfomationVO> doRequestToRequestInfomation(List<PurchaseRequestItem> purchaseRequestItemList,String toElsAccount) {
        List<String> requestHeadIds = purchaseRequestItemList.stream().map(PurchaseRequestItem::getHeadId).distinct().collect(Collectors.toList());
        List<PurchaseRequestHead> purchaseRequestHeadList = this.listByIds(requestHeadIds);
        //查询订单生成配置
        Map<String, Map<PurchaseOrderGenarateConfigDTO, List>> orderGenarateConfigMap = queryOrderGenrateConfigByMap(purchaseRequestHeadList, purchaseRequestItemList);
        //根据订单生成配置的合并数量的条件合并数量
        List<PurchaseRequestItem> requestItemList = purchaseRequestItemList;
        if (CollectionUtil.isEmpty(requestItemList)) {
            throw new ELSBootException(I18nUtil.translate("i18n_alert_nGTVSWstTVLV_cf88f1b9", "合并需求后,转单需求为空"));
        }
        //查询订单权限配置列表数据
        Map<String, PurchaseOrderPermissionConfigDTO> orderPermissionConfigMap = getOrderPermissionConfigMap(requestItemList);
        //查询物料主数据判定物料是否需要货源清单
        Map<String, PurchaseMaterialHeadExtendDTO> purchaseMaterialHeadExtendMap = getPurchaseMaterialHeadMap(requestItemList);
        //按照物料是否是货源清单将采购申请进行分类
        Map<String, List<PurchaseRequestItem>> goodsMaterialNumberMap = classicByMaterialSource(requestItemList, purchaseMaterialHeadExtendMap);
        List<RequestMatchInfomationVO> requestMatchInfomationVOList = new ArrayList<>();
        //key:物料编码_采购组织_工厂
        Map<String, List<PurchaseInformationRecordsDTO>> informationRecordsMap = new HashMap<>();

        //key:物料编码   value 货源清单
        Map<String, List<PurchaseMaterialSourceDTO>> sourceMap = new HashMap<>();

        //不需要货源清单的数据
        List<PurchaseRequestItem> noHadRequestItemList = goodsMaterialNumberMap.get(NO_HAD_SOURCE);
        Map<String, PurchaseRequestHead> requestHeadMap = purchaseRequestHeadList.stream().collect(Collectors.toMap(PurchaseRequestHead::getRequestNumber, Function.identity()));
        //匹配不需要货源清单的行的价格
        addNoMaterialRequestInfoToMap(informationRecordsMap, noHadRequestItemList,toElsAccount);
        //供应商拓展信息按照供应商进行分组
        Map<String, SupplierMasterDataDTO> supplierMasterDataDTOMap = new HashMap<>();
        //供应商组织信息按照elsAccount/toElsAccount/purchaseOrg进行分组
        Map<String, SupplierOrgInfoDTO> supplierOrgInfoDTOMap = new HashMap<>();
        //获取收货地址
        Map<String, DeliveryOrderAddressDTO> deliveryOrderAddressDTOMap = new HashMap<>();
        for (PurchaseRequestItem requestItem : noHadRequestItemList) {
            //查找出符合条件的价格
            List<PurchaseInformationRecordsDTO> informationRecordsDTOList = informationRecordsMap.get(requestItem.getMaterialNumber() + "_," + requestItem.getPurchaseOrg() + "_," + requestItem.getFactory());
            //物料组_采购申请类型_采购申请行类型
            Map<PurchaseOrderGenarateConfigDTO, List> purchaseOrderGenarateConfigMap = orderGenarateConfigMap.get(requestItem.getMaterialGroup() + "_" + requestItem.getRequestType() + "_" + requestItem.getPurchaseType());
            if (purchaseOrderGenarateConfigMap == null) {
                purchaseOrderGenarateConfigMap = orderGenarateConfigMap.get("_" + requestItem.getRequestType() + "_" + requestItem.getPurchaseType());
            }
            if (purchaseOrderGenarateConfigMap == null) {
                purchaseOrderGenarateConfigMap = orderGenarateConfigMap.get("_" + requestItem.getRequestType() + "_");
            }
            if (purchaseOrderGenarateConfigMap == null) {
                purchaseOrderGenarateConfigMap = orderGenarateConfigMap.get("_" + requestItem.getCateName() + "_");
            }
            if (purchaseOrderGenarateConfigMap == null) {
                throw new ELSBootException(I18nUtil.translate("i18n_alert_nRUVyWWWWWWWEyWWWWWWWKItbLERsYxuIdjERdW_b6d049b4", "采购申请号:[${0}]行号:[${1}]在订单生成配置中找不到对应的配置项!", requestItem.getRequestNumber(), requestItem.getItemNumber()));
            }
            PurchaseOrderGenarateConfigDTO purchaseOrderGenarateConfig = purchaseOrderGenarateConfigMap.keySet().iterator().next();
            PurchaseOrderPermissionConfigDTO purchaseOrderPermissionConfigDTO = orderPermissionConfigMap.get(requestItem.getCateCode() + "_" + requestItem.getFactory());
            if (purchaseOrderPermissionConfigDTO == null) {
                purchaseOrderPermissionConfigDTO = orderPermissionConfigMap.get("_" + requestItem.getFactory());
            }
            if (CollectionUtil.isEmpty(informationRecordsDTOList) && CommonConstant.YES.equals(purchaseOrderGenarateConfig.getPriceInfo())) {
                throw new ELSBootException(I18nUtil.translate("i18n_alert_nRUVyWWWWWWWEyWWWWWWWKItbLERslumVRWtHeBjzEujXjum_c426db7c", "采购申请号:[${0}]行号:[${1}]在订单生成配置中受价格控制,但系统没有匹配到有效的价格", requestItem.getRequestNumber(), requestItem.getItemNumber()));
            }
            if (purchaseOrderPermissionConfigDTO == null) {
                throw new ELSBootException(I18nUtil.translate("i18n_alert_nRUVyWWWWWWWEyWWWWWWWBjYuIdjItbWERWVWLDItbWWF_ecaf9b9e", "采购申请号:[${0}]行号:[${1}]没有找到对应的订单权限配置,请先维护订单权限数据", requestItem.getRequestNumber(), requestItem.getItemNumber()));
            }
            PurchaseMaterialHeadExtendDTO purchaseMaterialHeadExtend = purchaseMaterialHeadExtendMap.get(requestItem.getMaterialNumber() + "_" + requestItem.getFactory());
            PurchaseRequestHead requestHead = requestHeadMap.get(requestItem.getRequestNumber());
            DeliveryOrderAddressDTO deliveryOrderAddressDTO = deliveryOrderAddressDTOMap.get(requestItem.getFactory());
            //组装需求行与价格信息记录的数据
            //先把货源清单的数据挑出来
            List<PurchaseMaterialSourceDTO> purchaseMaterialSourceDTOList = new ArrayList<>();
            purchaseMaterialSourceDTOList = sourceMap.get(requestItem.getMaterialNumber());
            List<RequestMatchInfomationVO> requestMatchInfomationList = getRequestMatchInfomationVO(requestItem, informationRecordsDTOList, purchaseMaterialSourceDTOList, purchaseMaterialHeadExtend, requestHead, supplierMasterDataDTOMap, supplierOrgInfoDTOMap, purchaseOrderGenarateConfig, purchaseOrderPermissionConfigDTO, deliveryOrderAddressDTO);
            requestMatchInfomationVOList.addAll(requestMatchInfomationList);
        }
        return requestMatchInfomationVOList;
    }
~~~

### 优化步骤

**1. 创建自定义线程池配置类**

~~~ java
@Configuration
@EnableAsync
public class ThreadPoolConfig {
    // 核心线程数
    private int corePoolSize = 5;
    // 最大线程数
    private int maxPoolSize = 10;
    // 队列大小
    private int queueSize = 100;
    // 线程最大空闲时间
    private int keepAliveSeconds = 100;
    
    @Bean(value = "asyncOrderExecutor")
    public ThreadPoolTaskExecutor buildFirstThreadPool() {
        ThreadPoolTaskExecutor threadPool = new ThreadPoolTaskExecutor();
        // 核心线程数
        threadPool.setCorePoolSize(corePoolSize);
        // 最大线程数
        threadPool.setMaxPoolSize(maxPoolSize);
        // 任务队列大小
        threadPool.setQueueCapacity(queueSize);
        // 线程池名称前缀
        threadPool.setThreadNamePrefix("testThreadPool-");
        // 允许线程的空闲时间
        threadPool.setKeepAliveSeconds(keepAliveSeconds);
        /**
     * 自定义消费队列线程池
     * CallerRunsPolicy 这个策略重试添加当前的任务，他会自动重复调用 execute() 方法，直到成功。
     * AbortPolicy 对拒绝任务抛弃处理，并且抛出异常。
     * DiscardPolicy 对拒绝任务直接无声抛弃，没有异常信息。
     * DiscardOldestPolicy 对拒绝任务不抛弃，而是抛弃队列里面等待最久的一个线程，然后把拒绝任务加到队列。
     * @return
     */
        //线程池对拒绝任务的处理策略：这里采用了CallerRunsPolicy策略，当线程池没有处理能力的时候，该策略会直接在 execute 方法的调用线程中运行		被拒绝的任务；如果执行程序已关闭，则会丢弃该任务
        threadPool.setRejectedExecutionHandler(newThreadPoolExecutor.CallerRunsPolicy());
        //如果@Bean 就不需手动，会自动InitializingBean的afterPropertiesSet来调initialize
//      threadPool.initialize();
        return threadPool;
    }

}
~~~

**2. 使用异步的方式拼装数据**

1. 抽离循环匹配，拼接数据的方法，@Ansy注解指定线程池

2. 对数据进行分组，使用CompletableFuture.supplyAsync(() -> performTask(item))；进行异步计算处理数据
3. 同时使用 exceptionally() 方法对异步任务出现异常进行处理
4. 通过CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join()，阻塞等待所有的任务执行完毕之后，再统一收集
5. 循环 futures 获取最终拼接好的数据，并返回。

~~~ java
public List<RequestMatchInfomationVO> processTasks(List<PurchaseRequestItem> purchaseRequestItemList) throws ExecutionException, InterruptedException {
    int batchSize = 100; // 每个子列表的大小
    int totalSize = purchaseRequestItemList.size();
    List<CompletableFuture<List<RequestMatchInfomationVO>>> futures = new ArrayList<>();

    for (int i = 0; i < totalSize; i += batchSize) {
        int endIndex = Math.min(i + batchSize, totalSize);
        List<PurchaseRequestItem> sublist = purchaseRequestItemList.subList(i, endIndex);

        CompletableFuture<List<RequestMatchInfomationVO>> future = CompletableFuture.supplyAsync(() -> performBatchTasks(sublist), myThreadPool)
            .exceptionally(ex -> {
                    throw new CompletionException(ex); // 在出现异常时立即抛出异常
                });
        futures.add(future);
    }
	 CompletableFuture<Void> allFutures = CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join()
    List<RequestMatchInfomationVO> results = new ArrayList<>();
    for (CompletableFuture<List<RequestMatchInfomationVO>> future : futures) {
        List<RequestMatchInfomationVO> batchResults = future.get();
        results.addAll(batchResults);
    }

    return results;
}

@Ansy
private List<RequestMatchInfomationVO> performBatchTasks(List<PurchaseRequestItem> sublist) {
    List<RequestMatchInfomationVO> batchResults = new ArrayList<>();

    for (PurchaseRequestItem item : sublist) {
        RequestMatchInfomationVO result = performTask(item);
        batchResults.add(result);
    }

    return batchResults;
}
~~~









