'use strict';

const fs = require('fs');

// 锁超时时间
const lockTimeout = 1000 * 60 * 5;

const getLockFile = (file) => `${file}.lock`;

// 获取锁
const getLock = (file, callback) => {
  const lockfilePath = getLockFile(file);

  // 使用 mkdir 创建锁
  fs.mkdir(lockfilePath, (err) => {

    // 创建解锁函数
    const release = (releaseCallback) => {
      if (!releaseCallback) {
        releaseCallback = () => {};
      }

      unlock(file, releaseCallback);
    };

    callback(err, release);
  });
};

// 解锁
const unlock = (file, callback) => {
  const lockfilePath = getLockFile(file);

  fs.rm(lockfilePath, { recursive: true, force: true }, (err) => {
    if (err && err.code !== 'ENOENT') {
      return callback(err);
    }

    callback();
  });
};

// 上锁
const lock = (file, callback) => {
  // 获取锁
  getLock(file, (err, release) => {
    if (!err) {
      // 获取到锁
      return callback(null, release);
    }

    // 如果错误不是锁已存在，则返回错误
    if (err.code !== 'EEXIST') {
      return callback(err);
    }

    // 锁已存在的情况

    const lockfilePath = getLockFile(file);

    // 判断锁是不是太陈旧
    fs.stat(lockfilePath, (err, stat) => {
      if (err) {
        // 如果无法获取锁的时间，返回错误
        return callback(err);
      }

      if (Date.now() - stat.mtime.getTime() > lockTimeout) {
        // 锁太陈旧了，先解锁，再尝试获取锁

        // 先解锁
        unlock(file, (err) => {
          if (err) {
            // 解锁失败，返回错误
            return callback(err);
          }

          // 然后再次获取锁
          getLock(file, (err, release) => {
            if (!err) {
              // 获取到锁
              return callback(null, release);
            }
            else {
              // 获取锁失败
              return callback(err);
            }
          });
        });
      }
      else {
        // 锁未过期，返回锁已存在错误
        const lockedError = new Error('File is already locked');
        lockedError.code = 'ELOCKED';
        return callback(lockedError);
      }
    });
  });
};

// 检查是否已锁
const isLocked = (file, callback) => {
  const lockfilePath = getLockFile(file);

  // 检查锁是否存在
  fs.stat(lockfilePath, (err, stat) => {
    if (err) {
      // 如果锁不存在，表示未锁，否则都表示已锁
      return err.code === 'ENOENT' ? callback(false) : callback(true);
    }

    if (Date.now() - stat.mtime.getTime() > lockTimeout) {
      // 锁太陈旧了，认为未锁
      return callback(false);
    }
    else {
      // 已锁
      return callback(true);
    }
  });
};


module.exports = {
  lock,
  unlock,
  isLocked
};
