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

function BingResponseMessage(){

}

var dict = {};
util.inherits(BingResponseMessage, events.EventEmitter);

BingResponseMessage.prototype.parse = function(message){
    
    var lines = message.split("\r\n");
    lines.forEach(function(element) {
        //console.log(element);
        var s = new String(element);
        if(s.startsWith("{")){
            dict['body'] = s;
            //dict.push({key:'body', value:s});
        }else{
            var header = s.split(":");
            if(header.length === 2){
                //var kv = {key : header[0].trim().toLowerCase(), value: header[1].trim() };
                //dict.push(kv);
                dict[header[0].trim().toLowerCase().replace('-','')] = header[1].trim();
            }
        }
    }, this);

   //console.log(dict);
};
BingResponseMessage.prototype.item = function(key){
    return dict[key.trim().toLowerCase().replace('-','')];
};
module.exports = BingResponseMessage;