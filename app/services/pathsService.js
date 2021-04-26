const { allNations, pathsByNation, getPathDetail } = require('zerotheft-node-utils').paths
const { getUmbrellaPaths } = require('zerotheft-node-utils/utils/github')
module.exports = {
  allNations,
  pathsByNation,
  getPath: getPathDetail,
  getUmbrellaPaths
}
