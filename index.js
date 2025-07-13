'use strict';

const Layout = require('./lib/layout');
const helpers = require('./lib/helper');
const utils = require('./lib/utils');

const VERSION = '1.3.8';

const TEMPLATE_OUT = '__templateOut__';
const TEMPLATE_VAR_NAME = '__templateVarName__';
const TEMPLATE_SUB = '__templateSub__';
const TEMPLATE_OBJECT = '__templateObject__';
const TEMPLATE_NAME = '__templateName__';
const TEMPLATE_HELPER = '__templateHelper__';
const SUB_TEMPLATE = '__subTemplate__';
const FOREACH_INDEX = 'Index';

const core = {

  // Mark current version
  version: VERSION,

  // Custom delimiters, can contain regex metacharacters, can be HTML comment tags <! !>
  leftDelimiter: '<%',
  rightDelimiter: '%>',

  // Custom default escaping behavior, defaults to auto-escape
  escape: true,

  basePath: '',
  cachePath: '',

  defaultExtName: '.html',

  // Compile template
  compile(str) {
    // Return template function
    return this._buildTemplateFunction(this._parse(str));
  },

  // Render template function
  render(str, data, subTemplate) {
    // Return rendered content
    return this.compile(str)(data, subTemplate);
  },

  // Compile template file with inheritance support
  compileFile(filename, options = {}, callback) {
    // Handle parameter overloading: check actual number of arguments
    if (arguments.length === 2) {
      callback = options;
      options = {};
    }

    const instance = new Layout(this);

    instance.make(filename, options, (err, content) => {
      // Return template function
      callback(err, this._buildTemplateFunction(content));
    });
  },

  // Render template file with inheritance support
  renderFile(filename, data, options = {}, callback) {
    // Handle parameter overloading: check actual number of arguments
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }

    this.compileFile(filename, options, (err, func) => {
      // Return rendered content
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
      let ${TEMPLATE_OUT} /* init */ = '${str}';
      return ${TEMPLATE_OUT};
    `;

    // Remove invalid directives
    funcBody = funcBody.replace(new RegExp(`${TEMPLATE_OUT}\\s*\\+?=\\s*'';`, 'g'), '');

    // console.log(funcBody.replace(/\\n/g, '\n'));

    const func = new Function(TEMPLATE_HELPER, TEMPLATE_OBJECT, SUB_TEMPLATE, funcBody);

    return (templateObject, subTemplate) => func(helpers, templateObject, subTemplate);
  },

  // Parse template string
  _parse(str) {

    // Get delimiters
    const _left_ = this.leftDelimiter;
    const _right_ = this.rightDelimiter;

    // Escape delimiters, support regex metacharacters, can be HTML comments <!  !>
    const _left = utils.encodeReg(_left_);
    const _right = utils.encodeReg(_right_);

    str = String(str)

      // Remove JS comments within delimiters
      .replace(new RegExp("(" + _left + "[^" + _right + "]*)//.*\n", "g"), "$1")

      // Default support for HTML comments, removing them because users might use <! !> as delimiters
      //.replace(/<!--[\s\S]*?-->/g, '')
      // Remove comment content  <%* arbitrary comments here *%>
      .replace(new RegExp(_left + '\\*[\\s\\S]*?\\*' + _right, 'gm'), '')

      // Handle content outside delimiters containing backslashes \ and single quotes '
      .replace(new RegExp(_left + "(?:(?!" + _right + ")[\\s\\S])*" + _right + "|((?:(?!" + _left + ")[\\s\\S])+)", "g"), (item, $1) => {
        let str = '';
        if ($1) {
          // Escape backslashes and single quotes
          str = $1.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        }
        else {
          str = item;
        }

        return str;
      })

      // Remove all line breaks  \r carriage return \t tab \n newline
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n');


    str = str
      // Define variables, add semicolon if missing for error tolerance  <%let val='test'%>
      .replace(new RegExp("(" + _left + "\\s*?let\\s*?.+?\\s*?[^;])\\s*?" + _right, "g"),
        `$1;${_right_}`)

      // Handle trailing semicolons for variables (including escape modes like <%:h=value%>)  <%=value;%> exclude function calls <%fun1();%> exclude variable definitions  <%var val='test';%>
      .replace(new RegExp("(" + _left + ":?[hvu]?\\s*?=\\s*?[^;|" + _right + "]*?);\\s*?" + _right, "g"),
        `$1${_right_}`)

      // foreach loop  <% foreach (x in arr) %>
      .replace(new RegExp(_left + "\\s*?foreach\\s*?\\((.+?)\\s+in\\s+(.+?)\\)\\s*?" + _right, "g"),
        `${_left_}if/*-*/(typeof($2)!=='undefined'&&(Array.isArray($2)&&$2.length>0||${TEMPLATE_HELPER}.isObject($2)&&!${TEMPLATE_HELPER}.isEmptyObject($2))){${TEMPLATE_HELPER}.each($2,($1${FOREACH_INDEX},$1)=>{${_right_}`)

      // foreachelse directive  <% foreachelse %>
      .replace(new RegExp(_left + "\\s*?foreachelse\\s*?" + _right, "g"),
        `${_left_}})}else{${TEMPLATE_HELPER}.run(()=>{${_right_}`)

      // foreachbreak directive  <% foreachbreak %>
      .replace(new RegExp(_left + "\\s*?foreachbreak\\s*?" + _right, "g"),
        `${_left_}return false;${_right_}`)

      // foreach loop end  <% /foreach %>
      .replace(new RegExp(_left + "\\s*?/foreach\\s*?" + _right, "g"),
        `${_left_}})}${_right_}`)

      // if directive <% if (x == 1) %>
      .replace(new RegExp(_left + "\\s*?if\\s*?\\((.+?)\\)\\s*?" + _right, "g"),
        `${_left_}if($1){${_right_}`)

      // elseif directive <% elseif (x == 1) %>
      .replace(new RegExp(_left + "\\s*?else\\s*?if\\s*?\\((.+?)\\)\\s*?" + _right, "g"),
        `${_left_}}else if($1){${_right_}`)

      // else directive <% else %>
      .replace(new RegExp(_left + "\\s*?else\\s*?" + _right, "g"),
        `${_left_}}else{${_right_}`)

      // if directive end <% /if %>
      .replace(new RegExp(_left + "\\s*?/if\\s*?" + _right, "g"),
        `${_left_}}${_right_}`)

    // Note: must compile other directives after native directives are compiled

      // Define sub-template <% define value(param) %>
      .replace(new RegExp(_left + "\\s*?define\\s+?([a-z0-9_$]+?)\\s*?\\((.*?)\\)\\s*?" + _right, "g"),
        `${_left_}${TEMPLATE_SUB}['$1']=($2)=>{${_right_}`)

      // Add direct sub-template invocation code at the end of the last sub-template!
      .replace(new RegExp(_left + "\\s*?/define\\s*?(?![\\s\\S]*\\s*?/define\\s*?)" + _right, "g"),
        `${_left_} /define ${_right_}${_left_}if(${SUB_TEMPLATE}){${TEMPLATE_OUT}='';if(${TEMPLATE_SUB}[${SUB_TEMPLATE}]){${TEMPLATE_SUB}[${SUB_TEMPLATE}](value)}${TEMPLATE_VAR_NAME}=null;return}${_right_}`)

      // Define sub-template end <% /define %>
      .replace(new RegExp(_left + "\\s*?/define\\s*?" + _right, "g"),
        `${_left_}};${_right_}`)

      // Call sub-template <% run value() %>
      .replace(new RegExp(_left + "\\s*?run\\s+?([a-zA-Z0-9_$]+?)\\s*?\\((.*?)\\)\\s*?" + _right, "g"),
        `${_left_}if(${TEMPLATE_SUB}['$1']){${TEMPLATE_SUB}['$1']($2)}${_right_}`)


      // Split by <% into arrays, then join with \t, equivalent to replacing <% with \t
      // Split template by <% into segments, add \t at the end of each segment, i.e., use \t to separate each template fragment
      .split(_left_).join("\t");

    // Support user configuration for default auto-escaping
    if (this.escape) {
      str = str

        // Find \t=any character%> replace with ',any character,'
        // Replace simple variables  \t=data%> replace with ',data,'
        // Default HTML escaping  also supports HTML escape syntax <%:h=value%>
        .replace(new RegExp("\\t=(.*?)" + _right, "g"),
          `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML($1))+'`);
    }
    else {
      str = str

        // Default no HTML escaping
        .replace(new RegExp("\\t=(.*?)" + _right, "g"),
          `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':$1)+'`);
    };

    str = str

      // Support HTML escape syntax <%:h=value%>
      .replace(new RegExp("\\t:h=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML($1))+'`)

      // Support non-escape syntax <%:=value%> and <%-value%>
      .replace(new RegExp("\\t(?::=|-)(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':$1)+'`)

      // Support URL escaping <%:u=value%>
      .replace(new RegExp("\\t:u=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':encodeURIComponent($1))+'`)

      // Support UI variables in HTML tag event function parameters like onclick  <%:v=value%>
      .replace(new RegExp("\\t:v=(.*?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeEventHTML($1))+'`)

      // Support array iteration  <%:a=value|separator%>
      .replace(new RegExp("\\t:a=(.+?)(?:\\|(.*?))?" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.forEachArray($1,'$2'))+'`)

      // Support money formatting  <%:m=value%>
      .replace(new RegExp("\\t:m=(.+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null)||isNaN($1))?'':Number(Math.round(($1)*100)/100).toFixed(2))+'`)

      // String truncation with ellipsis <%:s=value|length%>
      .replace(new RegExp("\\t:s=(.+?)\\|(\\d+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML($1.length>$2?$1.substr(0,$2)+'...':$1))+'`)

      // HTTP protocol auto-adaptation <%:p=value%>
      .replace(new RegExp("\\t:p=(.+?)" + _right, "g"),
        `'+((typeof($1)==='undefined'||(typeof($1)==='object'&&$1===null))?'':${TEMPLATE_HELPER}.encodeHTML(${TEMPLATE_HELPER}.replaceUrlProtocol($1)))+'`)

      // <%:func=value%>
      .replace(new RegExp("\\t:func=(.*?)" + _right, "g"),
        `'+${TEMPLATE_HELPER}.encodeHTML($1)+'`)

      // <%:func-value%>
      .replace(new RegExp("\\t:func-(.*?)" + _right, "g"),
        `'+($1)+'`)


      // Split string by \t into arrays, then join with '; to replace trailing \t with ';'
      .split("\t").join("';")

      // Replace %> with ${TEMPLATE_OUT}+='
      // Remove closing delimiter and generate string concatenation
      .split(_right_).join(`${TEMPLATE_OUT}+='`);

    // console.log(str);

    return str;
  }

};


module.exports = Object.assign({
  getInstance() {
    return Object.assign({}, core);
  }
}, core);
