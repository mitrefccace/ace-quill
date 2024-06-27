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

const { Translate } = require('@google-cloud/translate').v2;
const projectID = 'ace-quill';
const translate = new Translate({ projectID });

function Google() {}

Google.prototype.translate = function translation(text, source, target, callback) {
  translate.translate(text, { from: source, to: target }, (err, data) => {
    callback(err, data);
  });
};

module.exports = Google;
