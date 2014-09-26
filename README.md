# mana

Mana is an small package that provides basic and a dead simple API structure for
creating high performance API clients. Take your mana potion and start creating
magical API clients which contain the following powers:

- **Rolling tokens** Supports multiple OAuth tokens which will be switched when
  rate limits are hit.
- **Callback queue** Multiple requests calls to the same URL will result in a
  single call.
- **Mirrors** When API endpoints become unresponsive, alternate replica's or
  mirrors API's can be hit instead.
- **Back off** Build in exponential back off when the API endpoint returns an
  error or error code.
- **Conditional requests** Requests with Etags can be cached and result will be
  reused when a 304 is returned. (Supports async and sync cache engines.)

## Installation

The module is released through npm.

```
npm install --save mana
```

## Assumptions

Before you get started with building your first mana based API client there are
some assumptions we make

### Tokens

We assume that the supplied token(s) should be used as `Authorization` header
and that the supplied token should be prefixed with `token `.

### Rate limiting

Again, we have to make some sane assumptions here as well. There tons of ways
that an API server can say that you've reached your limit. We assume that it
sends the following headers with each HTTP response: 

- `x-ratelimit-reset` Time when the limit is reset in UTC EPOCH seconds.
- `x-ratelimit-limit` Maximum of requests the user can make.
- `x-ratelimit-remaining` The amount of requests the user has left.

We will only take these values in to account when multiple tokens are used and a
none `200` status code has been returned from the server.

## Usage

In all of the examples we assume that you've loaded the library using:

```js
'use strict';

var mana = require('mana');
```

To create you own custom mana instance you need to extend the returned mana
instance. Extending is done by calling the `mana.extend` method with an object
which will be merged on the prototype:

```js
var MyAPI = mana.extend({
  url: 'https://api.im-implementing.com/'
});
```

In the code snippet you see us adding the `url` property and storing the result
of the extending as the `MyAPI` class. The `url` property is one of the
properies that are required and need to be specified on every single instance. 

## Drinking the potion

The module assumes a simple pattern. The API end points are listed in a folder
called `endpoints`. This folder contains JavaScript files which exports
a function:

```js
function Endpoint(api) {
  this.api = api;
}

module.exports = Endpoint
```

This function receives a reference to your base API class once it's initialised.
These API endpoints will be introduced on the prototype of your base API in
lowercase. So if you name your file `Endpoints` it will create an
`base.endpoints` method for you which access this constructed function. Now the
beauty of this is that these methods support lazy construction. So only when you
access the `.endpoints` property, it will create a new instance (only once
of course). This way you don't construct pointless API points that might never be
used by your users. 

In addition to lowercasing your endpoint and introducing it as constructed
property it also exposes the Full class on the base API. This class is Uppercase
first, just like all Classes should be in JavaScript.

## License

MIT
