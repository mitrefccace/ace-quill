# ACE Quill Asterisk

The Asterisk PBX is installed with a script that downloads the latest source
code, builds the server and updates the configuration files
with the required parameters. The installation script is:

`~/ace-quill/resources/asterisk/scripts/aq_asterisk_install.sh`

A Session Traversal of User Datagram (STUN) server is required by Asterisk.
The STUN server allows network address translation (NAT) clients to
set up phone calls to a Voice over Internet Protocol (VoIP) provider outside of
the local network. A publicly available STUN server (e.g., hosted by Google)
can also be used. The following network parameters are required by the Asterisk
installation script:
* Public Internet Protocol (IP) address
* Private/local IP address
* Private/local IP netmask
* Fully qualified domain name used by the SIP trunk provider (e.g.,
  fqdn.twilio.com)
* Certificate file
* Key file
* STUN server hostname
* STUN port number
* AMI user
* AMI password
* Asterisk extension passwords
* MySQL user
* MySQL password

To run the script:

`cd resouces/asterisk/scripts`

`chmod 777 aq_asterisk_install.sh`

`./aq_asterisk_install.sh –public-ip <public IP address> --local-ip <local IP address> --local-ip-mask <local IP netmask> --twilio-fqdn <twilio_fqdn> --crt-file <path to certificate> --crt-key <path to key> --stun-server <stun fqdn> --stun-port <stun port> --ami-user <ami user> --ami-password <ami password> --extension-password <extension password>  --mysql-user ace-quill --mysql-password <mysql password>`

By default extensions 5001 thru 5020 will be created in /etc/asterisk/pjsip.conf all using the extension password supplied to the installation script. If each extension requires a unique password, edit the /etc/asterisk/pjsip.conf file then restart asterisk.

The ACE Quill Asterisk server configuration uses Elastic Session Initiation
Protocol (SIP) Trunking. Elastic SIP Trunking is a cloud-based service that
connects IP-based communications with the Public Switched Telephone Network
(PSTN), which allows the ACE Quill prototype to call standard phone numbers.
Prototype administrators can select from a number of Elastic SIP Trunk vendors,
and other vendors would provide similar configuration options.

The following instructions are based on configuring a Twilio account:
* Sign into your Twilio account
* Select the button with three dots under the home button
* Select "Elastic SIP Trunking”
* Select “Trunks”, “Create new SIP Trunk”
  * Enter the subdomain for your Asterisk server in the “Friendly Name” field
  then click "Create"
* Select "Termination" in the menu on the left
* In the "Termination SIP URI" input box, enter the subdomain for your server
* In the "Authentication" section, click on the plus-sign button to the right
of "IP Access Control Lists"
  * Use the subdomain to name the ACL, then enter the elastic IP address of
  your server in the list
* Click on "Origination" to the left
  * Select “Add new Origination URI”
    * This should either be "sip:address", where address is either the FQDN or
    the elastic IP address of your server
* Click on "Numbers" to the left
  * Select “Buy a Number” to purchase and associate a new ten-digit number to
  the SIP trunk

The Asterisk server is a system service that can be started and stopped with
the Linux service command. To launch the Asterisk server, run the following
command:

`sudo service asterisk start`

To stop the Asterisk server, run the following command:

`sudo service asterisk stop`





### NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

©2021 The MITRE Corporation.
