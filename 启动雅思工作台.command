#!/bin/zsh
cd "${0:A:h}"
if [[ ! -f dist-cloudstudio/index.html ]]; then
  npm run build:cloudstudio || exit 1
fi
npm run start:local
