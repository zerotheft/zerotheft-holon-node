const pathsService = require('../services/pathsService')


const allNations = async (req, res, next) => {
  try {
    const nations = await pathsService.allNations()
    res.send(nations)
  } catch (e) {
    console.log('allNations::', e)
    next(e.message)
  }
}

const pathsByNation = async (req, res, next) => {
  try {
    const { nation } = req.query
    const paths = await pathsService.pathsByNation(nation)
    if (!!paths) {
      return res.send(paths)
    } else {
      next('no paths available')
    }
  } catch (e) {
    next(e.message)
  }
};

const getPath = async (req, res, next) => {
  try {
    const { dir } = req.params
    const { year } = req.query
    const response = await pathsService.getPath(decodeURIComponent(dir), year)
    return res.send(response)
  } catch (e) {
    next(e.message)
  }
};

const getUmbrellaPaths = async (req, res, next) => {
  try {
    const response = await pathsService.getUmbrellaPaths()
    return res.send(response)
  } catch (e) {
    next(e.message)
  }
};

module.exports = {
  allNations,
  pathsByNation,
  getPath,
  getUmbrellaPaths
}
