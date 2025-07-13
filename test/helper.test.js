import helpers from '../lib/helper.js';

describe('helper.js', () => {
  describe('run', () => {
    test('should execute function with correct context', () => {
      let contextValue;
      const testContext = { value: 'test' };

      function testFunc() {
        contextValue = this.value;
      }

      helpers.run.call(testContext, testFunc);
      expect(contextValue).toBe('test');
    });
  });

  describe('encodeHTML', () => {
    test('should encode HTML special characters', () => {
      expect(helpers.encodeHTML('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
      expect(helpers.encodeHTML('&amp;')).toBe('&amp;amp;');
      expect(helpers.encodeHTML('"hello"')).toBe('&quot;hello&quot;');
      expect(helpers.encodeHTML("'hello'")).toBe('&#39;hello&#39;');
      expect(helpers.encodeHTML('test\\slash')).toBe('test&#92;slash');
    });

    test('should handle empty string for HTML encoding', () => {
      expect(helpers.encodeHTML('')).toBe('');
    });

    test('should convert non-string values to string for HTML encoding', () => {
      expect(helpers.encodeHTML(null)).toBe('null');
      expect(helpers.encodeHTML(undefined)).toBe('undefined');
    });

    test('should handle mixed content for HTML encoding', () => {
      expect(helpers.encodeHTML('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
  });

  describe('replaceUrlProtocol', () => {
    test('should replace http protocol', () => {
      expect(helpers.replaceUrlProtocol('http://example.com')).toBe('//example.com');
    });

    test('should replace https protocol', () => {
      expect(helpers.replaceUrlProtocol('https://example.com')).toBe('//example.com');
    });

    test('should handle URLs with paths', () => {
      expect(helpers.replaceUrlProtocol('https://example.com/path/to/page'))
        .toBe('//example.com/path/to/page');
    });

    test('should not modify URLs without http/https protocol', () => {
      expect(helpers.replaceUrlProtocol('ftp://example.com')).toBe('ftp://example.com');
      expect(helpers.replaceUrlProtocol('//example.com')).toBe('//example.com');
      expect(helpers.replaceUrlProtocol('example.com')).toBe('example.com');
    });

    test('should handle case insensitive protocol', () => {
      expect(helpers.replaceUrlProtocol('HTTP://example.com')).toBe('//example.com');
      expect(helpers.replaceUrlProtocol('HTTPS://example.com')).toBe('//example.com');
    });
  });

  describe('encodeEventHTML', () => {
    test('should encode for HTML event attributes', () => {
      expect(helpers.encodeEventHTML('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
      expect(helpers.encodeEventHTML('&amp;')).toBe('&amp;amp;');
      expect(helpers.encodeEventHTML('"hello"')).toBe('&quot;hello&quot;');
      expect(helpers.encodeEventHTML("'hello'")).toBe('&#39;hello&#39;');
    });

    test('should handle escaped characters differently', () => {
      expect(helpers.encodeEventHTML('\\\\test')).toBe('\\test'); // Double backslash becomes single backslash
      expect(helpers.encodeEventHTML('\\/test')).toBe('/test');   // Backslash+slash becomes slash
      expect(helpers.encodeEventHTML('\\n')).toBe('\n');         // Escaped newline becomes real newline
      expect(helpers.encodeEventHTML('\\r')).toBe('\r');         // Escaped carriage return becomes real carriage return
    });

  });

  describe('forEachArray', () => {
    test('should join array with default separator', () => {
      const arr = ['item1', 'item2', 'item3'];
      expect(helpers.forEachArray(arr)).toBe('item1<br>item2<br>item3');
    });

    test('should join array with custom separator', () => {
      const arr = ['item1', 'item2', 'item3'];
      expect(helpers.forEachArray(arr, ', ')).toBe('item1, item2, item3');
    });

    test('should encode HTML in array items', () => {
      const arr = ['<div>item1</div>', 'item2'];
      expect(helpers.forEachArray(arr)).toBe('&lt;div&gt;item1&lt;/div&gt;<br>item2');
    });

    test('should filter out empty strings', () => {
      const arr = ['item1', '', '  ', 'item2'];
      expect(helpers.forEachArray(arr)).toBe('item1<br>item2');
    });

    test('should handle non-array input', () => {
      expect(helpers.forEachArray('not an array')).toBe('');
      expect(helpers.forEachArray(null)).toBe('');
      expect(helpers.forEachArray(undefined)).toBe('');
      expect(helpers.forEachArray({})).toBe('');
    });

    test('should handle empty array', () => {
      expect(helpers.forEachArray([])).toBe('');
    });
  });

  describe('isObject', () => {
    test('should return true for objects', () => {
      expect(helpers.isObject({})).toBe(true);
      expect(helpers.isObject({ key: 'value' })).toBe(true);
      expect(helpers.isObject([])).toBe(true); // Arrays are also objects
    });

    test('should return true for functions', () => {
      expect(helpers.isObject(function() {})).toBe(true);
      expect(helpers.isObject(() => {})).toBe(true);
    });

    test('should return false for primitives', () => {
      expect(helpers.isObject('string')).toBe(false);
      expect(helpers.isObject(123)).toBe(false);
      expect(helpers.isObject(true)).toBe(false);
      expect(helpers.isObject(null)).toBe(false);
      expect(helpers.isObject(undefined)).toBe(false);
    });
  });

  describe('isEmptyObject', () => {
    test('should return true for empty object', () => {
      expect(helpers.isEmptyObject({})).toBe(true);
    });

    test('should return false for non-empty object', () => {
      expect(helpers.isEmptyObject({ key: 'value' })).toBe(false);
    });

    test('should handle objects with prototype properties', () => {
      const obj = Object.create({ protoKey: 'value' });
      expect(helpers.isEmptyObject(obj)).toBe(true); // Only checks own properties
    });

    test('should handle objects with non-enumerable properties', () => {
      const obj = {};
      Object.defineProperty(obj, 'hidden', {
        value: 'test',
        enumerable: false
      });
      expect(helpers.isEmptyObject(obj)).toBe(true);
    });
  });

  describe('each', () => {
    test('should iterate over array', () => {
      const arr = ['a', 'b', 'c'];
      const result = [];

      helpers.each(arr, function(index, value) {
        result.push({ index, value, context: this });
      });

      expect(result).toEqual([
        { index: 0, value: 'a', context: 'a' },
        { index: 1, value: 'b', context: 'b' },
        { index: 2, value: 'c', context: 'c' }
      ]);
    });

    test('should iterate over object', () => {
      const obj = { key1: 'value1', key2: 'value2' };
      const result = [];

      helpers.each(obj, function(key, value) {
        result.push({ key, value, context: this });
      });

      expect(result).toEqual([
        { key: 'key1', value: 'value1', context: 'value1' },
        { key: 'key2', value: 'value2', context: 'value2' }
      ]);
    });

    test('should stop iteration when callback returns false', () => {
      const arr = ['a', 'b', 'c', 'd'];
      const result = [];

      helpers.each(arr, function(index, value) {
        result.push(value);
        if (value === 'b') {return false;}
      });

      expect(result).toEqual(['a', 'b']);
    });

    test('should stop iteration when callback returns false for objects', () => {
      const obj = { key1: 'value1', key2: 'value2', key3: 'value3' };
      const result = [];

      helpers.each(obj, function(key, value) {
        result.push(value);
        if (value === 'value2') {return false;}
      });

      expect(result).toEqual(['value1', 'value2']);
    });

    test('should return the original object/array', () => {
      const arr = ['a', 'b'];
      const returnValue = helpers.each(arr, () => {});
      expect(returnValue).toBe(arr);
    });
  });
});