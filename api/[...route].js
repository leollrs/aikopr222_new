import app from '../server/chat-server.js'

export default function handler(req, res) {
  return app(req, res)
}
