from telegram.ext import Updater, CommandHandler

import re
import requests
import datetime
from bs4 import BeautifulSoup


def get_nearest(day_of_week):
    """Gets the nearest day after today for day of week.

    day_of_week = 0 for Monday,
    day_of_week = 6 for Sunday
    """

    date = datetime.datetime.today()

    while date.weekday() != day_of_week:
        date += datetime.timedelta(days=1)

    return date


def is_reasonable_time(time_s):
    if "am" in time_s:
        m = re.match(r'(\d+):', time_s)
        if m:
            time = int(m.group(1))
            return (time >= 10 and
                    time != 12)
    elif "pm" in time_s:
        m = re.match(r'(\d+):', time_s)
        if m:
            return int(m.group(1)) <= 10
    else:
        return False


def ask_tiasa(date):
    request_data = 'wc_bookings_field_duration=2&wc_bookings_field_start_date_year={:04d}&wc_bookings_field_start_date_month={:02d}&wc_bookings_field_start_date_day={:02d}&wc_bookings_field_start_date_time=&addon-133-stick-rental%5Baddons-total%5D=&add-to-cart=133'.format(date.year, date.month, date.day)

    data = [
      ('action', 'wc_bookings_get_blocks'),
      ('form', request_data),
    ]

    r = requests.post('http://www.tiasafloorball.com/wp-admin/admin-ajax.php',
                      data=data)

    print "Raw:", r.text

    soup = BeautifulSoup(r.text, 'html.parser')

    return [t.contents[0] for t in soup.find_all('a')]


def start(bot, update):
    update.message.reply_text("Hello! Type /check to check "
                              "this weekend's availability")


def check(bot, update):
    print "Received request"
    message = ("Available one hour blocks with starting time between "
               "10 am and 10 pm:\n\n")

    date = get_nearest(5)
    print "Asking for Saturday info"
    times = [t for t in ask_tiasa(date) if is_reasonable_time(t)]
    print "Got Saturday info"
    if len(times) == 0:
        times_message = "No available times."
    else:
        times_message = "\n".join(["+ {}".format(t) for t in times])
    message += "Saturday ({}):\n{}".format(date.strftime("%Y/%m/%d"),
                                           times_message)

    date = get_nearest(6)
    print "Asking for Sunday info"
    times = [t for t in ask_tiasa(date) if is_reasonable_time(t)]
    print "Got Sunday info"
    if len(times) == 0:
        times_message = "No available times."
    else:
        times_message = "\n".join(["+ {}".format(t) for t in times])
    message += "\n\nSunday ({}):\n{}".format(date.strftime("%Y/%m/%d"),
                                             times_message)

    print repr(message)

    update.message.reply_text(message)


updater = Updater('313930958:AAHW4WB9QyDc4jZjdXovES8ymiZXRaUCuzc')

updater.dispatcher.add_handler(CommandHandler('start', start))
updater.dispatcher.add_handler(CommandHandler('check', check))

updater.start_polling()
updater.idle()
