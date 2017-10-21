const http = require('http');
const fs = require('fs');
const request = require('snekfetch');
const marked = require('marked');

const template = fs.readFileSync('./template.sh').toString();
const t = (v, c) => {
  console.log(`Generating ${c}/${v}`); // eslint-disable-line no-console
  return template
    .replace(/{{VERSION}}/g, `v${v.replace('v', '')}`)
    .replace(/{{CHANNEL}}/g, c);
};

const readme = fs.readFileSync('./README.md').toString();
const index = {
  rendered: marked(readme),
  striped: readme
    .replace(/^#{1,5} /gm, '')
    .replace(/\[.+?\]\(.+?\)/g, '')
    .trim(),
};

const vcache = {};

async function ensureVersion(channel) {
  const i = vcache[channel];
  if (!i || (i && Date.now() - i.time > 600000)) {
    const url = channel === 'nightly' ?
      'https://nodejs.org/download/nightly/index.json' :
      'https://nodejs.org/dist/index.json';
    const versions = await request.get(url).then((r) => r.body);
    switch (channel) {
      case 'latest':
      case 'nightly': {
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
  const url = req.url.slice(1);
  switch (url) {
    case 'favicon.ico':
      res.writeHead(404);
      res.end();
      break;
    case '': {
      const ua = req.headers['user-agent'];
      if (!/Wget|curl/.test(ua)) res.end(index.rendered);
      else res.end(index.striped);
      break;
    }
    case 'latest':
    case 'lts':
    case 'nightly': {
      const version = await ensureVersion(url);
      res.end(t(version, url === 'nightly' ? 'nightly' : 'release'));
      break;
    }
    default:
      res.end(t(url, 'release'));
  }
});

server.listen(1337);
