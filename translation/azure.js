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

const got = require('got');
const tunnel = require('tunnel');
const { v4: uuidv4 } = require('uuid');

function Azure(configs) {
  this.subscriptionKey = configs.key;
  this.endpoint = configs.url;
  this.region = configs.location;
  this.proxy = configs.proxy;
}

Azure.prototype.translate = function translation(text, source, target, callback) {
  console.info(`Azure translate text: ${text} \n Source: ${source} \n target:${target}`);
  const options = {
    prefixUrl: this.endpoint,
    searchParams: {
      'api-version': '3.0',
      'to': target,
    },
    headers: {
      'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      'Ocp-Apim-Subscription-Region': this.region,
      'Content-type': 'application/json',
      'X-ClientTraceId': uuidv4().toString(),
    },
    responseType: 'json',
    json: [{text}]
  };

  if(this.proxy){
    if(this.proxy.protocol==='https:'){
      options.agent={ https: tunnel.httpsOverHttps({
        proxy: {
          host: this.proxy.hostname,
          port: this.proxy.port
        }
      })};
    }
    else{
      options.agent={ https: tunnel.httpsOverHttp({
        proxy: {
          host: this.proxy.hostname,
          port: this.proxy.port
        }
      })};
    }
  }
  got.post('translate', options).then(response => {
    console.info(JSON.stringify(response.body[0].translations[0].text, null, 4));
    callback(null, response.body[0].translations[0].text);
  })
  .catch(err => {
    console.error(err);
    callback(err.response, '');
  });
};

module.exports = Azure;
