<template><div><h2 id="一、安装前置步骤" tabindex="-1"><a class="header-anchor" href="#一、安装前置步骤" aria-hidden="true">#</a> 一、安装前置步骤</h2>
<p>在安装 Docker 之前，先说一下配置，我这里是 Centos7 Linux 内核：官方建议 3.10 以上，3.8 以上貌似也可。</p>
<p>注意：本文的命令使用的是 root 用户登录执行，不是 root 的话所有命令前面要加 <code v-pre>sudo</code></p>
<p><strong>1.查看当前的内核版本</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token function">uname</span> <span class="token parameter variable">-r</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202210112126879.png" alt="image-20221011212654827" loading="lazy"></p>
<p>我这里是 3.10 ，满足条件。</p>
<p><strong>2.使用 root 权限更新 yum 包（生产环境中此步操作需慎重，看自己情况，学习的话随便搞）</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>yum <span class="token parameter variable">-y</span> update
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>这个命令不是必须执行的，看个人情况，后面出现不兼容的情况的话就必须 update 了</p>
<blockquote>
<p>注意
yum -y update：升级所有包同时也升级软件和系统内核；
yum -y upgrade：只升级所有包，不升级软件和系统内核</p>
</blockquote>
<p><strong>3.卸载旧版本（如果之前安装过的话）</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>yum remove <span class="token function">docker</span> <span class="token punctuation">\</span>
                  docker-client <span class="token punctuation">\</span>
                  docker-client-latest <span class="token punctuation">\</span>
                  docker-common <span class="token punctuation">\</span>
                  docker-latest <span class="token punctuation">\</span>
                  docker-latest-logrotate <span class="token punctuation">\</span>
                  docker-logrotate <span class="token punctuation">\</span>
                  docker-engine
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="二、安装-docker" tabindex="-1"><a class="header-anchor" href="#二、安装-docker" aria-hidden="true">#</a> 二、安装 Docker</h2>
<p><strong>1.安装需要的软件包， yum-util 提供 yum-config-manager 功能，另两个是 devicemapper 驱动依赖</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>yum <span class="token function">install</span> <span class="token parameter variable">-y</span> yum-utils device-mapper-persistent-data lvm2
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p><strong>2.设置 yum 源</strong></p>
<p>设置一个 yum 源，下面两个都可用</p>
<div class="language-javascript line-numbers-mode" data-ext="js"><pre v-pre class="language-javascript"><code>yum<span class="token operator">-</span>config<span class="token operator">-</span>manager <span class="token operator">--</span>add<span class="token operator">-</span>repo http<span class="token operator">:</span><span class="token operator">/</span><span class="token operator">/</span>download<span class="token punctuation">.</span>docker<span class="token punctuation">.</span>com<span class="token operator">/</span>linux<span class="token operator">/</span>centos<span class="token operator">/</span>docker<span class="token operator">-</span>ce<span class="token punctuation">.</span>repo
yum<span class="token operator">-</span>config<span class="token operator">-</span>manager <span class="token operator">--</span>add<span class="token operator">-</span>repo http<span class="token operator">:</span><span class="token operator">/</span><span class="token operator">/</span>mirrors<span class="token punctuation">.</span>aliyun<span class="token punctuation">.</span>com<span class="token operator">/</span>docker<span class="token operator">-</span>ce<span class="token operator">/</span>linux<span class="token operator">/</span>centos<span class="token operator">/</span>docker<span class="token operator">-</span>ce<span class="token punctuation">.</span>repo
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>3.安装最新版本的 Docker Engine-Community 和 containerd</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>yum <span class="token function">install</span> docker-ce docker-ce-cli containerd.io
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>出现下图说明安装成功</p>
<p><img src="https://qijiayi-image.oss-cn-shenzhen.aliyuncs.com/img/202210112131242.png" alt="image-20221011213131182" loading="lazy"></p>
<p><strong>4.启动 Docker 并设置开机自启</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>systemctl start <span class="token function">docker</span>
systemctl <span class="token builtin class-name">enable</span> <span class="token function">docker</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>5.验证是否安装成功</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token function">docker</span> version
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>Docker 需要用户具有 sudo 权限，为了避免每次命令都输入 sudo，可以把用户加入 Docker 用户组（官方文档）。</p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code><span class="token function">sudo</span> <span class="token function">usermod</span> <span class="token parameter variable">-aG</span> <span class="token function">docker</span> <span class="token environment constant">$USER</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p><strong>6.卸载 docker</strong></p>
<div class="language-bash line-numbers-mode" data-ext="sh"><pre v-pre class="language-bash"><code>yum remove docker-ce docker-ce-cli containerd.io
<span class="token function">rm</span> <span class="token parameter variable">-rf</span> /var/lib/docker
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div></div></template>


