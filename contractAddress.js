const MODE = process.env.REACT_APP_MODE || process.env.NODE_ENV;
const https = require('https');
const fs = require('fs');

return new Promise((resolve, reject) => {
  const filePath = `./contracts.${MODE}.json`
  console.log("MODE: ", MODE)
  const awsPath = `https://zerotheft-holon.s3.us-east-1.amazonaws.com/contracts.${MODE}.json`
  const file = fs.createWriteStream(filePath);
  https.get(awsPath, function (response) {
    response.pipe(file);
    resolve();
  });
})