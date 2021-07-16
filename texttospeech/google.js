const tts = require('@google-cloud/text-to-speech');

const client = new tts.TextToSpeechClient();
const fs = require('fs');
const uuid = require('uuid');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Google(configs) {
  // this.langCd = 'en-US';
  // this.ssmlGender = 'NEUTRAL';
  info.info(`Google configs: ${configs}`);
}

Google.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  if (voice == "Male"){
    voiceid = language == 'es' ? 'es-US-Standard-B' :'en-US-Standard-B'
  }
  else{
    voiceid = language == 'es' ? "es-US-Standard-A" : "en-US-Standard-C";
  }

  const request = {
    input: { text },
    voice: {
      languageCode: language,
      name: voiceid
      // ssmlGender: this.ssmlGender,
    },
    audioConfig: { audioEncoding: 'LINEAR16' },
  };
  client.synthesizeSpeech(request, (err, data) => {
    if (err) {
      error.error('Error: Google Text to Speech');
      callback(err);
    } else {
      const audiofilename = `${uuid.v4()}.mp3`;
      fs.writeFile(`./texttospeech/audiofiles/${audiofilename}`, data.audioContent, (err2) => {
        if (err2) {
          error.error(err2);
        } else {
          callback(null, audiofilename);
        }
      });
    }
  });
};

module.exports = Google;
