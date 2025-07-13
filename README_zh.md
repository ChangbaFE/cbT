# cbT.js

[![npm version](https://badgen.net/npm/v/cb-template)](https://www.npmjs.com/package/cb-template) [![Downloads](https://badgen.net/npm/dt/cb-template)](https://www.npmjs.com/package/cb-template) [![codecov](https://codecov.io/github/hex-ci/cbT/graph/badge.svg?token=HBHJLIG91R)](https://codecov.io/github/hex-ci/cbT)

一个支持模板多级继承的 Node.js 服务端模板引擎

\[ [English](README.md) | 中文 \]

## 目录

  * [安装](#安装)
  * [特性](#特性)
  * [实例](#实例)
  * [使用](#使用)
  * [选项](#选项)
     * [cbT.leftDelimiter](#cbtleftdelimiter)
     * [cbT.rightDelimiter](#cbtrightdelimiter)
     * [cbT.basePath](#cbtbasepath)
     * [cbT.cachePath](#cbtcachepath)
     * [cbT.defaultExtName](#cbtdefaultextname)
  * [API](#api)
     * [cbT.compile(str)](#cbtcompilestr)
     * [cbT.compileFile(filename, options, callback)](#cbtcompilefilefilename-options-callback)
     * [cbT.render(str, data)](#cbtrenderstr-data)
     * [cbT.renderFile(filename, data, options, callback)](#cbtrenderfilefilename-data-options-callback)
     * [cbT.getInstance()](#cbtgetinstance)
  * [模板语法](#模板语法)
     * [模板继承（Layout）](#模板继承layout)
        * [extends 标签](#extends-标签)
        * [block 标签](#block-标签)
        * [parent 标签](#parent-标签)
        * [child 标签](#child-标签)
        * [slot 标签](#slot-标签)
        * [call 标签](#call-标签)
        * [use 标签](#use-标签)
        * [实例](#实例-1)
     * [其他语法](#其他语法)
        * [转义后输出变量内容](#转义后输出变量内容)
        * [不转义输出变量内容](#不转义输出变量内容)
        * [URL 转义输出变量内容](#url-转义输出变量内容)
        * [转义 HTML 属性值后输出变量内容](#转义-html-属性值后输出变量内容)
        * [转义输出数组](#转义输出数组)
        * [格式化钱数](#格式化钱数)
        * [内容截取](#内容截取)
        * [URL 协议自适应](#url-协议自适应)
        * [转义输出函数返回值](#转义输出函数返回值)
        * [不转义输出函数返回值](#不转义输出函数返回值)
        * [定义变量](#定义变量)
        * [遍历数组](#遍历数组)
        * [条件输出](#条件输出)
        * [定义子模板](#定义子模板)
        * [调用子模板](#调用子模板)

## 安装

```bash
$ npm install cb-template
```

## 特性

* 支持模板继承（Layout）
* 模块化模板
* 灵活的模板语法

## 实例

```html
<% if (user) %>
  <p><%=user.name%></p>
<% /if %>
```

## 使用

```javascript
const cbT = require('cb-template');

const template = cbT.compile(str);
template(data);
// => 已渲染的 HTML 字符串

cbT.render(str, data);
// => 已渲染的 HTML 字符串

// 支持模板继承
cbT.renderFile(filename, data, options, (err, data) => {
  if (!err) {
    // => data 是已渲染的 HTML 字符串
  }
});
```

## 选项

### cbT.leftDelimiter

定义左分隔符，默认值：`<%`

### cbT.rightDelimiter

定义右分隔符，默认值：`%>`

### cbT.basePath

定义读取模板文件的根目录，默认值为空字符串。

例如你想以 `/my/template` 为所有模板的根目录，则设置 `cbT.basePath = '/my/template'`

### cbT.cachePath

模板缓存目录，默认值为系统临时目录。

### cbT.defaultExtName

模板文件默认扩展名，默认值为 `.html`

## API

### cbT.compile(str)

编译模板字符串，返回模板函数，不支持模板继承。

参数：

* str: 字符串，输入的模板内容

返回值：

类型：函数，模板函数，用于后续直接渲染模板。

模板函数参数：

* data: 对象，输入的数据

例子：

```javascript
const template = cbT.compile(`<title><%=title%></title><p><%=nickname%></p>`);
template({ title: '标题', nickname: '昵称' });
// => 已渲染的 HTML 字符串
```

### cbT.compileFile(filename, options, callback)

读取模板文件，返回模板函数，支持模板继承。

参数：

* filename: 字符串，模板文件路径，如果设置了 cbT.basePath 则 basePath 为根目录，建议使用绝对路径。
* options: 对象，编译参数。
  * cache: 布尔，是否开启编译缓存，默认开启
* callback: 函数，回调函数，编译完成后回调。
  * 回调函数参数: err: 是否有错误；template: 模板函数

例子：

```javascript
cbT.compileFile('/your/path/filename.html', {}, (err, template) => {
  template({ title: '标题', nickname: '昵称' });
  // => 已渲染的 HTML 字符串
});
```

### cbT.render(str, data)

编译模板字符串，并返回渲染后的结果，不支持模板继承。

参数：

* str: 字符串，输入的模板内容
* data: 对象，用于渲染的数据，对象的 key 会自动转换为模板中的变量名

返回值：

类型：字符串，已渲染的字符串

例子：

```javascript
cbT.render(`<title><%=title%></title><p><%=nickname%></p>`, { title: '标题', nickname: '昵称' });
// => 已渲染的 HTML 字符串
```

### cbT.renderFile(filename, data, options, callback)

读取模板文件，并返回渲染后的结果，支持模板继承。

参数：

* filename: 字符串，模板文件路径，如果设置了 cbT.basePath 则 basePath 为根目录，建议使用绝对路径。
* data: 对象，用于渲染的数据，对象的 key 会自动转换为模板中的变量名
* options: 对象，编译参数。
  * cache: 布尔，是否开启编译缓存，默认开启
  * cacheName: 字符串，设置缓存名称，默认值 `changba-template-cache`，如果设置过 `cbT.cachePath` 则此值无效
* callback: 函数，回调函数，编译完成后回调。
  * 回调函数参数: err: 是否有错误；content: 渲染后的结果

例子：

```javascript
cbT.renderFile('/your/path/filename.html', { title: '标题', nickname: '昵称' }, {}, (err, content) => {
  console.log(content);
  // => 已渲染的 HTML 字符串
});
```

### cbT.getInstance()

获取模板引擎的一个新实例，一般用于单独设置模板引擎的某个选项，比如单独设置左右分隔符。

例子：

```javascript
const myInstance = cbT.getInstance();
myInstance.render(`<title><%=title%></title><p><%=nickname%></p>`, { title: '标题', nickname: '昵称' });
// => 已渲染的 HTML 字符串
```

注意：获取的新实例不能进行 getInstance() 操作，只能从 cbT 中 getInstance()

## 模板语法

模板默认分隔符为 `<% %>`，例如：`<% block %>`

### 模板继承（Layout）

#### extends 标签

```
<% extends 模板路径 %>
```

例如 `<% extends /welcome/test %>`

这里指的是从 `basePath/welcome/test.html` 这个模板继承。

注意：`extends` 标签必须在模板文件首行首字母位置。另外这个标签不需要结束标签。

#### block 标签

```
<% block 名称 %>
  内容...
<% /block %>
```

在父模板中使用 block 代表定义一个名为"名称"的 block。

在子模板中使用 block 代表替换父模板中同名的 block。

```
<% block 名称 hide %>
  内容...
<% /block %>
```

`hide` 属性表示在子模板中隐藏父模板中同名的 block。

#### parent 标签

```
<% block 名称 %>
  <% parent %>

  内容...
<% /block %>
```

`parent` 标签只能在 `block` 标签中使用，功能是把父模板相同 block 名称的内容放到当前 block 中 parent 所在位置。

#### child 标签

```
<% block 名称 %>
  <% child %>

  内容...
<% /block %>
```

`child` 标签只能在 `block` 标签中使用，功能是把子模板相同 block 名称的内容放到当前 block 中 child 所在位置。

#### slot 标签

```
<% block 名称 %>
  <% slot 插槽名称 %>
    内容
  <% /slot %>

  内容...
<% /block %>
```

`slot` 标签只能在 `block` 标签中使用。

`slot` 标签是用于在父模板中定义一些插槽位置，子模板会替换父模板相同插槽名称所在位置的内容。

#### call 标签

```
<% block 名称 %>
  <% call 其它block名称 %>
    <% slot 插槽名称 %>
      内容
    <% /slot %>
  <% /call %>

  内容...
<% /block %>
```

```
<% block 名称 %>
  <% call 其它block名称 slot1="插槽内容1" slot2="插槽内容2" %>
    <% slot 插槽3 %>
      插槽内容3
    <% /slot %>
  <% /call %>

  内容...
<% /block %>
```

`call` 用于把当前文件其它 block 名称（支持所有父模板）的内容，替换 call 所在位置的内容。其中 `slot` 的意义与上节一样，会替换相应的内容。

#### use 标签

```
<% block 名称 %>
  <% use 其它block名称 slot1="插槽内容1" slot2="插槽内容2" %>

  内容...
<% /block %>
```

`use` 是简化版的 `call`。

#### 实例

父模板 parent.html：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to <% block title %>测试标题<% /block %></title>
</head>
<body>
  <h1>Welcome to <% block name %>测试内容<% /block %>!</h1>
  <p>
    <% block test-1 %>
      测试内容-1
    <% /block %>
  </p>

  <p>
    <% block test-2 %>
      <small><% child %></small>
      测试内容-2
    <% /block %>
  </p>
</body>
</html>
```

子模板 welcome.html：

```html
<% extends parent %>

<% block title %>子模板标题<% /block %>

<% block name %><strong>子模板内容</strong><% /block %>

<% block test-1 %>
  <% parent %>
  <strong>子模板内容-1</strong>
<% /block %>

<% block test-2 %>
  子模板内容-2
<% /block %>
```

最终渲染成：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to 子模板标题</title>
</head>
<body>
  <h1>Welcome to <strong>子模板内容</strong>!</h1>
  <p>
    测试内容-1
    <strong>子模板内容-1</strong>
  </p>

  <p>
    <small>子模板内容-2</small>
    测试内容-2
  </p>
</body>
</html>
```

### 其他语法

#### 转义后输出变量内容

进行 HTML 转义后输出变量内容，可确保没有 XSS 安全问题。

基本用法：`<%=变量%>`

例子：

```html
<title><%=title%></title>
<p><%=nickname%></p>
```

#### 不转义输出变量内容

原样输出变量内容，除非你知道自己在做什么，否则不要使用，会有 XSS 安全问题。

基本用法：`<%:=变量%>` 或 `<%-变量%>`

例子：

```html
<title><%:=title%></title>
<p><%-nickname%></p>
```

#### URL 转义输出变量内容

对变量做 URL 转义，一般用于 URL 传参中。

基本用法：`<%:u=变量%>`

例子：

```html
<a href="https://domain.com/index?title=<%:u=title%>&nickname=<%:u=nickname%>">链接</a>
```

#### 转义 HTML 属性值后输出变量内容

进行 HTML 属性值的转义输出，一般用于 HTML 属性值的安全输出。

基本用法：`<%:v=变量%>`

例子：

```html
<div data-title="<%:v=title%>" data-nickname="<%:v=nickname%>">内容</div>
```

#### 转义输出数组

迭代数组并做 HTML 转义输出。

基本用法：`<%:a=数组变量 | 分隔符%>`

分隔符可不写，默认值为 `<br>`

例子：

```html
<div><%:a=listing%></div> <!-- 输出 <div>元素0<br>元素1<br>元素2<div> -->
<div><%:a=listing|,%></div> <!-- 输出 <div>元素0,元素1,元素2<div> -->
```

#### 格式化钱数

四舍五入保留两位小数输出变量内容。

基本用法：`<%:m=变量%>`

例子：

```html
<div><%:m=money%></div>
```

#### 内容截取

截取内容后输出变量，如果被截断自动在末尾添加 `...`，否则不添加。

基本用法：`<%:s=变量 | 保留字数%>`

例子：

```html
<div><%:s=title | 10%></div>
```

#### URL 协议自适应

把 URL 处理成协议自适应格式，类似 `//domian.com/index`。

基本用法：`<%:p=变量%>`

例子：

```html
<img src="<%:p=avatar%>" alt="头像">
```

#### 转义输出函数返回值

用于转义输出函数返回值。

基本用法：`<%:func=函数%>`

例子：

```html
<p><%:func=getData()%></p>
```

#### 不转义输出函数返回值

不转义输出函数返回值，慎用。

基本用法：`<%:func-函数%>`

例子：

```html
<p><%:func-getData()%></p>
```

#### 定义变量

用于在模板作用域中定义变量。

基本用法：`<% let 变量名 = 变量值 %>`

例子：

```html
<% let myData = '123' %>
<p><%=myData%></p>
```

#### 遍历数组

一般用于循环输出数组内容。

基本用法：

* `<% foreach (循环变量 in 数组变量) %>循环体<% /foreach %>`
* `<% foreach (循环变量 in 数组变量) %>循环体<% foreachelse %>数组为空时的内容<% /foreach %>`

如果需要获取数组下标，可以使用 `循环变量Index` 的形式获取。

例子：

```html
<ul>
  <% foreach (item in listing) %>
  <li><%=itemIndex%>: <%=item.nickname%></li>
  <% foreachelse %>
  <li>暂无内容</li>
  <% /foreach %>
</ul>
```

#### 条件输出

用于根据不同条件输出不同内容

基本用法：

* `<% if (标准 js 条件表达式) %>条件为真时输出<% else %>条件为假时输出<% /if %>`
* `<% if (标准 js 条件表达式) %>本条件为真时输出<% elseif (标准 js 条件表达式) %>本条件为真时输出<% else %>条件都不符合时输出<% /if %>`

例子：

```html
<div>
  <% if (nickname === 'name1') %>
    <p>这是 name1</p>
  <% elseif (nickname === 'name2') %>
   <p>这是 name2</p>
  <% elseif (nickname === 'name3') %>
    <p>这是 name3</p>
  <% else %>
    <p>都不是</p>
  <% /if %>
</div>
```

#### 定义子模板

一般用于定义一个公共的模板部分，以方便重复使用

基本用法：`<% define 子模板名称(参数) %>子模板内容<% /define %>`

其中 `参数` 为合法变量名，用于在子模板中接收外部参数

例子：

```html
<% define mySubTemplate(params) %>
 <p><%=params.nickname%></p>
 <p><%=params.title%></p>
<% /define %>
```

#### 调用子模板

调用已经定义的子模板

基本用法：`<% run 子模板名称(参数对象) %>`

例子：

```html
<% run mySubTemplate({ nickname: '昵称', title: '标题' }) %>
```