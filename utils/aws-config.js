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

const config = require('./../configs/config.js');
const fs = require('fs');
const { ProxyAgent } = require('proxy-agent');
const { NodeHttpHandler } = require("@smithy/node-http-handler");

function getAWSConfig (){
    const awsConfig = JSON.parse(
        fs.readFileSync('./configs/amazon/amazon.json'),
      );
      const creds = {};
      switch (awsConfig.auth_type) {
        case 'credentials': 
          creds.accessKeyId = awsConfig.key;
          creds.secretAccessKey = awsConfig.secret;
          break;
        case 'mfa':
          if(awsConfig.credentials){
            creds.accessKeyId = awsConfig.credentials.AccessKeyId;
            creds.secretAccessKey = awsConfig.credentials.SecretAccessKey;
            creds.sessionToken = awsConfig.credentials.SessionToken;
          }
          break;
      }
      return {
        region: awsConfig.region,
        credentials: creds
      };
}

function getAWSConfigWithProxy (){
    const awsConfig = getAWSConfig();
    if(config.proxy){
        const proxyURL = new URL(config.proxy);
        const proxyAgent = new ProxyAgent({
          rejectUnauthorized: false,
          getProxyForUrl: (u) => {
            return proxyURL.href;
          },
        });
        awsConfig.requestHandler = new NodeHttpHandler({ httpAgent:  proxyAgent,
                                                         httpsAgent: proxyAgent });
    }
    return awsConfig;
}

module.exports = {
    getAWSConfig: getAWSConfig,
    getAWSConfigWithProxy: getAWSConfigWithProxy
};
