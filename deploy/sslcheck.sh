#!/bin/bash
echo "==CERT SERVED (SNI aiagent)=="
echo | openssl s_client -connect 127.0.0.1:443 -servername aiagent.webtrendsetter.com 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null

echo "==CHAIN VERIFY=="
echo | openssl s_client -connect 127.0.0.1:443 -servername aiagent.webtrendsetter.com 2>/dev/null | grep "Verify return"

echo "==CERTS IN FULLCHAIN=="
grep -c "BEGIN CERTIFICATE" /etc/letsencrypt/live/aiagent.webtrendsetter.com/fullchain.pem

echo "==ENABLED CONF WITH DOMAIN=="
grep -rl "aiagent.webtrendsetter.com" /etc/nginx/sites-enabled/

echo "==HTTP REDIRECT=="
curl -s -o /dev/null -w "http->  %{http_code} redirect=%{redirect_url}\n" http://aiagent.webtrendsetter.com/aircep/ --resolve aiagent.webtrendsetter.com:80:127.0.0.1

echo "==HTTPS AIRCEP=="
curl -s -o /dev/null -w "https-> %{http_code}\n" https://aiagent.webtrendsetter.com/aircep/ --resolve aiagent.webtrendsetter.com:443:127.0.0.1

echo "==HTTPS ROOT=="
curl -s -o /dev/null -w "https-root-> %{http_code}\n" https://aiagent.webtrendsetter.com/ --resolve aiagent.webtrendsetter.com:443:127.0.0.1
