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

const language = require('@google-cloud/language');

function Google(configs) {
  console.info(`Google configs: ${JSON.stringify(configs)}`);
}

Google.prototype.getEntities = async function getEntities(input, callback) {
  const client = new language.LanguageServiceClient();
  const document = {
    content: input,
    type: 'PLAIN_TEXT',
  };
  client.analyzeEntities({document}, (err, result) => {
    if (err) {
      console.error(`Error: Google Entity Analysis: ${JSON.stringify(err)}`);
    } else {
      ret = [];
      result.entities.forEach(entity => {
        if(entity.salience > 0.01){
          item = {
            Name: entity.name,
            Type: entity.type,
            salience: entity.salience,
          };
          if (entity.metadata && entity.metadata.wikipedia_url) {
            item.url = entity.metadata.wikipedia_url;
          }
          ret.push(item);
        }
      });
      callback(ret);
    }
  });
};

Google.prototype.getClassification = async function getClassification(input, callback) {
  const client = new language.LanguageServiceClient();
  const document = {
    content: input,
    type: 'PLAIN_TEXT',
  };
  // Classifies text in the document
  client.classifyText({document}, (err, result) => {
    if (err) {
      console.error(`Error: Google Classification Analysis: ${JSON.stringify(err)}`);
    } else {
      ret = [];
      result.categories.forEach(entity => {
        ret.push({
          Name: entity.name,
          Confidence: entity.confidence,
        });
      });
      callback(ret);
    }
  });
};

Google.prototype.getSentiment = async function getSentiment(input, callback) {
  const client = new language.LanguageServiceClient();
  const document = {
    content: input,
    type: 'PLAIN_TEXT',
  };
  // Classifies text in the document
  client.analyzeSentiment({document}, (err, result) => {
    if (err) {
      console.error(`Error: Google Sentiment Analysis: ${JSON.stringify(err)}`);
    } else {
      ret = [];
      result.sentences.forEach(sentence => {
        ret.push({Score: sentence.sentiment.score})
      });
      callback(ret);
    }
  });
};

module.exports = Google;
