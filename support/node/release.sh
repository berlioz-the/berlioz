cat << EOF

 ▄▄▄▄   ▓█████  ██▀███   ██▓     ██▓ ▒█████  ▒███████▒
▓█████▄ ▓█   ▀ ▓██ ▒ ██▒▓██▒    ▓██▒▒██▒  ██▒▒ ▒ ▒ ▄▀░
▒██▒ ▄██▒███   ▓██ ░▄█ ▒▒██░    ▒██▒▒██░  ██▒░ ▒ ▄▀▒░
▒██░█▀  ▒▓█  ▄ ▒██▀▀█▄  ▒██░    ░██░▒██   ██░  ▄▀▒   ░
░▓█  ▀█▓░▒████▒░██▓ ▒██▒░██████▒░██░░ ████▓▒░▒███████▒
░▒▓███▀▒░░ ▒░ ░░ ▒▓ ░▒▓░░ ▒░▓  ░░▓  ░ ▒░▒░▒░ ░▒▒ ▓░▒░▒
▒░▒   ░  ░ ░  ░  ░▒ ░ ▒░░ ░ ▒  ░ ▒ ░  ░ ▒ ▒░ ░░▒ ▒ ░ ▒
 ░    ░    ░     ░░   ░   ░ ░    ▒ ░░ ░ ░ ▒  ░ ░ ░ ░ ░
 ░         ░  ░   ░         ░  ░ ░      ░ ░    ░ ░
      ░                                      ░


EOF

MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
echo "My Dir: $MY_DIR"

if [[ "$(uname -s)" == CYGWIN* ]]; then
    echo 'CYGWIN DETECTED'
    MY_DIR=`cygpath -w $MY_DIR`
    echo "My Dir: $MY_DIR"
fi

# docker login

cd $MY_DIR/9
docker build . -t berlioz-node-9
docker tag berlioz-node-9 berliozcloud/node-9
docker push berliozcloud/node-9

# docker logout