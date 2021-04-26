#!/bin/bash
TIME_STAMP=$(date "+%s")
VERSION=$(jq .version ./package.json |sed 's/"//g')
RELEASE_LOG=debinstall/releases/release-private.json
DEBIAN_CONFIG=debinstall/zerotheft-holon/DEBIAN/control
SERVICE_FILE=debinstall/zerotheft-holon/etc/systemd/system/zerotheft-holon.service
REACT_PACKAGE_JSON=../zerotheft-holon-react/package.json
SOURCE_LIST_FILE=debinstall/zerotheft-holon/opt/.zerotheft/source.json
NEW_PKG=debinstall/zerotheft-holon-${VERSION}_amd64.deb

echo -e "\e[1m *********Releasing HOLON-${VERSION}*********\e[0m"

echo -e "\033[32mStep 1: Updating version number...\e[0m"
sed -i "2s/.*/Version: $VERSION/" $DEBIAN_CONFIG
sed -i "3s/.*/\"version\": \"$VERSION\",/" $REACT_PACKAGE_JSON

echo -e "\033[32mStep 2: Building frontend package...\e[0m"
yarn --cwd ../zerotheft-holon-react build-private

echo "setting up the environment as PRIVATE"
sed -i -E 's/( Environment=NODE_ENV=)[a-z]+/\1private/g'  $SERVICE_FILE
sed -i -E 's/(https:\/\/zerotheft-holon-)[a-z]+(.s3.us-east-1.amazonaws.com\/releases stable main)/\1private\2/g' $SOURCE_LIST_FILE

echo -e "\033[32mStep 4: Building debian package...\e[0m"
yarn pkg

cp debinstall/zerotheft-holon.deb ${NEW_PKG}
echo -e "\033[32mStep 5: File renamed...".${NEW_PKG}."\e[0m"

echo -e "\033[32mStep 5: Deploying in s3...\e[0m"
deb-s3 upload ${NEW_PKG} --prefix releases --bucket zerotheft-holon-private

echo -e "\033[32mStep 6: Deploy release log...\e[0m"
echo "{\"version\":\"${VERSION}\", \"date\":\"${TIME_STAMP}\"}"> $RELEASE_LOG
aws s3 cp $RELEASE_LOG   s3://zerotheft-holon-private/releases/ --grants read=uri=http://acs.amazonaws.com/groups/global/AllUsers