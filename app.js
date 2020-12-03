/* eslint-disable no-console */

var dotenv = require('dotenv');
const path = require('path');
const url = require('url');
dotenv.config()

const set = require('lodash/set');
const express = require('express'); // eslint-disable-line import/no-unresolved
const helmet = require('helmet');

const { Provider } = require('oidc-provider');

const Account = require('./support/account');
const configuration = require('./support/configuration');
const routes = require('./routes/auth');

const { PORT = 3000, ISSUER = `http://127.0.0.1:${PORT}` } = process.env;
configuration.findAccount = Account.findAccount;

const app = express();
app.use(helmet());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

let server;
(async () => {
    let adapter;
    if (process.env.REDIS_URL) {
        adapter = require('./adapters/redis'); // eslint-disable-line global-require
    }

    const provider = new Provider(ISSUER, { adapter, ...configuration });

    if (process.env.NODE_ENV === 'production') {
        app.enable('trust proxy');
        provider.proxy = true;
        set(configuration, 'cookies.short.secure', true);
        set(configuration, 'cookies.long.secure', true);

        app.use((req, res, next) => {
            if (req.secure) {
                next();
            } else if (req.method === 'GET' || req.method === 'HEAD') {
                res.redirect(url.format({
                    protocol: 'https',
                    host: req.get('host'),
                    pathname: req.originalUrl,
                }));
            } else {
                res.status(400).json({
                    error: 'invalid_request',
                    error_description: 'do yourself a favor and only use https',
                });
            }
        });
    }

    app.get("/", (req, res) => {
        res.send('Home Page');
    })
    routes(app, provider);
    app.use(provider.callback);
    server = app.listen(PORT, () => {
        console.log(`application is listening on port ${PORT}, check its /.well-known/openid-configuration`);
    });
})().catch((err) => {
    if (server && server.listening) server.close();
    console.error(err);
    process.exitCode = 1;
});
