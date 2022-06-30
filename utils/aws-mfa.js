const AWS = require('aws-sdk');
const proxy = require('proxy-agent');
const fs = require('fs');
const nconf = require('nconf');

if (nconf.get('proxy')) {
    AWS.config.update({
        httpOptions: { agent: proxy(nconf.get('proxy')) },
    });
}


module.exports = {
    async createMFASession(token) {
        try {
            const iamClient = new AWS.IAM();
            const stsClient = new AWS.STS();
            var AWSconfig = JSON.parse(fs.readFileSync('./configs/amazon/amazon.json'));
            AWS.config.update({
                region: AWSconfig.region,
                credentials: {
                    accessKeyId: AWSconfig.key,
                    secretAccessKey: AWSconfig.secret,
                }
            });

            var mfaDevices = await iamClient.listMFADevices().promise();
            console.log(mfaDevices.MFADevices[0].SerialNumber)
            var params = {
                DurationSeconds: 12 * 3600,
                SerialNumber: mfaDevices.MFADevices[0].SerialNumber,
                TokenCode: token
            };
            var sessToken = await stsClient.getSessionToken(params).promise();
            console.log(sessToken)
            AWSconfig.credentials = sessToken.Credentials;
            fs.writeFileSync('./configs/amazon/amazon.json', JSON.stringify(AWSconfig, null, 2));
            return true;
        } catch (e) {
            return false;
        }
    },
    async validateSession() {
        try {
            var AWSconfig = JSON.parse(fs.readFileSync('./configs/amazon/amazon.json'));
            var expires = new Date(AWSconfig.credentials.Expiration);
            var now = new Date();
            console.log("exp", expires)
            console.log("now", now)
            return (now.getTime() < expires.getTime())
        } catch (e) {
            return false;
        }
    }
}


