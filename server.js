const http = require('http');
const fs = require('fs');
const request = require('snekfetch');
const marked = require('marked');
const querystring = require('querystring');

const isSemver = (s) => /^(\d+\.)?(\d+\.)?(\*|\d+)(-[a-zA-Z0-9]+?)?$/.test(s);

const vcache = {};
const cmap = {
  latest: 'release',
  lts: 'release',
  rc: 'rc',
  nightly: 'nightly',
  default: 'release',
};

const template = fs.readFileSync('./template.sh').toString();
const t = (v, c = v, i = '/usr/local') => {
  console.log(`Generating ${c}/${v}`); // eslint-disable-line no-console
  return template
    .replace(/{{VERSION}}/g, `v${v.replace('v', '')}`)
    .replace(/{{CHANNEL}}/g, cmap[c] || cmap.default)
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

async function ensureVersion(channel) {
  const i = vcache[channel];
  if (!i || (i && Date.now() - i.time > 600000)) {
    const url = `https://nodejs.org/download/${cmap[channel] || cmap.default}/index.json`;
    const versions = await request.get(url).then((r) => r.body);
    switch (channel) {
      case 'latest':
      case 'nightly':
      case 'rc': {
        const version = versions[0].version;
        vcache[channel] = { time: Date.now(), version };
        return version;
      }
      case 'lts': {
        const version = versions.find((v) => v.lts).version;
        vcache.lts = { time: Date.now(), version };
        return version;
      }
    }
  } else {
    return i.version;
  }
}

const server = http.createServer(async(req, res) => {
  let [url, query] = req.url.slice(1).split('?');
  query = query ? querystring.parse(query) : {};
  switch (url) {
    case 'favicon.ico':
      res.writeHead(404);
      res.end();
      break;
    case '': {
      const ua = req.headers['user-agent'];
      if (!/Wget|curl/.test(ua)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(index.rendered);
      } else {
        res.end(index.striped);
      }
      break;
    }
    case 'latest':
    case 'lts':
    case 'nightly':
    case 'rc': {
      const version = await ensureVersion(url);
      res.end(t(version, url, query.dir));
      break;
    }
    default:
      if (isSemver(url)) {
        res.end(t(url, url, query.dir));
      } else {
        res.writeHead(404);
        res.end();
      }
  }
});

server.listen(1337);
