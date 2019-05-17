'use strict';

const fs = require('fs');

// 锁超时时间
const lockTimeout = 1000 * 60 * 5;

const getLockFile = (file) => `${file}.lock`;

// 解锁
const unlock = (file, callback) => {
  const lockfilePath = getLockFile(file);

  fs.rmdir(lockfilePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      return callback(err);
    }

    callback();
  });
};

// 上锁
const lock = (file, callback) => {
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

    if (!err) {
      // 获取到锁
      return callback(release);
    }

    // 如果错误不是锁已存在，则忽略，不调用回调函数
    if (err.code !== 'EEXIST') {
      return;
    }

    // 锁已存在的情况

    // 判断锁是不是太陈旧
    fs.stat(lockfilePath, (err, stat) => {
      if (err) {
        // 如果无法获取锁的时间，则忽略，不调用回调函数
        return;
      }

      if (Date.now() - stat.mtime.getTime() > lockTimeout) {
        // 锁太陈旧了，修改锁时间，尝试获取锁
        const current = new Date();

        fs.utimes(lockfilePath, current, current, (err) => {
          if (!err) {
            // 锁时间更新成功，获取到锁
            return callback(release);
          }
        });
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

    // 已锁
    // TODO: 需要判断一下锁是不是太陈旧？
    return callback(true);
  });
};

// 检查是否已锁（同步模式）
const isLockedSync = (file) => {
  const lockfilePath = getLockFile(file);

  // 检查锁是否存在
  try {
    fs.statSync(lockfilePath);

    // 已锁
    // TODO: 需要判断一下锁是不是太陈旧？
    return true;
  }
  catch (err) {
    // 如果锁不存在，表示未锁，否则都表示已锁
    return err.code !== 'ENOENT';
  }
};


module.exports = {
  lock,
  unlock,
  isLocked,
  isLockedSync
};
