---
title: Docker 安装教程
date: 2022-11-14
---

## 一、安装前置步骤

在安装 Docker 之前，先说一下配置，我这里是 Centos7 Linux 内核：官方建议 3.10 以上，3.8 以上貌似也可。

注意：本文的命令使用的是 root 用户登录执行，不是 root 的话所有命令前面要加 `sudo`

**1.查看当前的内核版本**

```shell
uname -r
```

![image-20221011212654827](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202210112126879.png)

我这里是 3.10 ，满足条件。

**2.使用 root 权限更新 yum 包（生产环境中此步操作需慎重，看自己情况，学习的话随便搞）**

```shell
yum -y update
```

这个命令不是必须执行的，看个人情况，后面出现不兼容的情况的话就必须 update 了

> 注意
> yum -y update：升级所有包同时也升级软件和系统内核；
> yum -y upgrade：只升级所有包，不升级软件和系统内核

**3.卸载旧版本（如果之前安装过的话）**

```shell
yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine
```

## 二、安装 Docker

**1.安装需要的软件包， yum-util 提供 yum-config-manager 功能，另两个是 devicemapper 驱动依赖**

```shell
yum install -y yum-utils device-mapper-persistent-data lvm2
```

**2.设置 yum 源**

设置一个 yum 源，下面两个都可用

```javascript
yum-config-manager --add-repo http://download.docker.com/linux/centos/docker-ce.repo
yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```

**3.安装最新版本的 Docker Engine-Community 和 containerd**

```shell
yum install docker-ce docker-ce-cli containerd.io
```

出现下图说明安装成功

![image-20221011213131182](https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202210112131242.png)

**4.启动 Docker 并设置开机自启**

```shell
systemctl start docker
systemctl enable docker
```

**5.验证是否安装成功**

```shell
docker version
```

Docker 需要用户具有 sudo 权限，为了避免每次命令都输入 sudo，可以把用户加入 Docker 用户组（官方文档）。

```shell
sudo usermod -aG docker $USER
```

**6.卸载 docker**

```shell
yum remove docker-ce docker-ce-cli containerd.io
rm -rf /var/lib/docker
```





