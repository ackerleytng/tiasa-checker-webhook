const axios = require('axios')
const querystring = require('querystring')
const moment = require('moment-timezone')
const cheerio = require('cheerio')

// ---------------------------------------
//  Telegram-related functions
// ---------------------------------------

const getBaseUrl = function (ctx) {
  return `https://api.telegram.org/bot${ctx.secrets.botApiKey}/`
}

const sendMessage = function (ctx, chatId, message) {
  if (ctx.body.isCli) {
    console.log(message)
  } else {
    axios.post(
      `${getBaseUrl(ctx)}sendMessage`,
      querystring.stringify({
        chat_id: chatId,
        text: message
      })
    )
  }
}

// ---------------------------------------
//  valhall query functions
// ---------------------------------------

const union = (setA, setB) => {
    let _union = new Set(setA)
    for (let elem of setB) {
        _union.add(elem)
    }
    return _union
}

const extractAuthorization = (body) => {
  const $ = cheerio.load(body);
  const instances = $('iframe').map(function (i, f) { return $(this).attr('data-src') });
  const indices = Object.keys(instances).filter((i) => !isNaN(parseInt(i, 10)));

  for (i in indices) {
    if (instances[i].startsWith('https://bookings.wixapps.net')) {
      const kvs = instances[i].split('&');
      const m = new Map(kvs.map((v) => v.split('=')));

      return m.get('instance');
    }
  }

  return null;
}

const uuids = {
  court1: {
    offPeak: '91021a5a-a738-42a3-88c1-94545f07ee34',
    peak: 'fc2a234c-02a2-4bce-9323-78bcd72ec02a',
  },
  court2: {
    offPeak: '087089fd-bf3a-466d-b3cc-d05bceaf8371',
    peak: 'd8342232-bd73-4b69-8400-b9ebb040c40e',
  }
}

/**
 * Makes a single request, given the uuid of the booking page, and a unix timestamp
 *
 * token: token, from getAuthorizationToken
 * uuid: uuid of the booking page
 * unixTime: unix timestamp
 */
const request = async (token, uuid, unixTime) => {
  const addr = `https://bookings.wixapps.net/_api/bookings-viewer/visitor/staff/slots/${uuid}/${unixTime}/${unixTime}?tz=Asia/Singapore`

  return await axios(addr, { headers: { authorization: token } }).then((res) => res.data)
}

/**
 * Given data in wix's format, return an array of moment objects
 */
const getTimes = (data) => {
  const slotsValues = Object.values(data['slots']);

  if (slotsValues.length === 0) {
    return [];
  }

  const tsSet = slotsValues[0]
        .map((o) => o['slots'])
        .reduce(union, new Set());

  return Array.from(tsSet).map((t) => moment(t));
}

/**
 * Gets an authorization token for further queries
 *   Use peak-weekend-for-court-1 just to get the authorization information.
 *   Same token can be used for querying other courts and for both peak and off peak
 */
const getAuthorizationToken = () => axios
      .get('https://www.valhall.asia/bookings-checkout/peak-weekend-for-court-1/book')
      .then((r) => extractAuthorization(r.data));

/**
 * Queries website for a single day's availability
 *   Returns an array of moment objects
 * token: the token to access the website, from getAuthorizationToken()
 * court: either 'court1' or 'court2'
 * timestamp: a unix timestamp for the day we're interested in
 */
const queryDayCourt = async (token, court, timestamp) => {
  const data = await Promise.all(Object.values(uuids[court]).map((u) => request(token, u, timestamp)));
  const flattened = [].concat(...data.map(getTimes));

  // Remove duplicates by timestamp
  return Array.from(new Map(flattened.map((m) => [m.format('x'), m])).values());
}

const queryDay = (token, timestamp) => Promise.all([
  queryDayCourt(token, 'court1', timestamp),
  queryDayCourt(token, 'court2', timestamp)
]);

// ---------------------------------------
//  Output formatting functions
// ---------------------------------------

const makeTimeslotsString = ([court1Timings, court2Timings]) => {
  // Use ISO String to merge maps
  //   because if it's a moment, then we have to deal with object equality
  const timeslots = new Map(court1Timings.map((m) => [m.toISOString(), [1]]));

  // Add court 2 availability
  for (const m of court2Timings) {
    const ts = m.toISOString();
    const v = timeslots.get(ts);
    if (v) {
      v.push(2)
    } else {
      timeslots.set(ts, [2])
    }
  }

  return Array.from(timeslots.entries())
    .sort((a, b) => moment(a[0]).diff(moment(b[0])))
    .map(e => [moment(e[0]).tz('Asia/Singapore').format('hh:mm a'),
               e[1].map(x => `Court ${x}`).join(', ')])
    .map(e => `+ ${e[0]}: ${e[1]}`)
    .join('\n')
}

const makeMessage = (reqDate, timings) => {
  const timeslotString = makeTimeslotsString(timings);
  const day = reqDate.format('dddd, MMMM Do YYYY')
  return `${day}:\n${timeslotString}`
}

// ---------------------------------------
//  Main asking function
// ---------------------------------------

const askTiasa = async function (ctx, chat, date) {
  if (date === undefined) {
    console.log('date is undefined')
    return
  }

  const token = await getAuthorizationToken();
  const timeslots = await queryDay(token, date.format('x'));
  const message = makeMessage(date, timeslots);

  sendMessage(ctx, chat, message);
}

// ---------------------------------------
//  Input parsing functions
// ---------------------------------------

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
