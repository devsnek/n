'use strict';

const http = require('http');
const fs = require('fs');
const request = require('snekfetch');
const marked = require('marked');
const querystring = require('querystring');

const isSemver = (s) => /^(\d+\.)?(\d+\.)?(\*|\d+)(-[a-zA-Z0-9]+?)?$/.test(s);


const template = fs.readFileSync('./template.sh').toString();
const channelOverrideMap = {
  default: 'release',
  lts: 'release',
  latest: 'release',
};

const t = (version, channel = version, i = '/usr/local') => {
  console.log(`Generating ${channel}/${version}`); // eslint-disable-line no-console
  return template
    .replace(/{{VERSION}}/g, `v${version.replace('v', '')}`)
    .replace(/{{CHANNEL}}/g, channel)
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
      res.end(t(url, 'release', query.dir));
    } else {
      const channel = channelOverrideMap[url] || url;
      const json = `https://nodejs.org/download/${channel}/index.json`;
      const versions = await request.get(json).then((r) => r.body);
      const { version } = url === 'lts' ? versions.find((v) => v.lts) : versions[0];

      res.end(t(version, channel, query.dir));
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('500 Server Error');
  }
});

const dev = /^dev/.test(process.env.NODE_ENV);

const sock = '/tmp/n.sock';
server.listen(dev ? 8080 : sock);
if (!dev)
  fs.chmodSync(sock, 666);

process.on('SIGINT', () => {
  server.close();
});
