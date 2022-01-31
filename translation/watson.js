/*
*                  NOTICE
*
*                  This (software/technical data) was produced for the U. S. Government under
*                  Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
*                  Regulation Clause 52.227-14, Rights in Data-General. No other use other than
*                  that granted to the U. S. Government, or to those acting on behalf of the U. S.
*                  Government under that Clause is authorized without the express written
*                  permission of The MITRE Corporation. For further information, please contact
*                  The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
*                  McLean, VA 22102-7539, (703) 983-6000.
*
*                                          ©2022 The MITRE Corporation.
*                                                          */

const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const { IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');
const tunnel = require('tunnel');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Watson(configs) {
  this.apikey = configs.apikey;
  this.authtype = configs.authtype;
  this.url = configs.url;
  this.proxy = configs.proxy || false;
  this.proxy_port = configs.proxy_port || false;
  this.version = '2018-05-01';
}

Watson.prototype.translate = function translation(text, source, target, callback) {
  var authParams = {};

  const translationParams = {
    version: this.version,
    url: this.url,
    disableSslVerification: true
  };

  if (this.proxy) {
    const agent = tunnel.httpsOverHttp({
      proxy: {
        host: this.proxy,
        port: this.proxy_port,
      },
    });
    authParams.httpsAgent = agent;
    authParams.proxy = false;
    translationParams.httpsAgent = agent;
    translationParams.proxy = false;
  }

  if (this.authtype === 'bearer_token') {
    authParams.bearerToken = this.apikey;
    translationParams.authenticator = new BearerTokenAuthenticator(authParams)
  } else {
    authParams.apikey = this.apikey;
    translationParams.authenticator = new IamAuthenticator(authParams);
  }

  const languageTranslator = new LanguageTranslatorV3(translationParams);

  const inputs = {
    text,
  };
  inputs.source = source || null;
  inputs.target = target || null;

  languageTranslator.translate(inputs)
    .then((resp) => {
      // logger.info(inputs1.text);
      callback(null, resp.result.translations[0].translation);
    })
    .catch((error) => {
      debug.debug('Error', error);
      callback(error, text);
    });
};

module.exports = Watson;
