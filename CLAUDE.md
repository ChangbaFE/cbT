# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

cbT.js 是一个支持模板多级继承的 Node.js 服务端模板引擎。该引擎提供了丰富的模板语法，包括模板继承、变量输出、条件控制、循环遍历等功能。

## 开发命令

### 代码检查
```bash
npm run eslint
```

### 测试相关
```bash
# 运行所有测试
npm test

# 运行单个测试文件
npm test -- test/index.test.js
npm test -- test/helper.test.js
npm test -- test/layout.test.js
npm test -- test/lockfile.test.js
npm test -- test/utils.test.js

# 监听模式运行测试
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 核心架构

### 主要文件结构
- `index.js` - 模板引擎核心入口，包含编译和渲染逻辑
- `lib/layout.js` - 模板继承系统，处理 extends、block 等指令
- `lib/helper.js` - 辅助函数集合，包含 HTML 转义、数组处理等工具
- `lib/lockfile.js` - 文件锁机制，用于缓存文件的并发安全
- `lib/utils.js` - 通用工具函数，包含文件操作、哈希生成等

### 模板语法特性
- **模板继承系统**: 支持 extends、block、parent、child、slot、call、use 指令
- **变量输出**: 支持 HTML 转义、URL 转义、不转义等多种输出方式
- **控制结构**: if/else、foreach 循环
- **安全特性**: 默认 HTML 转义防止 XSS 攻击
- **缓存机制**: 支持模板编译缓存，提升性能

### 关键配置
- 默认分隔符: `<%` 和 `%>`
- 默认扩展名: `.html`
- 支持自定义 basePath 和 cachePath
- 默认开启 HTML 转义

### 模板编译流程
1. 解析模板语法，转换为 JavaScript 代码
2. 处理模板继承关系（如果存在 extends）
3. 合并 block 内容
4. 生成最终的模板函数
5. 缓存编译结果（可选）

### 缓存策略
- 基于文件修改时间检测缓存有效性
- 使用文件锁确保并发安全
- 缓存文件包含版本信息和依赖文件时间戳

## 测试说明

测试文件位于 `test/` 目录，使用 Jest 作为测试框架。测试覆盖：
- `index.test.js` - 核心功能测试
- `helper.test.js` - 辅助函数测试
- `layout.test.js` - 模板继承系统测试
- `lockfile.test.js` - 文件锁机制测试
- `utils.test.js` - 工具函数测试

## 代码风格

项目使用 ESLint 进行代码检查，主要规则：
- 2 空格缩进
- 禁用 console 检查
- 强制使用 const（prefer-const）
- Stroustrup 大括号风格
- 严格的语法检查（无未使用变量、无未定义变量等）