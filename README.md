# cbT.js

[![npm version](https://badgen.net/npm/v/cb-template)](https://www.npmjs.com/package/cb-template) [![Downloads](https://badgen.net/npm/dt/cb-template)](https://www.npmjs.com/package/cb-template) [![codecov](https://codecov.io/github/hex-ci/cbT/graph/badge.svg?token=HBHJLIG91R)](https://codecov.io/github/hex-ci/cbT)

A Node.js server-side template engine that supports multi-level template inheritance

\[ English | [中文](README_zh.md) \]

## Table of Contents

  * [Installation](#installation)
  * [Features](#features)
  * [Example](#example)
  * [Usage](#usage)
  * [Options](#options)
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
  * [Template Syntax](#template-syntax)
     * [Template Inheritance (Layout)](#template-inheritance-layout)
        * [extends tag](#extends-tag)
        * [block tag](#block-tag)
        * [parent tag](#parent-tag)
        * [child tag](#child-tag)
        * [slot tag](#slot-tag)
        * [call tag](#call-tag)
        * [use tag](#use-tag)
        * [Example](#example-1)
     * [Other Syntax](#other-syntax)
        * [Escaped variable output](#escaped-variable-output)
        * [Unescaped variable output](#unescaped-variable-output)
        * [URL-escaped variable output](#url-escaped-variable-output)
        * [HTML attribute escaped variable output](#html-attribute-escaped-variable-output)
        * [Escaped array output](#escaped-array-output)
        * [Money formatting](#money-formatting)
        * [Content truncation](#content-truncation)
        * [URL protocol adaptation](#url-protocol-adaptation)
        * [Escaped function return value output](#escaped-function-return-value-output)
        * [Unescaped function return value output](#unescaped-function-return-value-output)
        * [Variable definition](#variable-definition)
        * [Array iteration](#array-iteration)
        * [Conditional output](#conditional-output)
        * [Sub-template definition](#sub-template-definition)
        * [Sub-template invocation](#sub-template-invocation)

## Installation

```bash
$ npm install cb-template
```

## Features

* Supports template inheritance (Layout)
* Modular templates
* Flexible template syntax

## Example

```html
<% if (user) %>
  <p><%=user.name%></p>
<% /if %>
```

## Usage

```javascript
const cbT = require('cb-template');

const template = cbT.compile(str);
template(data);
// => Rendered HTML string

cbT.render(str, data);
// => Rendered HTML string

// Supports template inheritance
cbT.renderFile(filename, data, options, (err, data) => {
  if (!err) {
    // => data is rendered HTML string
  }
});
```

## Options

### cbT.leftDelimiter

Defines the left delimiter, default value: `<%`

### cbT.rightDelimiter

Defines the right delimiter, default value: `%>`

### cbT.basePath

Defines the root directory for reading template files, default value is an empty string.

For example, if you want to use `/my/template` as the root directory for all templates, set `cbT.basePath = '/my/template'`

### cbT.cachePath

Template cache directory, default value is the system temporary directory.

### cbT.defaultExtName

Default extension for template files, default value is `.html`

## API

### cbT.compile(str)

Compiles a template string and returns a template function. Does not support template inheritance.

Parameters:

* str: String, input template content

Return value:

Type: Function, template function for subsequent direct template rendering.

Template function parameters:

* data: Object, input data

Example:

```javascript
const template = cbT.compile(`<title><%=title%></title><p><%=nickname%></p>`);
template({ title: 'Title', nickname: 'Nickname' });
// => Rendered HTML string
```

### cbT.compileFile(filename, options, callback)

Reads a template file and returns a template function. Supports template inheritance.

Parameters:

* filename: String, template file path. If cbT.basePath is set, basePath is used as the root directory. Absolute paths are recommended.
* options: Object, compilation parameters.
  * cache: Boolean, whether to enable compilation cache, default is enabled
* callback: Function, callback function executed after compilation.
  * Callback function parameters: err: whether there is an error; template: template function

Example:

```javascript
cbT.compileFile('/your/path/filename.html', {}, (err, template) => {
  template({ title: 'Title', nickname: 'Nickname' });
  // => Rendered HTML string
});
```

### cbT.render(str, data)

Compiles a template string and returns the rendered result. Does not support template inheritance.

Parameters:

* str: String, input template content
* data: Object, data for rendering. Object keys are automatically converted to variable names in the template

Return value:

Type: String, rendered string

Example:

```javascript
cbT.render(`<title><%=title%></title><p><%=nickname%></p>`, { title: 'Title', nickname: 'Nickname' });
// => Rendered HTML string
```

### cbT.renderFile(filename, data, options, callback)

Reads a template file and returns the rendered result. Supports template inheritance.

Parameters:

* filename: String, template file path. If cbT.basePath is set, basePath is used as the root directory. Absolute paths are recommended.
* data: Object, data for rendering. Object keys are automatically converted to variable names in the template
* options: Object, compilation parameters.
  * cache: Boolean, whether to enable compilation cache, default is enabled
  * cacheName: String, set cache name, default value `changba-template-cache`. This value is invalid if `cbT.cachePath` is set
* callback: Function, callback function executed after compilation.
  * Callback function parameters: err: whether there is an error; content: rendered result

Example:

```javascript
cbT.renderFile('/your/path/filename.html', { title: 'Title', nickname: 'Nickname' }, {}, (err, content) => {
  console.log(content);
  // => Rendered HTML string
});
```

### cbT.getInstance()

Gets a new instance of the template engine. Generally used to set individual options of the template engine, such as setting left and right delimiters separately.

Example:

```javascript
const myInstance = cbT.getInstance();
myInstance.render(`<title><%=title%></title><p><%=nickname%></p>`, { title: 'Title', nickname: 'Nickname' });
// => Rendered HTML string
```

Note: The new instance cannot perform getInstance() operations. You can only getInstance() from cbT.

## Template Syntax

The default template delimiters are `<% %>`, for example: `<% block %>`

### Template Inheritance (Layout)

#### extends tag

```
<% extends template_path %>
```

For example `<% extends /welcome/test %>`

This refers to inheriting from the template `basePath/welcome/test.html`.

Note: The `extends` tag must be at the first character position of the first line of the template file. Also, this tag does not need a closing tag.

#### block tag

```
<% block name %>
  content...
<% /block %>
```

Using block in a parent template means defining a block named "name".

Using block in a child template means replacing the block with the same name in the parent template.

```
<% block name hide %>
  content...
<% /block %>
```

The `hide` attribute means hiding the block with the same name in the parent template in the child template.

#### parent tag

```
<% block name %>
  <% parent %>

  content...
<% /block %>
```

The `parent` tag can only be used within `block` tags. Its function is to place the content of the parent template's block with the same name at the position where `parent` is located in the current block.

#### child tag

```
<% block name %>
  <% child %>

  content...
<% /block %>
```

The `child` tag can only be used within `block` tags. Its function is to place the content of the child template's block with the same name at the position where `child` is located in the current block.

#### slot tag

```
<% block name %>
  <% slot slot_name %>
    content
  <% /slot %>

  content...
<% /block %>
```

`slot` tag can only be used within `block` tags.

The `slot` tag is used to define slot positions in parent templates. Child templates will replace the content at the same slot name position in the parent template.

#### call tag

```
<% block name %>
  <% call other_block_name %>
    <% slot slot_name %>
      content
    <% /slot %>
  <% /call %>

  content...
<% /block %>
```

```
<% block name %>
  <% call other_block_name slot1="slot_content_1" slot2="slot_content_2" %>
    <% slot slot3 %>
      slot_content_3
    <% /slot %>
  <% /call %>

  content...
<% /block %>
```

`call` is used to replace the content at the call position with the content of other block names in the current file (supports all parent templates). The meaning of `slot` is the same as in the previous section, it will replace the corresponding content.

#### use tag

```
<% block name %>
  <% use other_block_name slot1="slot_content_1" slot2="slot_content_2" %>

  content...
<% /block %>
```

`use` is a simplified version of `call`.

#### Example

Parent template parent.html:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to <% block title %>Test Title<% /block %></title>
</head>
<body>
  <h1>Welcome to <% block name %>Test Content<% /block %>!</h1>
  <p>
    <% block test-1 %>
      Test Content-1
    <% /block %>
  </p>

  <p>
    <% block test-2 %>
      <small><% child %></small>
      Test Content-2
    <% /block %>
  </p>
</body>
</html>
```

Child template welcome.html:

```html
<% extends parent %>

<% block title %>Child Template Title<% /block %>

<% block name %><strong>Child Template Content</strong><% /block %>

<% block test-1 %>
  <% parent %>
  <strong>Child Template Content-1</strong>
<% /block %>

<% block test-2 %>
  Child Template Content-2
<% /block %>
```

Final rendered result:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Child Template Title</title>
</head>
<body>
  <h1>Welcome to <strong>Child Template Content</strong>!</h1>
  <p>
    Test Content-1
    <strong>Child Template Content-1</strong>
  </p>

  <p>
    <small>Child Template Content-2</small>
    Test Content-2
  </p>
</body>
</html>
```

### Other Syntax

#### Escaped variable output

Outputs variable content after HTML escaping, ensuring no XSS security issues.

Basic usage: `<%=variable%>`

Example:

```html
<title><%=title%></title>
<p><%=nickname%></p>
```

#### Unescaped variable output

Outputs variable content as-is. Do not use unless you know what you're doing, as it may cause XSS security issues.

Basic usage: `<%:=variable%>` or `<%-variable%>`

Example:

```html
<title><%:=title%></title>
<p><%-nickname%></p>
```

#### URL-escaped variable output

Applies URL escaping to variables, commonly used in URL parameters.

Basic usage: `<%:u=variable%>`

Example:

```html
<a href="https://domain.com/index?title=<%:u=title%>&nickname=<%:u=nickname%>">Link</a>
```

#### HTML attribute escaped variable output

Escapes HTML attribute values for output, commonly used for safe output of HTML attribute values.

Basic usage: `<%:v=variable%>`

Example:

```html
<div data-title="<%:v=title%>" data-nickname="<%:v=nickname%>">Content</div>
```

#### Escaped array output

Iterates through arrays and outputs with HTML escaping.

Basic usage: `<%:a=array_variable | separator%>`

Separator is optional, default value is `<br>`

Example:

```html
<div><%:a=listing%></div> <!-- Outputs <div>element0<br>element1<br>element2<div> -->
<div><%:a=listing|,%></div> <!-- Outputs <div>element0,element1,element2<div> -->
```

#### Money formatting

Rounds to two decimal places and outputs variable content.

Basic usage: `<%:m=variable%>`

Example:

```html
<div><%:m=money%></div>
```

#### Content truncation

Truncates content and outputs variable. If truncated, automatically adds `...` at the end, otherwise doesn't add.

Basic usage: `<%:s=variable | character_count%>`

Example:

```html
<div><%:s=title | 10%></div>
```

#### URL protocol adaptation

Processes URLs into protocol-adaptive format, like `//domain.com/index`.

Basic usage: `<%:p=variable%>`

Example:

```html
<img src="<%:p=avatar%>" alt="Avatar">
```

#### Escaped function return value output

Used for escaped output of function return values.

Basic usage: `<%:func=function%>`

Example:

```html
<p><%:func=getData()%></p>
```

#### Unescaped function return value output

Outputs function return values without escaping. Use with caution.

Basic usage: `<%:func-function%>`

Example:

```html
<p><%:func-getData()%></p>
```

#### Variable definition

Used to define variables in template scope.

Basic usage: `<% let variable_name = variable_value %>`

Example:

```html
<% let myData = '123' %>
<p><%=myData%></p>
```

#### Array iteration

Generally used for looping through and outputting array content.

Basic usage:

* `<% foreach (loop_variable in array_variable) %>loop_body<% /foreach %>`
* `<% foreach (loop_variable in array_variable) %>loop_body<% foreachelse %>content_when_array_is_empty<% /foreach %>`

If you need to get the array index, you can use the form `loop_variableIndex`.

Example:

```html
<ul>
  <% foreach (item in listing) %>
  <li><%=itemIndex%>: <%=item.nickname%></li>
  <% foreachelse %>
  <li>No content available</li>
  <% /foreach %>
</ul>
```

#### Conditional output

Used to output different content based on different conditions

Basic usage:

* `<% if (standard_js_conditional_expression) %>output_when_condition_is_true<% else %>output_when_condition_is_false<% /if %>`
* `<% if (standard_js_conditional_expression) %>output_when_this_condition_is_true<% elseif (standard_js_conditional_expression) %>output_when_this_condition_is_true<% else %>output_when_no_conditions_match<% /if %>`

Example:

```html
<div>
  <% if (nickname === 'name1') %>
    <p>This is name1</p>
  <% elseif (nickname === 'name2') %>
   <p>This is name2</p>
  <% elseif (nickname === 'name3') %>
    <p>This is name3</p>
  <% else %>
    <p>None of them</p>
  <% /if %>
</div>
```

#### Sub-template definition

Generally used to define a common template part for convenient reuse

Basic usage: `<% define sub_template_name(parameters) %>sub_template_content<% /define %>`

Where `parameters` is a valid variable name, used to receive external parameters in the sub-template

Example:

```html
<% define mySubTemplate(params) %>
 <p><%=params.nickname%></p>
 <p><%=params.title%></p>
<% /define %>
```

#### Sub-template invocation

Invokes an already defined sub-template

Basic usage: `<% run sub_template_name(parameter_object) %>`

Example:

```html
<% run mySubTemplate({ nickname: 'Nickname', title: 'Title' }) %>
```
