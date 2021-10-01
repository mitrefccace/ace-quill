const tts = require('@google-cloud/text-to-speech');
const language = require('@google-cloud/language');


const client = new tts.TextToSpeechClient();
const fs = require('fs');
const uuid = require('uuid');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Google(configs) {
  info.info(`Google configs: ${configs}`);
}

Google.prototype.getEntites = async function getEntites(input, callback) {
  const client = new language.LanguageServiceClient();

  const text = input

  const sqlLatestCall = 'SELECT id FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';

  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

  // Detects entities in the document
  const [result] = await client.analyzeEntities({document});

  const entities = result.entities;
  ret = [];

  client.analyzeEntities({document}, (err, result) => {
    if (err) {
      error.error('Error: Google Text to Speech');
    } else {
      const entities = result.entities;

      ret = [];
      entities.forEach(entity => {
        item = {
          Name: entity.name,
          Type: entity.type,
          salience: entity.salience,
        }
        if (entity.metadata && entity.metadata.wikipedia_url) {
          item.url = entity.metadata.wikipedia_url
        }
        if(item.salience > 0.01)
          ret.push(item)
      });
      callback(ret);
    }
  });
};

Google.prototype.getClassification = async function getClassification(input, callback) {
  const language = require('@google-cloud/language');
  const client = new language.LanguageServiceClient();
  const text = input;
  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

  // Classifies text in the document
  client.classifyText({document}, (err, result) => {
    if (err) {
      error.error('Error: Google Text to Speech');
    } else {
      const entities = result.categories;

      ret = [];
      entities.forEach(entity => {
        item = {
              Name: entity.name,
              Confidence: entity.confidence,
            }
        ret.push(item)
      });
      callback(ret);
    }
  });
};

Google.prototype.getSentiment = async function getSentiment(input, callback) {
  const language = require('@google-cloud/language');
  const client = new language.LanguageServiceClient();
  const text = input;
  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

  // Classifies text in the document
  client.analyzeSentiment({document}, (err, result) => {
    if (err) {
      error.error('Error: Google Text to Speech');
    } else {
      const sentences = result.sentences;

      ret = [];
      sentences.forEach(sentence => {
        item = {
          Score: sentence.sentiment.score
        }
        ret.push(item)
      });
      callback(ret);
    }
  });
};

module.exports = Google;
