const request = require('request')
const moment = require('moment')
const cheerio = require('cheerio')

const getBaseUrl = function (ctx) {
  return `https://api.telegram.org/bot${ctx.secrets.botApiKey}/`
}

const sendMessage = function (ctx, chatId, message) {
  if (ctx.data.isCli) {
    console.log(message)
  } else {
    request.post(`${getBaseUrl(ctx)}sendMessage`, {
      form: {
        'chat_id': chatId,
        'text': message
      }
    })
  }
}

const isReasonableTime = function (time) {
  if (time.includes('am')) {
    const t = parseInt(time)
    return t >= 10 && t !== 12
  } else if (time.includes('pm')) {
    // 9 because 9:30 is the last slot beginning before 10 pm
    return parseInt(time) <= 9
  } else {
    return false
  }
}

const getTimes = function (reply) {
  const $ = cheerio.load(reply)
  return $('a').map(function (i, e) { return $(this).text() }).get()
    .filter(isReasonableTime)
}

const makeStringFromTimes = function (times) {
  var timeslots = []

  for (var time in times) {
    timeslots.push([time, times[time]])
  }

  if (timeslots.length === 0) {
    return 'No available slots.'
  } else {
    return timeslots.sort(function (a, b) {
      function convert (string) {
        return moment(`2000-01-01 ${string}`, 'YYYY-MM-DD h:mm a')
      }
      return convert(a).diff(convert(b))
    })
      .map(e => [e[0], e[1].map(x => `Court ${x}`).join(', ')])
      .map(e => `+ ${e[0]}: ${e[1]}`)
      .join('\n')
  }
}

const askTiasa = function (ctx, chat, date) {
  if (date === undefined) {
    console.log('date is undefined')
    return
  }

  function buildData (date, court) {
    const representation = {
      1: 133,
      2: 151
    }

    const dataString = `wc_bookings_field_duration=2&wc_bookings_field_start_date_year=${date.format('YYYY')}&wc_bookings_field_start_date_month=${date.format('MM')}&wc_bookings_field_start_date_day=${date.format('DD')}&wc_bookings_field_start_date_time=&addon-${representation[court]}-stick-rental%5Baddons-total%5D=&add-to-cart=${representation[court]}`

    return {
      'action': 'wc_bookings_get_blocks',
      'form': dataString
    }
  }

  var url = 'http://www.tiasafloorball.com/wp-admin/admin-ajax.php'

  var times = {}

  function callbackCourt2 (error, response, body) {
    if (!error && response.statusCode === 200) {
      getTimes(body).forEach(function (e, i) {
        if (e in times) {
          times[e].push(2)
        } else {
          times[e] = [2]
        }
      })

      const day = date.format('dddd, MMMM Do YYYY')
      const timesString = makeStringFromTimes(times)
      const message = `${day}:\n${timesString}`
      sendMessage(ctx, chat, message)
    }
  }

  function callbackCourt1 (error, response, body) {
    if (!error && response.statusCode === 200) {
      getTimes(body).forEach(function (e, i) {
        times[e] = [1]
      })

      request.post(url, callbackCourt2).form(buildData(date, 2))
    }
  }

  request.post(url, callbackCourt1).form(buildData(date, 1))
}

/**
 * Given a request, identifies and returns the first word that contains anything that
 *   seems like a day
 */
const findDay = function (request) {
  const keywords = ['mon', 'tue', 'wed', 'thur', 'fri', 'sat', 'sun']
  function isDayWord (e, i, arr) {
    for (var k of keywords) {
      if (e.includes(k)) {
        return true
      }
    }
    return false
  }

  const words = request.split(' ')
  for (var w of words) {
    if (isDayWord(w)) {
      return w
    }
  }

  return ''
}

const handleRequest = function (ctx, chat, request) {
  request = request.toLowerCase().trim()

  // Default blank request to this weekend
  if (request.length === 0) {
    request = 'this weekend'
  }

  const originalRequest = request

  // Handle 'today'
  if (request.includes('today')) {
    sendMessage(ctx, chat, 'Checking for slots for today...')
    askTiasa(ctx, chat, moment())
    return
  }

  // Handle 'tomorrow'
  if (request.includes('tomorrow')) {
    sendMessage(ctx, chat, 'Checking for slots for tomorrow...')
    askTiasa(ctx, chat, moment().add(1, 'day'))
    return
  }

  // Handle 'day after'
  if (request.includes('day after')) {
    sendMessage(ctx, chat, 'Checking for slots for day after...')
    askTiasa(ctx, chat, moment().add(2, 'day'))
    return
  }

  var dateToAsk

  // Handle a date, assuming format '1' or '1st'
  const requestedDate = parseInt(request)
  if (requestedDate) {
    sendMessage(ctx, chat, `Checking for slots on a specific date: ${originalRequest}...`)

    dateToAsk = moment().date(requestedDate)
    if (dateToAsk.isBefore(moment())) {
      dateToAsk = dateToAsk.add(1, 'month')
    }
    askTiasa(ctx, chat, dateToAsk)
    return
  }

  // Handle relative dates
  var weeksToAdd = 0

  if (request.includes('this') ||
      request.includes('next') ||
      request.includes('coming')) {
    // For all these, we will just get whichever day closest to moment()
    request = request
      .replace('this', '')
      .replace('next', '')
      .replace('coming', '').trim()
    // weeksToAdd remains at 0
  }

  // Handles cases like 'next next sunday'
  while (request.includes('next')) {
    request = request.replace('next', '').trim()
    weeksToAdd++
  }

  const day = findDay(request)

  if (day.length === 0) {
    // Handles cases like "next weekend" or "next next weekend"
    if (request.includes('weekend')) {
      sendMessage(ctx, chat, `Checking for slots for ${originalRequest}...`)
      askTiasa(ctx, chat, moment().day(weeksToAdd * 7 + 6))
      askTiasa(ctx, chat, moment().day(weeksToAdd * 7 + 7))
    } else {
      sendMessage(ctx, chat, 'Not sure what you meant there...')
    }
    return
  }

  dateToAsk = moment().add(weeksToAdd, 'week').day(day)
  if (dateToAsk.isBefore(moment()) || dateToAsk.isSame(moment(), 'day')) {
    dateToAsk = dateToAsk.add(1, 'week')
  }
  askTiasa(ctx, chat, dateToAsk)
}

module.exports = function (ctx, cb) {
  const body = ctx.body

  var command
  var chat

  if (body.message !== undefined) {
    command = body.message.text
    chat = body.message.chat.id
  } else if (body.edited_message !== undefined) {
    command = body.edited_message.text
    chat = body.edited_message.chat.id
  } else {
    console.log(body)
    cb(null, {status: 'message undefined'})
    return
  }

  console.log(`Saw |${command}| from ${chat}`)

  // Remove the prefix if necessary. This removes /check and /check@whatever_till_end_of_word
  const input = command.replace(/\/check[@a-zA-Z_]*([^@a-zA-Z_]|$)/, '')
  handleRequest(ctx, chat, input)

  cb(null, {status: 'ok'})
}
