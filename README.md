# tiasa-checker Telegram Bot

Check availability of the floorball court this weekend on http://www.valhall.asia/!

I'm running this on https://webtask.io/. Thank you so much, webtask! :)

Add this bot at https://t.me/tiasa_checker_bot!

## Commands

These commands should do what you expect it to do:

(non-exhaustive list, but you get the idea)

+ `/check` (Checks for next weekend)
+ `/check this weekend`
+ `/check coming weekend`
+ `/check next weekend`
+ `/check next next weekend`
+ `/check next monday`
+ `/check next tue`
+ `/check this wed`
+ `/check coming thursday`
+ `/check 1st`
+ `/check 30`
+ `/check today`
+ `/check tomorrow`
+ `/check day after`

If you used a command and the bot didn't give you a satisfactory response, please let me know

+ The command you used
+ The date you ran the command
+ What the response was
+ What you thought the response should be

## Development

Go to the project directory, and do

```
yarn install
```

## Exercising the bot

If you want to exercise bot code without going through telegram, do

```
./main.js /check
```

If you want to test the webhook by posting to it, use [httpie](https://httpie.org/) while watching the logs.

Do

```
wt logs
```

in one terminal window, and then

```
http -j POST https://wt-ed91a750cc644b077ae35f82e3324df2-0.sandbox.auth0-extend.com/tiasa-checker-webhook @httpie.json
```

(this uses the webhook I registered for this telegram bot) in another.

You should see something like this:

```
[13:58:39.819Z]  INFO wt: new webtask request 1525183119621.327407
[13:58:40.161Z]  INFO wt:
    Saw |/check| from 00000000
    Checking for slots for this weekend...
[13:58:40.176Z]  INFO wt: finished webtask request 1525183119621.327407 with HTTP 200 in 436ms
[13:58:43.299Z]  INFO wt:
    Saturday, May 5th 2018:
    + 11:30 am: Court 2
    + 1:00 pm: Court 2
    + 1:30 pm: Court 2
    + 2:00 pm: Court 1, Court 2
    + 2:30 pm: Court 1, Court 2
    + 3:00 pm: Court 1, Court 2
    + 3:30 pm: Court 1
    + 4:00 pm: Court 1
    + 4:30 pm: Court 1
    + 5:00 pm: Court 1
    + 5:30 pm: Court 1
    + 6:00 pm: Court 1, Court 2
    + 6:30 pm: Court 1, Court 2
    + 7:00 pm: Court 1, Court 2
    + 7:30 pm: Court 1, Court 2
    + 8:00 pm: Court 1, Court 2
    + 8:30 pm: Court 1, Court 2
    + 9:00 pm: Court 1, Court 2
    + 9:30 pm: Court 1, Court 2
[13:58:44.323Z]  INFO wt:
    Sunday, May 6th 2018:
    + 1:30 pm: Court 1
    + 2:00 pm: Court 1
    + 2:30 pm: Court 1
    + 3:00 pm: Court 1
    + 4:00 pm: Court 2
    + 4:30 pm: Court 2
    + 5:00 pm: Court 2
    + 5:30 pm: Court 2
    + 6:00 pm: Court 1, Court 2
    + 6:30 pm: Court 1, Court 2
    + 7:00 pm: Court 1, Court 2
    + 7:30 pm: Court 1, Court 2
    + 8:00 pm: Court 1, Court 2
    + 8:30 pm: Court 1, Court 2
    + 9:00 pm: Court 1, Court 2
    + 9:30 pm: Court 1, Court 2
```

## Deployment

It seems like using `wt update` causes the secrets to be erased, so use this instead:

```
wt create --name tiasa-checker-webhook --secret botApiKey=<bot api key goes here> webtask.js
```

## Full Setup

If you'd like to create a bot, you'd have to go to the BotFather and ask for an API token.

https://webtask.io/docs/wt-cli will help you to administer your webtask.

After setting up with webtask, notify telegram with

```
curl -X POST -H "Content-Type: multipart/form-data" -F "url=<the webtask url>" 'https://api.telegram.org/bot<your bot api token>/setWebhook'
```

# Credits

Thanks @ http://iamlee.ch/posts/2015-07-29-webtask-telegram-bot.html !!
