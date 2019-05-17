'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const _0777 = parseInt('0777', 8);

const getHash = (content) => crypto.createHash('md5').update(content).digest('hex');

// 转义影响正则的字符
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

module.exports = {
  getHash,
  encodeReg,
  fileExists,
  dirExists,
  mkdirp,
  getFileTime
};
