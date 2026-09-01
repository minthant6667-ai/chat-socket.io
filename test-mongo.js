require('dotenv').config()

const { MongoClient } = require('mongodb')

const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  tls: true,
  tlsVersion: 'TLSv1.2',
})

async function testMongoDB() {
  try {
    await client.connect()

    console.log('MongoDB driver connected ✅')

    await client.db('chatapp').command({ ping: 1 })

    console.log('MongoDB ping successful ✅')
  } catch (error) {
    console.error('MongoDB driver error:')
    console.error(error)
  } finally {
    await client.close()
  }
}

testMongoDB()