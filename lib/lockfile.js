'use strict';

const fs = require('fs');

// Lock timeout duration
const lockTimeout = 1000 * 60 * 5;

const getLockFile = (file) => `${file}.lock`;

// Acquire lock
const getLock = (file, callback) => {
  const lockfilePath = getLockFile(file);

  // Use mkdir to create lock
  fs.mkdir(lockfilePath, (err) => {

    // Create unlock function
    const release = (releaseCallback) => {
      if (!releaseCallback) {
        releaseCallback = () => {};
      }

      unlock(file, releaseCallback);
    };

    callback(err, release);
  });
};

// Unlock
const unlock = (file, callback) => {
  const lockfilePath = getLockFile(file);

  fs.rm(lockfilePath, { recursive: true, force: true }, (err) => {
    if (err && err.code !== 'ENOENT') {
      return callback(err);
    }

    callback();
  });
};

// Lock
const lock = (file, callback) => {
  // Acquire lock
  getLock(file, (err, release) => {
    if (!err) {
      // Lock acquired
      return callback(null, release);
    }

    // If error is not lock already exists, return error
    if (err.code !== 'EEXIST') {
      return callback(err);
    }

    // Lock already exists case

    const lockfilePath = getLockFile(file);

    // Check if lock is too stale
    fs.stat(lockfilePath, (err, stat) => {
      if (err) {
        // If unable to get lock time, return error
        return callback(err);
      }

      if (Date.now() - stat.mtime.getTime() > lockTimeout) {
        // Lock is too stale, unlock first then try to acquire lock

        // Unlock first
        unlock(file, (err) => {
          if (err) {
            // Unlock failed, return error
            return callback(err);
          }

          // Then try to acquire lock again
          getLock(file, (err, release) => {
            if (!err) {
              // Lock acquired
              return callback(null, release);
            }
            else {
              // Failed to acquire lock
              return callback(err);
            }
          });
        });
      }
      else {
        // Lock has not expired, return lock already exists error
        const lockedError = new Error('File is already locked');
        lockedError.code = 'ELOCKED';
        return callback(lockedError);
      }
    });
  });
};

// Check if already locked
const isLocked = (file, callback) => {
  const lockfilePath = getLockFile(file);

  // Check if lock exists
  fs.stat(lockfilePath, (err, stat) => {
    if (err) {
      // If lock does not exist, indicates unlocked, otherwise all indicate locked
      return err.code === 'ENOENT' ? callback(false) : callback(true);
    }

    if (Date.now() - stat.mtime.getTime() > lockTimeout) {
      // Lock is too stale, consider unlocked
      return callback(false);
    }
    else {
      // Locked
      return callback(true);
    }
  });
};


module.exports = {
  lock,
  unlock,
  isLocked
};
