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

var events = require('events');
var util = require('util');

function HeaderHelper (){

};

function format (headers){
    var http = '';
    for(var i = 0; i < headers.length; i++)
    {
        http += headers[i].key + ':' + headers[i].value + '\r\n';
    }

    http += '\r\n\r\n';    
    return http;
}
util.inherits(HeaderHelper, events.EventEmitter);

HeaderHelper.prototype.SpeechConfig = function(connectionId) {
    var headers = [];
    /*
                [{'path':'speech.config'},
                {'x-timestamp:Date.UTC(new Date().toISOString())},
                {'content-type': 'application/json; charset=utf-8'},
                {'x-requestid': connectionId}];
    */
    headers.push({key:'path',value:'speech.config'});
    headers.push({key:'x-timestamp',value:(new Date()).toISOString()});
    headers.push({key:'content-type',value:'application/json; charset=utf-8'});
    headers.push({key:'x-requestid',value:connectionId});
    var http = format(headers);
    return http;
};
HeaderHelper.prototype.Telemetry = function(connectionId){
    var headers = [];
    
    headers.push({key:'path',value:'telemetry'});
    headers.push({key:'x-timestamp',value:(new Date().toISOString())});
    headers.push({key:'content-type',value:'application/json'});
    headers.push({key:'x-requestid',value:connectionId});                
    var http = format(headers);    
    /*
    path: telemetry
    x-requestid: 32AFB505BF22487CAE5B9E5B10DCBDA7
    x-timestamp: 2017-06-29T11:28:14.489Z
    content-type: application/json

    {"Metrics":[{"End":"2017-06-29T11:28:10.380Z","Name":"ListeningTrigger","Start":"2017-06-29T11:28:10.380Z"},{"End":"2017-06-29T11:28:14.463Z","Name":"Microphone","Start":"2017-06-29T11:28:11.865Z"},{"End":"2017-06-29T11:28:12.177Z","Id":"E1E6407757974D39BE7DB877140D209D","Name":"Connection","Start":"2017-06-29T11:28:11.931Z"}],"ReceivedMessages":{"turn.start":["2017-06-29T11:28:12.455Z"],"speech.startDetected":["2017-06-29T11:28:12.825Z"],"speech.hypothesis":["2017-06-29T11:28:12.826Z","2017-06-29T11:28:12.851Z","2017-06-29T11:28:13.199Z","2017-06-29T11:28:13.209Z","2017-06-29T11:28:13.291Z","2017-06-29T11:28:13.529Z"],"speech.endDetected":["2017-06-29T11:28:14.458Z"],"speech.phrase":["2017-06-29T11:28:14.475Z"],"turn.end":["2017-06-29T11:28:14.478Z"]}}
    */
   
    return http;
};
HeaderHelper.prototype.StartSendingChunk = function(connectionId) {
    var headers = [];
    /*
        [{'path':'audio'},
        {'x-timestamp':Date.UTC(new Date().toISOString())},
        {'content-type': 'audio/x-wav'},
        {'x-requestid': connectionId}];
    */
    headers.push({key:'path',value:'audio'});
    headers.push({key:'x-timestamp',value:(new Date().toISOString())});
    headers.push({key:'content-type',value:'audio/x-wav'});
    headers.push({key:'x-requestid',value:connectionId});                
    var http = format(headers);

    return http;
};
module.exports = HeaderHelper;