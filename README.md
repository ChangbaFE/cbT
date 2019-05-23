# cbT.js

[![npm version](https://badgen.net/npm/v/cb-template)](https://www.npmjs.com/package/cb-template)

一个支持模板多级继承的 Node.js 服务端模板引擎

## 安装

```bash
$ npm install cb-template
```

## 特性

  * 支持模板继承（Layout）
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
* callback: 函数，回调函数，编译完成后回调。
  * 回调函数参数: err: 是否有错误；content: 渲染后的结果

例子：

```javascript
cbT.renderFile('/your/path/filename.html', { title: '标题', nickname: '昵称' }, {}, (err, content) => {
  console.log(content);
  // => 已渲染的 HTML 字符串
});
```

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

在父模板中使用 block 代表定义一个名为“名称”的 block。

在子模板中使用 block 代表替换父模板中同名的 block。

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

#### 输出变量内容

基本用法：`<%=变量%>`

例子：

```javascript
const cbT = require('cb-template');

cbT.renderFile('filename.html', { title: '标题', nickname: '昵称' });
```
