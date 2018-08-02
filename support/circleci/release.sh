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

cd $MY_DIR/berlioz-cli
docker build . -t berlioz-circleci-cli
docker tag berlioz-circleci-cli berliozcloud/circleci-cli
docker push berliozcloud/circleci-cli