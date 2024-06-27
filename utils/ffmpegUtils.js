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

var ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
    convertToMono(file, outputFile) {
        return new Promise(function(resolve, reject){
            var command = ffmpeg({
                        source: file
                    }).addOption('-ac', 1).audioFrequency(16000)
                        .saveToFile(outputFile)
                        .on('end', function() {
                            console.info('Finished processing');
                            resolve();
                        })
                        .on('error', function(err) {
                            console.error('Error processing' + err);
                            reject();
                        })
                    }
                )
            },
        };
