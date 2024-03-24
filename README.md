## Guide + code to run VDO.Ninja without Internet on a local network

This guide was tested on a Raspberry Pi with a clean RPI OS installed ([the image of which is provided if desired](https://github.com/steveseguin/offline_deployment#rpi-provided-image-option))

Included with this guide is a custom Node.js server script (express.js), along with a linux service file to auto-start things on boot, if needed. You can probably use the Node.js on its own, but it's only intended for offline use -- I haven't tested for public use.

There is no STUN or TURN server provided in this guide/install, as those are probably not needed if using just over a LAN.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Installing from scratch](#installing-from-scratch)
- [RPI provided image option](#rpi-provided-image-option)
- [Docker option](#docker-option)
- [Getting OBS to play nice without Internet](#getting-obs-to-play-nice-without-internet)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


### Installing from scratch 

If installing via scratch, the following is a sample script that might get you going. I'd recommend you run each block manually, a bit at a time, to catch any errors or user input requirements along the way. This install script may run fine on a Ubuntu system, but it's only tested on a Raspberry Pi.

We will be using ports 443 and 8443, just in case you have those already in use, you may need to configure it yourself then.

```
### If using a Raspberry Pi, and if having issues updating
sudo chmod 777 /etc/resolv.conf
sudo echo "nameserver 1.1.1.1" >> /etc/resolv.conf
sudo chmod 644 /etc/resolv.conf
sudo chattr -V +i /etc/resolv.conf ### lock access
sudo systemctl restart systemd-resolved.service
export GIT_SSL_NO_VERIFY=1

### Update
sudo apt-get update
sudo apt-get upgrade -y

### Install dependencies
sudo apt-get install git -y
sudo apt-get install nodejs -y
sudo apt-get install npm -y
sudo apt-get install vim -y

### Install vdo.ninja 
git clone https://github.com/steveseguin/vdo.ninja

## configure vdo.ninja for local hss server
sed -i 's/\/\/ session\.customWSS = true;/session\.wss = "wss:\/\/"+window\.location\.hostname+":8443";session\.customWSS = true;/' ./vdo.ninja/index.html

### Install websocket server
git clone https://github.com/steveseguin/offline_deployment
mv offline_deployment webserver
cd webserver
npm install

## Lets create our self-signed certs
openssl req  -nodes -new -x509  -keyout key.pem -out cert.pem
## Just press enter to skip past the questions at the end of the process

## Make it available to the website, so you can download it and install it
cp cert.pem ../vdo.ninja/cert.pem

## create a service and start the server
sudo cp vdoninja.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vdoninja
sudo systemctl restart vdoninja

## or start our server directly ..
# sudo nodejs server.js

## show IP addresses
ifconfig 

```

You can then load the site at https://192.168.XXX.YYY/ or whereever its loaded.  Accept any SSL concerns or what not (see https://github.com/steveseguin/vdo.ninja/blob/develop/install.md#dealing-with-no-ssl-scenarios for more details)

You may need to download and install the cert https://192.168.XXX.YYY/cert.pem if you don't have allowances for self-signed certs. The required cert is located at https://192.168.XXX.YYY/cert.pem for easy download.

### RPI provided image option

I'm providing a RPi image, but WiFi will need to be configured via boot config, Ethernet, or with keyboard/mouse, or however.

[Download it here](https://drive.google.com/file/d/10WtVXUh7yHxWmdSaR95-E_M3pnUNUtvr/view?usp=sharing) ( 2.4-GB zipped )

The image uses the following user/pass combo:
```
username: vdo 
password: ninja
```

It requires an 8-GB uSD card or larger; if it's too big, you'll need to PiShrink it down first using: https://ostechnix.com/pishrink-make-raspberry-pi-images-smaller/
(I may get around to doing that in the future)

Just burn the image following any RPi guide, login in, and get going.  Currently I think v22.10 (beta) is installed, so probably out of date. You can update, but if you do, you may need to run `sed -i 's/\/\/ session\.customWSS = true;/session\.wss = "wss:\/\/"+window\.location\.hostname+":8443";session\.customWSS = true;/' ./vdo.ninja/index.html` from the home user folder after, or manually update the index.html to point to the local wss server. Depending on how you update, it may not be needed though.

You can then load the site at https://192.168.XXX.YYY/ or whereever its loaded.  Accept any SSL concerns or what not (see https://github.com/steveseguin/vdo.ninja/blob/develop/install.md#dealing-with-no-ssl-scenarios for more details)

You may need to download and install the cert https://192.168.XXX.YYY/cert.pem if you don't have allowances for self-signed certs. The required cert is located at https://192.168.XXX.YYY/cert.pem for easy download.

### Docker option

There's now a docker option to deploy a basic offline-version of VDO.Ninja also, supplied by @hamza1311. Thank you.

#### How to use

1. Mount your certificates
2. Set environment variables `CERT_PATH` and `KEY_PATH` for the certificate and private key respectively
3. Bind port 8443
    3.1. **Note:** the port _can_ be different but you may run into issues where port is hardcoded to be 8443

#### Example

```
docker run --mount type=bind,source="$(pwd)"/certs,target=/var/certs -e KEY_PATH=/var/certs/private.key -e CERT_PATH=/var/certs/certificate.crt -p 8443:8443 vdoninja
```

### Getting OBS to play nice without Internet

If on Windows, OBS uses the same certificates as Chrome does, so adding self-signed certs to Chrome works for users there. There may be a URL parameter to disable SSL checking as well, but I can't seem to find it at the moment.

On Mac, I loosely recall I needed to add the self-signed certs to the local system's keychain for it to work. 

@hamza1311 mentioned when deploying on Linux, to get OBS to play nice, they used real SSL certificates for their domain, and then had things point to their local IP in `/etc/hosts`.

Please let me know if you find additional ways to handle SSL certifcates offline, or other ways of ensureing webRTC plays nice.
