'use strict';

const Layout = require('./lib/layout');
const helpers = require('./lib/helper');
const utils = require('./lib/utils');

const VERSION = '1.3.3';

const TEMPLATE_OUT = '__templateOut__';
const TEMPLATE_VAR_NAME = '__templateVarName__';
const TEMPLATE_SUB = '__templateSub__';
const TEMPLATE_OBJECT = '__templateObject__';
const TEMPLATE_NAME = '__templateName__';
const TEMPLATE_HELPER = '__templateHelper__';
const SUB_TEMPLATE = '__subTemplate__';
const FOREACH_INDEX = 'Index';

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
  compileFile(filename, options = {}, callback) {
    const instance = new Layout(this);

    instance.make(filename, options, (err, content) => {
      // 返回模板函数
      callback(err, this._buildTemplateFunction(content));
    });
  },

  // 渲染模板文件，支持模板继承
  renderFile(filename, data, options = {}, callback) {
    this.compileFile(filename, options, (err, func) => {
      // 返回渲染后的内容
      callback(err, func(data));
    });
  },

  _buildTemplateFunction(str) {
    let funcBody = `
      if (${SUB_TEMPLATE}) {
        ${TEMPLATE_OBJECT} = { value: ${TEMPLATE_OBJECT} };
      }
      if (${TEMPLATE_HELPER}.isObject(${TEMPLATE_OBJECT})) {
        let ${TEMPLATE_VAR_NAME} = '';
        for (var ${TEMPLATE_NAME} in ${TEMPLATE_OBJECT}) {
          ${TEMPLATE_VAR_NAME} += 'var ' + ${TEMPLATE_NAME} + ' = ${TEMPLATE_OBJECT}["' + ${TEMPLATE_NAME} + '"];';
        }
        if (${TEMPLATE_VAR_NAME} !== '') {
          eval(${TEMPLATE_VAR_NAME});
        }
        ${TEMPLATE_VAR_NAME} = null;
      }
      let ${TEMPLATE_SUB} = {};
      let ${TEMPLATE_OUT} = '${str}';
      return ${TEMPLATE_OUT};
    `;

    // console.log(funcBody.replace(/\\n/g, '\n'));

    // 删除无效指令
    funcBody = funcBody.replace(new RegExp(`${TEMPLATE_OUT}\\s*\\+?=\\s*'';`, 'g'), '');

    const func = new Function(TEMPLATE_HELPER, TEMPLATE_OBJECT, SUB_TEMPLATE, funcBody);

    return (templateObject, subTemplate) => func(helpers, templateObject, subTemplate);
  },

  //解析模板字符串
  _parse(str) {

    //取得分隔符
    const _left_ = this.leftDelimiter;
    const _right_ = this.rightDelimiter;

    //对分隔符进行转义，支持正则中的元字符，可以是HTML注释 <!  !>
    const _left = utils.encodeReg(_left_);
    const _right = utils.encodeReg(_right_);

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
        `${_left_}if/*-*/(typeof($2)!=='undefined'&&(Array.isArray($2)&&$2.length>0||${TEMPLATE_HELPER}.isObject($2)&&!${TEMPLATE_HELPER}.isEmptyObject($2))){${TEMPLATE_HELPER}.each($2,($1${FOREACH_INDEX},$1)=>{${_right_}`)

      // foreachelse指令  <% foreachelse %>
      .replace(new RegExp(_left + "\\s*?foreachelse\\s*?" + _right, "g"),
        `${_left_}})}else{${TEMPLATE_HELPER}.run(()=>{${_right_}`)

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
          `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML($1))+'`);
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
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML($1))+'`)

      //支持不转义写法 <%:=value%>和<%-value%>
      .replace(new RegExp("\\t(?::=|-)(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':$1)+'`)

      //支持url转义 <%:u=value%>
      .replace(new RegExp("\\t:u=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':encodeURIComponent($1))+'`)

      //支持UI 变量使用在HTML页面标签onclick等事件函数参数中  <%:v=value%>
      .replace(new RegExp("\\t:v=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeEventHTML($1))+'`)

      //支持迭代数组  <%:a=value|分隔符%>
      .replace(new RegExp("\\t:a=(.+?)(?:\\|(.*?))?" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.forEachArray($1,'$2'))+'`)

      //支持格式化钱数  <%:m=value%>
      .replace(new RegExp("\\t:m=(.+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null)||isNaN($1))?'':Number(Math.round(($1)*100)/100).toFixed(2))+'`)

      //字符串截取补... <%:s=value|位数%>
      .replace(new RegExp("\\t:s=(.+?)\\|(\\d+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML($1.length>$2?$1.substr(0,$2)+'...':$1))+'`)

      //HTTP协议自适应 <%:p=value%>
      .replace(new RegExp("\\t:p=(.+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML(${TEMPLATE_HELPER}.replaceUrlProtocol($1)))+'`)

      // <%:func=value%>
      .replace(new RegExp("\\t:func=(.*?)" + _right, "g"),
        `'+${TEMPLATE_HELPER}.encodeHTML($1)+'`)

      // <%:func-value%>
      .replace(new RegExp("\\t:func-(.*?)" + _right, "g"),
        `'+($1)+'`)


      // 将字符串按照 \t 分成为数组，在用'; 将其合并，即替换掉结尾的 \t 为 ';
      .split("\t").join("';")

      // 将 %> 替换为 ${TEMPLATE_OUT}+='
      // 即去掉结尾符，生成字符串拼接
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
