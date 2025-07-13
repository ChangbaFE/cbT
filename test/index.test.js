'use strict';

const cbT = require('../index');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('index.js', () => {
  let testDir;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'cbt-test-' + Date.now() + '-' + Math.random());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // 清理测试目录
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('compile', () => {
    test('should compile simple template', () => {
      const template = cbT.compile('Hello <%=name%>!');
      const result = template({ name: 'World' });
      expect(result).toBe('Hello World!');
    });

    test('should handle undefined variables', () => {
      const template = cbT.compile('Value: <%=undefinedVar%>');
      const result = template({});
      expect(result).toBe('Value: ');
    });

    test('should handle null variables', () => {
      const template = cbT.compile('Value: <%=nullVar%>');
      const result = template({ nullVar: null });
      expect(result).toBe('Value: ');
    });

    test('should escape HTML by default', () => {
      const template = cbT.compile('<%=html%>');
      const result = template({ html: '<script>alert("XSS")</script>' });
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    test('should not escape with :=', () => {
      const template = cbT.compile('<%:=html%>');
      const result = template({ html: '<div>content</div>' });
      expect(result).toBe('<div>content</div>');
    });

    test('should not escape with -', () => {
      const template = cbT.compile('<%-html%>');
      const result = template({ html: '<div>content</div>' });
      expect(result).toBe('<div>content</div>');
    });
  });

  describe('render', () => {
    test('should render template directly', () => {
      const result = cbT.render('Hello <%=name%>!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    test('should handle complex data', () => {
      const template = 'User: <%=user.name%>, Age: <%=user.age%>';
      const result = cbT.render(template, {
        user: { name: 'John', age: 30 }
      });
      expect(result).toBe('User: John, Age: 30');
    });
  });

  describe('template syntax', () => {
    describe('variable output', () => {
      test('should support URL encoding with :u=', () => {
        const result = cbT.render('<%:u=url%>', { url: 'hello world' });
        expect(result).toBe('hello%20world');
      });

      test('should support HTML attribute encoding with :v=', () => {
        const result = cbT.render('<%:v=attr%>', { attr: '"test"' });
        expect(result).toBe('&quot;test&quot;');
      });

      test('should support array output with :a=', () => {
        const result = cbT.render('<%:a=items%>', { items: ['a', 'b', 'c'] });
        expect(result).toBe('a<br>b<br>c');
      });

      test('should support array with custom separator', () => {
        const result = cbT.render('<%:a=items|,%>', { items: ['a', 'b', 'c'] });
        expect(result).toBe('a,b,c');
      });

      test('should support money formatting with :m=', () => {
        const result = cbT.render('<%:m=price%>', { price: 123.456 });
        expect(result).toBe('123.46');
      });

      test('should support string truncation with :s=', () => {
        const result = cbT.render('<%:s=text|5%>', { text: 'Hello World' });
        expect(result).toBe('Hello...');
      });

      test('should support protocol replacement with :p=', () => {
        const result = cbT.render('<%:p=url%>', { url: 'https://example.com' });
        expect(result).toBe('//example.com');
      });

      test('should support function return value with escaping :func=', () => {
        const result = cbT.render('<%:func=getData()%>', {
          getData: () => '<div>function result</div>'
        });
        expect(result).toBe('&lt;div&gt;function result&lt;/div&gt;');
      });

      test('should support function return value without escaping :func-', () => {
        const result = cbT.render('<%:func-getData()%>', {
          getData: () => '<div>function result</div>'
        });
        expect(result).toBe('<div>function result</div>');
      });
    });

    describe('control structures', () => {
      test('should support if statements', () => {
        const template = '<% if (show === true) %>visible<% /if %>';
        expect(cbT.render(template, { show: true })).toBe('visible');
        expect(cbT.render(template, { show: false })).toBe('');
      });

      test('should support if-else statements', () => {
        const template = '<% if (value > 5) %>big<% else %>small<% /if %>';
        expect(cbT.render(template, { value: 10 })).toBe('big');
        expect(cbT.render(template, { value: 3 })).toBe('small');
      });

      test('should support elseif statements', () => {
        const template = '<% if (value > 10) %>big<% elseif (value > 5) %>medium<% else %>small<% /if %>';
        expect(cbT.render(template, { value: 15 })).toBe('big');
        expect(cbT.render(template, { value: 7 })).toBe('medium');
        expect(cbT.render(template, { value: 3 })).toBe('small');
      });

      test('should support foreach loops', () => {
        const template = '<% foreach (item in items) %><%=item%>,<% /foreach %>';
        const result = cbT.render(template, { items: ['a', 'b', 'c'] });
        expect(result).toBe('a,b,c,');
      });

      test('should support foreach with index', () => {
        const template = '<% foreach (item in items) %><%=itemIndex%>:<%=item%> <% /foreach %>';
        const result = cbT.render(template, { items: ['a', 'b'] });
        expect(result).toBe('0:a 1:b ');
      });

      test('should support foreachelse', () => {
        const template = '<% foreach (item in items) %><%=item%><% foreachelse %>empty<% /foreach %>';
        expect(cbT.render(template, { items: [] })).toBe('empty');
        expect(cbT.render(template, { items: ['a'] })).toBe('a');
      });

      test('should support foreach with objects', () => {
        const template = '<% foreach (value in obj) %><%=valueIndex%>:<%=value%> <% /foreach %>';
        const result = cbT.render(template, { obj: { a: 1, b: 2 } });
        expect(result).toMatch(/a:1|b:2/);
      });
    });

    describe('variable definition', () => {
      test('should support let statements', () => {
        const template = '<% let name = "test" %><%=name%>';
        const result = cbT.render(template, {});
        expect(result).toBe('test');
      });

      test('should handle let without semicolon', () => {
        const template = '<% let name = "test" %><%=name%>';
        const result = cbT.render(template, {});
        expect(result).toBe('test');
      });
    });

    describe('sub templates', () => {
      test('should support define and run', () => {
        const template = '<% define sub(data) %>Hello <%=data.name%>!<% /define %><% run sub({name: "World"}) %>';
        const result = cbT.render(template, {});
        expect(result).toBe('Hello World!');
      });

      test('should support multiple sub templates', () => {
        const template = `
          <% define header(title) %><h1><%=title%></h1><% /define %>
          <% define footer(text) %><p><%=text%></p><% /define %>
          <% run header("Title") %>
          Content
          <% run footer("Footer") %>
        `;
        const result = cbT.render(template, {});
        expect(result).toMatch(/<h1>Title<\/h1>/);
        expect(result).toMatch(/Content/);
        expect(result).toMatch(/<p>Footer<\/p>/);
      });
    });

  });

  describe('getInstance', () => {
    test('should create independent instance', () => {
      const instance = cbT.getInstance();

      // 修改实例的设置
      instance.leftDelimiter = '{{';
      instance.rightDelimiter = '}}';

      // 原始实例应该不受影响
      expect(cbT.leftDelimiter).toBe('<%');
      expect(cbT.rightDelimiter).toBe('%>');

      // 新实例应该能使用新的分隔符
      const result = instance.render('Hello {{=name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    test('should not have getInstance method on instance', () => {
      const instance = cbT.getInstance();
      expect(instance.getInstance).toBeUndefined();
    });
  });

  describe('file operations', () => {
    test('renderFile should render file template', (done) => {
      const templatePath = path.join(testDir, 'test.html');
      fs.writeFileSync(templatePath, 'Hello <%=name%>!');

      cbT.basePath = testDir;
      cbT.renderFile('test.html', { name: 'World' }, { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toBe('Hello World!');
        done();
      });
    });

    test('compileFile should compile file template', (done) => {
      const templatePath = path.join(testDir, 'test.html');
      fs.writeFileSync(templatePath, 'Hello <%=name%>!');

      cbT.basePath = testDir;
      cbT.compileFile('test.html', { cache: false }, (err, template) => {
        expect(err).toBeNull();
        expect(typeof template).toBe('function');
        const result = template({ name: 'World' });
        expect(result).toBe('Hello World!');
        done();
      });
    });

    test('should handle file not found error', (done) => {
      cbT.basePath = testDir;
      cbT.renderFile('notexist.html', {}, { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ENOENT');
        done();
      });
    });
  });

  describe('error handling', () => {
    test('should handle syntax errors in template', () => {
      const template = '<% let a = 1; eval("alert(1)") %>';
      expect(() => {
        cbT.render(template, {});
      }).toThrow();
    });

    test('should handle invalid variable references gracefully', () => {
      const template = '<%=a.b.c.d%>';
      expect(() => {
        cbT.render(template, { a: {} });
      }).toThrow();
    });
  });

  describe('escape option', () => {
    test('should not escape HTML when escape is false', () => {
      const instance = cbT.getInstance();
      instance.escape = false;
      
      const template = instance.compile('<%=html%>');
      const result = template({ html: '<script>alert("XSS")</script>' });
      expect(result).toBe('<script>alert("XSS")</script>');
    });

    test('should handle undefined variables when escape is false', () => {
      const instance = cbT.getInstance();
      instance.escape = false;
      
      const template = instance.compile('<%=undefinedVar%>');
      const result = template({});
      expect(result).toBe('');
    });

    test('should handle null variables when escape is false', () => {
      const instance = cbT.getInstance();
      instance.escape = false;
      
      const template = instance.compile('<%=nullVar%>');
      const result = template({ nullVar: null });
      expect(result).toBe('');
    });
  });

  describe('default parameters', () => {
    test('compileFile should work without options parameter', (done) => {
      const templatePath = path.join(testDir, 'test-no-options.html');
      fs.writeFileSync(templatePath, 'Hello <%=name%>!');

      cbT.basePath = testDir;
      cbT.compileFile('test-no-options.html', (err, template) => {
        expect(err).toBeNull();
        expect(typeof template).toBe('function');
        const result = template({ name: 'World' });
        expect(result).toBe('Hello World!');
        done();
      });
    });

    test('renderFile should work without options parameter', (done) => {
      const templatePath = path.join(testDir, 'test-no-options2.html');
      fs.writeFileSync(templatePath, 'Hello <%=name%>!');

      cbT.basePath = testDir;
      cbT.renderFile('test-no-options2.html', { name: 'World' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toBe('Hello World!');
        done();
      });
    });

    test('compileFile should use default options when explicitly passed undefined', (done) => {
      const templatePath = path.join(testDir, 'test-undefined-options.html');
      fs.writeFileSync(templatePath, 'Hello <%=name%>!');

      cbT.basePath = testDir;
      // Explicitly pass undefined as options to trigger default parameter
      cbT.compileFile('test-undefined-options.html', undefined, (err, template) => {
        expect(err).toBeNull();
        expect(typeof template).toBe('function');
        const result = template({ name: 'World' });
        expect(result).toBe('Hello World!');
        done();
      });
    });

    test('renderFile should use default options when explicitly passed undefined', (done) => {
      const templatePath = path.join(testDir, 'test-undefined-options2.html');
      fs.writeFileSync(templatePath, 'Hello <%=name%>!');

      cbT.basePath = testDir;
      // Explicitly pass undefined as options to trigger default parameter
      cbT.renderFile('test-undefined-options2.html', { name: 'World' }, undefined, (err, content) => {
        expect(err).toBeNull();
        expect(content).toBe('Hello World!');
        done();
      });
    });
  });
});
