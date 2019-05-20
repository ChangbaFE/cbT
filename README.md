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

let template = cbT.template(str);
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
<% block 名称 %>内容...<% /block %>
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

`call` 用于把当前文件其它 block 名称（支持最近一级父模板）的内容，替换 call 所在位置的内容。其中 `slot` 的意义与上节一样，会替换相应的内容。

#### use 标签

```
<% block 名称 %>
  <% use 其它block名称 %>

  内容...
<% /block %>
```

`use` 是简化版的 `call`，如果不需要替换 `slot` 的内容，可以直接使用 `use`。

#### 实例

父模板 parent.html :

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to <% block title %>测试标题<% /block %></title>
</head>
<body>
  <h1>Welcome to <% block name %>测试内容<% /block %>!</h1>
</body>
</html>
```

子模板 welcome.html :

```html
<% extends parent %>

<% block title %>子模板标题<% /block %>

<% block name %><strong>子模板内容</strong><% /block %>
```

### 其他语法

（未完待续...）
