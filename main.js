#! /usr/bin/env node

const moment = require('moment')
const request = require('request')
const cheerio = require('cheerio')

const isReasonableTime = function(time) {
    if (time.includes("am")) {
        const t = parseInt(time)
        return t >= 10 && t != 12
    } else if (time.includes("pm")) {
        return parseInt(time) <= 9
    } else {
        return false
    }
}

const getTimes = function(reply) {
    const $ = cheerio.load(reply)
    return $('a').map(function(i, e) { return $(this).text() }).get()
        .filter(isReasonableTime)
}

const makeStringFromTimes = function(times) {
    var timeslots = []

    for (var time in times) {
        timeslots.push([time, times[time]])
    }

    if (timeslots.length == 0) {
        return "No available slots."
    } else {
        return timeslots.sort(function(a, b) {
            function convert(string) {
                return moment(`2000-01-01 ${string}`, 'YYYY-MM-DD h:mm a')
            }
            return convert(a).diff(convert(b))
        })
            .map(function(e) { return [e[0], e[1].map(function (x) { return `Court ${x}` }).join(', ')] })
            .map(function(e) { return `+ ${e[0]}: ${e[1]}` })
            .join('\n')
    }
}

const askTiasa = function(date) {
    function buildData(date, court) {
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

    function callbackCourt2(error, response, body) {
        if (!error && response.statusCode == 200) {
            getTimes(body).forEach(function(e, i) {
                if (e in times) {
                    times[e].push(2)
                } else {
                    times[e] = [2]
                }
            })
            
            const day = date.format('dddd, MMMM Do YYYY')
            const timesString = makeStringFromTimes(times)
            const message = `${day}:\n${timesString}`
            console.log(message)
        }
    }
    
    function callbackCourt1(error, response, body) {
        if (!error && response.statusCode == 200) {
            getTimes(body).forEach(function(e, i) {
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
const findDay = function(request) {
    const keywords = ["mon", "tue", "wed", "thur", "fri", "sat", "sun"]
    function isDayWord(e, i, arr) {
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
    
    return ""
}

const handleRequest = function(request) {
    request = request.toLowerCase().trim()
    
    // Default blank request to this weekend
    if (request.length === 0) {
        request = "this weekend"
    }

    const original_request = request

    // Handle "today"
    if (request.includes("today")) {
        console.log("Checking for slots for today...")
        askTiasa(moment())
        return
    }

    // Handle "tomorrow"
    if (request.includes("tomorrow")) {
        console.log("Checking for slots for tomorrow...")
        askTiasa(moment().add(1, 'day'))
        return
    }

    // Handle "day after"
    if (request.includes("day after")) {
        console.log("Checking for slots for day after...")
        askTiasa(moment().add(2, 'day'))
        return
    }

    // Handle a date, assuming format '1' or '1st'
    const requested_date = parseInt(request)
    if (requested_date) {
        console.log(`Checking for slots on a specific date: ${original_request}...`)

        var date_to_ask = moment().date(requested_date)
        if (date_to_ask.isBefore(moment())) {
            date_to_ask = date_to_ask.add(1, 'month')
        }
        askTiasa(date_to_ask)
        return
    }
    
    // Handle relative dates
    var weeks_to_add = 0

    if (request.includes("this") || 
        request.includes("next") || 
        request.includes("coming")) {
        // For all these, we will just get whichever day closest to moment()
        request = request
            .replace("this", "")
            .replace("next", "")
            .replace("coming", "").trim()
        // weeks_to_add remains at 0
    }
    
    // Handles cases like "next next sunday"
    while (request.includes("next")) {
        request = request.replace("next", "").trim()
        weeks_to_add++
    }
    
    const day = findDay(request)
    
    if (day.length === 0) {
        // Handles cases like "next weekend" or "next next weekend"
        if (request.includes("weekend")) {
            console.log(`Checking for slots for ${original_request}...`)
            askTiasa(moment().day(weeks_to_add * 7 + 6))
            askTiasa(moment().day(weeks_to_add * 7 + 7))
        } else {
            console.log("Not sure what you meant there...")
        }
        return
    }

    var date_to_ask = moment().add(weeks_to_add, 'week').day(day)
    if (date_to_ask.isBefore(moment()) || date_to_ask.isSame(moment(), 'day')) {
        date_to_ask = date_to_ask.add(1, 'week')
    }
    askTiasa(date_to_ask)
}

var message = ""
if (process.argv.length > 2) {
    message = process.argv.slice(2).join(' ')
}

handleRequest(message)
