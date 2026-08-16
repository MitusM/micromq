const qs = require('querystring');
const parse = require('co-body');

module.exports.prepareRequest = async (req, res, next) => {
  const [, queryString] = req.url.split('?');
  const query = qs.decode(queryString);

  // Парсим тело по Content-Type: форма логина шлёт urlencoded, API — JSON.
  // parse.json на urlencoded валит gateway (SyntaxError), поэтому не падаем:
  // ошибочное/пустое тело → пустой объект.
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  let body = {};
  if (contentType.includes('application/json')) {
    try {
      body = await parse.json(req);
    } catch (err) {
      body = {};
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    try {
      body = await parse.form(req);
    } catch (err) {
      body = {};
    }
  } else if (req.headers['transfer-encoding'] || req.headers['content-length']) {
    // неизвестный тип с телом — пробуем JSON, не падаем
    try {
      body = await parse.json(req);
    } catch (err) {
      body = {};
    }
  }

  req.path = (req.originalUrl || req.url).split('?')[0];
  req.method = req.method.toLowerCase();
  req.body = body;
  req.query = query;
  req.params = {};

  await next();
};

module.exports.upgradeServerResponse = async (req, res, next) => {
  const writeHead = res.writeHead.bind(res);

  res.writeHead = function(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;

    writeHead(statusCode, headers);

    return this;
  };

  res.status = function(statusCode) {
    this.statusCode = statusCode;

    return this;
  };

  res.json = function(response) {
    const body = JSON.stringify(response);

    if (!this.headersSent) {
      writeHead(this.statusCode, {
        ...this.headers,
        'Content-Type': 'application/json',
      });
    }

    return this.end(body);
  };

  await next();
};
