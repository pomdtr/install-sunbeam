import shlex from "npm:shlex";

const script = (tag: string) => `#!/bin/sh
# This script installs sunbeam.
#
# Quick install: 'curl -sSf https://install-sunbeam.deno.dev | sh'
# inspired by https://sshx.io/ install script

set -eu

tag=${shlex.quote(tag)}
system=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)

tempdir=$(mktemp -d)
trap 'rm -rf $tempdir' EXIT

url="https://github.com/pomdtr/sunbeam/releases/download/\${tag}/sunbeam-\${system}_\${arch}.tar.gz"
printf "↯ Downloading sunbeam from %s\\n" "$url"
http_code=$(curl -L "$url" -o "$tempdir/sunbeam.tar.gz" -w "%{http_code}")
if [ "$http_code" -lt 200 ] || [ "$http_code" -gt 299 ]; then
  printf "Error: Request had status code %s.\\n" "$http_code" 1>&2
  cat "$tempdir/sunbeam.tar.gz" 1>&2
  exit 1
fi

tar zxf "$tempdir/sunbeam.tar.gz" -C "$tempdir"
printf "\\n↯ Adding sunbeam binary to /usr/local/bin\\n"
if [ "$(id -u)" -ne 0 ]; then
  sudo mv "$tempdir/sunbeam" /usr/local/bin/sunbeam
else
  mv "$tempdir/sunbeam" /usr/local/bin/sunbeam
fi

printf "\\n↯ Done! You can now run sunbeam.\\n"
`;

async function installSunbeam(request: Request): Promise<Response> {
  const githubToken = Deno.env.get("GITHUB_TOKEN")
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is required")
  }

  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  let tag = params.get("tag");
  if (!tag) {
    const resp = await fetch("https://api.github.com/repos/pomdtr/sunbeam/releases", {
      headers: {
        "User-Agent": "install-sunbeam.deno.dev",
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${githubToken}`
      }
    })
    const releases = await resp.json()
    if (releases.length == 0) {
      return new Response("Not Found", {
        status: 404,
      });
    }
    tag = releases[0].tag_name
  }

  return new Response(script(tag!), {
    headers: {
      "Content-Type": "application/x-shellscript",
    },
  });
}

Deno.serve(installSunbeam);
