---
title: API 开放平台总结
date: 2023-06-12
---

## 需求分析&业务流程

### 需求分析

**做一个 API 接口平台：**

1. 管理员可以对接口信息进行增删改查
2. 用户访问前台，查看接口信息、调用接口

**其他要求：**

1. 防止攻击（安全性）
2. 不能随便调用接口（限制、开通）
3. 统计调用次数
4. 计费
5. 流量保护
6. API 接入

### 业务流程

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306120602964.png" alt="image-20230612060207830" style="zoom:67%;" />

## API签名认证实现流程

### 签名认证

**签名认证本质：**

1. 签发签名
2. 使用签名（校验签名）

**签名认证的作用：**

1. 保证安全性，不能随便一个人就可以去调用
2. 适用于无需保存登录态的场景。只认签名，不关注用户登录态

### 签名认证实现

**通过 http request header 头传递参数。**

- 参数1：accessKey [调用的标识 userA，userB（复杂、无序、无规律）]
- 参数2：secretKey [密钥（复杂、无序、无规律）**该参数不能放到请求头中**]

- 参数3：用户请求参数
- 参数4：sign
- 参数5：加 noce 随机数，只能用一次
- 参数6：加 timestamp 时间戳，校验时间戳是否过期

> ps:
>
> 1. ak、sk跟密码类似，区别在于 ak、sk 是无状态的
>
> 2. **千万不能把密钥直接放在服务器之间传递，有可能会被拦截下来**
> 3. 使用 noce 、timestamp 的目的是为了防重
>
> 加密方式：对称加密、非对称加密、md5签名（不可解密）
>
> **在我们项目当中使用了MD5加密，再获取请求参数之后，通过用户参数+密钥 => 签名生成算法（MD5、HMac、Sha1） => 不可解密的值**

**怎么知道生成的签名是否正确？**

服务端用一模一样的参数和算法去生成签名，只要和用户传的一致，就表示一致。

### 代码实现

**1. 在用户创建时我们就生成对应的ak、sk**

~~~ java
  @Override
    public long userRegister(String userAccount, String userPassword, String checkPassword) {
        // 1. 校验
        if (StringUtils.isAnyBlank(userAccount, userPassword, checkPassword)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "参数为空");
        }
        if (userAccount.length() < 4) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户账号过短");
        }
        if (userPassword.length() < 8 || checkPassword.length() < 8) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户密码过短");
        }
        // 密码和校验密码相同
        if (!userPassword.equals(checkPassword)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "两次输入的密码不一致");
        }
        synchronized (userAccount.intern()) {
            // 账户不能重复
            QueryWrapper<User> queryWrapper = new QueryWrapper<>();
            queryWrapper.eq("userAccount", userAccount);
            long count = userMapper.selectCount(queryWrapper);
            if (count > 0) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "账号重复");
            }
            // 2. 加密
            String encryptPassword = DigestUtils.md5DigestAsHex((SALT + userPassword).getBytes());
            // 3. 分配 accessKey，secretKey
            String accessKey = DigestUtil.md5Hex(SALT + userAccount + RandomUtil.randomNumbers(5));
            String secretKey = DigestUtil.md5Hex(SALT + userAccount + RandomUtil.randomNumbers(8));
            // 4. 插入数据
            User user = new User();
            user.setUserAccount(userAccount);
            user.setUserPassword(encryptPassword);
            user.setAccessKey(accessKey);
            user.setSecretKey(secretKey);
            boolean saveResult = this.save(user);
            if (!saveResult) {
                throw new BusinessException(ErrorCode.SYSTEM_ERROR, "注册失败，数据库错误");
            }
            return user.getId();
        }
    }
~~~

**2. 在用户请求对应的接口时，会请求到网关上，网关会对其进行校验过滤操作**

~~~ java
@Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // 1. 请求日志
        ServerHttpRequest request = exchange.getRequest();
        String method = request.getMethod().toString();
        String path = INTERFACE_HOST + request.getPath().value();
        log.info("请求唯一标识：" + request.getId());
        log.info("请求路径：" + path);
        log.info("请求方法：" + method);
        log.info("请求参数：" + request.getQueryParams());
        String sourceAddress = request.getLocalAddress().getHostString();
        log.info("请求来源地址：" + sourceAddress);
        log.info("请求来源地址：" + request.getRemoteAddress());
        ServerHttpResponse response = exchange.getResponse();
        // 2. 访问扣工资 - 黑白名单
        if (!IP_WHITE_LIST.contains(sourceAddress)) {
            handleNoAuth(response);
        }

        // 3. 用户鉴权（判断 ak、sk 是否合法）
        HttpHeaders headers = request.getHeaders();
        String accessKey = headers.getFirst("accessKey");
        String nonce = headers.getFirst("nonce");
        String timestamp = headers.getFirst("timestamp");
        String sign = headers.getFirst("sign");
        String body = headers.getFirst("body");
        // 去数据库中查是否已分配给用户
        User invokeUser = null;
        try {
            invokeUser = innerUserService.getInvokeUser(accessKey);
        } catch (Exception e) {
            log.error("getInvokeUser error", e);
        }
        if (invokeUser == null) {
            return handleNoAuth(response);
        }
        if (Long.parseLong(nonce) > 10000L) {
            handleNoAuth(response);
        }
        // 时间和当前时间不超过5分钟
        Long currentTime = System.currentTimeMillis() / 1000;
        final Long FIVE_MINUTES = 60 * 5L;
        if ((currentTime - Long.parseLong(timestamp)) >= FIVE_MINUTES) {
            return handleNoAuth(response);
        }

        // 从数据库中查询 secretKey
        String secretKey = invokeUser.getSecretKey();
        // 生成签名，判断用户请求携带的签名与本地生成的签名是否一致
        String serverSign = SignUtils.getSign(body, secretKey);
        if (sign == null || !sign.equals(serverSign)) {
            handleNoAuth(response);
        }

        // 4. 判断请求接口是否存在，以及请求方法是否匹配，校验请求参数
        InterfaceInfo interfaceInfo = null;
        try {
            interfaceInfo = innerInterfaceInfoService.getInterfaceInfo(path, method);
        } catch (Exception e) {
            log.error("getInterfaceInfo error", e);
        }
        if (interfaceInfo == null) {
            return handleNoAuth(response);
        }
        // 5.  请求转发，调用模拟接口 + 响应日志
        return handleResponse(exchange, chain, 1L, 1L);
    }
~~~

### 大厂对接签名认证接口处理

#### 京东VOP

在京东VOP获取 Access token的接口中使用到了签名认证算法，该接口的作用是调用该接口，获取 token 授权， token 将作为其他接口的授权凭证。

**请求方式：PSOT**

**参数格式："Content-Type", "application/x-www-form-urlencoded"**

**请求参数：**

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306120729216.png" alt="image-20230612072905147" style="zoom:67%;" />

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306120729377.png" alt="image-20230612072947307" style="zoom: 85%;" />

#### 得力电商平台

在得力电商平台获取 Access token的接口中使用到了签名认证算法，该接口的作用是调用该接口，获取 token 授权， token 将作为其他接口的授权凭证。

**请求方式：PSOT**

**参数格式："Content-Type", "application/x-www-form-urlencoded"**

**请求参数：**

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306120735665.png" alt="image-20230612073525609" style="zoom: 67%;" />

### 改进的地方

目前的设计方案是用户每一次携带参数来进行授权访问。

后续的改进中可以在sdk客户端当中，使用token的形式来调用，即是调用接口之前必须要生成对应的token，客户端通过在redis中获取对应的token来进行签名认证。

## SpringBoot Starter 开发流程

理想的状态就是开发者只需要关心调用那些接口、传递那些参数，所以我们需要开发一个便于开发者调用的SDK

> 开发Starter的好处：开发者引入之后，可以直接在 application.yml 中写配置，自动创建客户端

### 开发流程

**1. 初始化，环境依赖（一定要异常 build）：**

~~~ xml
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
        </dependency>
        <!-- 自动生成代码提示-->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-configuration-processor</artifactId>
            <optional>true</optional>
        </dependency>
~~~

**2. 编写配置类（启动类）**

~~~ java
@Configuration
// 配置前缀
@ConfigurationProperties("api-client")
@Data
@ComponentScan
public class ApiClientConfig {
    private String accessKey;
    private String secretKey;

    @Bean
    public ApiClient apiClient() {
        return new ApiClient(accessKey, secretKey);
    }
}
~~~

在引入之后，我们就可以在yml文件进行如下配置：

<img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202306120640686.png" alt="image-20230612064022639" style="zoom:67%;" />

**3. 注册配置类**

在 resource 目录下，创建 META_INF 目录，同时在该目录下创建 spring.factories 文件：

~~~ tex
# spring boot starter
org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.example.apiclientsdk.ApiClientConfig
~~~

**4. mvn install 打包代码为本地依赖包**

**5. 创建新的项目引入测试**

## GateWay网关的使用

### 网关基本介绍

网关可以理解为火车站的检票口，统一检票

**网关的作用：**

1. **路由**

   起到转发的作用，比如有接口A和接口B，网关会记录这些信息，根据用户访问地址和参数，转发请求到对应的接口（服务器/集群）。

   /a => 接口A

   /b => 接口B

2. **负载均衡**

   在路由的基础上

   /c => 服务A / 集权A（随机转发到其中的某一个机器）

   url 从固定地址改为lb:xxxx

3. **统一鉴权**

   判断用户是否有权限进行操作，无论访问什么接口，统一去判断权限，不用重复写鉴权操作

4. **跨域**

   网关统一处理跨域，不用在每个项目里单独处理，Gateway处理跨域，采用的是cors方案，并且只需要简单配置即可实现。

   ~~~ yaml
   spring:
     application:
       name: gateway  #服务名称
     cloud:
       nacos:
         discovery:
           server-addr: localhost:8848 #nacos地址
       gateway:
         globalcors:
           add-to-simple-url-handler-mapping: true
           cors-configurations:
             '[/**]':  #拦截的请求
               allowedOrigins: #允许跨域的请求
                 - "http://localhost:8080"
               allowedMethods: #运行跨域的请求方式
                 - "GET"
                 - "POST"
                 - "DELETE"
                 - "PUT"
                 - "OPTIONS"
               allowedHeaders: "*" #允许请求中携带的头信息
               allowedCredentials: true #是否允许携带cookie
               maxAge: 36000 #跨域检测的有效期,单位s
   
   ~~~

5. **统一业务处理（缓存）**

   把一些每个项目中都要做到通用逻辑放到上层（网关），统一处理，比如这个项目中的次数统计

6. **访问控制**

   黑白名单，比如限制 DDOS IP

7. **发布控制**

   灰度发布，比如接口上新，先给新接口分配 20% 的流量，老接口 80%，在慢慢调整比重

8. **流量染色**

   给请求(流量)添加一些标识，一般是设置请求头中，添加新的请求头

9. **接口保护**

   - 限制请求
   - 信息脱敏
   - 降级（熔断）
   - 限流：令牌桶算法，漏桶算法，RedisLimitHandler
   - 超时时间

10. **统一日志**

    统一请求、响应信息记录

11. **统一文档**

### GateWay 运用

基本功能：对请求头、请求参数、响应头的增删改查

1. 添加请求头
2. 添加请求参数
3. 添加响应头
4. 降级
5. 限流
6. 重试



**1. 在application.ynl文件中做以下定义：**

~~~~ yaml
server:
  port: 8090
spring:
  cloud:
    gateway:
      default-filters:
        #流量染色，在请求头中给固定标识
        - AddResponseHeader=source, yupi
      # 转发路由设置，前缀匹配  
      routes:
        - id: api_route
          uri: http://localhost:8123
          predicates:
            - Path=/api/**
logging:
  level:
    org:
      springframework:
        cloud:
          gateway: trace
dubbo:
  application:
    name: dubbo-springboot-demo-provider
  protocol:
    name: dubbo
    port: -1
  registry:
    id: nacos-registry
    address: nacos://localhost:8848


~~~~



**代码实现**

~~~ java
@Slf4j
@Component
public class CustomGlobalFilter implements GlobalFilter, Ordered {

    @DubboReference
    private InnerUserService innerUserService;
    @DubboReference
    private InnerInterfaceInfoService innerInterfaceInfoService;
    @DubboReference
    private InnerUserInterfaceInfoService innerUserInterfaceInfoService;

    public static final List<String> IP_WHITE_LIST = Arrays.asList("127.0.0.1");
    public static final String INTERFACE_HOST = "http://localhost:8123";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // 1. 请求日志
        ServerHttpRequest request = exchange.getRequest();
        String method = request.getMethod().toString();
        String path = INTERFACE_HOST + request.getPath().value();
        log.info("请求唯一标识：" + request.getId());
        log.info("请求路径：" + path);
        log.info("请求方法：" + method);
        log.info("请求参数：" + request.getQueryParams());
        String sourceAddress = request.getLocalAddress().getHostString();
        log.info("请求来源地址：" + sourceAddress);
        log.info("请求来源地址：" + request.getRemoteAddress());
        ServerHttpResponse response = exchange.getResponse();
        // 2. 访问扣工资 - 黑白名单
        if (!IP_WHITE_LIST.contains(sourceAddress)) {
            handleNoAuth(response);
        }

        // 3. 用户鉴权（判断 ak、sk 是否合法）
        HttpHeaders headers = request.getHeaders();
        String accessKey = headers.getFirst("accessKey");
        String nonce = headers.getFirst("nonce");
        String timestamp = headers.getFirst("timestamp");
        String sign = headers.getFirst("sign");
        String body = headers.getFirst("body");
        // 去数据库中查是否已分配给用户
        User invokeUser = null;
        try {
            invokeUser = innerUserService.getInvokeUser(accessKey);
        } catch (Exception e) {
            log.error("getInvokeUser error", e);
        }
        if (invokeUser == null) {
            return handleNoAuth(response);
        }
        //if (!accessKey.equals("ikun")) {
        //    handleNoAuth(response);
        //}
        if (Long.parseLong(nonce) > 10000L) {
            handleNoAuth(response);
        }
        // 时间和当前时间不超过5分钟
        Long currentTime = System.currentTimeMillis() / 1000;
        final Long FIVE_MINUTES = 60 * 5L;
        if ((currentTime - Long.parseLong(timestamp)) >= FIVE_MINUTES) {
            return handleNoAuth(response);
        }

        // 从数据库中查询 secretKey
        String secretKey = invokeUser.getSecretKey();
        String serverSign = SignUtils.getSign(body, secretKey);
        if (sign == null || !sign.equals(serverSign)) {
            handleNoAuth(response);
        }

        // 4. 判断请求接口是否存在，以及请求方法是否匹配，校验请求参数
        InterfaceInfo interfaceInfo = null;
        try {
            interfaceInfo = innerInterfaceInfoService.getInterfaceInfo(path, method);
        } catch (Exception e) {
            log.error("getInterfaceInfo error", e);
        }
        if (interfaceInfo == null) {
            return handleNoAuth(response);
        }
        // 5.  请求转发，调用模拟接口 + 响应日志
        return handleResponse(exchange, chain, interfaceInfo.getId(), invokeUser.getId());
    }

    @Override
    public int getOrder() {
        return -1;
    }

    public Mono<Void> handleNoAuth(ServerHttpResponse response) {
        response.setStatusCode(HttpStatus.FORBIDDEN);
        return response.setComplete();
    }

    public Mono<Void> handleInvokeError(ServerHttpResponse response) {
        response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
        return response.setComplete();
    }

    /**
     * 处理响应
     *
     * @param exchange
     * @param chain
     * @return
     */
    public Mono<Void> handleResponse(ServerWebExchange exchange, GatewayFilterChain chain, long interfaceInfoId, long userId) {
        try {
            ServerHttpResponse originalResponse = exchange.getResponse();
            // 缓存数据的工厂
            DataBufferFactory bufferFactory = originalResponse.bufferFactory();
            // 拿到响应码
            HttpStatus statusCode = originalResponse.getStatusCode();
            if (statusCode == HttpStatus.OK) {
                // 装饰，增强能力
                ServerHttpResponseDecorator decoratedResponse = new ServerHttpResponseDecorator(originalResponse) {
                    // 等调用完转发的接口后才会执行
                    @Override
                    public Mono<Void> writeWith(Publisher<? extends DataBuffer> body) {
                        log.info("body instanceof Flux: {}", (body instanceof Flux));
                        if (body instanceof Flux) {
                            Flux<? extends DataBuffer> fluxBody = Flux.from(body);
                            // 往返回值里写数据
                            // 拼接字符串
                            return super.writeWith(
                                    fluxBody.map(dataBuffer -> {
                                        // 7. 调用成功，接口调用次数 + 1 invokeCount
                                        try {
                                            innerUserInterfaceInfoService.invokeCount(interfaceInfoId, userId);
                                        } catch (Exception e) {
                                            log.error("invokeCount error", e);
                                        }
                                        byte[] content = new byte[dataBuffer.readableByteCount()];
                                        dataBuffer.read(content);
                                        DataBufferUtils.release(dataBuffer);//释放掉内存
                                        // 构建日志
                                        StringBuilder sb2 = new StringBuilder(200);
                                        List<Object> rspArgs = new ArrayList<>();
                                        rspArgs.add(originalResponse.getStatusCode());
                                        String data = new String(content, StandardCharsets.UTF_8); //data
                                        sb2.append(data);
                                        // 打印日志
                                        log.info("响应结果：" + data);
                                        return bufferFactory.wrap(content);
                                    }));
                        } else {
                            // 8. 调用失败，返回一个规范的错误码
                            log.error("<--- {} 响应code异常", getStatusCode());
                        }
                        return super.writeWith(body);
                    }
                };
                // 设置 response 对象为装饰过的
                return chain.filter(exchange.mutate().response(decoratedResponse).build());
            }
            return chain.filter(exchange); // 降级处理返回数据
        } catch (Exception e) {
            log.error("网关处理响应异常" + e);
            return chain.filter(exchange);
        }
    }

}
~~~


## Dubbo 运用

### 整合 Dubbo

- backed 项目作为服务器的提供者，提供3个方法：
  - 从数据库中查询是否有存在该用户，是否已经分配ak/sk
  - 从数据中查询接口是否存在，以及请求的方法是否匹配
  - 调用成功，接口调用次数 + 1 invokeCount
- GateWay 项目作为服务的调用这3个方法

>注意：
>
>1. 服务接口类必须要在同一个包下，建议是抽象出一个公共项目（放接口、实体类等）
>2. 设置注解（比如启动类的 EnableDubbo、接口实现类和Bean 引用的注解）
>3. 添加配置
>4. 服务调用项目和提供者项目尽量引入相同的依赖和配置

### 具体实现

#### 服务提供者

1. 配置 pom 文件

~~~ xml
        <dependency>
            <groupId>org.apache.dubbo</groupId>
            <artifactId>dubbo</artifactId>
            <version>3.0.9</version>
        </dependency>
        <dependency>
            <groupId>com.alibaba.nacos</groupId>
            <artifactId>nacos-client</artifactId>
            <version>2.1.0</version>
        </dependency>
~~~

2. 配置对应的yaml文件

~~~ yml
dubbo:
  application:
    name: dubbo-springboot-demo-provider
  protocol:
    name: dubbo
    port: -1
  registry:
    id: nacos-registry
    address: nacos://localhost:8848
~~~

3. 启动类添加`@EnableDubbo`

~~~ java
@SpringBootApplication
@MapperScan("com.example.project.mapper")
@EnableDubbo
public class MyApplication {

    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }

}
~~~

4. 配置`@dubboservice`，作为服务的提供者

~~~ java
@DubboService
public class InnerUserInterfaceInfoServiceImpl implements InnerUserInterfaceInfoService {


    @Resource
    private UserInterfaceInfoService userInterfaceInfoService;

    @Override
    public boolean invokeCount(long interfaceInfoId, long userId) {
        return userInterfaceInfoService.invokeCount(interfaceInfoId, userId);
    }
}


@DubboService
public class InnerInterfaceInfoServiceImpl implements InnerInterfaceInfoService {
    @Resource
    private InterfaceInfoMapper interfaceInfoMapper;
    @Override
    public InterfaceInfo getInterfaceInfo(String url, String method) {
        if (StringUtils.isAnyBlank(url, method)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR);
        }
        QueryWrapper<InterfaceInfo> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("url", url);
        queryWrapper.eq("method", method);
        return interfaceInfoMapper.selectOne(queryWrapper);
    }
}


@DubboService
public class InnerUserServiceImpl implements InnerUserService {

    @Resource
    private UserMapper userMapper;

    @Override
    public User getInvokeUser(String accessKey) {
        if (StringUtils.isAnyBlank(accessKey)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR);
        }
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("accessKey", accessKey);
        return  userMapper.selectOne(queryWrapper);
    }
}
~~~

#### 服务调用者

1. 配置 pom 文件

~~~ xml
        <dependency>
            <groupId>org.apache.dubbo</groupId>
            <artifactId>dubbo</artifactId>
            <version>3.0.9</version>
        </dependency>
        <dependency>
            <groupId>com.alibaba.nacos</groupId>
            <artifactId>nacos-client</artifactId>
            <version>2.1.0</version>
        </dependency>
~~~

2. 配置对应的yaml文件

~~~ yaml
dubbo:
  application:
    name: dubbo-springboot-demo-provider
  protocol:
    name: dubbo
    port: -1
  registry:
    id: nacos-registry
    address: nacos://localhost:8848
~~~

3. 启动类添加 `@EnableDubbo`

~~~ java
@SpringBootApplication(exclude = {
        DataSourceAutoConfiguration.class,
        DataSourceTransactionManagerAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class})

@EnableDubbo
@Service
public class ApiGatewayApplication {

    public static void main(String[] args) {

        ConfigurableApplicationContext context = SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
~~~

4. 通过 `@DubboReference` 注解，调用对应的服务

~~~ java
    @DubboReference
    private InnerUserService innerUserService;
    @DubboReference
    private InnerInterfaceInfoService innerInterfaceInfoService;
    @DubboReference
    private InnerUserInterfaceInfoService innerUserInterfaceInfoService;
~~~

