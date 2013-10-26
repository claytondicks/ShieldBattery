// Simple UDP NAT traversal, meant to be used only in the initial setup of a connection and then
// replaced with your actual transport protocol
var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , udp = require('dgram')

// port - port to bind to and receive packets on
// name - a unique (within the set of machines you wish to holepunch with) name, used to verify that
//   packets have been generated by holepunch
module.exports = function(port, name) {
  return new HolePuncher(port, name)
}

function HolePuncher(port, name, punchIntervalMs) {
  EventEmitter.call(this)
  this._port = port
  this._syn = new Buffer('?' + name, 'utf8')
  this._ack = new Buffer('!' + name, 'utf8')
  this._punchInterval = punchIntervalMs || HolePuncher.DEFAULT_INTERVAL

  this._punchTargets = Object.create(null)
  this._completedPunches = 0
  this._outstandingPunches = 0

  this._socket = udp.createSocket('udp4')
  this._listening = false
  this._socket.on('error', function (err) {
    this.emit('error', err)
  }.bind(this)).on('listening', function() {
    this._listening = true
    if (this._outstandingPunches > 0) {
      Object.keys(this._punchTargets).forEach(function (key) {
        this._beginPunch(this._punchTargets[key])
      }.bind(this))
    }
  }.bind(this)).on('message', this._onMessage.bind(this))

  this._socket.bind(port)
}
util.inherits(HolePuncher, EventEmitter)

HolePuncher.DEFAULT_INTERVAL = 500

function key(port, address) {
  return port + ':' + address
}

// Attempt to punch a hole to a destination.
// port - destination port
// address - destination host/IP
// name - name (unique in the set of destinations) that the destination machine will be using
// cb - callback to be called when the hole is punched successfully, or when the puncher is stopped
//   and no hole has been punched yet
HolePuncher.prototype.punch = function(port, address, name, cb) {
  if (this._punchTargets[key(port, address)]) {
    cb(new Error('A punch is already in progress for this destination'))
    return
  }

  // TODO(tec27): dgram accepts hostnames (and does a lookup to convert them to IPs). This could
  // result in us getting messages from an IP, but storing the host (and thus not being able to
  // match them). We should pre-lookup the IP if passed a host and store it instead
  var target =  { port: port
                , address: address
                , name: '' + name
                , cb: cb
                }
  this._punchTargets[key(port, address)] = target
  this._outstandingPunches++
  this._beginPunch(target)
}

HolePuncher.prototype.stop = function() {
  Object.keys(this._punchTargets).forEach(function(key) {
    var target = this._punchTargets[key]
    if (target.interval) {
      clearInterval(target.interval)
    }
    if (target.cb) {
      target.cb(new Error('Closed before a successful punch was made'))
    }
    delete this._punchTargets[key]
  }.bind(this))
  this._socket.close()
  this._listening = false
  this.emit('stopped')
}

HolePuncher.prototype._beginPunch = function(target) {
  if (!this._listening) return

  this.emit('punching', target.port, target.address, target.name)
  var punchFunc = function() {
    var data = !target.received ? this._syn : this._ack
      , isAck = target.received
    this._socket.send(data, 0, data.length, target.port, target.address, function(err, bytes) {
      if (!err && isAck) {
        target.sentAck = true
        if (target.gotAck) {
          // success!
          this._completePunch(target)
        }
      }
    }.bind(this))
  }.bind(this)

  target.interval = setInterval(punchFunc, this._punchInterval)
  punchFunc()
}

HolePuncher.prototype._onMessage = function(msg, rinfo) {
  var target = this._punchTargets[key(rinfo.port, rinfo.address)]
  if (!target || !target.cb || !msg.length) return

  var synAckChar = msg.toString('utf8', 0, 1)
    , isSyn = synAckChar == '?'
    , isAck = synAckChar == '!'
  if (!(isSyn || isAck)) return

  var name = msg.toString('utf8', 1)
  if (name != target.name) return

  if (!target.received) {
    // received!
    target.received = true
    this.emit('received', target.port, target.address, target.name)
  }
  if (isAck && !target.gotAck) {
    target.gotAck = true
    this.emit('acked', target.port, target.address, target.name)
  }

  if (isAck && target.sentAck) {
    // success!
    this._completePunch(target)
  }
}

HolePuncher.prototype._completePunch = function(target) {
  var cb = target.cb // ensure that #stop() can be called from a callback without erroneous errors
  ;delete target.cb
  cb.call(this, null)
  this.emit('punched', target.port, target.address, target.name)
  this._completedPunches++

  if (this._completedPunches == this._outstandingPunches) {
    this.emit('finished')
  }
}
