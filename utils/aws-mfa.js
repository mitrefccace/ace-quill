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

const fs = require('fs');
const { getAWSConfigWithProxy }  = require('../utils/aws-config');
const { IAMClient, ListMFADevicesCommand  } = require("@aws-sdk/client-iam");
const { STSClient, GetSessionTokenCommand } = require("@aws-sdk/client-sts");

module.exports = {
    async createMFASession(token) {
        try {
            const AWSConfig = JSON.parse(fs.readFileSync('./configs/amazon/amazon.json'));
            const clientConfig = getAWSConfigWithProxy();
            clientConfig.credentials = {
                accessKeyId: AWSConfig.key,
                secretAccessKey: AWSConfig.secret,
            };
            const iamClient = new IAMClient(clientConfig);
            const stsClient = new STSClient(clientConfig);
            const devicesResponse = await iamClient.send(new ListMFADevicesCommand({userName:''}));
            const mfaDevice = devicesResponse.MFADevices[0];
            console.info('Using AWS MFA Device: ', mfaDevice);
            const sessionTokenParams = {
                DurationSeconds: 12 * 3600,
                SerialNumber: mfaDevice.SerialNumber,
                TokenCode: token
            };
            const sessionResponse = await stsClient.send(new GetSessionTokenCommand(sessionTokenParams));
            AWSConfig.credentials = sessionResponse.Credentials;
            fs.writeFileSync('./configs/amazon/amazon.json', JSON.stringify(AWSConfig, null, 2));
            return true;
        } catch (e) {
            console.error(`Failed to create AWS MFA Session, reason: ${e}`);
            return false;
        }
    },
    async validateSession() {
        try {
            var AWSConfig = JSON.parse(fs.readFileSync('./configs/amazon/amazon.json'));
            var expires = new Date(AWSConfig.credentials.Expiration);
            var now = new Date();
            console.info(`AWS Session expiration: ${expires}`);
            console.info(`Current time: ${now}`, );
            return (now.getTime() < expires.getTime());
        } catch (err) {
            console.error('Failed to find current AWS MFA Session: ', err);
            return false;
        }
    }
}
