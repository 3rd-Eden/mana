describe('mana', function () {
  'use strict';

  var Mana = require('../')
    , chai = require('chai')
    , expect = chai.expect;

  var mana = new Mana();

  describe('construction', function () {
    it('is exposed as function');
    it('calls the initialise function');
  });

  describe('#args', function () {
    it('aliases types', function () {
      expect(mana.args([function () {}])).to.have.property('fn');
      expect(mana.args([function () {}])).to.have.property('function');

      expect(mana.args([{}])).to.have.property('options');
      expect(mana.args([{}])).to.have.property('object');

      expect(mana.args(['foo'])).to.have.property('str');
      expect(mana.args(['foo'])).to.have.property('string');

      expect(mana.args([0])).to.have.property('nr');
      expect(mana.args([0])).to.have.property('number');

      expect(mana.args([[]])).to.have.property('array');
      expect(mana.args([new Date])).to.have.property('date');
    });

    it('parses multiple types correctly');
  });

  describe('#of', function () {
    it('detects array');
    it('detects regexp');
    it('detects function');
    it('detects string');
    it('detects error');
    it('detects date');
    it('detects object');
  });

  describe('#downgrade', function () {
    it('calls the function with the first item of the mirror');
    it('continues gets the next mirror on another invocation');
    it('gives an error when its out of mirrors');
  });
});
