'use strict';

var debug = require('debug')('mana')
  , request = require('request')
  , qs = require('querystring')
  , Assign = require('assign')
  , fuse = require('fusing')
  , back = require('back')
  , url = require('url');

//
// Cached variables to improve performance.
//
var toString = Object.prototype.toString
  , slice = Array.prototype.slice;

/**
 * Give me mana.
 *
 * @constructor
 * @api public
 */
function Mana() {
  this.fnqueue = Object.create(null);

  if ('function' === this.type(this.initialise)) {
    this.initialise(arguments);
  }
}

fuse(Mana);

/**
 * Default configuration for the build-in randomized exponential back off.
 *
 * @type {Number}
 * @public
 */
Mana.prototype.maxdelay = 60000;  // Max duration of exponential back off
Mana.prototype.mindelay = 100;    // Min duration of exponential back off
Mana.prototype.retries = 3;       // Allowed back off attempts.
Mana.prototype.factor = 2;        // Back off factor.

/**
 * Expose the current version number of our Mana package so it's re-used in our
 * user agent string.
 *
 * @type {String} The version number
 * @public
 */
Mana.prototype.version = require('./package.json').version;

/**
 * The name of the module so we can re-use it in our user agent string.
 *
 * @type {String} The name of the module.
 * @public
 */
Mana.prototype.name = require('./package.json').name;

/**
 * Return a function that will call all queued callbacks that wants to hit the
 * same endpoint.
 *
 * @param {String} urid The Unique Request Identifier.
 * @return {Function} A callback which calls all queued functions.
 * @api private
 */
Mana.prototype.all = function all(urid) {
  var mana = this;

  return function all(err, data) {
    if (!(urid in mana.fnqueue)) {
      if (!err) return debug('No queued callbacks for urid %s, ignoring data.', urid);
      return debug('No queued callback for urid %s but received error: ', err.message);
    }

    //
    // Get the queued function list before calling the callbacks so we don't
    // create a recursive loop if the first function calls the same API endpoint
    // again and causes it to get queued.
    //
    var queue = mana.fnqueue[urid];
    delete mana.fnqueue[urid];

    queue.forEach(function each(fn) {
      fn(err, data);

      if (fn.assign) fn.assign.destroy();
      delete fn.assign;
    });
  };
};

/**
 * Check if we're already fetching data for the given request.
 *
 * @param {String} urid The Unique Request Identifier.
 * @returns {Array|Undefined} Potential list of callbacks to call.
 * @api privat
 */
Mana.prototype.fetching = function fetching(urid) {
  return this.fnqueue[urid];
};

/**
 * Add a new callback to the queue.
 *
 * @param {String} urid The Unique Request Identifier.
 * @param {function} fn The callback to queue.
 * @param {Assign} assign The assignment we returned.
 * @returns {Assign} The assignment.
 * @api private
 */
Mana.prototype.push = function push(urid, fn, assign) {
  fn.assign = assign;

  if (!this.fnqueue[urid]) {
    this.fnqueue[urid] = [fn];
  } else {
    this.fnqueue[urid].push(fn);
  }

  return assign;
};

/**
 * Parse the given arguments because we don't want to do an optional queue check
 * for every single API endpoint.
 *
 * @param {Arguments} args Arguments.
 * @returns {Object} type => based object.
 * @api private
 */
Mana.prototype.args = function parser(args) {
  var alias = {
    'function': 'fn',       // My preferred callback name.
    'object':   'options',  // Objects are usually options.
    'string':   'str',      // Shorter to write.
    'number':   'nr'        // ditto.
  }, mana = this;

  return slice.call(args, 0).reduce(function parse(data, value) {
    var type = mana.type(value);
    data[type] = value;

    if (type in alias) {
      data[alias[type]] = data[type];
    }

    return data;
  }, {});
};

/**
 * Get accurate type information for the given JavaScript class.
 *
 * @param {Mixed} of The thing who's type class we want to figure out.
 * @returns {String} lowercase variant of the name.
 * @api private
 */
Mana.prototype.type = function type(of) {
  return toString.call(of).slice(8, -1).toLowerCase();
};

/**
 * Downgrade the list of given mirrors so we can query against a different
 * server when our default api endpoint is down.
 *
 * @param {Array} mirrors The list of mirrors we can query against.
 * @param {Function} fn The callback.
 * @api private
 */
Mana.prototype.downgrade = function downgrade(mirrors, fn) {
  var source = mirrors[0];

  //
  // Remove duplicates as we don't want to test against the same server twice as
  // we already received an error. An instant retry isn't that useful in most
  // cases as we should give the server some time to cool down.
  //
  mirrors = mirrors.filter(function dedupe(item, i, all) {
    if (!item) return false; // Removes undefined, null and other garbage.
    return all.indexOf(item) === i;
  });

  (function recursive() {
    var api = mirrors.shift();

    //
    // We got a valid api endpoint that we can query against.
    //
    if (api) return fn(undefined, api, recursive);

    //
    // No valid api endpoints available, the callback should start an back off
    // operation against the default provided source
    //
    fn(
      new Error('No more API endpoints available, everything is down'),
      source,
      recursive
    );
  }());

  return this;
};

Mana.prototype.view = function view(args) {
  args = this.args(arguments);

  var query = {};

  args.str = '/-/_view/'+ args.str +'?';

  //
  // We're querying the view based on a known or part of a known key.
  //
  if (args.key) {
    query.startkey = JSON.stringify([args.key]);
    query.endkey   = JSON.stringify([args.key, {}]);
  }

  query.group_level = 'group_level' in args.options ? args.options.group_level : 3;
  query.descending = 'descending' in args.options ? args.options.descending : true;
  query.stale = 'stale' in args.options ? args.options.stale : 'update_after';

  //
  // Optional query arguments.
  //
  if ('limit' in args.options) query.limit = args.options.limit;
  if ('skip' in args.options) query.skip = args.options.skip;

  return this.send(args.str + qs.stringify(query), args.fn);
};

/**
 * Query against a given API endpoint.
 *
 * @param {Arguments} args
 * @returns {Assign}
 * @api public
 */
Mana.prototype.send = function send(args) {
  args = this.args(arguments);

  var mirrors = [ this.api ].concat(this.mirrors || [])
    , assign = new Assign(this, this.all(args.str))
    , options = args.options || {};

  options.method = 'method' in options ? options.method : 'GET';
  options.strictSSL = 'strictSSL' in options ? options.strictSSL : false;
  options.headers = 'headers' in options ? options.headers : {};
  options.backoff = {
    retries: 'retries' in options ? options.retires : this.retries,
    minDelay: 'mindelay' in options ? options.mindelay : this.mindelay,
    maxDelay: 'maxdelay' in options ? options.maxdelay : this.maxdelay,
    factor: 'factor' in options ? options.factor : this.factor
  };

  //
  // Optimization: Check if we're already running a request for this given API
  // endpoint so we can have the given callback executed when this request
  // finishes. This allows us to get a response faster for the callback and
  // reduce requests on the actual API.
  //
  if (options.method === 'GET' && this.fetching(args.str)) {
    return this.push(args.str, args.fn, assign);
  }

  //
  // Add some extra HTTP headers so it would be easier to get a normal response
  // from the server.
  //
  [
    {
      key: 'User-Agent',
      value: 'mana/'+ this.version + ' node/'+ process.version
    }, {
      key: 'Authorization',
      value: this.authorization
    }, {
      key: 'Accept',
      value: 'application/json'
    }
  ].forEach(function each(header) {
    if (
         header.key in options.headers                // Already defined.
      || header.key.toLowerCase() in options.headers  // Alternate.
      || !header.value                                // No value, ignore this.
    ) return;

    options.headers[header.key] = header.value;
  });

  this.downgrade(mirrors, function downgraded(err, root, next) {
    options.uri = url.resolve(root, args.str);

    /**
     * Handle the requests.
     *
     * @param {Error} err Optional error argument.
     * @param {Object} res HTTP response object.
     * @param {String} body The registry response.
     * @api private
     */
    function parse(err, res, body) {
      if (err || !res || res.statusCode !== 200) {
        if (err) err = err.message;
        else err = 'Received an invalid status code %s when requesting URL %s';

        debug(err, res ? res.statusCode : '', options.uri);
        return next();
      }

      //
      // In this case I prefer to manually parse the JSON response as it allows us
      // to return more readable error messages.
      //
      var data = body;

      if ('string' === typeof data) {
        try { data = JSON.parse(body); }
        catch (e) {
          debug('Failed to parse JSON: %s for %s', err.message, options.uri);
          return next();
        }
      }

      assign.write(data, { end: true });
    }

    //
    // The error indicates that we've ran out of mirrors, so we should try
    // a back off operation against the default npm registry, which is provided
    // by the callback. If the back off fails, we should completely give up and
    // return an useful error back to the client.
    //
    if (!err) return request(options, parse);

    back(function toTheFuture(err, backoff) {
      options.backoff = backoff;

      debug(
        'Starting request again to %s after back off attempt %s/%s',
        options.uri,
        backoff.attempt,
        backoff.retries
      );

      if (!err) return request(options, parse);

      //
      // Okay, we can assume that shit is seriously wrong here.
      //
      debug('We failed to fetch %s, all servers are down.', options.uri);
      assign.destroy(new Error('Failed to process request'));
    }, options.backoff);
  });

  return assign;
};

/**
 * Drink this magical elixir and auto"magically" introduce the correct lazy loaded
 * methods.
 *
 * @param {String} module
 * @returns {Mana}
 */
Mana.drink = function drink(module) {
  var path = require('path')
    , fs = require('fs')
    , Potion = this;

  //
  // The module filename is the name absolute position of the file that wants to
  // use mana as api-client base.
  //
  var directory = path.dirname(module.filename);

  fs.readdirSync(path.join(directory, 'endpoints')).filter(function filter(name) {
    return path.extname(name) === '.js';
  }).forEach(function each(name) {
    var lowercase = name.slice(0, -3).toLowerCase()
      , uppercasefirst = lowercase.slice(0, 1).toUpperCase() + lowercase.slice(1);

    Potion.predefine.lazy(Potion.prototype, lowercase, function defined() {
      return new Potion[uppercasefirst](this);
    });

    debug('registered endpoint %s', lowercase);
    Potion[uppercasefirst] = require(path.join(directory, 'endpoints', name));

    if ('function' !== typeof Potion[uppercasefirst]) {
      throw new Error('You forgot to add module.exports on your module: '+ name);
    }
  });

  //
  // Expose the module on in our preferred way.
  //
  module.exports = Potion;
  return Potion;
};

//
// Expose this module.
//
module.exports = Mana;
