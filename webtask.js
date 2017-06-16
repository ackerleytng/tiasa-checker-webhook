const request = require('request');
const moment = require('moment');
const cheerio = require('cheerio');

const getBaseUrl = function(ctx) {
    return `https://api.telegram.org/bot${ctx.secrets.botApiKey}/`;
}

const sendMessage = function(ctx, chatId, message) {
    request.post(`${getBaseUrl(ctx)}sendMessage`, {
        form: {
            'chat_id': chatId,
            'text': message
        }
    })
}

const isReasonableTime = function(time) {
    if (time.includes("am")) {
        const t = parseInt(time);
        return t >= 10 && t != 12;
    } else if (time.includes("pm")) {
        // 9 because 9:30 is the last slot beginning before 10 pm
        return parseInt(time) <= 9;
    } else {
        return false
    }
}

const getTimes = function(reply) {
    const $ = cheerio.load(reply);
    return $('a').map(function(i, e) { return $(this).text() }).get()
        .filter(isReasonableTime);
}

const makeStringFromTimes = function(times) {
    var timeslots = [];

    for (var time in times) {
        timeslots.push([time, times[time]]);
    }
    
    if (timeslots.length == 0) {
        return "No available slots.";
    } else {
        return timeslots.sort(function(a, b) {
            function convert(string) {
                return moment(`2000-01-01 ${string}`, 'YYYY-MM-DD h:mm a');
            }
            return convert(a).diff(convert(b));
        })
            .map(function(e) { return [e[0], e[1].map(function (x) { return `Court ${x}`; })
                                                 .join(', ')]; })
            .map(function(e) { return `+ ${e[0]}: ${e[1]}`; })
            .join('\n');
    }
}

const askTiasa = function(ctx, chat, date) {
    function buildData(date, court) {
        const representation = {
            1: 133,
            2: 151
        }
    
        const dataString = `wc_bookings_field_duration=2&wc_bookings_field_start_date_year=${date.format('YYYY')}&wc_bookings_field_start_date_month=${date.format('MM')}&wc_bookings_field_start_date_day=${date.format('DD')}&wc_bookings_field_start_date_time=&addon-${representation[court]}-stick-rental%5Baddons-total%5D=&add-to-cart=${representation[court]}`;

        return {
            'action': 'wc_bookings_get_blocks',
            'form': dataString
        };
    }

    var url = 'http://www.tiasafloorball.com/wp-admin/admin-ajax.php';

    var times = {};

    function callbackCourt2(error, response, body) {
        if (!error && response.statusCode == 200) {
            getTimes(body).forEach(function(e, i) {
                if (e in times) {
                    times[e].push(2);
                } else {
                    times[e] = [2];
                }
            });
            
            const day = date.format('dddd, MMMM Do YYYY');
            const timesString = makeStringFromTimes(times);
            const message = `${day}:\n${timesString}`;
            sendMessage(ctx, chat, message);
        }
    }
    
    function callbackCourt1(error, response, body) {
        if (!error && response.statusCode == 200) {
            getTimes(body).forEach(function(e, i) {
                times[e] = [1];
            });
            
            request.post(url, callbackCourt2).form(buildData(date, 2));
        }
    }
    
    request.post(url, callbackCourt1).form(buildData(date, 1));
}

module.exports = function(ctx, cb) {
    var command = ctx.data.message.text;
    var chat = ctx.data.message.chat.id;
    
    console.log(`Saw ${command} from ${chat}`);
    
    // intercept command /check
    if (command !== undefined && command.lastIndexOf('/check', 0) === 0) {
        // response message
        sendMessage(ctx, chat, 'Checking for slots between 10am and 10pm this weekend...');
        
        askTiasa(ctx, chat, moment().day(6));
        askTiasa(ctx, chat, moment().day(7));
    }
    
    cb(null, {status: 'ok'});
};
