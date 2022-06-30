const proxy = require('proxy-agent');
const fs = require('fs');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');
const AWS = require('aws-sdk');

const aceConfig = JSON.parse(
  fs.readFileSync('./configs/acequill.json'),
);

AWS.config.update({
  httpOptions: { agent: proxy(aceConfig.proxy) },
});

function Amazon() {}

Amazon.prototype.translate = function translation(text, source, target, callback) {
  const config = JSON.parse(fs.readFileSync('./configs/amazon/amazon.json'),);
  let creds = {};
  let awsConfig = {
    region: config.region,
  };
  
  switch (config.auth_type) {
    case 'credentials': 
      creds.accessKeyId = config.key;
      creds.secretAccessKey = config.secret;
      awsConfig.credentials = creds;
      break;
    case 'mfa':
      creds.accessKeyId = config.credentials.AccessKeyId;
      creds.secretAccessKey = config.credentials.SecretAccessKey;
      creds.sessionToken = config.credentials.SessionToken;
      awsConfig.credentials = creds;
      break;
  } 
  
  AWS.config.update(awsConfig);
  const translate = new AWS.Translate();

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
