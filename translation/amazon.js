const AWS = require('aws-sdk');

const proxy = require('proxy-agent');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

AWS.config.update({
  httpOptions: { agent: proxy('{proxy}') },
});
AWS.config.update({ region: '{region}' });
const translate = new AWS.Translate();

function Amazon() {}

Amazon.prototype.translate = function translation(text, source, target, callback) {
  const params = {
    SourceLanguageCode: source /* required */,
    TargetLanguageCode: target /* required */,
    Text: text /* required */,
  };
  translate.translateText(params, (err, data) => {
    if (err) error.error(err, err.stack);
    // an error occurred
    else {
      info.info('amazon translation', data); // successful response
      callback(err, data.TranslatedText);
    }
  });
};

module.exports = Amazon;
