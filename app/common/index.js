const fs = require('fs')
const yaml = require('js-yaml');
const https = require('https');
const config = require('zerotheft-node-utils/config')
const PUBLIC_PATH = `${config.APP_PATH}/public`

const writeFile = async (filePath, input) => {
    const jsonString = JSON.stringify(input)
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, jsonString, err => {
            if (err) {
                reject({ message: err })
            }
            resolve()
        })
    })
}
const createDir = async (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
const respondWithPDF = (fileName, res) => {
    const file = fs.createReadStream(fileName)
    const stat = fs.statSync(fileName)
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf')
    file.pipe(res)
}

const readFromIPFS = async (ipfsHash) => {
    return new Promise((resolve, reject) => {
        const url = `https://ipfs.io/ipfs/${ipfsHash}`
        https.get(url, (res) => {
            let body = ""
            res.on("data", (chunk) => {
                body += chunk
            })

            res.on("end", () => {
                try {
                    const data = yaml.safeLoad(body)
                    resolve(data)
                } catch (error) {
                    reject(error.message)
                }
            })
        }).on("error", (error) => {
            reject(error.message)
        })
    })
}

const convertUnixValToDate = (unixVal) => {
    const date = new Date(unixVal * 1000);
    const hours = date.getHours();
    // Minutes part from the timestamp
    const minutes = "0" + date.getMinutes();
    // Seconds part from the timestamp
    const seconds = "0" + date.getSeconds();
    const formattedDateTime = date.toString() + " " + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    return formattedDateTime
}

module.exports = {
    PUBLIC_PATH,
    writeFile,
    createDir,
    respondWithPDF,
    readFromIPFS,
    convertUnixValToDate
}
