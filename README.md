# tiasa-checker Telegram Bot

Check availability of the floorball court this weekend on http://www.tiasafloorball.com/!

I'm running this on https://webtask.io/. Thank you so much, webtask! :)

Add this bot at https://t.me/tiasa_checker_bot!

# Setting up

Go to the project directory, and do

```
yarn install
```

# Usage

If you want to just ping http://www.tiasafloorball.com/ with node, try

```
./main.js
```

# Full Setup

If you'd like to create a bot, you'd have to go to the BotFather and ask for an API token.

https://webtask.io/docs/wt-cli will help you to administer your webtask.

After setting up with webtask, notify telegram with

```
curl -X POST -H "Content-Type: multipart/form-data" -F "url=<the webtask url>" 'https://api.telegram.org/bot<your bot api token>/setWebhook'
```

I used the webui to configure my bot's API token, accessed using `ctx.secrets.botApikey`.

Most useful command from here on (probably)

```
wt update tiasa-checker-webhook webtask.js
```


# Credits

Thanks @ http://iamlee.ch/posts/2015-07-29-webtask-telegram-bot.html !!