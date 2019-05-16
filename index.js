'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const VERSION = '1.1.6';

const TEMPLATE_OUT = '__templateOut__';
const TEMPLATE_VAR_NAME = '__templateVarName__';
const TEMPLATE_SUB = '__templateSub__';
const TEMPLATE_OBJECT = '__templateObject__';
const TEMPLATE_NAME = '__templateName__';
const TEMPLATE_HELPER = '__templateHelper__';
const SUB_TEMPLATE = '__subTemplate__';
const FOREACH_INDEX = 'Index';

const _0777 = parseInt('0777', 8);

const getHash = (content) => crypto.createHash('md5').update(content).digest('hex');

//转义影响正则的字符
const encodeReg = (source) => String(source).replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');

const fileExists = (filename) => {
  try {
    return fs.statSync(filename).isFile();
  }
  catch (e) {
    return false;
  }
};

const dirExists = (dirname) => {
  try {
    return fs.statSync(dirname).isDirectory();
  }
  catch (e) {
    return false;
  }
};

const getFileTime = (filename) => {
  try {
    return fs.statSync(filename).mtime.getTime();
  }
  catch (e) {
    return -1;
  }
};

const mkdirp = (p, opts, made) => {
  if (!opts || typeof opts !== 'object') {
    opts = { mode: opts };
  }

  let mode = opts.mode;

  if (mode === undefined) {
    mode = _0777 & (~process.umask());
  }
  if (!made) {
    made = null;
  }

  p = path.resolve(p);

  try {
    fs.mkdirSync(p, mode);
    made = made || p;
  }
  catch (err0) {
    let stat;

    switch (err0.code) {
      case 'ENOENT':
        made = mkdirp(path.dirname(p), opts, made);
        mkdirp(p, opts, made);
        break;

      // In the case of any other error, just see if there's a dir
      // there already.  If so, then hooray!  If not, then something
      // is borked.
      default:
        try {
          stat = fs.statSync(p);
        }
        catch (err1) {
          throw err0;
        }
        if (!stat.isDirectory()) {
          throw err0;
        }
        break;
    }
  }

  return made;
};


// 辅助函数
const helpers = {
  // run wrapper
  run(func) {
    func.call(this);
  },

  //HTML转义
  encodeHTML(source) {
    return String(source)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '&#92;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  replaceUrlProtocol(source) {
    return String(source).replace(/^https?:\/\/(.+?)$/i, '//$1');
  },

  //转义UI UI变量使用在HTML页面标签onclick等事件函数参数中
  encodeEventHTML(source) {
    return String(source)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\\\\/g, '\\')
      .replace(/\\\//g, '/')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');
  },

  forEachArray(source, sep = '<br>') {
    const result = [];

    if (Array.isArray(source)) {
      source.forEach((item) => {
        const tmp = String(item).trim();

        if (tmp !== '') {
          result.push(this.encodeHTML(tmp));
        }
      });
    }

    return result.join(sep);
  },

  //判断是否是 Object 类型
  isObject(source) {
    return 'function' === typeof source || !!(source && 'object' === typeof source);
  },

  isEmptyObject(obj) {
    for (const prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        return false;
      }
    }

    return true;
  },

  each(obj, callback) {
    let length, i = 0;

    if (Array.isArray(obj)) {
      length = obj.length;
      for (; i < length; i++) {
        if (callback.call(obj[i], i, obj[i]) === false) {
          break;
        }
      }
    }
    else {
      for (i in obj) {
        if (callback.call(obj[i], i, obj[i]) === false) {
          break;
        }
      }
    }

    return obj;
  }
};


// 模板布局类
class Layout {
  constructor(core) {
    this.core = core;

    this.depth = 0;

    // 存储模板文件修改时间
    this.templateTimes = {};

    // 存储已处理过的 block
    this.blocks = {};

    // 存储未处理的原始 block
    this.rawBlocks = [];

    // 存储模板内容
    this.templates = [];

    // 默认选项
    this.defaultOptions = {
      block: '',
      cache: true
    }
  }

  make(name, options = {}) {
    options = Object.assign({}, this.defaultOptions, options);

    const extName = path.extname(name);
    const block = options.block;

    if (!extName) {
      name += this.core.defaultExtName;
    }

    // 设置缓存目录
    const cachePath = this.core.cachePath || path.join(os.tmpdir(), 'changba-template-cache', getHash(this.core.basePath));

    // 设置缓存文件名
    const destFilename = path.join(cachePath, getHash(name + (block === '' ? '' : ':' + block)) + extName);

    if (options.cache) {
      // 检查是否需要重编译
      const cacheContent = this.getCache(destFilename);
      if (cacheContent !== false) {
        return cacheContent;
      }
    }

    // 先读取文件名
    const filename = path.join(this.core.basePath, name);
    // TODO: 可能需要先判断文件是否存在，并给出错误信息
    let content = fs.readFileSync(filename).toString();
    this.templateTimes[filename] = getFileTime(filename);

    const extendsName = this.getExtends(content);

    // 判断是否第一行是否有 extends 指令
    if (extendsName) {
      // 有 extends 指令，表示需要解析父模板
      this.parseParent(extendsName, content, filename);
      // 处理模板
      content = this.processParent(content);
    }

    content = this.removeCommand(content);

    let result = `'/* changba template engine v${this.core.version}\n${JSON.stringify(this.templateTimes)}\n*/+'`;

    // 写入文件
    if (block !== '') {
      // 支持直接获取 block 内容
      result += this.blocks[block] ? this.blocks[block] : `Block ${block} not found!`;
    }
    else {
      result += this.core._parse(content);
    }

    this.writeFile(destFilename, result);

    return result;
  }

  // 解析父模板
  parseParent(name, subContent, subFilename) {
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

    const content = fs.readFileSync(filename).toString();
    this.templateTimes[filename] = getFileTime(filename);

    // 模板内容入栈，等待后续处理
    this.templates.push(content);

    // 获取父模板名称
    const extendsName = this.getExtends(content);

    if (extendsName) {
      // 有 extends 指令，表示需要加载父模板
      this.parseParent(extendsName, content, filename);
    }

    // 合并每一级的 block 信息，备用
    this.rawBlocks.push(this.getBlocks(content));

    this.depth--;

    if (this.depth === 0) {
      // 如果解析到最末一级，则合并最末一级模板的 block 内容
      // 此处需要特殊处理，否则会丢掉最末一级模板的 block 内容
      this.rawBlocks.push(this.getBlocks(subContent));
    }
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

  // 获取缓存数据
  getCache(filename) {
    if (!fileExists(filename)) {
      return false;
    }

    try {
      const content = fs.readFileSync(filename).toString();
      const contents = content.split(/\n/);
      const templates = JSON.parse(contents[1] || '{}');

      // 检查每个文件是否过期
      // 只要有一个文件过期则重编译整个模板
      for (const key in templates) {
        const value = templates[key];

        const newTime = getFileTime(key);
        if (newTime < 0 || newTime > value) {
          // 文件有更新，标记为无缓存
          return false;
        }
      }

      return content;
    }
    catch (e) {
      return false;
    }
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

        blocks[param[0]] = match[3];
      }
    }

    return blocks;
  }

  writeFile(filename, data) {
    const dir = path.dirname(filename);

    if (!dirExists(dir)) {
      mkdirp(dir);
    }

    try {
      fs.writeFileSync(filename, data);
    }
    catch (e) {
    }
  }

  removeCommand(content) {
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

  commandParent(content, parentContent) {
    const pattern = this.createOpenMatcher('parent');

    return content.replace(pattern, parentContent);
  }

  commandChild(content, parentContent) {
    const pattern = this.createOpenMatcher('child');

    if (parentContent.match(pattern)) {
      content = parentContent.replace(pattern, content);
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
        slots[match[2]] = match[3];
      }
      else {
        defaultSlot = match[3];
      }
    }

    // 获取清理了 slot 指令的内容
    const plainContent = content.replace(pattern, '');

    content = parentContent.replace(pattern, (match, p1, p2, p3) => {
      if (!p2) {
        return typeof defaultSlot !== 'undefined' ? defaultSlot : plainContent;
      }
      else {
        return typeof slots[p2] !== 'undefined' ? slots[p2] : p3;
      }
    });

    return content;
  }

  commandUse(content, currentBlocks) {
    const pattern = this.createOpenMatcher('use');
    const patternSlot = this.createMatcher('slot');

    content = content.replace(pattern, (p0, p1, p2) => {
      const params = p2.split(/\s+/, 2);
      const name = params[0];
      const other = params.splice(1).join(' ');

      if (!currentBlocks[name]) {
        return '';
      }

      const blocks = {};
      let match = null;
      const paramsPattern = /(\S+?)="(.*?)"/g;

      while ((match = paramsPattern.exec(other)) !== null) {
        blocks[match[1]] = match[2];
      }

      return currentBlocks[name].replace(patternSlot, (match, p1, p2, p3) => {
        return blocks[p2] ? blocks[p2] : p3;
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
        blocks[match[1]] = match[2];
      }

      while ((match = patternSlot.exec(p3)) !== null) {
        blocks[match[2]] = match[3];
      }

      return currentBlocks[name].replace(patternSlot, (match, slotP1, slotP2, slotP3) => {
        if (slotP2 == '') {
          return this.removeCommandWithContent('slot', p3);
        }
        else {
          return blocks[slotP2] ? blocks[slotP2] : slotP3;
        }
      });
    });

    return content;
  }

  createMatcher(keyword, noParam = false) {
    return new RegExp(encodeReg(this.core.leftDelimiter) + '\\s*(' + keyword + ')' + (noParam ? '' : '(?:\\s+([^' + encodeReg(this.core.rightDelimiter) + ']+?)|\\s*)') + '\\s*' + encodeReg(this.core.rightDelimiter)
      + '(?:\\r?\\n)?([\\s\\S]*?)' + encodeReg(this.core.leftDelimiter) + '\\s*/' + keyword + '\\s*' + encodeReg(this.core.rightDelimiter) + '(?:\\r?\\n)?', 'g');
  }

  createOpenMatcher(keyword) {
    return new RegExp(encodeReg(this.core.leftDelimiter) + '\\s*(' + keyword + ')(?:\\s+([^' + encodeReg(this.core.rightDelimiter) + ']+?)|\\s*)\\s*' + encodeReg(this.core.rightDelimiter) + '(?:\\r?\\n)?', 'g');
  }

  createPlainMatcher(keyword) {
    return new RegExp('(' + encodeReg(this.core.leftDelimiter) + '\\s*(' + keyword + ')(?:\\s+([^' + encodeReg(this.core.rightDelimiter) + ']+?)|\\s*)\\s*' + encodeReg(this.core.rightDelimiter)
      + '(?:\\r?\\n)?)([\\s\\S]*?)(' + encodeReg(this.core.leftDelimiter) + '\\s*/' + keyword + '\\s*' + encodeReg(this.core.rightDelimiter) + '(?:\\r?\\n)?)', 'g');
  }
};


const core = {

  //标记当前版本
  version: VERSION,

  //自定义分隔符，可以含有正则中的字符，可以是HTML注释开头 <! !>
  leftDelimiter: '<%',
  rightDelimiter: '%>',

  //自定义默认是否转义，默认为自动转义
  escape: true,

  basePath: '',
  cachePath: '',

  defaultExtName: '.html',

  //编译模板
  compile(str) {
    // 返回模板函数
    return this._buildTemplateFunction(this._parse(str));
  },

  // 渲染模板函数
  render(str, data, subTemplate) {
    // 返回渲染后的内容
    return this.compile(str)(data, subTemplate);
  },

  // 编译模板文件，支持模板继承
  compileFile(filename, options = {}) {
    const instance = new Layout(this);
    const content = instance.make(filename, options);

    // 返回模板函数
    return this._buildTemplateFunction(content);
  },

  // 渲染模板文件，支持模板继承
  renderFile(filename, data, options = {}) {
    // 返回渲染后的内容
    return this.compileFile(filename, options)(data);
  },

  _buildTemplateFunction(str) {
    let funcBody = `
      var ${TEMPLATE_OUT} = '';
      if (${SUB_TEMPLATE}) {
        ${TEMPLATE_OBJECT} = { value: ${TEMPLATE_OBJECT} };
      }
      var ${TEMPLATE_VAR_NAME} = '';
      if (typeof ${TEMPLATE_OBJECT} === 'function' || !!(${TEMPLATE_OBJECT} && typeof ${TEMPLATE_OBJECT} === 'object')) {
        for (var ${TEMPLATE_NAME} in ${TEMPLATE_OBJECT}) {
          ${TEMPLATE_VAR_NAME} += 'var ' + ${TEMPLATE_NAME} + ' = ${TEMPLATE_OBJECT}["' + ${TEMPLATE_NAME} + '"];';
        }
      }
      eval(${TEMPLATE_VAR_NAME});
      ${TEMPLATE_VAR_NAME} = null;
      var cbTemplate = ${TEMPLATE_HELPER};
      var ${TEMPLATE_SUB} = {};
      ${TEMPLATE_OUT} += '${str}';
      return ${TEMPLATE_OUT};
    `;

    // console.log(funcBody.replace(/\\n/g, '\n'));

    // 删除无效指令
    funcBody = funcBody.replace(new RegExp(`${TEMPLATE_OUT}\\s*\\+=\\s*'';`, 'g'), '');

    const func = new Function(TEMPLATE_HELPER, TEMPLATE_OBJECT, SUB_TEMPLATE, funcBody);

    return (templateObject, subTemplate) => func(helpers, templateObject, subTemplate);
  },

  //解析模板字符串
  _parse(str) {

    //取得分隔符
    const _left_ = this.leftDelimiter;
    const _right_ = this.rightDelimiter;

    //对分隔符进行转义，支持正则中的元字符，可以是HTML注释 <!  !>
    const _left = encodeReg(_left_);
    const _right = encodeReg(_right_);

    str = String(str)

      //去掉分隔符中js注释
      .replace(new RegExp("(" + _left + "[^" + _right + "]*)//.*\n", "g"), "$1")

      //默认支持HTML注释，将HTML注释匹配掉的原因是用户有可能用 <! !>来做分割符
      //.replace(/<!--[\s\S]*?-->/g, '')
      //去掉注释内容  <%* 这里可以任意的注释 *%>
      .replace(new RegExp(_left + '\\*[\\s\\S]*?\\*' + _right, 'gm'), '')

      //用来处理非分隔符内部的内容中含有 斜杠 \ 单引号 ‘ ，处理办法为HTML转义
      .replace(new RegExp(_left + "(?:(?!" + _right + ")[\\s\\S])*" + _right + "|((?:(?!" + _left + ")[\\s\\S])+)", "g"), (item, $1) => {
        let str = '';
        if ($1) {
          //将 斜杠 单引 HTML转义
          str = $1.replace(/\\/g, "&#92;").replace(/'/g, '&#39;');
          while (/<[^<]*?&#39;[^<]*?>/g.test(str)) {
            //将标签内的单引号转义为\r  结合最后一步，替换为\'
            str = str.replace(/(<[^<]*?)&#39;([^<]*?>)/g, '$1\r$2');
          };
        }
        else {
          str = item;
        }

        return str;
      })

      //把所有换行去掉  \r回车符 \t制表符 \n换行符
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n');


    str = str
      //定义变量，如果没有分号，需要容错  <%let val='test'%>
      .replace(new RegExp("(" + _left + "\\s*?let\\s*?.+?\\s*?[^;])\\s*?" + _right, "g"),
        `$1;${_right_}`)

      //对变量后面的分号做容错(包括转义模式 如<%:h=value%>)  <%=value;%> 排除掉函数的情况 <%fun1();%> 排除定义变量情况  <%var val='test';%>
      .replace(new RegExp("(" + _left + ":?[hvu]?\\s*?=\\s*?[^;|" + _right + "]*?);\\s*?" + _right, "g"),
        `$1${_right_}`)

      // foreach循环  <% foreach (x in arr) %>
      .replace(new RegExp(_left + "\\s*?foreach\\s*?\\((.+?)\\s+in\\s+(.+?)\\)\\s*?" + _right, "g"),
        `${_left_}if/*-*/(typeof($2)!=='undefined'&&(Array.isArray($2)&&$2.length>0||cbTemplate.isObject($2)&&!cbTemplate.isEmptyObject($2))){cbTemplate.each($2,($1${FOREACH_INDEX},$1)=>{${_right_}`)

      // foreachelse指令  <% foreachelse %>
      .replace(new RegExp(_left + "\\s*?foreachelse\\s*?" + _right, "g"),
        `${_left_}})}else{cbTemplate.run(()=>{${_right_}`)

      // foreachbreak指令  <% foreachbreak %>
      .replace(new RegExp(_left + "\\s*?foreachbreak\\s*?" + _right, "g"),
        `${_left_}return false;${_right_}`)

      // foreach循环结束  <% /foreach %>
      .replace(new RegExp(_left + "\\s*?/foreach\\s*?" + _right, "g"),
        `${_left_}})}${_right_}`)

      // if 指令 <% if (x == 1) %>
      .replace(new RegExp(_left + "\\s*?if\\s*?\\((.+?)\\)\\s*?" + _right, "g"),
        `${_left_}if($1){${_right_}`)

      // elseif 指令 <% elseif (x == 1) %>
      .replace(new RegExp(_left + "\\s*?else\\s*?if\\s*?\\((.+?)\\)\\s*?" + _right, "g"),
        `${_left_}}else if($1){${_right_}`)

      // else 指令 <% else %>
      .replace(new RegExp(_left + "\\s*?else\\s*?" + _right, "g"),
        `${_left_}}else{${_right_}`)

      // if 指令结束 <% /if %>
      .replace(new RegExp(_left + "\\s*?/if\\s*?" + _right, "g"),
        `${_left_}}${_right_}`)

    // 注意：必须在原生指令编译完毕再编译其他指令

      // 定义子模板 <% define value(param) %>
      .replace(new RegExp(_left + "\\s*?define\\s+?([a-z0-9_$]+?)\\s*?\\((.*?)\\)\\s*?" + _right, "g"),
        `${_left_}${TEMPLATE_SUB}['$1']=($2)=>{${_right_}`)

      // 在最后子模板结束的位置增加直接调用子模板的代码！
      .replace(new RegExp(_left + "\\s*?/define\\s*?(?![\\s\\S]*\\s*?/define\\s*?)" + _right, "g"),
        `${_left_} /define ${_right_}${_left_}if(${SUB_TEMPLATE}){${TEMPLATE_OUT}='';if(${TEMPLATE_SUB}[${SUB_TEMPLATE}]){${TEMPLATE_SUB}[${SUB_TEMPLATE}](value)}${TEMPLATE_VAR_NAME}=null;return}${_right_}`)

      // 定义子模板结束 <% /define %>
      .replace(new RegExp(_left + "\\s*?/define\\s*?" + _right, "g"),
        `${_left_}};${_right_}`)

      // 调用子模板 <% run value() %>
      .replace(new RegExp(_left + "\\s*?run\\s+?([a-zA-Z0-9_$]+?)\\s*?\\((.*?)\\)\\s*?" + _right, "g"),
        `${_left_}if(${TEMPLATE_SUB}['$1']){${TEMPLATE_SUB}['$1']($2)}${_right_}`)


      //按照 <% 分割为一个个数组，再用 \t 和在一起，相当于将 <% 替换为 \t
      //将模板按照<%分为一段一段的，再在每段的结尾加入 \t,即用 \t 将每个模板片段前面分隔开
      .split(_left_).join("\t");

    //支持用户配置默认是否自动转义
    if (this.escape) {
      str = str

        //找到 \t=任意一个字符%> 替换为 ‘，任意字符,'
        //即替换简单变量  \t=data%> 替换为 ',data,'
        //默认HTML转义  也支持HTML转义写法<%:h=value%>
        .replace(new RegExp("\\t=(.*?)" + _right, "g"),
          `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':cbTemplate.encodeHTML($1))+'`);
    }
    else {
      str = str

        //默认不转义HTML转义
        .replace(new RegExp("\\t=(.*?)" + _right, "g"),
          `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':$1)+'`);
    };

    str = str

      //支持HTML转义写法<%:h=value%>
      .replace(new RegExp("\\t:h=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':cbTemplate.encodeHTML($1))+'`)

      //支持不转义写法 <%:=value%>和<%-value%>
      .replace(new RegExp("\\t(?::=|-)(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':$1)+'`)

      //支持url转义 <%:u=value%>
      .replace(new RegExp("\\t:u=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':encodeURIComponent($1))+'`)

      //支持UI 变量使用在HTML页面标签onclick等事件函数参数中  <%:v=value%>
      .replace(new RegExp("\\t:v=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':cbTemplate.encodeEventHTML($1))+'`)

      //支持迭代数组  <%:a=value|分隔符%>
      .replace(new RegExp("\\t:a=(.+?)(?:\\|(.*?))?" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':cbTemplate.forEachArray($1,'$2'))+'`)

      //支持格式化钱数  <%:m=value%>
      .replace(new RegExp("\\t:m=(.+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null)||isNaN($1))?'':Number(Math.round(($1)*100)/100).toFixed(2))+'`)

      //字符串截取补... <%:s=value|位数%>
      .replace(new RegExp("\\t:s=(.+?)\\|(\\d+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':cbTemplate.encodeHTML($1.length>$2?$1.substr(0,$2)+'...':$1))+'`)

      //HTTP协议自适应 <%:p=value%>
      .replace(new RegExp("\\t:p=(.+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':cbTemplate.encodeHTML(cbTemplate.replaceUrlProtocol($1)))+'`)

      // <%:func=value%>
      .replace(new RegExp("\\t:func=(.*?)" + _right, "g"),
        `'+cbTemplate.encodeHTML($1)+'`)

      // <%:func-value%>
      .replace(new RegExp("\\t:func-(.*?)" + _right, "g"),
        `'+($1)+'`)


      //将字符串按照 \t 分成为数组，在用'); 将其合并，即替换掉结尾的 \t 为 ');
      //在if，for等语句前面加上 '); ，形成 ');if  ');for  的形式
      .split("\t").join("';")

      //将 %> 替换为 _template_out+='
      //即去掉结尾符，生成字符串拼接
      //如：if(list.length=5){%><h2>',list[4],'</h2>');}
      //会被替换为 if(list.length=5){_template_out+='<h2>'+list[4]+'</h2>';}
      .split(_right_).join(`${TEMPLATE_OUT}+='`);

    //console.log(str);

    return str;
  }

};


module.exports = Object.assign({
  getInstance() {
    return Object.assign({}, core);
  }
}, core);
