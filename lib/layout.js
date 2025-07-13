'use strict';

const os = require('os');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const lockfile = require('./lockfile');
const utils = require('./utils');

// 模板布局类
class Layout {
  constructor(core) {
    this.core = core;

    this.leftDelimiter = utils.encodeReg(core.leftDelimiter);
    this.rightDelimiter = utils.encodeReg(core.rightDelimiter);

    this.depth = 0;

    // 存储模板文件修改时间
    this.templateTimes = {};

    // 存储已处理过的 block
    this.blocks = {};

    // 存储未处理的原始 block
    this.rawBlocks = [];

    // 存储模板内容
    this.templates = [];

    // 跟踪正在处理的文件，用于循环继承检测
    this.visitedFiles = new Set();

    // 默认选项
    this.defaultOptions = {
      block: '',
      cache: true,
      cacheName: 'changba-template-cache'
    }
  }

  make(name, options = {}, callback) {
    options = Object.assign({}, this.defaultOptions, options);

    // 重置实例状态，以支持多次调用
    this.depth = 0;
    this.templateTimes = {};
    this.blocks = {};
    this.rawBlocks = [];
    this.templates = [];
    this.visitedFiles.clear();

    const extName = path.extname(name);

    if (!extName) {
      name += this.core.defaultExtName;
    }

    const block = options.block;

    // 设置缓存目录
    const cachePath = this.core.cachePath || path.join(os.tmpdir(), options.cacheName, utils.getHash(this.core.basePath));

    // 设置缓存文件名
    const cacheFilename = path.join(cachePath, utils.getHash(name + (block === '' ? '' : ':' + block)) + extName);

    // 检查是否需要重编译
    this.getCache(cacheFilename, options.cache, (cacheContent) => {
      if (cacheContent !== false) {
        return callback(null, cacheContent);
      }

      try {
        // 先读取文件名
        const filename = path.join(this.core.basePath, name);

        fs.readFile(filename, async(err, data) => {
          if (err) {
            return callback(err);
          }

          try {
            let content = data.toString();

            utils.getFileTime(filename, async(time) => {
              try {
                this.templateTimes[filename] = time;

                const extendsName = this.getExtends(content);

                // 判断是否第一行是否有 extends 指令
                if (extendsName) {
                  // 有 extends 指令，表示需要解析父模板
                  await this.parseParent(extendsName, content, filename);
                  // 处理模板
                  content = this.processParent(content);
                }
                else {
                  // 没有继承，也需要收集 blocks
                  const blocks = this.getBlocks(content);
                  Object.assign(this.blocks, blocks);
                }

                content = this.removeCommand(content);

                // 准备缓存文件的数据

                const cacheInfo = {
                  version: this.core.version,
                  files: this.templateTimes
                };

                let result = `'/* changba template engine\n${JSON.stringify(cacheInfo)}\n*/+'`;

                if (block !== '') {
                  // 支持直接获取 block 内容
                  result += this.blocks[block] ? this.blocks[block] : `Block ${block} not found!`;
                }
                else {
                  result += this.core._parse(content);
                }

                if (options.cache) {
                  // 写入缓存（异步）
                  this.writeCache(cacheFilename, result);
                }

                callback(null, result);
              }
              catch (err) {
                callback(err);
              }
            });
          }
          catch (err) {
            callback(err);
          }
        });
      }
      catch (err) {
        callback(err);
      }
    });
  }

  // 解析父模板
  async parseParent(name, subContent, subFilename) {
    this.depth++;

    const extName = path.extname(name);

    if (!extName) {
      name += this.core.defaultExtName;
    }

    let filename;

    if (name.indexOf('/') === 0) {
      filename = path.join(this.core.basePath, name);
    }
    else {
      filename = path.join(path.dirname(subFilename), name);
    }

    // 循环继承检测
    if (this.visitedFiles.has(filename)) {
      throw new Error(`Circular inheritance detected: ${filename} is already being processed`);
    }
    this.visitedFiles.add(filename);

    const data = await fsPromises.readFile(filename);
    const content = data.toString();

    // 获取文件修改时间
    const stats = await fsPromises.stat(filename);
    this.templateTimes[filename] = stats.mtime.getTime();

    // 模板内容入栈，等待后续处理
    this.templates.push(content);

    // 获取父模板名称
    const extendsName = this.getExtends(content);

    if (extendsName) {
      // 有 extends 指令，表示需要加载父模板
      await this.parseParent(extendsName, content, filename);
    }

    // 合并每一级的 block 信息，备用
    this.rawBlocks.push(this.getBlocks(content));

    this.depth--;

    if (this.depth === 0) {
      // 如果解析到最末一级，则合并最末一级模板的 block 内容
      // 此处需要特殊处理，否则会丢掉最末一级模板的 block 内容
      this.rawBlocks.push(this.getBlocks(subContent));
    }

    // 清理访问记录
    this.visitedFiles.delete(filename);
  }

  processParent(subContent) {
    let content = '';
    let subBlocks = this.getBlocks(subContent);

    const length = this.rawBlocks.length;

    this.templates.forEach((item, index) => {
      let parentsBlocks = {};

      for (let i = 0; i < length - index; i++) {
        parentsBlocks = Object.assign(parentsBlocks, this.rawBlocks[i]);
      }

      content = this.parseParentBlock(item, subBlocks, parentsBlocks);
      subBlocks = this.getBlocks(content);
    });

    return content;
  }

  parseParentBlock(content, subBlocks, currentBlocks) {
    Object.assign(this.blocks, subBlocks);

    const pattern = this.createPlainMatcher('block');

    content = content.replace(pattern, (match, p1, p2, p3, p4, p5) => {
      if (!p3) {
        return '';
      }

      const params = p3.split(/\s+/);
      const name = params[0];
      const mode = params[1];

      if (mode === 'hide') {
        return '';
      }

      if (typeof this.blocks[name] !== 'undefined') {
        let str = this.blocks[name];

        p4 = p4.trim();

        str = this.commandUse(str, currentBlocks);
        str = this.commandCall(str, currentBlocks, 'apply');
        str = this.commandCall(str, currentBlocks);

        str = this.commandParent(str, p4);
        str = this.commandChild(str, p4);

        str = this.commandSlot(str, p4);

        // 返回: <% block xxx %>处理后的内容<% /block %>
        return p1 + str + p5;
      }

      return match;
    });

    return content;
  }

  getExtends(content) {
    const pattern = this.createOpenMatcher('extends');
    const match = pattern.exec(content);

    return match ? match[2] : '';
  }

  getBlocks(content) {
    const blocks = {};
    let match = null;
    const pattern = this.createMatcher('block');

    while ((match = pattern.exec(content)) !== null) {
      if (match[2]) {
        const param = match[2].trim().split(/\s+/);

        blocks[param[0]] = match[3].trim();
      }
    }

    return blocks;
  }

  commandParent(content, parentContent) {
    const pattern = this.createOpenMatcher('parent');

    return content.replace(pattern, parentContent.trim());
  }

  commandChild(content, parentContent) {
    const pattern = this.createOpenMatcher('child');

    if (parentContent.match(pattern)) {
      content = parentContent.replace(pattern, content.trim());
    }

    return content;
  }

  commandSlot(content, parentContent) {
    const pattern = this.createMatcher('slot');

    if (!parentContent.match(pattern)) {
      return content;
    }

    const slots = {};
    let defaultSlot;
    let match = null;

    // 查找子 block 中的所有 slot
    while ((match = pattern.exec(content)) !== null) {
      if (match[2]) {
        slots[match[2]] = match[3].trim();
      }
      else {
        defaultSlot = match[3].trim();
      }
    }

    // 获取清理了 slot 指令的内容
    const plainContent = content.replace(pattern, '').trim();

    content = parentContent.replace(pattern, (match, p1, p2, p3) => {
      if (!p2) {
        return typeof defaultSlot !== 'undefined' ? defaultSlot : plainContent;
      }
      else {
        return typeof slots[p2] !== 'undefined' ? slots[p2] : p3.trim();
      }
    });

    return content;
  }

  commandUse(content, currentBlocks) {
    const pattern = this.createOpenMatcher('use');
    const patternSlot = this.createMatcher('slot');

    content = content.replace(pattern, (p0, p1, p2) => {
      const params = p2.split(/\s+/);
      const name = params[0];
      const other = params.splice(1).join(' ');

      if (!currentBlocks[name]) {
        return '';
      }

      const blocks = {};
      let match = null;
      const paramsPattern = /(\S+?)="(.*?)"/g;

      while ((match = paramsPattern.exec(other)) !== null) {
        blocks[match[1]] = match[2].trim();
      }

      return currentBlocks[name].replace(patternSlot, (match, p1, p2, p3) => {
        return blocks[p2] ? blocks[p2] : p3.trim();
      });
    });

    return content;
  }

  commandCall(content, currentBlocks, command = 'call') {
    const pattern = this.createMatcher(command);
    const patternSlot = this.createMatcher('slot');

    content = content.replace(pattern, (p0, p1, p2, p3) => {
      const params = p2.split(/\s+/);
      const name = params[0];
      const other = params.splice(1).join(' ');

      if (!currentBlocks[name]) {
        return '';
      }

      const blocks = {};
      let match = null;
      const paramsPattern = /(\S+?)="(.*?)"/g;

      while ((match = paramsPattern.exec(other)) !== null) {
        blocks[match[1]] = match[2].trim();
      }

      while ((match = patternSlot.exec(p3)) !== null) {
        blocks[match[2]] = match[3].trim();
      }

      return currentBlocks[name].replace(patternSlot, (match, slotP1, slotP2, slotP3) => {
        if (!slotP2) {
          return this.removeCommandWithContent('slot', p3).trim();
        }
        else {
          return blocks[slotP2] ? blocks[slotP2] : slotP3.trim();
        }
      });
    });

    return content;
  }

  removeCommand(content) {
    const pattern = this.createPlainMatcher('block');

    content = content.replace(pattern, (match, p1, p2, p3, p4) => {
      // 检查是否有 hide 模式
      if (p3) {
        const params = p3.split(/\s+/);
        const mode = params[1];
        if (mode === 'hide') {
          return '';
        }
      }
      return p4.trim();
    });

    ['extends', 'block', '/block', 'parent', 'child', 'use', 'apply', '/apply', 'call', '/call', 'slot', '/slot'].forEach((item) => {
      const pattern = this.createOpenMatcher(item);

      content = content.replace(pattern, '');
    });

    return content;
  }

  removeCommandWithContent(commend, content) {
    const pattern = this.createMatcher(commend);

    return content.replace(pattern, '');
  }

  createMatcher(keyword) {
    return new RegExp(this.leftDelimiter + '\\s*(' + keyword + ')' + '(?:\\s+((?!' + this.rightDelimiter + ')[\\s\\S]+?)|\\s*)' + '\\s*' + this.rightDelimiter
      + '([\\s\\S]*?)' + this.leftDelimiter + '\\s*/' + keyword + '\\s*' + this.rightDelimiter, 'g');
  }

  createOpenMatcher(keyword) {
    return new RegExp(this.leftDelimiter + '\\s*(' + keyword + ')(?:\\s+((?!' + this.rightDelimiter + ')[\\s\\S]+?)|\\s*)\\s*' + this.rightDelimiter, 'g');
  }

  createPlainMatcher(keyword) {
    return new RegExp('(' + this.leftDelimiter + '\\s*(' + keyword + ')(?:\\s+((?!' + this.rightDelimiter + ')[\\s\\S]+?)|\\s*)\\s*' + this.rightDelimiter
      + ')([\\s\\S]*?)(' + this.leftDelimiter + '\\s*/' + keyword + '\\s*' + this.rightDelimiter + ')', 'g');
  }

  // 获取缓存数据
  getCache(filename, enableCache, callback) {
    if (!enableCache) {
      return callback(false);
    }

    utils.fileExists(filename, (exists) => {
      if (!exists) {
        // 缓存文件不存在，说明无缓存
        return callback(false);
      }

      lockfile.isLocked(filename, (locked) => {
        if (locked) {
          // 如果文件已锁定，说明缓存未就绪
          return callback(false);
        }

        // 开始读缓存文件
        fs.readFile(filename, 'utf8', (err, content) => {
          if (err) {
            return callback(false);
          }

          const contents = content.split(/\n/);
          let info;

          try {
            info = JSON.parse(contents[1]);
          }
          catch (e) {
            info = {};
          }

          if (info.version !== this.core.version) {
            // 模板引擎版本不同，标记为无缓存
            return callback(false);
          }

          // 检查每个文件是否过期
          // 只要有一个文件过期则重编译整个模板

          const files = Object.keys(info.files || {});

          const next = (index) => {
            if (index === files.length) {
              // 所有文件检查完毕
              return callback(content);
            }

            const key = files[index];

            utils.getFileTime(key, (newTime) => {
              if (newTime < 0 || newTime > info.files[key]) {
                // 文件有更新，标记为无缓存
                return callback(false);
              }

              next(index + 1);
            });
          };

          // 开始
          next(0)
        });
      });
    });
  }

  writeCache(filename, data) {
    const dir = path.dirname(filename);

    const lock = () => {
      lockfile.lock(filename, (err, release) => {
        if (err) {
          // 获取锁失败，静默处理
          // 因为缓存并不是主要功能，失败不影响模板渲染
          return;
        }

        // 获取到锁，开始写文件
        fs.writeFile(filename, data, () => {
          // 不管缓存文件是否写成功，都释放锁
          // 因为缓存并不是主要功能
          release();
        });
      });
    };

    utils.dirExists(dir, (exists) => {
      if (!exists) {
        utils.mkdirp(dir, () => {
          lock();
        });
      }
      else {
        lock();
      }
    });
  }

};

module.exports = Layout;
