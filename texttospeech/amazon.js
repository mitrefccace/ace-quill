const fs = require('fs');
const proxy = require('proxy-agent');
const uuid = require('uuid');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');
const AWS = require('aws-sdk');

function Amazon(configs) {
  info.info(`Amazon configs: ${configs}`);
}

const aceConfig = JSON.parse(
    fs.readFileSync('./configs/acequill.json'),
  );

AWS.config.update({
    httpOptions: { agent: proxy(aceConfig.proxy) },
  });

Amazon.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  const audiofilename = `${uuid.v4()}.mp3`;

  const config = JSON.parse(
            fs.readFileSync('./configs/amazon/amazon.json'),
          );

  AWS.config.update({
    region: config.region,
    credentials:{
      accessKeyId : config.key,
      secretAccessKey : config.secret,
    }
   });

  const Polly = new AWS.Polly({
    signatureVersion: 'v4',
    region: config.region,
  });

  if (voice == "Male"){
    voiceid = language == 'es' ? 'Miguel' :'Matthew'
  }
  else{
    voiceid = language == 'es' ? 'Penelope' :'Joanna'
  }


  const params = {
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: voiceid,
  };

  Polly.synthesizeSpeech(params, (err, data) => {
    if (err) {
      error.error(err.code);
    } else if (data) {
      if (data.AudioStream instanceof Buffer) {
        fs.writeFile(`./texttospeech/audiofiles/${audiofilename}`, data.AudioStream, (err2) => {
          if (err2) {
            error.error(err2);
          }
          info.info('The file was saved!');
          callback(null, audiofilename);
        });
      }
    }
  });
};

module.exports = Amazon;
