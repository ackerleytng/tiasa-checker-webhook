#!/usr/bin/env node

const webtask = require('./webtask.js')

if (process.argv.length != 3) {
  console.log("Usage: ")
  console.log(`  ${process.argv.join(' ')} <check-command>`)
  console.log("Example: ")
  console.log(`  ${process.argv.join(' ')} /check@tiasa_checker_bot`)
  process.exit(1)
}

const command = process.argv[2]

const callback = function(_, output) {
  console.log({"returned": output})
}

const ctx = {
  "data": {
    "message": {
      "text": command,
      "chat": {
        "id": "00000000"
      }
    },
    "isCli": true
  }
}

webtask(ctx, callback)
