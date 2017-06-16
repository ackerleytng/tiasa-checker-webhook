#! /usr/bin/env node

const moment = require('moment');
const request = require('request');
const cheerio = require('cheerio');

const isReasonableTime = function(time) {
    if (time.includes("am")) {
        const t = parseInt(time);
        return t >= 10 && t != 12;
    } else if (time.includes("pm")) {
        return parseInt(time) <= 9;
    } else {
        return false
    }
}

const getTimes = function(reply) {
    const $ = cheerio.load(reply);
    var data = $('a').map(function(i, e) { return $(this).text() }).get();
    data = data.filter(isReasonableTime)
    return data;
}

const makeStringFromTimes = function(times) {
    if (times.length == 0) {
        return "No available slots.";
    } else {
        return times.map(function(e) { return `+ ${e}`}).join('\n');
    }
}

const askTiasa = function(date) {
    
    var dataString = `wc_bookings_field_duration=2&wc_bookings_field_start_date_year=${date.format('YYYY')}&wc_bookings_field_start_date_month=${date.format('MM')}&wc_bookings_field_start_date_day=${date.format('DD')}&wc_bookings_field_start_date_time=&addon-133-stick-rental%5Baddons-total%5D=&add-to-cart=133`;

    var data = {
        'action': 'wc_bookings_get_blocks',
        'form': dataString
    };
    
    var url = 'http://www.tiasafloorball.com/wp-admin/admin-ajax.php';

    function callback(error, response, body) {
        if (!error && response.statusCode == 200) {
            // console.log(body);
            const times = getTimes(body);
            
            const day = date.format('dddd, MMMM Do YYYY');
            const timesString = makeStringFromTimes(times);
            const message = `${day}:\n${timesString}`;
            console.log(message);
        }
    }

    request.post(url, callback).form(data);
}

console.log('Checking for slots between 10am and 10pm this weekend...');
askTiasa(moment().day(6));
askTiasa(moment().day(7));
