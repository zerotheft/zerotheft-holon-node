# Backend repo for Zerotheft Holon
* APIs and Calc Engine logic for Zerotheft Report Generation using LaTex

# Setup and Installation Instructions
* Make sure `zerotheft-cli` is installed and setup.
* Create your own config file `config.json` from config.json.example
* Create symbolic link linking this project directory `zerotheft-holon-node` to `.zerotheft/Zerotheft-Holon/holon-api` directory.
* Using zerotheft-cli switch to development environment
```
zerotheft change-env --env development
```
* Install `zerotheft-node-utils` which is sub-modules needed for this repo.

```
yarn init-utils
```

* Install required node modules
```
yarn install
```
* Create `zt_report` directory inside `.zerotheft` directory if it does not exist
```
cd .zerotheft
mkdir zt_report
```
* Finally start the server
```
yarn start
```
