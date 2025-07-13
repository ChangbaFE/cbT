'use strict';

const os = require('os');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const lockfile = require('./lockfile');
const utils = require('./utils');

// Template layout class
class Layout {
  constructor(core) {
    this.core = core;

    this.leftDelimiter = utils.encodeReg(core.leftDelimiter);
    this.rightDelimiter = utils.encodeReg(core.rightDelimiter);

    this.depth = 0;

    // Store template file modification times
    this.templateTimes = {};

    // Store processed blocks
    this.blocks = {};

    // Store unprocessed raw blocks
    this.rawBlocks = [];

    // Store template contents
    this.templates = [];

    // Track files being processed for circular inheritance detection
    this.visitedFiles = new Set();

    // Default options
    this.defaultOptions = {
      block: '',
      cache: true,
      cacheName: 'changba-template-cache'
    }
  }

  make(name, options = {}, callback) {
    options = Object.assign({}, this.defaultOptions, options);

    // Reset instance state to support multiple calls
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

    // Set cache directory
    const cachePath = this.core.cachePath || path.join(os.tmpdir(), options.cacheName, utils.getHash(this.core.basePath));

    // Set cache filename
    const cacheFilename = path.join(cachePath, utils.getHash(name + (block === '' ? '' : ':' + block)) + extName);

    // Check if recompilation is needed
    this.getCache(cacheFilename, options.cache, (cacheContent) => {
      if (cacheContent !== false) {
        return callback(null, cacheContent);
      }

      try {
        // Read filename first
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

                // Check if the first line has an extends directive
                if (extendsName) {
                  // Has extends directive, need to parse parent template
                  await this.parseParent(extendsName, content, filename);
                  // Process template
                  content = this.processParent(content);
                }
                else {
                  // No inheritance, still need to collect blocks
                  const blocks = this.getBlocks(content);
                  Object.assign(this.blocks, blocks);
                }

                content = this.removeCommand(content);

                // Prepare cache file data

                const cacheInfo = {
                  version: this.core.version,
                  files: this.templateTimes
                };

                let result = `'/* changba template engine\n${JSON.stringify(cacheInfo)}\n*/+'`;

                if (block !== '') {
                  // Support getting block content directly
                  result += this.blocks[block] ? this.blocks[block] : `Block ${block} not found!`;
                }
                else {
                  result += this.core._parse(content);
                }

                if (options.cache) {
                  // Write cache (asynchronous)
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

  // Parse parent template
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

    // Circular inheritance detection
    if (this.visitedFiles.has(filename)) {
      throw new Error(`Circular inheritance detected: ${filename} is already being processed`);
    }
    this.visitedFiles.add(filename);

    const data = await fsPromises.readFile(filename);
    const content = data.toString();

    // Get file modification time
    const stats = await fsPromises.stat(filename);
    this.templateTimes[filename] = stats.mtime.getTime();

    // Template content goes to stack, waiting for subsequent processing
    this.templates.push(content);

    // Get parent template name
    const extendsName = this.getExtends(content);

    if (extendsName) {
      // Has extends directive, need to load parent template
      await this.parseParent(extendsName, content, filename);
    }

    // Merge each level's block information for later use
    this.rawBlocks.push(this.getBlocks(content));

    this.depth--;

    if (this.depth === 0) {
      // If parsed to the last level, merge the block content of the last level template
      // Special handling needed here, otherwise the block content of the last level template will be lost
      this.rawBlocks.push(this.getBlocks(subContent));
    }

    // Clean up visit records
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

        // Return: <% block xxx %>processed content<% /block %>
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

    // Find all slots in child block
    while ((match = pattern.exec(content)) !== null) {
      if (match[2]) {
        slots[match[2]] = match[3].trim();
      }
      else {
        defaultSlot = match[3].trim();
      }
    }

    // Get content with slot directives cleaned
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
      // Check if there is hide mode
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

  // Get cache data
  getCache(filename, enableCache, callback) {
    if (!enableCache) {
      return callback(false);
    }

    utils.fileExists(filename, (exists) => {
      if (!exists) {
        // Cache file does not exist, indicating no cache
        return callback(false);
      }

      lockfile.isLocked(filename, (locked) => {
        if (locked) {
          // If file is locked, cache is not ready
          return callback(false);
        }

        // Start reading cache file
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
            // Template engine version is different, mark as no cache
            return callback(false);
          }

          // Check if each file is expired
          // If any file is expired, recompile the entire template

          const files = Object.keys(info.files || {});

          const next = (index) => {
            if (index === files.length) {
              // All files checked
              return callback(content);
            }

            const key = files[index];

            utils.getFileTime(key, (newTime) => {
              if (newTime < 0 || newTime > info.files[key]) {
                // File has been updated, mark as no cache
                return callback(false);
              }

              next(index + 1);
            });
          };

          // Start
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
          // Failed to acquire lock, handle silently
          // Because cache is not the main feature, failure does not affect template rendering
          return;
        }

        // Acquired lock, start writing file
        fs.writeFile(filename, data, () => {
          // Regardless of whether cache file is written successfully, always release lock
          // Because cache is not the main feature
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
