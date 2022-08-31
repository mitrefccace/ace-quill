const request = require('request');
const { v4: uuidv4 } = require('uuid');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

// function Azure() {}

function Azure(configs) {
  this.subscriptionKey = configs.key;
  this.endpoint = configs.url;
  this.region = configs.location;
  this.proxy = configs.proxy;
}

Azure.prototype.translate = function translation(text, source, target, callback) {
  info.info('text ,', text);
  info.info('source ,', source);
  info.info('target ,', target);
  const options = {
    method: 'POST',
    baseUrl: this.endpoint,
    url: 'translate',
    qs: {
      'api-version': '3.0',
      to: [target],
    },
    headers: {
      'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      'Ocp-Apim-Subscription-Region': this.region,
      'Content-type': 'application/json',
      'X-ClientTraceId': uuidv4().toString(),
    },
    proxy: this.proxy,
    body: [
      {
        text,
      },
    ],
    json: true,
  };

  request(options, (err, res, body) => {
    if (err) error.error(err);
    if (err) console.log(err);
    console.log(JSON.stringify(body))
    info.info(JSON.stringify(body[0].translations[0].text, null, 4));
    callback(err, body[0].translations[0].text);
  });
};

module.exports = Azure;
