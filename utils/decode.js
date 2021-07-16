/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2018 The MITRE Corporation.
*/

const nconf = require('nconf');
const logger = require('../utils/logger')
const winston = require('winston');
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

let clearText = false;
if (typeof (nconf.get('cleartext')) !== 'undefined') {
  info.info('clearText field is in config.json. Assuming file is in clear text');
  clearText = true;
}

module.exports = function exports(encodedString) {
  let decodedString = null;
  if (clearText) {
    decodedString = encodedString;
  } else {
    decodedString = Buffer.alloc(encodedString, 'base64');
  }
  return (decodedString.toString());
};
