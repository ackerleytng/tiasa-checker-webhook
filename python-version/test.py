import requests
import datetime
from bs4 import BeautifulSoup
import re


def get_nearest(day_of_week):
    """Gets the nearest day after today for day of week.

    day_of_week = 0 for Monday,
    day_of_week = 6 for Sunday
    """

    date = datetime.datetime.today()

    while date.weekday() != 5:
        date += datetime.timedelta(days=1)

    return date


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


saturday = get_nearest(5)
print [t for t in ask_tiasa(saturday) if is_reasonable_time(t)]
