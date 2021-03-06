'use strict';
(() => {
    
    const https = require('https');
    const fs = require('fs');
    const { spawn } = require('child_process');

    
    
    (function scopeWebServer() {
        let server;
        const runWebServer = (passphrase) => {
            const options = {
                pfx: fs.readFileSync('./2048/crt.pfx'),
                passphrase
            };
            server = https.createServer(options);
            
            server.on('request', (request, response) => {
                getDateStr(dateStr => {
                    response.writeHead(200, {
                        'Content-Type': 'text/plain',
                        'Content-Length': Buffer.byteLength(dateStr),
                    });
                    response.end(dateStr);
                });
            });
            server.listen(_port, () => console.log(`WebServer listening`));
        };
        
        
        
        const getDateStr = callback => {
            const _date = new Date();
            callback(`${_date.getFullYear()}-${_date.getMonth() + 1}-${_date.getDate()} ${_date.getHours()}:${_date.getMinutes()}:${_date.getSeconds()}.${_date.getMilliseconds()}`);
        };
        
        
        
        const generateRandom = (length) => {
            const lengthId = 20;
            let randomId = '';
            for (let ix = 0; ix < length; ix++) {
                const random = Math.floor(Math.random() * (62));
                if (random >= 36)
                    randomId += String.fromCharCode(random + 61);
                else if (random >= 10)
                    randomId += String.fromCharCode(random + 55);
                else
                    randomId += random;
            }
            return randomId;
        };
        
        
        const generateRandomSsl = function () {
            return new Promise((resolve, reject) => {
                const generatePrivateKey = () => {
                    const privateKey = spawn('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', './2048/key.key']);
                    privateKey.on('close', (code) => {
                        console.log(`privateKey process exited with code ${code}`);
                        if (code === 0) generateCerteficateSignRequest();
                        else reject();
                    });
                };
                const generateCerteficateSignRequest = () => {
                    let counter = -1;
                    const annoyingQuestions = { 1: 'NL', 2: 'Nort Holland', 3: 'Amsterdam', 4: 'Beer End', 5: 'R&D', 6: '192.168.2.13', 7: 'berend_kemper@hotmail.com' }
                    const csr = spawn('openssl', ['req', '-config', './ssl/csr.cnf', '-new', '-key', './2048/key.key', '-inform', 'PEM', '-out', './2048/csr.csr', '-outform', 'PEM']);
                    csr.stderr.on('data', (data) => {
                        csr.stdin.write(`${annoyingQuestions[++counter] || '.'}\n`);
                    });
                    csr.on('close', (code) => {
                        console.log(`CerteficateSignRequest process exited with code ${code}`);
                        if (code === 0) generateSelfSignedCertificate();
                        else reject();
                    });
                };
                const generateSelfSignedCertificate = () => {
                    const crt = spawn('openssl', ['x509', '-req', '-days', '3', '-in', './2048/csr.csr', '-signkey', './2048/key.key', '-out', './2048/crt.crt', '-extfile', './ssl/crt.cnf', '-extensions', 'v3_ca'])
                    crt.on('close', (code) => {
                        console.log(`SelfSignedCertificate process exited with code ${code}`);
                        if (code === 0) generatePublicKeyPKCS12();
                        else reject();
                    });
                };
                const generatePublicKeyPKCS12 = () => {
                    const passphrase = generateRandom(20);
                    let counter = 0;
                    const publicKey = spawn('openssl', ['pkcs12', '-export', '-out', './2048/crt.pfx', '-inkey', './2048/key.key', '-in', './2048/crt.crt']);
                    publicKey.stderr.on('data', data => {
                        counter++;
                        if (counter === 1)
                            publicKey.stdin.write(`${passphrase}\n`);
                        if (counter === 2)
                            setTimeout(() => publicKey.stdin.write(`${passphrase}\n`), 200);
                    });
                    publicKey.on('close', (code) => {
                        console.log(`PublicKeyPKCS12 process exited with code ${code}`);
                        if (code === 0) return resolve(passphrase);
                        else reject();
                    });
                };
                generatePrivateKey();
            });
        };
        let then = new Date();
        setImmediate(() => (function startEvent() {
            const now = new Date();
            if (now > then) {
                generateSsl().then(passphrase => {
                    if (server instanceof http.Server) server.close();
                    runWebServer(passphrase);
                });
                then = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 2, 0, 0, 0);
            }
            // console.log('minute tick');
            setTimeout(() => startEvent(), 60000);
        })());
    })();
})();

