import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
export function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
export function validatePublicUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw Error('请输入完整的 HTTPS 网页或音频链接');
  }
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    (u.port && u.port !== '443') ||
    u.hostname === 'localhost' ||
    u.hostname.endsWith('.local') ||
    u.hostname.endsWith('.localhost') ||
    isIP(u.hostname.replaceAll('[', '').replaceAll(']', ''))
  )
    throw Error(
      '仅支持公网 HTTPS 域名链接，不支持本机、内网或带登录凭据的地址',
    );
  return u;
}
export async function fetchPublic(
  value,
  { limit = 25 * 1024 * 1024, redirects = 0 } = {},
) {
  const u = validatePublicUrl(value);
  if (redirects > 4) throw Error('网页重定向次数过多');
  const addresses = await lookup(u.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIPv4(a.address)))
    throw Error('该域名不是可读取的公网地址');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    let done = false;
    const finishError = (e) => {
      if (!done) {
        done = true;
        reject(e);
      }
    };
    const req = request(
      u,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'IELTS-Study-Workbench/1.0 (personal reading import)',
          Accept: 'text/html,text/plain,audio/*;q=0.9,*/*;q=0.5',
          'Accept-Encoding': 'identity',
        },
        lookup: (_host, opts, cb) => {
          if (opts.all) cb(null, [{ address: pinned.address, family: 4 }]);
          else cb(null, pinned.address, 4);
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const location = res.headers.location;
          res.resume();
          if (!location) {
            finishError(Error('网页跳转地址缺失'));
            return;
          }
          done = true;
          clearTimeout(timer);
          fetchPublic(new URL(location, u).href, {
            limit,
            redirects: redirects + 1,
          }).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          finishError(
            Error(
              `网站返回 ${res.statusCode}，可能需要登录或不允许读取。可换用公开文章链接。`,
            ),
          );
          return;
        }
        if (Number(res.headers['content-length']) > limit) {
          res.destroy();
          finishError(Error('链接内容超过 25 MB，请改用上传功能'));
          return;
        }
        let size = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > limit) {
            finishError(Error('链接内容超过 25 MB，请改用上传功能'));
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (!done) {
            done = true;
            resolve({
              url: u.href,
              mime: String(res.headers['content-type'] || '')
                .split(';')[0]
                .trim(),
              body: Buffer.concat(chunks),
            });
          }
        });
        res.on('error', finishError);
      },
    );
    const timer = setTimeout(() => {
      finishError(Error('读取超时，请重试或换一个链接'));
      req.destroy();
    }, 25000);
    req.on('error', () =>
      finishError(Error('无法连接该网站，请检查网络或换一个公开链接')),
    );
    req.on('close', () => clearTimeout(timer));
    req.end();
  });
}
