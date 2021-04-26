const fs = require("fs")
const { exec } = require('child_process')
const { getReportPath } = require('../../../config');
const { JUPYTER_PATH, WKPDFTOHTML_PATH, APP_PATH } = require('zerotheft-node-utils/config')
const { createLog, MAIN_PATH } = require('../LogInfoServices')

const generateReport = async (noteBookName, fileName, year, isPdf = 'false') => {
    createLog(MAIN_PATH, `Generating Report for the year ${year} with filename: ${fileName}`)
    return new Promise((resolve, reject) => {
        let newNoteBook = isPdf === 'false' ? noteBookName : `temp_${noteBookName}`
        // console.log(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${noteBookName}'`)
        exec(`rm -rf ${getReportPath()}__pycache__ && NB_ARGS='{"file": "${fileName}", "year": ${year}, "isPdf": "${isPdf}"}' ${JUPYTER_PATH} nbconvert --to=html ${getReportPath()}${noteBookName}.ipynb --TagRemovePreprocessor.enabled=True --TagRemovePreprocessor.remove_cell_tags='{"remove_cell"}' --TagRemovePreprocessor.remove_input_tags='{"remove_input"}' --TagRemovePreprocessor.remove_single_output_tags='{"remove_output"}' --execute --output-dir='${getReportPath()}reports/${newNoteBook}'`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

const generatePDF = async (folder, pdfReportName) => {
    createLog(MAIN_PATH, `Generating PDF for ${folder}/${pdfReportName}`)
    return new Promise((resolve, reject) => {
        // console.log(`${WKPDFTOHTML_PATH} --header-left "Report" --footer-right [page]/[topage] --margin-top 2cm --margin-bottom 2cm --lowquality ${folder}/${pdfReportName}.html ${folder}/${pdfReportName}.pdf`)
        exec(`${WKPDFTOHTML_PATH} --header-left "Report" --footer-right [page]/[topage] --margin-top 2cm --margin-bottom 2cm --lowquality ${folder}/${pdfReportName}.html ${folder}/${pdfReportName}.pdf`, (error, stdout, stderr) => {
            resolve()
        })
    })
}

const mergePdfForNation = async (folder, pdfFileName, allPdfs) => {
    createLog(MAIN_PATH, `Merging PDF for the nation ${folder}/${pdfFileName}`)
    return new Promise((resolve, reject) => {
        exec(`java -jar ${APP_PATH}/pdftk/build/jar/pdftk.jar ${allPdfs} cat output ${folder}/${pdfFileName}.pdf && rm -rf ${getReportPath()}reports/temp_multiIssueReport`, (error, stdout, stderr) => {
            resolve()
        })
    })
}

const generatePageNumberFooter = async (folder, noFooterFileName, fileName, footer = 'ZeroTheft Total Theft Report') => {
    createLog(MAIN_PATH, `Generating Page number footer ${folder}/${fileName}`)
    return new Promise((resolve, reject) => {
        exec(`enscript --fancy-header=footer -L1 -b'||' --footer '|| ${footer} - Page $%' -o- < \
        <(for i in $(seq 1 200); do echo; done) | \
        ps2pdf - | \
        java -jar ${APP_PATH}/pdftk/build/jar/pdftk.jar '${folder}/${noFooterFileName}.pdf' multistamp - output '${folder}/${fileName}.pdf'`, { shell: '/bin/bash' }, (error, stdout, stderr) => {
            resolve()
        })
    })
}

const renameHTMLFile = async (oldFileName, newFileName, filePath = `${getReportPath()}reports/${oldFileName}/`) => {
    createLog(MAIN_PATH, `Renaming html file from ${filePath}${oldFileName} to ${filePath}${newFileName}`)
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${filePath}${newFileName}.html && mv ${filePath}${oldFileName}.html ${filePath}${newFileName}.html`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

const renamePDFFile = async (oldFileName, newFileName, filePath = `${getReportPath()}reports/${oldFileName}/`) => {
    createLog(MAIN_PATH, `Renaming pdf file from ${filePath}${oldFileName} to ${filePath}${newFileName}`)
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${filePath}${newFileName}.pdf ${filePath}${oldFileName}.html && mv ${filePath}${oldFileName}.pdf ${filePath}${newFileName}.pdf`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

const deleteJsonFile = async (fileName) => {
    createLog(MAIN_PATH, `Deleting json file from inpus json with filename:: ${fileName}`)
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${getReportPath()}input_jsons/${fileName}.json`, (error, stdout, stderr) => {
            if (error) {
                reject({ message: `exec error: ${error}` })
            }
            resolve()
        })
    })
}

module.exports = {
    generateReport,
    generatePDF,
    mergePdfForNation,
    generatePageNumberFooter,
    renameHTMLFile,
    renamePDFFile,
    deleteJsonFile,
}