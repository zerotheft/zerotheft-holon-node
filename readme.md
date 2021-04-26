# Initial Setup and Starting your server

* Make sure that you setup the config files from sample config files.
```
yarn install
yarn start
```

# Production Build and Deployment
* Make sure that you build the holon frontend react project first
* Make sure that you fetch the latest contract address and implementation via command below
```
yarn fetch-contract

```
* Make sure you install dependecies
```
npm i pkg -g
```
* Build the frontend packages
* For Testnet
```
yarn build-staging
```
* For Private Net
```
yarn build-private
```
* Now execute the following command to create the main deb package file
```
yarn pkg
```
* upload with deb command
* For Testnet
```
deb-s3 upload debinstall/zerotheft-holon-${VERSION}_amd64.deb --prefix releases --bucket zerotheft-holon"
```
* For Privatenet
```
deb-s3 upload debinstall/zerotheft-holon-${VERSION}_amd64.deb --prefix releases --bucket zerotheft-holon-private"
```

* The software of autoupdated after you push the file