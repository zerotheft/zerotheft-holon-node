const redis = require('redis')
const bluebird = require('bluebird')

bluebird.promisifyAll(redis)

const client = redis.createClient()

client.on('error', error => {
  console.error(error)
})

cacheServer = client
module.exports = {
  cacheServer,
  redis,
}
