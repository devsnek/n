'use strict';

const http = require('http');
const fs = require('fs');
const request = require('snekfetch');
const marked = require('marked');
const querystring = require('querystring');

const isSemver = (s) => /^(\d+\.)?(\d+\.)?(\*|\d+)(-[a-zA-Z0-9]+?)?$/.test(s);

const channelOverrideMap = {
  default: 'release',
  lts: 'release',
  latest: 'release',
};

const template = fs.readFileSync('./template.sh').toString();
const t = (v, c = v, i = '/usr/local') => {
  console.log(`Generating ${c}/${v}`); // eslint-disable-line no-console
  return template
    .replace(/{{VERSION}}/g, `v${v.replace('v', '')}`)
    .replace(/{{CHANNEL}}/g, channelOverrideMap[c] || c)
    .replace(/{{INSTALL_DIR}}/g, i);
};

const readme = fs.readFileSync('./README.md').toString();
const index = {
  rendered: marked(readme),
  striped: readme
    .replace(/^#{1,5} /gm, '')
    .replace(/\[.+?\]\(.+?\)/g, '')
    .trim(),
};

const server = http.createServer(async (req, res) => {
  try {
    let [url, query] = req.url.slice(1).split('?');
    query = query ? querystring.parse(query) : {};

    if (url === 'favicon.ico') {
      res.writeHead(404);
      res.end();
      return;
    }

    if (url === '') {
      const ua = req.headers['user-agent'];
      if (!/Wget|curl/.test(ua)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(index.rendered);
      } else {
        res.end(index.striped);
      }
    }


    if (isSemver(url)) {
      res.end(t(url, url, query.dir));
    } else {
      const json = `https://nodejs.org/download/${channelOverrideMap[url] || url}/index.json`;
      const versions = await request.get(json).then((r) => r.body);
      const { version } = url === 'lts' ? versions.find((v) => v.lts) : versions[0];

      res.end(t(version, url, query.dir));
    }
  } catch (err) {
    res.writeHead(500);
    res.end('500 Server Error');
  }
});

server.listen('/tmp/n.sock');

process.on('SIGINT', () => {
  server.close();
});
