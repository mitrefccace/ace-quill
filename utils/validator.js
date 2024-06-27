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

module.exports = {
  isUniqueId(uniqueId) {
    let isFormatCorrect = false;
    if (uniqueId) isFormatCorrect = (!Number.isNaN(uniqueId) && (uniqueId.toString().length < 32) && (uniqueId.toString().indexOf('.') !== -1));
    return isFormatCorrect;
  },
  isDtmfDigit(dtmf) {
    let isFormatCorrect = false;
    if (dtmf) isFormatCorrect = (!Number.isNaN(dtmf) && (dtmf.toString().length === 1));
    return isFormatCorrect;
  },
  isChannel(channel) {
    let isFormatCorrect = false;
    if (channel) {
      const re = /^PJSIP.{0,30}$/;
      isFormatCorrect = re.test(channel);
    }
    return isFormatCorrect;
  },
  isPasswordComplex(password) {
    let isFormatCorrect = false;
    if (password) {
      const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])(?!.*\s).{8,64}$/;
      isFormatCorrect = re.test(password);
    }
    return isFormatCorrect;
  },
  isUsernameValid(username) {
    let isFormatCorrect = false;
    if (username) {
      const legalChars = /^[a-zA-Z0-9_]+$/; // allow letters, numbers, and underscores
      isFormatCorrect = ((username.length >= 4) && (username.length <= 15)
      && (legalChars.test(username)));
    }
    return isFormatCorrect;
  },
  isNameValid(name) {
    let isFormatCorrect = false;
    if (name) {
      const legalChars = /^[a-zA-Z]+$/; // allow letters only
      isFormatCorrect = ((name.length >= 1) && (name.length <= 45) && (legalChars.test(name)));
    }
    return isFormatCorrect;
  },
};
