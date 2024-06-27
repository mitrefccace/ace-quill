/*
 *                   NOTICE
 *
 *                   This (software/technical data) was produced for the U. S. Government under
 *                   Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
 *                   Regulation Clause 52.227-14, Rights in Data-General. No other use other than
 *                   that granted to the U. S. Government, or to those acting on behalf of the U. S.
 *                   Government under that Clause is authorized without the express written
 *                   permission of The MITRE Corporation. For further information, please contact
 *                   The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
 *                   McLean, VA 22102-7539, (703) 983-6000.
 *
 *                                           ©2024 The MITRE Corporation.
 *                                          */
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const GrowingFile = require('growing-file');
const { IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');
const tunnel = require('tunnel');
var fs = require('fs');

function UsabilityWatson(file, configs, langCode, docLocation) {
  this.file = file;
  this.authtype = configs.authtype;
  this.apikey = configs.apikey;
  this.url = configs.url;
  this.model = langCode;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
  this.contentType = 'audio/wav; rate=16000';
  this.smart_formatting = true;
  this.docLocation = docLocation;
}

UsabilityWatson.prototype.start = function start(callback) {
  console.debug('starting usability watson');
  console.debug('file: '+ this.file);
  console.debug('authtype: '+ this.authtype);
  console.debug('api: '+ this.apikey);
  console.debug('proxy: '+ this.proxy);
  console.debug('port: '+ this.proxy_port);

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
    //dialect: this.dialect,
    objectMode: true,
    //backgroundAudioSuppression: this.background,
    //speechDetectorSensitivity: this.speechDetector,
    lowLatency: true,
    profanityFilter: false
  };

  const recognizeStream = speechToText.recognizeUsingWebSocket(recognizeParams)
    .on('data', (data) => {
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
        results.firstWordTime = data.results[0].alternatives[0].timestamps[0][1];
        if (data.results[0].alternatives[0].word_confidence.length > 0) {
          const wC = data.results[0].alternatives[0].word_confidence;
          results.wordConfidence = wC.filter((x) => (x[0] !== '%HESITATION')).map((x) => x[1]);
        }
        const confidence = Math.trunc(results.transcriptConfidence * 100) 
        const text = data.results[0].alternatives[0].transcript;
        const time = new Date(results.firstWordTime * 1000).toISOString().slice(11, 19);
        fs.appendFileSync(this.docLocation, `${time} - ${text}(${confidence}%)\n` + `-----------------\n` );
      }
      console.info(`results:${JSON.stringify(results)}`);
      callback(results);
    })
    .on('open', () => {
      console.info('Websocket to watson is open. Resume GrowingFile.');
      gf.resume();
    })
    .on('error', (err) => {
      console.debug(err.toString());
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
    recognizeStream.finish();
    callback({ end: true });
  });
};

module.exports = UsabilityWatson;