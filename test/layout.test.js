'use strict';

const Layout = require('../lib/layout');
const cbT = require('../index');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('layout.js', () => {
  let testDir;
  let layout;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'cbt-layout-test-' + Date.now() + '-' + Math.random());
    fs.mkdirSync(testDir, { recursive: true });

    // 创建Layout实例
    const coreInstance = cbT.getInstance();
    coreInstance.basePath = testDir;
    layout = new Layout(coreInstance);
  });

  afterEach(() => {
    // 清理测试目录
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('template inheritance', () => {
    test('should handle simple template extension', (done) => {
      // 创建父模板
      const parentContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title><% block title %>Default Title<% /block %></title>
        </head>
        <body>
          <% block content %>Default Content<% /block %>
        </body>
        </html>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      // 创建子模板
      const childContent = `<% extends parent %>
<% block title %>Child Title<% /block %>
<% block content %>Child Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();

        // 编译并渲染模板
        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('Child Title');
        expect(result).toContain('Child Content');
        expect(result).not.toContain('Default Title');
        expect(result).not.toContain('Default Content');
        done();
      });
    });

    test('should support parent tag', (done) => {
      const parentContent = `
        <% block content %>Parent Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% parent %>
  Child Content
<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();

        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('Parent Content');
        expect(result).toContain('Child Content');
        done();
      });
    });

    test('should support child tag', (done) => {
      const parentContent = `
        <% block content %>
          Before Child
          <% child %>
          After Child
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>Child Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();

        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('Before Child');
        expect(result).toContain('Child Content');
        expect(result).toContain('After Child');
        done();
      });
    });

    test('should support slot tag', (done) => {
      const parentContent = `
        <% block content %>
          <div class="header">
            <% slot header %>Default Header<% /slot %>
          </div>
          <div class="body">
            <% slot body %>Default Body<% /slot %>
          </div>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% slot header %>Custom Header<% /slot %>
  <% slot body %>Custom Body<% /slot %>
<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();

        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('Custom Header');
        expect(result).toContain('Custom Body');
        expect(result).not.toContain('Default Header');
        expect(result).not.toContain('Default Body');
        done();
      });
    });

    test('should handle multiple levels of inheritance', (done) => {
      // 祖父模板
      const grandparentContent = `
        <html>
        <% block header %><header>Grand<% /block %>
        <% block content %>Grand Content<% /block %>
        <% block footer %><footer>Grand<% /block %>
        </html>
      `;
      fs.writeFileSync(path.join(testDir, 'grandparent.html'), grandparentContent);

      // 父模板
      const parentContent = `<% extends grandparent %>
<% block header %><header>Parent<% /block %>
<% block content %>Parent Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      // 子模板
      const childContent = `<% extends parent %>
<% block content %>Child Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();

        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('<header>Parent');
        expect(result).toContain('Child Content');
        expect(result).toContain('<footer>Grand');
        done();
      });
    });
  });

  describe('error handling', () => {
    test('should handle non-existent parent template', (done) => {
      const childContent = `<% extends nonexistent %>
<% block content %>Child<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ENOENT');
        done();
      });
    });

    test('should detect circular inheritance', (done) => {
      // 创建循环继承: template1 extends template2, template2 extends template1
      const template1 = `<% extends template2 %>
<% block content %>Template1<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'template1.html'), template1);

      const template2 = `<% extends template1 %>
<% block content %>Template2<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'template2.html'), template2);

      layout.make('template1.html', { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.message).toContain('Circular inheritance detected');
        expect(err.message).toContain('already being processed');
        done();
      });
    });

    test('should detect complex circular inheritance chain', (done) => {
      // 创建复杂循环: A -> B -> C -> A
      const templateA = `<% extends templateB %>
<% block content %>A<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'templateA.html'), templateA);

      const templateB = `<% extends templateC %>
<% block content %>B<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'templateB.html'), templateB);

      const templateC = `<% extends templateA %>
<% block content %>C<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'templateC.html'), templateC);

      layout.make('templateA.html', { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.message).toContain('Circular inheritance detected');
        done();
      });
    });

  });

  describe('caching', () => {
    test('should cache compiled templates', (done) => {
      const content = '<% block test %>Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'cached.html'), content);

      // 第一次编译
      layout.make('cached.html', { cache: true }, (err1, content1) => {
        expect(err1).toBeNull();

        // 不修改文件，直接第二次编译（应该使用缓存）
        layout.make('cached.html', { cache: true }, (err2, content2) => {
          expect(err2).toBeNull();
          expect(content1).toBe(content2); // 应该相同因为使用了缓存
          done();
        });
      });
    });

    test('should invalidate cache when file is modified', (done) => {
      const content = '<% block test %>Test<% /block %>';
      const filePath = path.join(testDir, 'cached2.html');
      fs.writeFileSync(filePath, content);

      // 第一次编译
      layout.make('cached2.html', { cache: true }, (err1, content1) => {
        expect(err1).toBeNull();

        // 等待一秒确保文件时间戳不同
        setTimeout(() => {
          // 修改文件
          fs.writeFileSync(filePath, '<% block test %>Modified<% /block %>');

          // 第二次编译
          layout.make('cached2.html', { cache: true }, (err2, content2) => {
            expect(err2).toBeNull();
            // 内容应该不同因为文件被修改了
            expect(content1).not.toBe(content2);
            done();
          });
        }, 1000);
      });
    });
  });

  describe('block features', () => {
    test('should support block hide mode', (done) => {
      const content = `
        <% block visible %>Visible<% /block %>
        <% block hidden hide %>Hidden<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'hide.html'), content);

      layout.make('hide.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();

        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('Visible');
        expect(result).not.toContain('Hidden');
        done();
      });
    });

    test('should support use tag', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot content %>Default Content<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% use template title="Custom Title" content="Custom Content" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'use.html'), content);

      layout.make('use.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();

        const template = layout.core._buildTemplateFunction(content);
        const result = template({});

        expect(result).toContain('Custom Title');
        expect(result).toContain('Custom Content');
        done();
      });
    });
  });

  describe('file handling', () => {
    test('should handle template files without extension', (done) => {
      const content = '<% block test %>No Extension<% /block %>';
      fs.writeFileSync(path.join(testDir, 'noext.html'), content);

      layout.make('noext', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('No Extension');
        done();
      });
    });

    test('should handle relative path inheritance', (done) => {
      // Create subdirectory
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir);

      // Create parent in subdir
      const parentContent = '<% block content %>Parent<% /block %>';
      fs.writeFileSync(path.join(subDir, 'parent.html'), parentContent);

      // Create child in subdir that extends relative parent
      const childContent = `<% extends parent %>
<% block content %>Child<% /block %>`;
      fs.writeFileSync(path.join(subDir, 'child.html'), childContent);

      layout.make('subdir/child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child');
        done();
      });
    });

    test('should handle file read errors', (done) => {
      // Try to make a template that doesn't exist
      layout.make('nonexistent.html', { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ENOENT');
        done();
      });
    });
  });

  describe('advanced block features', () => {
    test('should handle block without parameters', (done) => {
      const content = `
        <% block %>
          Content without name
        <% /block %>
        <% block named %>Named content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'unnamed.html'), content);

      layout.make('unnamed.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Named content');
        done();
      });
    });

    test('should request specific block content', (done) => {
      const content = `
        <% block header %>Header Content<% /block %>
        <% block footer %>Footer Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'blocks.html'), content);

      layout.make('blocks.html', { cache: false, block: 'header' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Header Content');
        expect(content).not.toContain('Footer Content');
        done();
      });
    });

    test('should handle non-existent block request', (done) => {
      const content = `
        <% block existing %>Existing Content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'missing-block.html'), content);

      layout.make('missing-block.html', { cache: false, block: 'nonexistent' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Block nonexistent not found!');
        done();
      });
    });

    test('should cache compiled layout templates correctly', (done) => {
      const content = '<% block test %>Cache Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'cachetest.html'), content);

      // First compilation to create cache
      layout.make('cachetest.html', { cache: true }, (err1, content1) => {
        expect(err1).toBeNull();

        // Second call should hit cache
        layout.make('cachetest.html', { cache: true }, (err2, content2) => {
          expect(err2).toBeNull();
          expect(content1).toBe(content2);
          done();
        });
      });
    });
  });

  describe('advanced caching scenarios', () => {
    test('should handle cache being disabled', (done) => {
      const content = '<% block test %>No Cache<% /block %>';
      fs.writeFileSync(path.join(testDir, 'nocache.html'), content);

      layout.make('nocache.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('No Cache');
        done();
      });
    });

    test('should handle version mismatch in cache', (done) => {
      const content = '<% block test %>Version Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'version.html'), content);

      // First compilation to create cache
      layout.make('version.html', { cache: true }, (err1) => {
        expect(err1).toBeNull();

        // Now manually create a cache file with wrong version
        const cacheDir = layout.core.cachePath || path.join(os.tmpdir(), 'changba-template-cache', require('../lib/utils').getHash(layout.core.basePath));
        const cacheFile = path.join(cacheDir, require('../lib/utils').getHash('version.html') + '.html');

        // Create cache with wrong version
        const wrongCacheContent = `'/* changba template engine
{"version":"wrong-version","files":{}}
*/+'test content`;

        require('../lib/utils').mkdirp(cacheDir, () => {
          fs.writeFile(cacheFile, wrongCacheContent, (writeErr) => {
            if (writeErr) {
              return done(writeErr);
            }

            // Try to use cache - should ignore due to version mismatch
            layout.make('version.html', { cache: true }, (err2, content2) => {
              expect(err2).toBeNull();
              expect(content2).toContain('Version Test');
              done();
            });
          });
        });
      });
    });

    test('should handle corrupted cache file', (done) => {
      const content = '<% block test %>Corrupt Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'corrupt.html'), content);

      // Create corrupted cache file
      const cacheDir = layout.core.cachePath || path.join(os.tmpdir(), 'changba-template-cache', require('../lib/utils').getHash(layout.core.basePath));
      const cacheFile = path.join(cacheDir, require('../lib/utils').getHash('corrupt.html') + '.html');

      require('../lib/utils').mkdirp(cacheDir, () => {
        // Write corrupted JSON
        const corruptCache = `'/* changba template engine
{invalid json}
*/+'test content`;

        fs.writeFile(cacheFile, corruptCache, (writeErr) => {
          if (writeErr) {
            return done(writeErr);
          }

          layout.make('corrupt.html', { cache: true }, (err, content) => {
            expect(err).toBeNull();
            expect(content).toContain('Corrupt Test');
            done();
          });
        });
      });
    });

    test('should handle cache read errors', (done) => {
      const content = '<% block test %>Read Error Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'readerror.html'), content);

      // Create a cache file we can't read
      const cacheDir = layout.core.cachePath || path.join(os.tmpdir(), 'changba-template-cache', require('../lib/utils').getHash(layout.core.basePath));
      const cacheFile = path.join(cacheDir, require('../lib/utils').getHash('readerror.html') + '.html');

      require('../lib/utils').mkdirp(cacheDir, () => {
        fs.writeFile(cacheFile, 'test', (writeErr) => {
          if (writeErr) {
            return done(writeErr);
          }

          // Mock fs.readFile to simulate read error
          const originalReadFile = fs.readFile;
          fs.readFile = (path, options, callback) => {
            if (path === cacheFile) {
              const error = new Error('Read error');
              return callback(error);
            }
            return originalReadFile(path, options, callback);
          };

          layout.make('readerror.html', { cache: true }, (err, content) => {
            expect(err).toBeNull();
            expect(content).toContain('Read Error Test');

            // Restore original function
            fs.readFile = originalReadFile;
            done();
          });
        });
      });
    });

    test('should handle locked cache files', (done) => {
      const content = '<% block test %>Lock Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'locked.html'), content);

      // Mock lockfile.isLocked to return true
      const originalIsLocked = require('../lib/lockfile').isLocked;
      require('../lib/lockfile').isLocked = (file, callback) => {
        callback(true); // Always locked
      };

      layout.make('locked.html', { cache: true }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Lock Test');

        // Restore original function
        require('../lib/lockfile').isLocked = originalIsLocked;
        done();
      });
    });
  });

  describe('error scenarios', () => {
    test('should handle processing errors gracefully', (done) => {
      // Create a mock layout with faulty getFileTime
      const coreInstance = cbT.getInstance();
      coreInstance.basePath = testDir;
      const mockLayout = new Layout(coreInstance);

      const content = '<% block test %>Error Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'error.html'), content);

      // Mock utils.getFileTime to throw error
      const originalGetFileTime = require('../lib/utils').getFileTime;
      require('../lib/utils').getFileTime = () => {
        throw new Error('getFileTime error');
      };

      mockLayout.make('error.html', { cache: false }, (err) => {
        // Should handle error gracefully
        expect(err).toBeTruthy();

        // Restore original function
        require('../lib/utils').getFileTime = originalGetFileTime;
        done();
      });
    });

    test('should handle inheritance processing errors', (done) => {
      const parentContent = '<% block content %>Parent<% /block %>';
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>Child<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      // Create a layout and mock a method to throw error
      const coreInstance = cbT.getInstance();
      coreInstance.basePath = testDir;
      const mockLayout = new Layout(coreInstance);

      // Override parseParent to throw error
      mockLayout.parseParent = async() => {
        throw new Error('Parse error');
      };

      mockLayout.make('child.html', { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.message).toBe('Parse error');
        done();
      });
    });

    test('should handle outer catch block errors', (done) => {
      const content = '<% block test %>Outer Error Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'outer-error.html'), content);

      // Mock fs.readFile to throw error synchronously in outer catch
      const originalReadFile = fs.readFile;
      fs.readFile = () => {
        throw new Error('Synchronous fs error');
      };

      layout.make('outer-error.html', { cache: false }, (err) => {
        expect(err).toBeTruthy();
        expect(err.message).toBe('Synchronous fs error');

        // Restore original function
        fs.readFile = originalReadFile;
        done();
      });
    });
  });

  describe('absolute path templates', () => {
    test('should handle templates with absolute paths', (done) => {
      // Create parent with absolute path reference
      const parentContent = '<% block content %>Absolute Parent<% /block %>';
      fs.writeFileSync(path.join(testDir, 'abs-parent.html'), parentContent);

      // Create child that extends using absolute path (starting with /)
      const childContent = `<% extends /abs-parent %>
<% block content %>Absolute Child<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'abs-child.html'), childContent);

      layout.make('abs-child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Absolute Child');
        done();
      });
    });
  });

  describe('block parameter handling', () => {
    test('should handle blocks without parameters', (done) => {
      const content = `
        <% block %>
          Content without name parameter
        <% /block %>
        <% block named %>Named content<% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'no-params.html'), content);

      layout.make('no-params.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Named content');
        done();
      });
    });
  });

  describe('slot default handling', () => {
    test('should handle default slot without name', (done) => {
      const parentContent = `
        <% block content %>
          <% slot %>Default slot content<% /slot %>
          <% slot named %>Named slot<% /slot %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% slot %>Child default slot<% /slot %>
  <% slot named %>Child named slot<% /slot %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'child.html'), childContent);

      layout.make('child.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child default slot');
        expect(content).toContain('Child named slot');
        done();
      });
    });
  });

  describe('command use with parameters', () => {
    test('should handle use command with parameter parsing', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot description %>Default Description<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% use template title="Custom Title" description="Custom Description" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'use-params.html'), content);

      layout.make('use-params.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Custom Title');
        expect(content).toContain('Custom Description');
        done();
      });
    });

    test('should handle use command with non-existent block', (done) => {
      const content = `
        <% block main %>
          <% use nonexistent title="Test" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'use-nonexistent.html'), content);

      layout.make('use-nonexistent.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        // Use command with non-existent block should remain as-is in the output
        expect(content).toContain('use nonexistent');
        done();
      });
    });
  });

  describe('command call with complex scenarios', () => {
    test('should handle call command with slot parameters and content', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot %>Default Content<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% call template title="Param Title" %>
            <% slot content %>Slot Content<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'call-complex.html'), content);

      layout.make('call-complex.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Param Title');
        done();
      });
    });

    test('should handle call command with apply variation', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot content %>Default Content<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% apply template title="Apply Title" %>
            <% slot content %>Apply Content<% /slot %>
          <% /apply %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'apply-test.html'), content);

      layout.make('apply-test.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Apply Title');
        expect(content).toContain('Apply Content');
        done();
      });
    });

    test('should handle call with non-existent block', (done) => {
      const content = `
        <% block main %>
          <% call nonexistent title="Test" %>
            <% slot content %>Test Content<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'call-nonexistent.html'), content);

      layout.make('call-nonexistent.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        // Call command with non-existent block should remain as-is in the output
        expect(content).toContain('call nonexistent');
        done();
      });
    });
  });

  describe('cache file validation', () => {
    test('should handle successful cache validation', (done) => {
      const content = '<% block test %>Cache Validation<% /block %>';
      fs.writeFileSync(path.join(testDir, 'cache-validation.html'), content);

      // First compilation to create cache
      layout.make('cache-validation.html', { cache: true }, (err1, content1) => {
        expect(err1).toBeNull();

        // Second call should validate cache and return cached content
        layout.make('cache-validation.html', { cache: true }, (err2, content2) => {
          expect(err2).toBeNull();
          expect(content1).toBe(content2);
          done();
        });
      });
    });
  });

  describe('remove command with content', () => {
    test('should remove command content from template strings', (done) => {
      // Create a layout instance to test the method directly
      const coreInstance = cbT.getInstance();
      coreInstance.basePath = testDir;
      const testLayout = new Layout(coreInstance);

      // Test the method with slot content removal
      const content = '<% slot test %>Test Content<% /slot %>';
      const result = testLayout.removeCommandWithContent('slot', content);

      expect(result).toBe('');
      done();
    });
  });

  describe('cache edge cases', () => {

    test('should handle locked cache files during cache retrieval', (done) => {
      const content = '<% block test %>Cache Lock Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'cache-lock.html'), content);

      // Create cache first
      layout.make('cache-lock.html', { cache: true }, (err1) => {
        expect(err1).toBeNull();

        // Now mock the isLocked function to simulate cache lock
        const originalIsLocked = require('../lib/lockfile').isLocked;
        require('../lib/lockfile').isLocked = (filePath, callback) => {
          // Return true for cache files (triggers line 469)
          callback(true);
        };

        // Also mock fileExists to ensure cache file exists check passes
        const originalFileExists = require('../lib/utils').fileExists;
        require('../lib/utils').fileExists = (filePath, callback) => {
          callback(true); // Cache file exists
        };

        // This should trigger the cache lock path (line 469)
        layout.make('cache-lock.html', { cache: true }, (err2, content2) => {
          expect(err2).toBeNull();
          expect(content2).toContain('Cache Lock Test');

          // Restore original functions
          require('../lib/lockfile').isLocked = originalIsLocked;
          require('../lib/utils').fileExists = originalFileExists;
          done();
        });
      });
    });

    test('should handle cache file time validation', (done) => {
      const content = '<% block test %>Time Validation<% /block %>';
      fs.writeFileSync(path.join(testDir, 'time-validation.html'), content);

      // Create cache first
      layout.make('time-validation.html', { cache: true }, (err1) => {
        expect(err1).toBeNull();

        // Now test file time validation by making another call
        layout.make('time-validation.html', { cache: true }, (err2, content2) => {
          expect(err2).toBeNull();
          expect(content2).toContain('Time Validation');
          done();
        });
      });
    });
  });

  describe('comprehensive edge cases', () => {
    test('should handle block hide mode specifically', (done) => {
      const parentContent = `
        <% block content %>
          <% block visible %>Visible Content<% /block %>
          <% block hidden hide %>Hidden Content<% /block %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% block visible %>Child Visible<% /block %>
  <% block hidden hide %>Child Hidden<% /block %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'hide-mode.html'), childContent);

      layout.make('hide-mode.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child Visible');
        expect(content).not.toContain('Hidden Content');
        expect(content).not.toContain('Child Hidden');
        done();
      });
    });

    test('should handle multiple file inheritance with successful cache hit', (done) => {
      // Create a chain of files to trigger multiple file time checks
      const grandparentContent = '<% block content %>Grandparent<% /block %>';
      fs.writeFileSync(path.join(testDir, 'grandparent.html'), grandparentContent);

      const parentContent = `<% extends grandparent %>
<% block content %>Parent: <% parent %><% /block %>`;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>Child: <% parent %><% /block %>`;
      fs.writeFileSync(path.join(testDir, 'inheritance-cache.html'), childContent);

      // First call to create cache
      layout.make('inheritance-cache.html', { cache: true }, (err1, content1) => {
        expect(err1).toBeNull();
        expect(content1).toContain('Child: Parent: Grandparent');

        // Second call should hit cache and validate all files
        layout.make('inheritance-cache.html', { cache: true }, (err2, content2) => {
          expect(err2).toBeNull();
          expect(content1).toBe(content2);
          done();
        });
      });
    });

    test('should return cached content when cache is valid', (done) => {
      const content = '<% block test %>Cache Hit Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'cache-hit.html'), content);

      // First call creates cache
      layout.make('cache-hit.html', { cache: true }, (err1, content1) => {
        expect(err1).toBeNull();

        // Ensure cache file exists and is valid
        setTimeout(() => {
          // Second call should hit cache when cacheContent is valid
          layout.make('cache-hit.html', { cache: true }, (err2, content2) => {
            expect(err2).toBeNull();
            expect(content2).toBe(content1); // Should be exact same cached content
            done();
          });
        }, 10); // Small delay to ensure cache is written
      });
    });

    test('should handle block parameter parsing edge case', (done) => {
      const parentContent = `
        <% block content %>
          Parent content
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      // Create a child that will trigger parsing with empty parameters
      const childContent = `<% extends parent %>
<% block %>
  Empty block name
<% /block %>
<% block content %>Child content<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'edge-params.html'), childContent);

      layout.make('edge-params.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child content');
        done();
      });
    });


    test('should match use command parameters to slot names correctly', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot content %>Default Content<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% use template title="Custom Title" content="Custom Content" extra="Extra Value" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'use-complex.html'), content);

      layout.make('use-complex.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Custom Title');
        expect(content).toContain('Custom Content');
        done();
      });
    });

    test('should parse call command parameters and slot content', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot %>Default unnamed slot<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% call template title="Call Title" %>
            <% slot content %>Call Content<% /slot %>
            <% slot %>Override unnamed slot<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'call-complex-slots.html'), content);

      layout.make('call-complex-slots.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Call Title');
        expect(content).toContain('Override unnamed slot');
        done();
      });
    });

    test('should parse blocks without parameter attributes', (done) => {
      // Create blocks without parameter attributes
      // This happens when a block tag has no parameters at all
      const parentContent = `
        <html>
          <% block %>Empty param block<% /block %>
          <% block content %>Default<% /block %>
        </html>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block %>Child empty param<% /block %>
<% block content %>Child Content<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'p3-test.html'), childContent);

      layout.make('p3-test.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child Content');
        // The empty param block should be processed
        done();
      });
    });





    test('should handle unnamed slots in call command', (done) => {
      const content = `
        <% block template %>
          <div><% slot %>Default unnamed<% /slot %></div>
        <% /block %>

        <% block main %>
          <% call template %>
            <% slot %>
              Replaced unnamed slot content
            <% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'unnamed-slot.html'), content);

      layout.make('unnamed-slot.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Replaced unnamed slot content');
        done();
      });
    });

    test('should execute use command when blocks already exist', (done) => {
      const parentContent = `
        <% block widget %>
          <div class="widget">
            <h3><% slot title %>Default Widget Title<% /slot %></h3>
            <div><% slot body %>Default Widget Body<% /slot %></div>
          </div>
        <% /block %>

        <% block main %>
          <% use widget title="My Widget" body="My Content" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'use-existing.html'), parentContent);

      layout.make('use-existing.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('My Widget');
        expect(content).toContain('My Content');
        done();
      });
    });

    test('should execute call command with multiple slots', (done) => {
      const parentContent = `
        <% block component %>
          <article>
            <header><% slot header %>Default Header<% /slot %></header>
            <main><% slot %>Default Content<% /slot %></main>
            <footer><% slot footer %>Default Footer<% /slot %></footer>
          </article>
        <% /block %>

        <% block page %>
          <% call component header="Page Header" footer="Page Footer" %>
            <% slot content %>Page Content<% /slot %>
            <% slot %>Page Main Content<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'call-existing.html'), parentContent);

      layout.make('call-existing.html', { cache: false, block: 'page' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Page Header');
        expect(content).toContain('Page Footer');
        expect(content).toContain('Page Main Content');
        done();
      });
    });


    test('unnamed slot in call command', (done) => {
      const content = `
        <% block template %>
          <div>
            <% slot %>Default unnamed slot<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          <% call template %>
            <% slot %>Override unnamed slot<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'fixed-line-399.html'), content);

      layout.make('fixed-line-399.html', { cache: false, block: 'main' }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Override unnamed slot');
        expect(content).not.toContain('Default unnamed slot');
        done();
      });
    });



    test('should parse use command parameters in template inheritance', (done) => {
      const parentContent = `
        <% block reusable %>
          <div class="card">
            <h2><% slot title %>Default Title<% /slot %></h2>
            <p><% slot content %>Default Content<% /slot %></p>
            <span><% slot category %>Default Category<% /slot %></span>
          </div>
        <% /block %>

        <% block content %>
          <% use reusable title="Parent Title" content="Parent Content" category="Parent Category" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% use reusable title="Child Title" content="Child Content" category="Child Category" %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'inheritance-use-params.html'), childContent);

      layout.make('inheritance-use-params.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child Title');
        expect(content).toContain('Child Content');
        expect(content).toContain('Child Category');
        done();
      });
    });

    test('should handle call command with parameters and slot content', (done) => {
      const parentContent = `
        <% block component %>
          <section class="component">
            <h1><% slot title %>Parent Title<% /slot %></h1>
            <div><% slot %>Parent Default<% /slot %></div>
          </section>
        <% /block %>

        <% block main %>
          <% call component title="Original Title" %>
            <% slot content %>Original Content<% /slot %>
            <% slot %>Original Default<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block main %>
  <% call component title="Inherited Title" %>
    <% slot content %>Inherited Content<% /slot %>
    <% slot %>Inherited Default<% /slot %>
  <% /call %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'call-inheritance.html'), childContent);

      layout.make('call-inheritance.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Inherited Title');
        done();
      });
    });


    test('should handle use command referencing non-existent blocks', (done) => {
      // Create a scenario where use references a block that doesn't exist anywhere
      const parentContent = `
        <% block content %>
          <% use nonexistentblock title="Test" %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% use totallynonexistent title="Test" %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'use-line-353.html'), childContent);

      layout.make('use-line-353.html', { cache: false }, (err) => {
        expect(err).toBeNull();
        // The use command should be processed and return empty for non-existent block
        done();
      });
    });

    test('should handle call command referencing non-existent blocks', (done) => {
      // Create a scenario where call references a block that doesn't exist anywhere
      const parentContent = `
        <% block content %>
          <% call nonexistentblock title="Test" %>
            <% slot content %>Test<% /slot %>
          <% /call %>
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block content %>
  <% call totallynonexistent title="Test" %>
    <% slot content %>Test<% /slot %>
  <% /call %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'call-line-382.html'), childContent);

      layout.make('call-line-382.html', { cache: false }, (err) => {
        expect(err).toBeNull();
        // The call command should be processed and return empty for non-existent block
        done();
      });
    });



    test('should parse parent template names with file extensions', (done) => {
      // Test parseParent with parent template that has file extension
      const parentContent = '<% block content %>Parent With Extension<% /block %>';
      fs.writeFileSync(path.join(testDir, 'parent-with-ext.html'), parentContent);

      const childContent = `<% extends parent-with-ext.html %>
<% block content %>Child Content<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'child-extends-with-ext.html'), childContent);

      layout.make('child-extends-with-ext.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Child Content');
        done();
      });
    });

    test('should use default options when options parameter is null', (done) => {
      // Test make method with null options parameter
      const simpleContent = '<% block test %>Default Param Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'default-param.html'), simpleContent);

      // Call make with null/undefined options to trigger default parameter
      layout.make('default-param.html', null, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('Default Param Test');
        done();
      });
    });

    test('should use default options when options parameter is undefined', (done) => {
      // Test make method without passing options parameter to trigger default
      const content = '<% block test %>No Options Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'no-options.html'), content);

      // Directly call make to test the method's parameter handling
      // We need to check if Layout class handles the case where options is undefined
      const coreInstance = cbT.getInstance();
      coreInstance.basePath = testDir;
      const testLayout = new Layout(coreInstance);

      // Call make with undefined options to trigger default parameter
      testLayout.make('no-options.html', undefined, (err, content) => {
        expect(err).toBeNull();
        expect(content).toContain('No Options Test');
        done();
      });
    });

    test('should handle use command with non-existent slot names', (done) => {
      // Test commandUse when slot doesn't exist in blocks
      const parentContent = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot content %>Default Content<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          Parent main block
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block main %>
  <% use template title="Custom Title" nonexistent="Non-existent Value" %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'use-nonexistent-slot.html'), childContent);

      layout.make('use-nonexistent-slot.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        const template = layout.core._buildTemplateFunction(content);
        const result = template({});
        expect(result).toContain('Custom Title');
        expect(result).toContain('Default Content'); // Should keep default since 'content' wasn't provided
        done();
      });
    });

    test('should handle call command with non-existent slot names', (done) => {
      // Test commandCall when slot doesn't exist in blocks
      const parentContent = `
        <% block template %>
          <div>
            <% slot title %>Default Title<% /slot %>
            <% slot content %>Default Content<% /slot %>
          </div>
        <% /block %>

        <% block main %>
          Parent main block
        <% /block %>
      `;
      fs.writeFileSync(path.join(testDir, 'parent.html'), parentContent);

      const childContent = `<% extends parent %>
<% block main %>
  <% call template title="Custom Title" %>
    <% slot nonexistent %>Non-existent slot content<% /slot %>
  <% /call %>
<% /block %>`;
      fs.writeFileSync(path.join(testDir, 'call-nonexistent-slot.html'), childContent);

      layout.make('call-nonexistent-slot.html', { cache: false }, (err, content) => {
        expect(err).toBeNull();
        const template = layout.core._buildTemplateFunction(content);
        const result = template({});
        expect(result).toContain('Custom Title');
        expect(result).toContain('Default Content'); // Should keep default
        done();
      });
    });

    test('should handle cache with missing files property', (done) => {
      // Test getCache when info.files is undefined
      const content = '<% block test %>Cache Files Test<% /block %>';
      fs.writeFileSync(path.join(testDir, 'cache-no-files.html'), content);

      // Create a cache file with no files property
      const cacheDir = layout.core.cachePath || path.join(os.tmpdir(), 'changba-template-cache', require('../lib/utils').getHash(layout.core.basePath));
      const cacheFile = path.join(cacheDir, require('../lib/utils').getHash('cache-no-files.html') + '.html');

      const cacheContent = `'/* changba template engine
{"version":"${layout.core.version}"}
*/+'test content`;

      require('../lib/utils').mkdirp(cacheDir, () => {
        fs.writeFile(cacheFile, cacheContent, (writeErr) => {
          if (writeErr) {
            return done(writeErr);
          }

          // Try to use cache - should handle missing files property
          layout.make('cache-no-files.html', { cache: true }, (err, content) => {
            expect(err).toBeNull();
            expect(content).toContain('test content');
            done();
          });
        });
      });
    });
  });
});
