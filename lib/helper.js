'use strict';

// 辅助函数
const helpers = {
  // run wrapper
  run(func) {
    func.call(this);
  },

  // HTML escaping
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

  // Escape UI variables for use in HTML tag event function parameters like onclick
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

    return result.join(sep || '<br>');
  },

  // Check if it is Object type
  isObject(source) {
    return 'function' === typeof source || !!(source && 'object' === typeof source);
  },

  isEmptyObject(obj) {
    for (const prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
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

module.exports = helpers;
