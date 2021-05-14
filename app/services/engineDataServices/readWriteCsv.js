const fs = require('fs');
const ObjectsToCsv = require('objects-to-csv');

const createCsv = (path, keys) => {
  if (!fs.existsSync(path))
    fs.writeFileSync(path, keys + "\n", 'utf8')
}

const writeCsv = async (data, path, reWrite = false) => {
  if (reWrite && fs.existsSync(path))
    fs.unlinkSync(path)
  createCsv(path, Object.keys(data[0]), reWrite)
  new ObjectsToCsv(data).toDisk(path, { append: true });

}

module.exports = {
  writeCsv
}