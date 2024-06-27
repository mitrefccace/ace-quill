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

const { getAWSConfigWithProxy } = require('../utils/aws-config');
const { TranslateClient, TranslateTextCommand  } = require("@aws-sdk/client-translate");

function Amazon() {
  this.translateConfig = getAWSConfigWithProxy();
  this.Translate = new TranslateClient(this.translateConfig);
  console.info(`Amazon Translate config: ${JSON.stringify(this.translateConfig)}`);
}

Amazon.prototype.translate = function translation(text, source, target, callback) {
  const command = new TranslateTextCommand({ SourceLanguageCode: source,
                                             TargetLanguageCode: target,
                                             Text: text });
  this.Translate.send(command).then(
    (data) => {
      console.info(`amazon translation: ${JSON.stringify(data)}`);
      callback(data, data.TranslatedText);
    },
    (err) => {
      console.info(`amazon translation Error: ${err.message} : ${JSON.stringify(err)}`);
    }
  );
};

module.exports = Amazon;
