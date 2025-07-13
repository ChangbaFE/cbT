import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const _0777 = parseInt('0777', 8);

const getHash = (content) => crypto.createHash('md5').update(content).digest('hex');

// Escape characters that affect regex
const encodeReg = (source) => String(source).replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');

const fileExists = (filename, callback) => {
  fs.stat(filename, (err, stats) => {
    if (err) {
      return callback(false);
    }

    return callback(stats.isFile());
  });
};

const dirExists = (dirname, callback) => {
  fs.stat(dirname, (err, stats) => {
    if (err) {
      return callback(false);
    }

    callback(stats.isDirectory());
  });
};

const getFileTime = (filename, callback) => {
  fs.stat(filename, (err, stats) => {
    if (err) {
      return callback(-1);
    }

    callback(stats.mtime.getTime());
  });
};

const mkdirp = (p, callback, opts, made) => {
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

  fs.mkdir(p, mode, (err0) => {
    if (err0) {
      switch (err0.code) {
        case 'ENOENT':
          mkdirp(path.dirname(p), (result) => {
            made = result;
            mkdirp(p, () => callback(made), opts, made);
          }, opts, made);
          break;

        // In the case of any other error, just see if there's a dir
        // there already.  If so, then hooray!  If not, then something
        // is borked.
        default:
          fs.stat(p, (err1, stat) => {
            if (err1) {
              throw err0;
            }

            if (!stat.isDirectory()) {
              throw err0;
            }
          });

          break;
      }
    }
    else {
      made = made || p;

      callback(made);
    }
  });
};

export {
  getHash,
  encodeReg,
  fileExists,
  dirExists,
  mkdirp,
  getFileTime
};
