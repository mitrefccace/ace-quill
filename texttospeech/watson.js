/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2024 The MITRE Corporation.
*/

const { IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');
const TextToSpeechV1 = require('ibm-watson/text-to-speech/v1');
const fs = require('fs');
const uuid = require('uuid');
const tunnel = require('tunnel');

function Watson(configs) {
  this.authtype = configs.authtype;
  this.apikey = configs.apikey;
  this.url = configs.url;
  this.proxy = configs.proxy || false;
  this.proxy_port = configs.proxy_port || false;
  this.version = '2018-04-05';
}

Watson.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  var authParams = {};

  const translationParams = {
    version: this.version,
    url: this.url,
    serviceUrl: this.url,
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

  if (voice == "Male"){
    voiceid = language == 'es' ? 'es-ES_EnriqueV3Voice' :'en-US_MichaelV3Voice'
  }
  else{
    voiceid = language == 'es' ? 'es-US_SofiaV3Voice':'en-US_AllisonV3Voice'
  }
  const textToSpeech = new TextToSpeechV1(translationParams);
  const synthesizeParams = {
    text,
    accept: 'audio/mp3',
    voice: voiceid
  };
  textToSpeech
    .synthesize(synthesizeParams)
    .then((response) => {
      const audio = response.result;
      const audiofilename = `${uuid.v4()}.mp3`;
      const stream = fs.createWriteStream(`./texttospeech/audiofiles/${audiofilename}`);
      audio.pipe(stream);

      audio.on('end', () => {
        callback(null, audiofilename);
      });
    })
    .catch((err) => {
      console.error(`Waton TTS error: ${JSON.stringify(err)}`);
    });
};

module.exports = Watson;
