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

  describe('.initialise', function () {
    it('correctly receives all arguments', function (done) {
      var Init = Mana.extend({
        initialise: function (foo, bar) {
          expect(foo).to.equal('bar');
          expect(bar).to.equal('foo');

          done();
        }
      });

      new Init('bar', 'foo');
    });
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

    it('parses multiple types correctly', function () {
      var types = mana.args([{}, 'str']);

      expect(types).to.have.property('string');
      expect(types).to.have.property('object');
    });
  });

  describe('#type', function () {
    it('detects array', function () {
      expect(mana.type([])).to.equal('array');
    });

    it('detects regexp', function () {
      expect(mana.type(/\//)).to.equal('regexp');
    });

    it('detects function', function () {
      expect(mana.type(function() {})).to.equal('function');
    });

    it('detects string', function () {
      expect(mana.type('string')).to.equal('string');
    });

    it('detects error', function () {
      expect(mana.type(new Error())).to.equal('error');
    });

    it('detects date', function () {
      expect(mana.type(new Date())).to.equal('date');
    });

    it('detects object', function () {
      expect(mana.type({})).to.equal('object');
    });
  });

  describe('#downgrade', function () {
    it('calls the function with the first item of the mirror');
    it('continues gets the next mirror on another invocation');
    it('gives an error when its out of mirrors');
  });
});

describe('Tokens', function () {
  'use strict';

  var Mana = require('../')
    , chai = require('chai')
    , expect = chai.expect
    , Token = Mana.Token;

  var token = new Token('foo')
    , mana = new Mana();

  it('sets all values to Infinity', function () {
    expect(token.ratelimit).to.equal(Infinity);
    expect(token.ratereset).to.equal(Infinity);
    expect(token.remaining).to.equal(Infinity);
  });

  it('transforms the given token to an correct Authorization header value', function () {
    expect(token.authorization).to.equal('token foo');
  });

  describe("#available", function () {
    beforeEach(function () {
      token.ratelimit = 0;
      token.ratereset = 0;
      token.remaining = 0;
    });

    it('is unavailable if values are null', function () {
      expect(token.available()).to.equal(false);
    });

    it('is available when fist initialised', function () {
      expect((new Token()).available()).to.equal(true);
    });

    it('is available if it has remaining rates', function () {
      expect(token.available()).to.equal(false);

      token.remaining = 1;
      expect(token.available()).to.equal(true);
    });

    it('is available if our rate has been reset', function () {
      expect(token.available()).to.equal(false);

      token.ratereset = Date.now() / 1000;
      expect(token.available()).to.equal(true);

      token.ratereset = (Date.now() / 1000) + 10;
      expect(token.available()).to.equal(false);
    });
  });
});
