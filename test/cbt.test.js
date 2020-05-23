'use strict';

const assert = require('assert')
const cbT = require('..');

describe('cbT', function() {
  const basicTemplate = `<title><%=title%></title>`;
  const render = cbT.compile(basicTemplate);

  describe('#compile()', function() {
    it('should return a function', function() {
      assert.equal(typeof render, 'function');
    });
  });

  describe('#()', function() {
    it('should render the template', function() {
      assert.equal(render({title: 'http'}), '<title>http</title>');
      assert.equal(render({title: '<b>test</b>'}), '<title>&lt;b&gt;test&lt;/b&gt;</title>');
      assert.equal(render({}), '<title></title>');
    });
  });
});
