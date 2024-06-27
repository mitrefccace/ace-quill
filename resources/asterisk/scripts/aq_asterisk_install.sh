#!/bin/bash

#                                  NOTICE
# 
# This (software/technical data) was produced for the U. S. Government under
# Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
# Regulation Clause 52.227-14, Rights in Data-General. No other use other than
# that granted to the U. S. Government, or to those acting on behalf of the U. S.
# Government under that Clause is authorized without the express written
# permission of The MITRE Corporation. For further information, please contact
# The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
# McLean, VA 22102-7539, (703) 983-6000.
# 
#                         ©2024 The MITRE Corporation.

# This will stop the script if any of the commands fail
set -e

source /etc/environment
startPath=$(pwd)

echo "startPath is $startPath"

# Set variable names
STUN_PORT='insert port number'
STUN_SERVER='insert stun server'
CRT_KEY='insert path to key'
CRT_FILE='insert path to cert'
LOCAL_IP_MASK='insert local netmask'
LOCAL_IP='insert local ip address'
PUBLIC_IP='insert public ip address'
TWILIO_FQDN='insert twilio fqdn'
AMI_USER='insert ami user'
AMI_PASS='insert ami password'
EXT_PASS='insert extension password'
MYSQL_USER='insert mysql user'
MYSQL_PASS='insert mysql user password'

# Specify Asterisk version
AST_VERSION=16.19.0

# Hostname command suggestion
HOST_SUGG="You can use 'sudo hostnamectl set-hostname <hostname>' to set the hostname."

print_args()
{
  echo "Required params: --public-ip --local-ip --local-ip-mask --crt-file --crt-key --twilio-fqdn --stun-server --stun-port --ami-user --ami-password --extension-password" >&2
  echo "Aborting" >&2
  exit 1
} >&2

# Check for empty params
if [ $# -eq 0 ]
  then
    echo "No arguments supplied"
    print_args
    exit 1
fi

# Read the options
# TEMP=`getopt -o a:: -l public-ip:,local-ip:,crt-file:,crt-key: -n '$0' -- "$@"`
TEMP=`getopt -o a:: -l public-ip:,local-ip:,local-ip-mask:,crt-file:,crt-key:,twilio-fqdn:,stun-server:,stun-port: -n '$0' -- "$@"`
eval set -- "$TEMP"

# Process the command line arguments
while true
do
        case "$1" in
        --public-ip)
                case $2 in
                        "") print_args ;;
                        *) PUBLIC_IP=$2; shift 2 ;;
                esac ;;
        --local-ip)
                case "$2" in
                        "") print_args ;;
                        *) LOCAL_IP=$2; shift 2 ;;
                esac ;;
        --local-ip-mask)
                case "$2" in
                        "") print_args ;;
                        *) LOCAL_IP_MASK=$2; shift 2 ;;
                esac ;;
        --crt-file)
                case "$2" in
                        "") echo -e "WARNING: no SSL/TLS certificate specified. Using to-be-generated self-signed\nAsterisk certificate."
                        CRT_FILE="//etc//asterisk//keys//asterisk.pem"; shift 2;;
                        *) CRT_FILE=$2; shift 2 ;;
                esac ;;
        --crt-key)
                case "$2" in
                        "") CRT_KEY="//etc//asterisk//keys//asterisk.key"; shift 2;;
                        *) CRT_KEY=$2; shift 2 ;;
                esac ;;
        --twilio-fqdn)
                case "$2" in
                      "") print_args ;;
                      *) TWILIO_FQDN=$2; shift 2 ;;
                esac ;;
        --stun-server)
                case "$2" in
                      "") print_args ;;
                      *) STUN_SERVER=$2; shift 2 ;;
                esac ;;
        --stun-port)
                case "$2" in
                      "") print_args ;;
                      *) STUN_PORT=$2; shift 2 ;;
                esac ;;
        --ami-user)
                case "$2" in
                      "") print_args ;;
                      *) AMI_USER=$2; shift 2 ;;
                esac ;;
        --ami-password)
                case "$2" in
                      "") print_args ;;
                      *) AMI_PASS=$2; shift 2 ;;
                esac ;;
        --extension-password)
                case "$2" in
                      "") print_args ;;
                      *) EXT_PASS=$2; shift 2 ;;
                esac ;;
        --mysql-user)
                case "$2" in
                      "") print_args ;;
                      *) MYSQL_USER=$2; shift 2 ;;
                esac ;;
        --mysql-password)
                case "$2" in
                      "") print_args ;;
                      *) MYSQL_PASS=$2; shift 2 ;;
                esac ;;
        --) shift ; break ;;
        *) echo "Error parsing args"; print_args;;
    esac
done

# Set defaults for non-required options

if [ -z $CRT_FILE ]
then
    echo -e "WARNING: no SSL/TLS certificate specified. Using to-be-generated\nself-signed Asterisk certificate."
    CRT_FILE="\/etc\/asterisk\/keys\/asterisk.crt"
fi

if [ -z $CRT_KEY ]
then
    CRT_KEY="\/etc\/asterisk\/keys\/asterisk.key"
fi


# Check for IPv6 and SElinux - we want both disabled
DISABLED="disabled"
SESTATUS=$(sestatus | head -1 | awk '{print $3}')
IPV6=$(cat /proc/net/if_inet6)

if [ $SESTATUS != $DISABLED ]
then
    echo "ERROR: SELinux must be disabled before running Asterisk. Disable SELinux, reboot the server, and try again."
    exit 1
fi

if [ -n "$IPV6" ]
then
    echo "ERROR: IPv6 must be disabled before installing Asterisk. See README.md for more information. Disable IPv6 then try again"
    exit 1
fi

# Check that a hostname has been set - if not, exit
HOSTNAME=$(hostname -f)
if [ -z $HOSTNAME ]
then
	echo "ERROR: no hostname set on this server. Set the hostname, then restart the script."
	echo $HOST_SUGG
	exit 1
fi

# Ask user to validate hostname
echo -e  "The hostname of this server is currently $HOSTNAME.\nIs this the hostname you want to use with Asterisk? (y/n)"
read response
if [ $response == "n" ]
	then
	echo "Exiting. Set the hostname, then rerun the script."
	echo $HOST_SUGG
	exit 0
fi

# Prompt user to update packages
echo "Packages in your system should be updated. Proceed? (y/n)"
read response2

if [ $response2 == "y" ]
then
    echo "Executing yum update"
    yum -y update
fi

# Installing pre-requisite packages
echo "Installing pre-requisite packages for Asterisk"
yum -y groupinstall -y 'Development Tools'
yum -y install -y epel-release bzip2 dmidecode gcc-c++ ncurses-devel libxml2-devel make wget netstat telnet vim zip unzip openssl-devel newt-devel kernel-devel libuuid-devel gtk2-devel jansson-devel binutils-devel git unixODBC unixODBC-devel libtool-ltdl libtool-ltdl-devel mysql-connector-odbc tcpdump sqlite-devel libsrtp libsrtp-devel

# Download Asterisk
mkdir -p /tmp/asterisk
cd /tmp/asterisk
wget http://downloads.asterisk.org/pub/telephony/asterisk/old-releases/asterisk-$AST_VERSION.tar.gz
tar -zxf asterisk-$AST_VERSION.tar.gz && cd asterisk-$AST_VERSION

# Install prerequisites
echo "Running install_prereq script"
./contrib/scripts/install_prereq install

# Build Asterisk
echo "Running .configure --with-pjproject-bundled --with-jansson-bundled"
./configure --with-pjproject-bundled --with-jansson-bundled

echo "Running make"
make

echo "Running make install"
make install

echo "Running make config"
touch /etc/redhat-release
make config

#run ldconfig so that Asterisk finds PJPROJECT packages
echo "Running ldconfig"
echo “/usr/local/lib” > /etc/ld.so.conf.d/usr_local.conf
/sbin/ldconfig
rm /etc/redhat-release

echo -e "Generating the Asterisk self-signed certificates. You will be prompted to\nenter a password or passphrase for the private key."
sleep 2
mkdir /etc/asterisk/keys
#generate TIS certificates
./contrib/scripts/ast_tls_cert -C $PUBLIC_IP -O "ACE Quill" -d /etc/asterisk/keys

# pull down confi/media files and add to /etc/asterisk and /var/lib/asterisk/sounds, respectively
#cd ~
#git clone $GIT_URL
#cd /home/centos/asterisk-codev
repo=$(dirname $startPath)
cd $repo
echo "Repo is $repo"
yes | cp -rf config/* /etc/asterisk

echo "These are the parameters provided:"
echo "HOSTNAME: $HOSTNAME"
echo "CRT_FILE: $CRT_FILE"
echo "CRT_KEY: $CRT_KEY"
echo "TWILIO FQDN: $TWILIO_FQDN"
echo "PUBLIC_IP: $PUBLIC_IP"
echo "LOCAL_IP: $LOCAL_IP"
echo "LOCAL_IP_MASK: $LOCAL_IP_MASK"
echo "STUN_SERVER: $STUN_SERVER"
echo "STUN_PORT: $STUN_PORT"
echo "EXT_PASS: $EXT_PASS"
echo "AMI_USER: $AMI_USER"
echo "AMI_PASS: $AMI_PASS"
echo "MYSQL_USER: $MYSQL_USER"
echo "MYSQL_PASS: $MYSQL_PASS"

# Modify configs with named params
echo "Modifiying /etc/asterisk config files"
cd /etc/asterisk
sed -i -e "s|<crt_file>|$CRT_FILE|g" http.conf pjsip.conf
sed -i -e "s|<crt_key>|$CRT_KEY|g" http.conf pjsip.conf
sed -i -e "s|<public_ip>|$PUBLIC_IP|g" pjsip.conf
sed -i -e "s|<twilio_fqdn>|$TWILIO_FQDN|g" pjsip.conf
sed -i -e "s|<local_ip>|$LOCAL_IP|g" pjsip.conf
sed -i -e "s|<local_ip_mask>|$LOCAL_IP_MASK|g" pjsip.conf
sed -i -e "s|<hostname>|$HOSTNAME|g" pjsip.conf
sed -i -e "s|<ext_password>|$EXTPASS|g" pjsip.conf
sed -i -e "s|<crt_file>|$CRT_FILE|g" http.conf
sed -i -e "s|<crt_key>|$CRT_KEY|g" http.conf
sed -i -e "s|<stun_server_port>|$STUN_SERVER:$STUN_PORT|g" res_stun_monitor.conf
sed -i -e "s|<stun_server_port>|$STUN_SERVER:$STUN_PORT|g" rtp.conf
sed -i -e "s|<ami_user>|$AMI_USER|g" manager.conf
sed -i -e "s|<ami_password>|$AMI_PASS|g" manager.conf
sed -i -e "s|<mysql_user>|$MYSQL_USER|g" cdr_mysql.conf res_odbc.conf
sed -i -e "s|<mysql_password>|$MYSQL_PASS|g" cdr_mysql.conf res_odbc.conf

echo ""
echo "NOTE: View the conf files in /etc/asterisk for more info."
echo ""
echo "     _    ____ _____    ___  _   _ ___ _     _       "
echo "    / \  / ___| ____|  / _ \| | | |_ _| |   | |      "
echo "   / _ \| |   |  _|   | | | | | | || || |   | |      "
echo "  / ___ \ |___| |___  | |_| | |_| || || |___| |___   "
echo " /_/   \_\____|_____|  \__\_\\\___/|___|_____|_____|  "
echo ""

echo "Installation is complete. When ready, run 'service asterisk start' as root to start Asterisk."
