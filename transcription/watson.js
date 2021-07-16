/*
 *                   NOTICE
 *
 *                   This (software/technical data) was produced for the U. S. Government under
 *                   Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
 *                   Regulation Clause 52.227-14, Rights in Data-General. No other use other than
 *                   that granted to the U. S. Government, or to those acting on behalf of the U. S.
 *                   Government under that Clause is authorized without the express written
 *                   permission of The MITRE Corporation. For further information, please contact
 *                   The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
 *                   McLean, VA 22102-7539, (703) 983-6000.
 *
 *                                           ©2018 The MITRE Corporation.
 *                                          */
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
// const fs = require('fs');
const GrowingFile = require('growing-file');
const { IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');
const tunnel = require('tunnel');
// const decode = require('../utils/decode');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Watson(file, configs, langCode, dialect) {
  this.file = file;
  this.authtype = configs.authtype;
  this.apikey = configs.apikey;
  this.url = configs.url;
  this.model = langCode;
  this.dialect = dialect;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
  this.contentType = 'audio/wav; rate=16000';
  this.smart_formatting = true;
}

Watson.prototype.start = function start(callback) {
  debug.debug('starting watson');
  debug.debug('file: '+ this.file);
  debug.debug('authtype: '+ this.authtype);
  debug.debug('api: '+ this.apikey);
  debug.debug('proxy: '+ this.proxy);
  debug.debug('port: '+ this.proxy_port);

  var authParams = {};

  var speechToTextParams = {
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
    speechToTextParams.httpsAgent = agent;
    speechToTextParams.proxy = false;
  } 

  if (this.authtype === 'bearer_token') {
    authParams.bearerToken = this.apikey;
    speechToTextParams.authenticator = new BearerTokenAuthenticator(authParams)
  } else {
    authParams.apikey = this.apikey;
    speechToTextParams.authenticator = new IamAuthenticator(authParams);
  }

  const gf = GrowingFile.open(this.file, {
    timeout: 25000,
    interval: 100,
  });

  const speechToText = new SpeechToTextV1(speechToTextParams);

  const recognizeParams = {
    content_type: this.contentType,
    smartFormatting: this.smart_formatting,
    wordConfidence: true,
    timestamps: true,
    interimResults: true,
    model: this.model,
    dialect: this.dialect,
    objectMode: true,
  };
  console.log(recognizeParams)
  const recognizeStream = speechToText.recognizeUsingWebSocket(recognizeParams)
    .on('data', (data) => {
      info.info('In data handler');
      const results = {
        transcript: data.results[0].alternatives[0].transcript,
        final: data.results[0].final,
        timestamp: new Date(),
        raw: JSON.stringify(data),
        wordConfidence: [],
        transcriptConfidence: [],
      };

      if (data.results[0].final) {
        results.transcriptConfidence = data.results[0].alternatives[0].confidence;
        if (data.results[0].alternatives[0].word_confidence.length > 0) {
          const wC = data.results[0].alternatives[0].word_confidence;
          results.wordConfidence = wC.filter((x) => (x[0] !== '%HESITATION')).map((x) => x[1]);
        }
      }

      info.info(`results:${JSON.stringify(results)}`);
      callback(results);
    })
    .on('open', () => {
      info.info('Websocket to watson is open. Resume GrowingFile.');
      gf.resume();
    })
    .on('error', (err) => {
      debug.debug(err.toString());
    });

  //  _write is usually reserved for piping a filestream
  // due to an issue with back pressure callback not unpausing
  // the data stream pipe() was switched to this event handler
  let first = true;
  gf.on('data', (data) => {
    // callback is required by _write, omitting it will crash the service.
    recognizeStream._write(data, null, () => true);
    if (first) {
      gf.pause();
      first = false;
    }
  }).on('end', () => {
    info.info('FILE HAS ENDED');
    recognizeStream.finish();
    callback({ end: true });
  });
};

module.exports = Watson;
