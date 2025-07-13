'use strict';

const lockfile = require('../lib/lockfile');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('lockfile.js', () => {
  let testFile;
  let lockDir;
  let testDir;

  beforeEach(() => {
    // 创建测试文件路径
    testDir = path.join(os.tmpdir(), 'cbt-lockfile-test-' + Date.now() + '-' + Math.random());
    fs.mkdirSync(testDir, { recursive: true });
    testFile = path.join(testDir, 'test.txt');
    lockDir = testFile + '.lock';
  });

  afterEach((done) => {
    // 清理测试锁目录和测试目录
    fs.rm(lockDir, { recursive: true, force: true }, () => {
      fs.rmSync(testDir, { recursive: true, force: true });
      done();
    });
  });

  describe('lock', () => {
    test('should acquire lock and provide release function', (done) => {
      lockfile.lock(testFile, (err, release) => {
        expect(err).toBeNull();
        expect(typeof release).toBe('function');

        // 检查锁目录是否存在
        fs.stat(lockDir, (err, stats) => {
          expect(err).toBeNull();
          expect(stats.isDirectory()).toBe(true);

          // 释放锁
          release(() => {
            // 检查锁目录是否已删除
            fs.stat(lockDir, (err) => {
              expect(err.code).toBe('ENOENT');
              done();
            });
          });
        });
      });
    });

    test('should not acquire lock if already locked', (done) => {
      // 第一次获取锁
      lockfile.lock(testFile, (err1, release1) => {
        expect(err1).toBeNull();

        let secondLockCalled = false;

        // 尝试第二次获取锁（应该失败）
        lockfile.lock(testFile, (err2) => {
          secondLockCalled = true;
          expect(err2).toBeTruthy();
          expect(err2.code).toBe('ELOCKED');
        });

        // 等待一段时间确认第二次获取锁被调用
        setTimeout(() => {
          expect(secondLockCalled).toBe(true);

          // 释放第一个锁
          release1(() => {
            done();
          });
        }, 100);
      });
    });

    test('should handle stale locks', (done) => {
      // 手动创建一个过期的锁目录
      fs.mkdir(lockDir, (err) => {
        if (err && err.code !== 'EEXIST') {
          return done(err);
        }

        // 修改锁目录的时间为6分钟前（超过5分钟超时时间）
        const oldTime = new Date(Date.now() - 6 * 60 * 1000);
        fs.utimes(lockDir, oldTime, oldTime, () => {

          // 现在应该能够获取锁
          lockfile.lock(testFile, (err, release) => {
            expect(err).toBeNull();
            expect(typeof release).toBe('function');

            release(() => {
              done();
            });
          });
        });
      });
    });

    test('should handle release function without callback', (done) => {
      lockfile.lock(testFile, (err, release) => {
        expect(err).toBeNull();
        expect(typeof release).toBe('function');

        // Test release without callback parameter - this should cover the if (!releaseCallback) branch
        release();

        // Give it a moment to complete the unlock operation
        setTimeout(() => {
          // Verify the lock was released by checking if we can acquire it again
          lockfile.lock(testFile, (err2, release2) => {
            expect(err2).toBeNull();
            release2(() => {
              done();
            });
          });
        }, 50);
      });
    });
  });

  describe('unlock', () => {
    test('should remove lock directory', (done) => {
      // 先创建锁
      fs.mkdir(lockDir, () => {
        lockfile.unlock(testFile, (err) => {
          expect(err).toBeUndefined();

          // 检查锁目录是否已删除
          fs.stat(lockDir, (err) => {
            expect(err.code).toBe('ENOENT');
            done();
          });
        });
      });
    });

    test('should handle non-existent lock gracefully', (done) => {
      lockfile.unlock(testFile, (err) => {
        expect(err).toBeUndefined();
        done();
      });
    });
  });

  describe('isLocked', () => {
    test('should return true if locked', (done) => {
      lockfile.lock(testFile, (err, release) => {
        expect(err).toBeNull();

        lockfile.isLocked(testFile, (locked) => {
          expect(locked).toBe(true);

          release(() => {
            done();
          });
        });
      });
    });

    test('should return false if not locked', (done) => {
      lockfile.isLocked(testFile, (locked) => {
        expect(locked).toBe(false);
        done();
      });
    });

    test('should return false for stale locks', (done) => {
      // 手动创建一个过期的锁目录
      fs.mkdir(lockDir, (err) => {
        if (err && err.code !== 'EEXIST') {
          return done(err);
        }

        // 修改锁目录的时间为6分钟前
        const oldTime = new Date(Date.now() - 6 * 60 * 1000);
        fs.utimes(lockDir, oldTime, oldTime, () => {

          lockfile.isLocked(testFile, (locked) => {
            expect(locked).toBe(false);
            done();
          });
        });
      });
    });

    test('should return true for error cases other than ENOENT', (done) => {
      // 创建一个锁文件而不是目录（模拟错误情况）
      const lockFile = lockDir;
      fs.writeFile(lockFile, 'lock', () => {
        lockfile.isLocked(testFile, (locked) => {
          expect(locked).toBe(true);

          // 清理
          fs.unlink(lockFile, () => {
            done();
          });
        });
      });
    });

    test('should return true for stat errors other than ENOENT', (done) => {
      // Mock fs.stat to simulate a different error
      const originalStat = fs.stat;

      fs.stat = (path, callback) => {
        if (path.endsWith('.lock')) {
          const error = new Error('Permission denied');
          error.code = 'EACCES';
          callback(error);
        }
        else {
          originalStat(path, callback);
        }
      };

      lockfile.isLocked(testFile, (locked) => {
        expect(locked).toBe(true);

        // Restore original function
        fs.stat = originalStat;
        done();
      });
    });
  });

  describe('integration tests', () => {
    test('should handle concurrent lock attempts correctly', (done) => {
      const results = [];
      let completed = 0;

      // 尝试3次并发获取锁
      for (let i = 0; i < 3; i++) {
        lockfile.lock(testFile, (err, release) => {
          if (!err) {
            results.push(i);

            // 持有锁100ms
            setTimeout(() => {
              release(() => {
                completed++;
                if (completed === results.length) {
                  // 只有一个应该成功获取锁
                  expect(results.length).toBe(1);
                  done();
                }
              });
            }, 100);
          }
        });
      }
    });
  });

  describe('error handling', () => {
    test('should handle unlock errors', (done) => {
      // Mock fs.rm to simulate error
      const originalRm = fs.rm;
      fs.rm = (path, options, callback) => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        callback(error);
      };

      lockfile.unlock(testFile, (err) => {
        expect(err).toBeTruthy();
        expect(err.message).toBe('Permission denied');

        // Restore original function
        fs.rm = originalRm;
        done();
      });
    });

    test('should handle lock errors other than EEXIST', (done) => {
      // Mock fs.mkdir to simulate error
      const originalMkdir = fs.mkdir;
      fs.mkdir = (path, callback) => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        callback(error);
      };

      lockfile.lock(testFile, (err) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('EACCES');

        // Restore original function
        fs.mkdir = originalMkdir;
        done();
      });
    });

    test('should handle stat errors during stale lock check', (done) => {
      // Create a lock first
      fs.mkdir(lockDir, () => {
        // Mock fs.stat to simulate error when checking lock age
        const originalStat = fs.stat;
        let callCount = 0;
        fs.stat = (path, callback) => {
          callCount++;
          if (callCount === 1) {
            // First call should fail to trigger the stat error path
            const error = new Error('Permission denied');
            error.code = 'EACCES';
            callback(error);
          }
          else {
            // Restore and use original for cleanup
            fs.stat = originalStat;
            originalStat(path, callback);
          }
        };

        lockfile.lock(testFile, (err) => {
          expect(err).toBeTruthy();
          expect(err.code).toBe('EACCES');

          // Cleanup
          fs.stat = originalStat;
          done();
        });
      });
    });

    test('should handle unlock errors during stale lock cleanup', (done) => {
      // Create a stale lock
      fs.mkdir(lockDir, () => {
        const oldTime = new Date(Date.now() - 6 * 60 * 1000);
        fs.utimes(lockDir, oldTime, oldTime, () => {

          // Mock unlock to fail
          const originalRm = fs.rm;
          fs.rm = (path, options, callback) => {
            const error = new Error('Permission denied');
            error.code = 'EACCES';
            callback(error);
          };

          lockfile.lock(testFile, (err) => {
            expect(err).toBeTruthy();
            expect(err.code).toBe('EACCES');

            // Restore original function
            fs.rm = originalRm;
            done();
          });
        });
      });
    });

    test('should handle getLock failure after stale lock cleanup', (done) => {
      // Create a stale lock
      fs.mkdir(lockDir, () => {
        const oldTime = new Date(Date.now() - 6 * 60 * 1000);
        fs.utimes(lockDir, oldTime, oldTime, () => {

          // Mock mkdir to fail on second attempt
          const originalMkdir = fs.mkdir;
          let callCount = 0;
          fs.mkdir = (path, callback) => {
            callCount++;
            if (callCount === 2) {
              // Second call (after stale lock cleanup) should fail
              const error = new Error('Permission denied');
              error.code = 'EACCES';
              callback(error);
            }
            else {
              originalMkdir(path, callback);
            }
          };

          lockfile.lock(testFile, (err) => {
            expect(err).toBeTruthy();
            expect(err.code).toBe('EACCES');

            // Restore original function
            fs.mkdir = originalMkdir;
            done();
          });
        });
      });
    });
  });
});