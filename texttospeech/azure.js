const sdk = require('microsoft-cognitiveservices-speech-sdk');
const uuid = require('uuid');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Azure(configs) {
  this.key = configs.key;
  this.location = configs.location;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
}

Azure.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  const audiofilename = `${uuid.v4()}.mp3`;
  const speechConfig = sdk.SpeechConfig.fromSubscription(this.key, this.location);

  if (voice == "Male"){
    voiceid = language == 'es' ? 'es-US-AlonsoNeural' :'en-US-GuyNeural'
  }
  else{
    voiceid = language == 'es' ? "es-US-PalomaNeural" : "en-US-AriaNeural";
  }

  speechConfig.speechSynthesisVoiceName = voiceid;
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(`./texttospeech/audiofiles/${audiofilename}`);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  if (this.proxy) speechConfig.setProxy(this.proxy, this.proxy_port);

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
  synthesizer.speakTextAsync(
    text,
    (result) => {
      if (result) {
        info.info(JSON.stringify(result));
        callback(null, audiofilename);
      }
      synthesizer.close();
    },
    (error) => {
      error.error(error);
      callback(error);
      synthesizer.close();
    },
  );
};

module.exports = Azure;
